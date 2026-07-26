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
    clarify_response,
    is_health_related,
    match_all_symptoms,
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

# A short greeting word count as a whole message means "just saying hi" —
# but "hey I have a fever" carries real content after the greeting and
# should be treated as the symptom/question it actually is, not swallowed
# by the greeting branch. Previously `message_lower.startswith('hi')`
# alone decided this, which meant ANY message opening with a greeting word
# (a very natural way to start a chat, e.g. "hi, i have a fever") never
# reached symptom/medicine/order matching at all — this was the main
# reason real questions kept getting a plain "hi there" reply instead of
# an actual answer.
_GREETING_MAX_WORDS = 4


def is_pure_greeting(message_lower):
    stripped = message_lower.strip(' .,!?')
    if stripped in GREETING_WORDS:
        return True
    if not any(stripped.startswith(w) for w in GREETING_WORDS):
        return False
    # Starts with a greeting word — only treat the WHOLE message as a
    # greeting if there's little to nothing else in it ("hi there",
    # "hey!", "good morning :)"). Anything longer almost certainly has a
    # real question or symptom attached.
    return len(stripped.split()) <= _GREETING_MAX_WORDS


def detect_intent(message_lower):
    if is_pure_greeting(message_lower):
        return 'greeting'
    if any(w in message_lower for w in ORDER_WORDS):
        return 'order_status'
    if any(w in message_lower for w in PRESCRIPTION_WORDS):
        return 'prescription_question'
    if any(w in message_lower for w in DELIVERY_WORDS):
        return 'delivery_question'
    if any(w in message_lower for w in RECOMMEND_WORDS):
        return 'recommendation'
    if match_all_symptoms(message_lower):
        return 'symptom_advice'
    if any(w in message_lower for w in MEDICINE_WORDS):
        return 'medicine_question'
    if is_health_related(message_lower):
        return 'symptom_clarify'
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
    """Addresses every symptom the message mentions, not just the first
    one found — "I have a fever and a headache" used to only get a
    headache reply (whichever key happened to come first in SYMPTOM_KB)
    and silently drop the fever.

    A handful of entries (chest pain, dengue, ...) deliberately carry no
    medicines at all — see the "never just an OTC suggestion" section of
    knowledge_base.py for why. Those get a direct "see a doctor" sentence
    instead of the usual "For X: <medicines>. (<precautions>.)" shape,
    which would otherwise render as a nonsensical "For chest pain: . (...)"
    with an empty medicines list."""
    matches = match_all_symptoms(message_lower)
    symptom_names = [s for s, _ in matches]

    sections = []
    any_urgent = False
    for symptom, info in matches:
        if info.get('urgent'):
            any_urgent = True
        if info['medicines']:
            sections.append(
                f"For {symptom}: {', '.join(info['medicines'])}. "
                f"({'; '.join(info['precautions'])}.)"
            )
        else:
            prefix = '\u26a0\ufe0f ' if info.get('urgent') else ''
            sections.append(f"{prefix}For {symptom}: {'; '.join(info['precautions'])}.")

    closing = (
        "Please seek medical attention for the item(s) above marked \u26a0\ufe0f — this assistant can't help further with those."
        if any_urgent
        else "Consult a doctor if symptoms persist or worsen."
    )
    reply = "\n".join(sections) + f"\n{closing}"
    return {
        'reply': reply,
        'intent': 'symptom_advice',
        'disclaimer': DISCLAIMER,
        'data': {'symptoms': symptom_names, 'urgent': any_urgent},
    }


def handle_symptom_clarify():
    """The message reads as a health complaint ("I feel sick", "not
    feeling well") but doesn't name a symptom the knowledge base
    recognizes. Previously this fell straight through to the Gemini/static
    fallback, which had no way to ask "which symptom?" — this asks
    directly instead of dead-ending the conversation."""
    return {'reply': clarify_response(), 'intent': 'symptom_clarify', 'disclaimer': DISCLAIMER}


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
    elif intent == 'symptom_clarify':
        result = handle_symptom_clarify()
    else:
        result = handle_gemini_fallback(message)

    return JsonResponse(result)
