import logging
import os
import random
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
    EMPTY_MEDICINE_PROMPT_RESPONSES,
    EMPTY_RECOMMENDATION_RESPONSES,
    NO_ORDERS_RESPONSES,
    NOT_FOUND_RESPONSES,
    ORDER_STATUS_RESPONSES,
    clarify_response,
    delivery_faq_response,
    fallback_response,
    greeting_response,
    is_health_related,
    match_all_symptoms,
    prescription_faq_response,
)
from .intent_classifier import DEFAULT_CONFIDENCE_THRESHOLD, get_classifier

logger = logging.getLogger(__name__)

# Connect to MongoDB from django settings
db = settings.MONGO_DB
USER_CONVERSATION_CONTEXT = {}

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')
GEMINI_URL = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'

GREETING_WORDS = ('hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening')

# A short greeting word count as a whole message means "just saying hi" —
# but mixed messages like "hey, I have a fever" should not be swallowed by
# the greeting branch. The classifier is the primary router now, and this
# helper only nudges the pure greeting branch when the model still reports
# a high-confidence greeting.
_GREETING_MAX_WORDS = 4


def is_pure_greeting(message_lower):
    stripped = message_lower.strip(' .,!?')
    if stripped in GREETING_WORDS:
        return True
    if not any(stripped.startswith(w) for w in GREETING_WORDS):
        return False
    return len(stripped.split()) <= _GREETING_MAX_WORDS


def _strip_leading_greeting(message_lower):
    if is_pure_greeting(message_lower):
        return message_lower

    for greeting in GREETING_WORDS:
        if message_lower.startswith(greeting + ' '):
            return message_lower[len(greeting):].strip(' ,.!?')
        if message_lower.startswith(greeting + ','):
            return message_lower[len(greeting) + 1:].strip(' ,.!?')
    return message_lower


def classify_message(message_lower):
    normalized_message = _strip_leading_greeting(message_lower)
    classifier = get_classifier()
    ml_intent, confidence = classifier.predict_intent(normalized_message)

    if ml_intent != 'general_question' and confidence >= DEFAULT_CONFIDENCE_THRESHOLD:
        if ml_intent == 'greeting' and not is_pure_greeting(message_lower):
            return 'general_question', ml_intent, confidence
        return ml_intent, ml_intent, confidence

    if is_pure_greeting(message_lower):
        return 'greeting', 'greeting', confidence

    return 'general_question', ml_intent, confidence


def detect_intent(message_lower):
    return classify_message(message_lower)[0]


def resolve_follow_up_message(message, user_id):
    if not user_id:
        return message

    context = USER_CONVERSATION_CONTEXT.get(user_id, {})
    last_medicine = context.get('last_medicine')
    if not last_medicine:
        return message

    message_lower = message.lower()
    is_follow_up_query = any(keyword in message_lower for keyword in (
        'price', 'stock', 'available', 'availability', 'cost', 'in stock', 'out of stock',
        'buy', 'have it', 'have that', 'have this', 'get it', 'check it', 'find it'
    ))
    has_pronoun = any(token in message_lower for token in (' it ', ' that ', ' this ', ' those ', ' they ', ' them '))

    if has_pronoun and is_follow_up_query:
        for pronoun in (' it ', ' that ', ' this ', ' those ', ' they ', ' them '):
            if pronoun in message_lower:
                return re.sub(re.escape(pronoun), f' {last_medicine} ', message, flags=re.IGNORECASE, count=1)

    return message


# ---------------------------------------------------------------------------
# Per-intent handlers
# ---------------------------------------------------------------------------
def handle_order_status(user_id):
    if not user_id:
        return {'reply': random.choice(ORDER_STATUS_RESPONSES), 'intent': 'order_status'}
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        return {'reply': random.choice(ORDER_STATUS_RESPONSES), 'intent': 'order_status'}

    order = db.orders.find_one({'user': oid}, sort=[('createdAt', -1)])
    if not order:
        return {'reply': random.choice(NO_ORDERS_RESPONSES), 'intent': 'order_status'}

    invoice = order.get('invoiceNumber') or 'N/A'
    order_status = order.get('orderStatus') or 'Pending'
    shipping_stage = order.get('shippingStage') or order_status
    prescription_status = order.get('prescriptionStatus') or 'Not required'
    reply = (
        f"Invoice {invoice} is {order_status}. Shipping stage: {shipping_stage}. "
        f"Prescription: {prescription_status}."
    )
    return {
        'reply': reply,
        'intent': 'order_status',
        'data': {
            'invoiceNumber': invoice,
            'orderStatus': order_status,
            'shippingStage': shipping_stage,
            'prescriptionStatus': prescription_status,
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
        return {'reply': random.choice(EMPTY_MEDICINE_PROMPT_RESPONSES), 'intent': 'medicine_question'}

    results = list(db.medicines.find({'$text': {'$search': query}}, {'name': 1, 'price': 1, 'stock': 1}).limit(3))
    if not results:
        # Fall back to a loose regex match on name if the text index finds nothing
        results = list(
            db.medicines.find({'name': {'$regex': re.escape(query), '$options': 'i'}}, {'name': 1, 'price': 1, 'stock': 1}).limit(3)
        )

    if not results:
        return {
            'reply': f"{random.choice(NOT_FOUND_RESPONSES)} Try: \"{query}\" with a different spelling, or tell me the brand name if you have it.",
            'intent': 'medicine_question',
            'data': {'query': query, 'matches': []},
        }

    lines = []
    for m in results:
        stock_status = 'in stock' if m.get('stock', 0) > 0 else 'out of stock'
        lines.append(f"{m['name']} — ₹{m.get('price', 'N/A')} | {stock_status}. You can view it in the catalog.")

    return {
        'reply': "Here’s the quick update:\n" + "\n".join(lines),
        'intent': 'medicine_question',
        'data': {
            'query': query,
            'matches': [{'name': m['name'], 'price': m.get('price'), 'stock': m.get('stock')} for m in results],
        },
    }


def handle_recommendation():
    results = list(
        db.medicines.find(
            {'isFeatured': True, 'stock': {'$gt': 0}, 'isDiscontinued': {'$ne': True}},
            {'name': 1, 'price': 1, 'stock': 1},
        ).limit(5)
    )
    if not results:
        return {
            'reply': random.choice(EMPTY_RECOMMENDATION_RESPONSES),
            'intent': 'recommendation',
        }
    lines = [
        f"{m['name']} — ₹{m.get('price', 'N/A')} | {'in stock' if m.get('stock', 0) > 0 else 'out of stock'}. View it in the catalog."
        for m in results
    ]
    return {
        'reply': "A few popular picks right now:\n" + "\n".join(lines),
        'intent': 'recommendation',
        'data': {'matches': [{'name': m['name'], 'price': m.get('price'), 'stock': m.get('stock')} for m in results]},
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
                f"For {symptom}: {', '.join(info['medicines'][:2])}. "
                f"{'; '.join(info['precautions'][:2])}."
            )
        else:
            prefix = '\u26a0\ufe0f ' if info.get('urgent') else ''
            sections.append(f"{prefix}For {symptom}: {'; '.join(info['precautions'][:2])}.")

    if any_urgent:
        closing = "Please seek urgent medical care right away for any red-flag symptoms above."
    else:
        closing = "For everyday symptoms, rest and stay hydrated. Ask a doctor or pharmacist if it persists or worsens."

    reply = "\n".join(sections[:2]) + f"\n{closing}"
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


def build_disambiguation_reply(message_lower):
    if any(term in message_lower for term in ('order', 'parcel', 'shipment', 'delivery', 'tracking')):
        return "Do you want order tracking help, or a medicine question?"
    if any(term in message_lower for term in ('fever', 'cough', 'cold', 'pain', 'headache', 'allergy', 'sore throat')):
        return "Do you want symptom advice or medicine info for that?"
    return "Do you want symptom advice, medicine info, or an order update?"


def should_disambiguate(message_lower, intent):
    if intent in {'order_status', 'medicine_question', 'prescription_question', 'delivery_question', 'recommendation'}:
        return False
    symptom_terms = ('fever', 'cough', 'cold', 'pain', 'headache', 'allergy', 'sore throat', 'symptom')
    if any(term in message_lower for term in symptom_terms) and any(phrase in message_lower for phrase in ('something for', 'something about', 'need something', 'looking for something')):
        return True
    return False


def log_chat_analytics(user_id, predicted_intent, confidence, handler_name, fallback_path):
    logger.warning(
        "chat_analytics user=%s predicted_intent=%s confidence=%.3f handler=%s fallback_path=%s",
        user_id or 'anonymous',
        predicted_intent,
        confidence,
        handler_name,
        fallback_path,
    )


def clear_user_context(user_id):
    if user_id:
        USER_CONVERSATION_CONTEXT.pop(user_id, None)
    return True


def handle_gemini_fallback(message):
    if not GEMINI_API_KEY or requests is None:
        return {'reply': fallback_response(), 'intent': 'general_question', 'disclaimer': DISCLAIMER}

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
            return {'reply': fallback_response(), 'intent': 'general_question', 'disclaimer': DISCLAIMER}

        data = res.json()
        text = data['candidates'][0]['content']['parts'][0]['text']
        return {'reply': text.strip(), 'intent': 'general_question', 'disclaimer': DISCLAIMER}
    except Exception:
        return {'reply': fallback_response(), 'intent': 'general_question', 'disclaimer': DISCLAIMER}


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
    user_id = body.get('userId') or body.get('user_id')

    if not message:
        return JsonResponse({'error': 'message is required'}, status=400)

    resolved_message = resolve_follow_up_message(message, user_id)
    message_lower = resolved_message.lower()
    intent, predicted_intent, confidence = classify_message(message_lower)

    if should_disambiguate(message_lower, intent):
        result = {'reply': build_disambiguation_reply(message_lower), 'intent': 'disambiguation'}
        handler_name = 'disambiguation'
        fallback_path = 'disambiguation'
    elif intent == 'greeting':
        result = {'reply': greeting_response(), 'intent': 'greeting'}
        handler_name = 'greeting'
        fallback_path = None
    elif intent == 'order_status':
        result = handle_order_status(user_id)
        handler_name = 'order_status'
        fallback_path = None
    elif intent == 'prescription_question':
        result = {'reply': prescription_faq_response(), 'intent': 'prescription_question'}
        handler_name = 'prescription_question'
        fallback_path = None
    elif intent == 'delivery_question':
        result = {'reply': delivery_faq_response(), 'intent': 'delivery_question'}
        handler_name = 'delivery_question'
        fallback_path = None
    elif intent == 'recommendation':
        result = handle_recommendation()
        handler_name = 'recommendation'
        fallback_path = None
    elif intent == 'symptom_advice':
        result = handle_symptom(message_lower)
        handler_name = 'symptom_advice'
        fallback_path = None
    elif intent == 'medicine_question':
        result = handle_medicine_question(resolved_message)
        handler_name = 'medicine_question'
        fallback_path = None
    elif intent == 'symptom_clarify':
        result = handle_symptom_clarify()
        handler_name = 'symptom_clarify'
        fallback_path = 'symptom_clarify'
    elif match_all_symptoms(message_lower) or is_health_related(message_lower):
        if match_all_symptoms(message_lower):
            result = handle_symptom(message_lower)
            handler_name = 'symptom_advice'
            fallback_path = None
        else:
            result = handle_symptom_clarify()
            handler_name = 'symptom_clarify'
            fallback_path = 'symptom_clarify'
    else:
        result = handle_gemini_fallback(message)
        handler_name = 'gemini_fallback'
        fallback_path = 'gemini_fallback'

    if user_id and result.get('intent') == 'medicine_question' and result.get('data'):
        query = result.get('data', {}).get('query')
        if query:
            USER_CONVERSATION_CONTEXT[user_id] = {
                'last_intent': 'medicine_question',
                'last_medicine': query,
            }

    is_failed_turn = (
        result.get('intent') in {'general_question', 'disambiguation', 'symptom_clarify'}
        or predicted_intent == 'general_question'
        or confidence < DEFAULT_CONFIDENCE_THRESHOLD
    )
    if is_failed_turn:
        result.setdefault('data', {})['analytics'] = {
            'predictedIntent': predicted_intent,
            'confidence': round(confidence, 3),
            'handler': handler_name,
            'fallbackPath': fallback_path,
        }
        log_chat_analytics(user_id, predicted_intent, confidence, handler_name, fallback_path)

    return JsonResponse(result)


@csrf_exempt
def reset_chat(request):
    """POST /api/chat/reset"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    user_id = body.get('userId') or body.get('user_id')
    clear_user_context(user_id)
    return JsonResponse({'success': True, 'message': 'Chat history cleared'})
