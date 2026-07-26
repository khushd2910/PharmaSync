import os
import re
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from bson import ObjectId
from bson.errors import InvalidId

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

from .knowledge_base import (
    DISCLAIMER,
    GREETING_RESPONSES,
    PRESCRIPTION_FAQ,
    DELIVERY_FAQ,
    FALLBACK_RESPONSE,
    match_symptom,
)

# Connect to MongoDB from django settings
db = settings.MONGO_DB

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')
GEMINI_URL = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'

# ---------------------------------------------------------------------------
# Intent detection — simple, explainable keyword rules rather than an ML
# classifier. Checked in priority order; the first match wins.
# ---------------------------------------------------------------------------
GREETING_WORDS = ('hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening')
ORDER_WORDS = ('order', 'track', 'shipment', 'where is my')
PRESCRIPTION_WORDS = ('prescription', 'rx ', 'upload prescription')
DELIVERY_WORDS = ('delivery', 'shipping', 'deliver')
RECOMMEND_WORDS = ('recommend', 'suggest', 'best medicine', 'what should i buy')
MEDICINE_WORDS = ('price', 'stock', 'available', 'tablet', 'syrup', 'medicine', 'capsule')


def detect_intent(message_lower):
    if any(message_lower.startswith(w) or message_lower == w for w in GREETING_WORDS):
        return 'greeting'
    if any(w in message_lower for w in ORDER_WORDS):
        return 'order_status'
    if any(w in message_lower for w in PRESCRIPTION_WORDS):
        return 'prescription_question'
    if any(w in message_lower for w in DELIVERY_WORDS):
        return 'delivery_question'
    if any(w in message_lower for w in RECOMMEND_WORDS):
        return 'recommendation'
    if match_symptom(message_lower):
        return 'symptom_advice'
    if any(w in message_lower for w in MEDICINE_WORDS):
        return 'medicine_question'
    return 'general_question'


# ---------------------------------------------------------------------------
# Per-intent handlers
# ---------------------------------------------------------------------------
def handle_order_status(user_id):
    if not user_id:
        return {'reply': "Please log in so I can look up your orders.", 'intent': 'order_status'}
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        return {'reply': "Please log in so I can look up your orders.", 'intent': 'order_status'}

    order = db.orders.find_one({'user': oid}, sort=[('createdAt', -1)])
    if not order:
        return {'reply': "I couldn't find any orders on your account yet.", 'intent': 'order_status'}

    reply = (
        f"Your most recent order ({order.get('invoiceNumber', 'N/A')}) is currently "
        f"'{order.get('orderStatus', 'Pending')}'."
    )
    if order.get('prescriptionRequired') and order.get('prescriptionStatus') != 'Approved':
        reply += f" It's also waiting on prescription review (status: {order.get('prescriptionStatus')})."
    return {
        'reply': reply,
        'intent': 'order_status',
        'data': {
            'invoiceNumber': order.get('invoiceNumber'),
            'orderStatus': order.get('orderStatus'),
            'prescriptionStatus': order.get('prescriptionStatus'),
        },
    }


# Filler words stripped off a medicine question before searching, e.g.
# "what's the price of paracetamol" -> "paracetamol"
_MEDICINE_FILLER = re.compile(
    r"\b(price|stock|available|availability|of|is|the|a|an|tablet|tablets|syrup|capsule|capsules|for|do you have|how much|does)\b",
    re.IGNORECASE,
)


def handle_medicine_question(message):
    query = _MEDICINE_FILLER.sub(' ', message).strip()
    query = re.sub(r'\s+', ' ', query)
    if not query:
        return {'reply': "Which medicine would you like to know about?", 'intent': 'medicine_question'}

    results = list(db.medicines.find({'$text': {'$search': query}}, {'name': 1, 'price': 1, 'stock': 1}).limit(3))
    if not results:
        # Fall back to a loose regex match on name if the text index finds nothing
        results = list(
            db.medicines.find({'name': {'$regex': re.escape(query), '$options': 'i'}}, {'name': 1, 'price': 1, 'stock': 1}).limit(3)
        )

    if not results:
        return {
            'reply': f"I couldn't find a medicine matching \"{query}\" in our catalog.",
            'intent': 'medicine_question',
        }

    lines = [
        f"{m['name']} — ₹{m.get('price', 'N/A')}, {'in stock' if m.get('stock', 0) > 0 else 'out of stock'}"
        for m in results
    ]
    return {
        'reply': "Here's what I found:\n" + "\n".join(lines),
        'intent': 'medicine_question',
        'data': {'matches': [{'name': m['name'], 'price': m.get('price'), 'stock': m.get('stock')} for m in results]},
    }


def handle_recommendation():
    results = list(
        db.medicines.find(
            {'isFeatured': True, 'stock': {'$gt': 0}, 'isDiscontinued': {'$ne': True}},
            {'name': 1, 'price': 1},
        ).limit(5)
    )
    if not results:
        return {
            'reply': "I don't have a specific recommendation right now — try browsing the Popular section on the home page.",
            'intent': 'recommendation',
        }
    lines = [f"{m['name']} — ₹{m.get('price', 'N/A')}" for m in results]
    return {
        'reply': "A few popular picks right now:\n" + "\n".join(lines),
        'intent': 'recommendation',
        'data': {'matches': [{'name': m['name'], 'price': m.get('price')} for m in results]},
    }


def handle_symptom(message_lower):
    symptom, info = match_symptom(message_lower)
    reply = (
        f"For {symptom}, commonly used OTC options include: {', '.join(info['medicines'])}.\n"
        f"Precautions: {'; '.join(info['precautions'])}.\n"
        "Consult a doctor if symptoms persist."
    )
    return {'reply': reply, 'intent': 'symptom_advice', 'disclaimer': DISCLAIMER}


def handle_gemini_fallback(message):
    if not GEMINI_API_KEY or requests is None:
        return {'reply': FALLBACK_RESPONSE, 'intent': 'general_question', 'disclaimer': DISCLAIMER}

    try:
        payload = {
            'contents': [{
                'parts': [{
                    'text': (
                        "You are a pharmacy assistant chatbot for an online medicine store called PharmaSync. "
                        "Answer briefly (2-4 sentences), stay general, never name a specific dosage, and always "
                        "end by suggesting the user consult a doctor or pharmacist for anything specific. "
                        f"User question: {message}"
                    )
                }]
            }]
        }
        res = requests.post(f'{GEMINI_URL}?key={GEMINI_API_KEY}', json=payload, timeout=6)
        if not res.ok:
            return {'reply': FALLBACK_RESPONSE, 'intent': 'general_question', 'disclaimer': DISCLAIMER}

        data = res.json()
        text = data['candidates'][0]['content']['parts'][0]['text']
        return {'reply': text.strip(), 'intent': 'general_question', 'disclaimer': DISCLAIMER}
    except Exception:
        return {'reply': FALLBACK_RESPONSE, 'intent': 'general_question', 'disclaimer': DISCLAIMER}


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
def health(request):
    """GET /health"""
    return JsonResponse({'status': 'ok', 'module': 'Module 9 - AI Chatbot'})


@csrf_exempt
def chat(request):
    """POST /api/chat"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    message = (body.get('message') or '').strip()
    user_id = body.get('userId')

    if not message:
        return JsonResponse({'error': 'message is required'}, status=400)

    message_lower = message.lower()
    intent = detect_intent(message_lower)

    if intent == 'greeting':
        result = {'reply': GREETING_RESPONSES[0], 'intent': 'greeting'}
    elif intent == 'order_status':
        result = handle_order_status(user_id)
    elif intent == 'prescription_question':
        result = {'reply': PRESCRIPTION_FAQ, 'intent': 'prescription_question'}
    elif intent == 'delivery_question':
        result = {'reply': DELIVERY_FAQ, 'intent': 'delivery_question'}
    elif intent == 'recommendation':
        result = handle_recommendation()
    elif intent == 'symptom_advice':
        result = handle_symptom(message_lower)
    elif intent == 'medicine_question':
        result = handle_medicine_question(message)
    else:
        result = handle_gemini_fallback(message)

    return JsonResponse(result)
