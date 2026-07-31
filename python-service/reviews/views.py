"""
Reviews — medicine review CRUD (Django).

Same split as Module 8 (medicine_api) and Module 9 (chatbot): this service
owns the actual read/write against MongoDB, Node is just an authenticated
proxy in front of it (see server/controllers/reviewController.js). This
service has no auth/session system of its own and was never meant to be
reachable directly from a browser, so Node is responsible for verifying
who the logged-in user is before it ever calls in here — every write
below trusts the `userId` / `userName` / `isAdmin` values Node forwards
in the request body rather than re-deriving them from a token.

Reviews live in their own `reviews` collection (not on the medicine
document itself) so a busy medicine's review count never bloats the
document Node's /api/medicines endpoints already return. One review per
user per medicine — re-reviewing means editing the existing one (PUT),
not creating a second row.

    GET    /api/medicines/<medicine_id>/reviews   -> list + rating summary
    POST   /api/medicines/<medicine_id>/reviews   -> create (one per user)
    PUT    /api/reviews/<review_id>                -> edit (owner only)
    DELETE /api/reviews/<review_id>                -> delete (owner or admin)
"""

import json
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Connect to MongoDB from django settings (same shared database Node uses)
db = settings.MONGO_DB
reviews_collection = db.reviews

MAX_COMMENT_LENGTH = 1000


def health(request):
    """GET /health - Liveness check"""
    return JsonResponse({'status': 'ok', 'module': 'Reviews - Medicine Review CRUD'})


def _parse_object_id(raw_id):
    """Returns a bson ObjectId, or None if raw_id isn't a valid one."""
    try:
        return ObjectId(raw_id)
    except (InvalidId, TypeError):
        return None


def _serialize_review(doc):
    """Converts a Mongo review document into a JSON-safe dict — ObjectIds
    to strings, datetimes to ISO strings — matching how the rest of this
    service (see analytics/views.py's _json_safe) hands data back to Node."""
    return {
        'id': str(doc['_id']),
        'medicineId': doc['medicineId'],
        'userId': doc['userId'],
        'userName': doc.get('userName', 'Anonymous'),
        'rating': doc['rating'],
        'comment': doc.get('comment', ''),
        'createdAt': doc['createdAt'].isoformat() if isinstance(doc.get('createdAt'), datetime) else doc.get('createdAt'),
        'updatedAt': doc['updatedAt'].isoformat() if isinstance(doc.get('updatedAt'), datetime) else doc.get('updatedAt'),
    }


def _validate_rating_and_comment(body):
    """Shared validation for create/update. Returns (rating, comment, error)
    — error is a string to return as a 400 when validation fails, else None."""
    rating = body.get('rating')
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return None, None, 'rating must be an integer between 1 and 5'
    if rating < 1 or rating > 5:
        return None, None, 'rating must be an integer between 1 and 5'

    comment = (body.get('comment') or '').strip()
    if len(comment) > MAX_COMMENT_LENGTH:
        return None, None, f'comment must be {MAX_COMMENT_LENGTH} characters or fewer'

    return rating, comment, None


def _rating_summary(medicine_id):
    """Aggregates count/average/star-distribution for one medicine's reviews."""
    pipeline = [
        {'$match': {'medicineId': medicine_id}},
        {'$group': {'_id': '$rating', 'count': {'$sum': 1}}},
    ]
    distribution = {str(n): 0 for n in range(1, 6)}
    total = 0
    total_stars = 0
    for row in reviews_collection.aggregate(pipeline):
        stars = row['_id']
        count = row['count']
        distribution[str(stars)] = count
        total += count
        total_stars += stars * count

    average = round(total_stars / total, 1) if total else 0
    return {'count': total, 'average': average, 'distribution': distribution}


@csrf_exempt
def medicine_reviews(request, medicine_id):
    """GET  /api/medicines/<medicine_id>/reviews — list reviews + summary
    POST /api/medicines/<medicine_id>/reviews — create a review (one per user)
    """
    if _parse_object_id(medicine_id) is None:
        return JsonResponse({'error': 'Invalid medicine id'}, status=400)

    if request.method == 'GET':
        cursor = reviews_collection.find({'medicineId': medicine_id}).sort('createdAt', -1)
        reviews = [_serialize_review(doc) for doc in cursor]
        return JsonResponse({'reviews': reviews, 'summary': _rating_summary(medicine_id)})

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        user_id = (body.get('userId') or '').strip()
        user_name = (body.get('userName') or '').strip()
        if not user_id or not user_name:
            return JsonResponse({'error': 'userId and userName are required'}, status=400)

        rating, comment, error = _validate_rating_and_comment(body)
        if error:
            return JsonResponse({'error': error}, status=400)

        if reviews_collection.find_one({'medicineId': medicine_id, 'userId': user_id}):
            return JsonResponse(
                {'error': 'You have already reviewed this medicine. Edit your existing review instead.'},
                status=409,
            )

        now = datetime.now(timezone.utc)
        doc = {
            'medicineId': medicine_id,
            'userId': user_id,
            'userName': user_name,
            'rating': rating,
            'comment': comment,
            'createdAt': now,
            'updatedAt': now,
        }
        result = reviews_collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        return JsonResponse(_serialize_review(doc), status=201)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def review_detail(request, review_id):
    """PUT    /api/reviews/<review_id> — edit a review (owner only)
    DELETE /api/reviews/<review_id> — delete a review (owner or admin)
    """
    object_id = _parse_object_id(review_id)
    if object_id is None:
        return JsonResponse({'error': 'Invalid review id'}, status=400)

    review = reviews_collection.find_one({'_id': object_id})
    if not review:
        return JsonResponse({'error': 'Review not found'}, status=404)

    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    user_id = (body.get('userId') or '').strip()

    if request.method == 'PUT':
        # Edits are owner-only, even for admins — moderation is a delete,
        # not silently rewriting someone else's words.
        if not user_id or review['userId'] != user_id:
            return JsonResponse({'error': 'You can only edit your own review'}, status=403)

        rating, comment, error = _validate_rating_and_comment(body)
        if error:
            return JsonResponse({'error': error}, status=400)

        now = datetime.now(timezone.utc)
        reviews_collection.update_one(
            {'_id': object_id},
            {'$set': {'rating': rating, 'comment': comment, 'updatedAt': now}},
        )
        review.update({'rating': rating, 'comment': comment, 'updatedAt': now})
        return JsonResponse(_serialize_review(review))

    if request.method == 'DELETE':
        is_admin = bool(body.get('isAdmin'))
        if not user_id or (review['userId'] != user_id and not is_admin):
            return JsonResponse({'error': 'You can only delete your own review'}, status=403)

        reviews_collection.delete_one({'_id': object_id})
        return JsonResponse({'message': 'Review deleted', 'id': review_id})

    return JsonResponse({'error': 'Method not allowed'}, status=405)
