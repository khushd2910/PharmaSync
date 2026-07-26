"""
Static knowledge the chatbot answers from directly, with no MongoDB or
Gemini call needed — the "Knowledge Base" and "Predefined responses"
boxes in the Module 9 diagram.

This is deliberately a small, hand-picked set for common everyday
symptoms — NOT a medical database. Every symptom reply carries the same
disclaimer (see DISCLAIMER below) and is worded as general OTC guidance,
never a diagnosis.
"""

DISCLAIMER = (
    "This is for informational purposes only and is not a substitute for "
    "professional medical advice, diagnosis, or treatment."
)

# symptom keyword -> { medicines: [...], precautions: [...] }
# Keys are matched as substrings of the (lowercased) user message.
SYMPTOM_KB = {
    'headache': {
        'medicines': ['Paracetamol (Acetaminophen)', 'Ibuprofen'],
        'precautions': [
            'Rest in a quiet, dimly lit room',
            'Stay hydrated',
            'Limit screen time until it eases',
        ],
    },
    'fever': {
        'medicines': ['Paracetamol (Acetaminophen)'],
        'precautions': [
            'Rest and stay hydrated',
            'Monitor your temperature every few hours',
            'Wear light clothing and keep the room cool',
        ],
    },
    'cold': {
        'medicines': ['Cetirizine', 'Paracetamol'],
        'precautions': [
            'Drink warm fluids',
            'Try steam inhalation',
            'Get extra rest',
        ],
    },
    'cough': {
        'medicines': ['A cough syrup suited to dry vs. productive cough', 'Cetirizine (if allergy-related)'],
        'precautions': [
            'Avoid cold drinks and smoke exposure',
            'Try warm water with honey',
        ],
    },
    'acidity': {
        'medicines': ['Antacid tablets/syrup', 'Pantoprazole (OTC strength)'],
        'precautions': [
            'Avoid spicy, oily, or acidic foods',
            "Don't lie down immediately after eating",
        ],
    },
    'heartburn': {
        'medicines': ['Antacid tablets/syrup'],
        'precautions': ['Avoid large meals late at night', 'Sit upright for a while after eating'],
    },
    'body pain': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Rest the affected area', 'Gentle stretching once pain eases'],
    },
    'allergy': {
        'medicines': ['Cetirizine', 'Loratadine'],
        'precautions': ['Avoid the known trigger/allergen where possible', 'Keep the environment dust-free'],
    },
}

# Words that signal "this is a health complaint" even when they don't match
# a specific SYMPTOM_KB entry — e.g. "I'm not feeling well" or "I feel
# sick" say something is wrong without naming what. These trigger a
# clarifying question (see CLARIFY_RESPONSE) instead of falling straight
# through to the generic Gemini/static fallback, which had no way to ask
# "which symptom?" and just gave up.
HEALTH_HINT_WORDS = (
    'sick', 'unwell', 'not feeling well', 'not well', 'not okay', 'not ok',
    'ill', 'pain', 'ache', 'aches', 'hurts', 'hurting', 'symptom', 'symptoms',
    'feel bad', 'feeling bad', 'feel awful', 'feeling awful',
)

# Predefined canned responses — the diagram's "Predefined responses" and
# rule-driven FAQ boxes (Prescription question / Delivery question).
GREETING_RESPONSES = [
    "Hi! I'm PharmaSync's assistant. Ask me about a medicine, your order status, or a symptom like a headache or fever.",
]

PRESCRIPTION_FAQ = (
    "Some medicines on PharmaSync require a valid prescription. When your cart has one of those, "
    "you'll be asked to upload a prescription at checkout — our pharmacist team reviews it, and your "
    "order proceeds once it's approved. You can check an order's prescription status on its Order Details page."
)

DELIVERY_FAQ = (
    "Orders move through Pending \u2192 Confirmed \u2192 Packed \u2192 Out for Delivery \u2192 Delivered. "
    "You can track any order's current status from My Orders."
)

FALLBACK_RESPONSE = (
    "I'm not able to help with that one directly \u2014 for anything specific to your health, "
    "please consult a doctor or pharmacist."
)

# What SYMPTOM_KB actually covers, used to build the clarifying question
# below — kept as a function rather than a frozen string so it can never
# drift out of sync with SYMPTOM_KB itself.
def _known_symptoms_list():
    return ', '.join(sorted(SYMPTOM_KB.keys()))


def clarify_response():
    return (
        "Sorry to hear that — could you tell me a bit more about what you're experiencing? "
        f"I can help with common symptoms like: {_known_symptoms_list()}."
    )


def match_all_symptoms(message_lower):
    """Returns a list of (symptom, info) for every SYMPTOM_KB entry whose
    key appears in the message — e.g. "fever and headache" matches both,
    so the reply can address everything the user mentioned instead of only
    the first (dict-order-dependent) match. Dict insertion order is stable
    in Python 3.7+, so this is deterministic when only one matches too."""
    return [(symptom, info) for symptom, info in SYMPTOM_KB.items() if symptom in message_lower]


def match_symptom(message_lower):
    """Back-compat single-match helper — returns the first match from
    match_all_symptoms(), or None. Kept for anything that only needs a
    yes/no "does this message mention a known symptom" check."""
    matches = match_all_symptoms(message_lower)
    return matches[0] if matches else None


def is_health_related(message_lower):
    """True if the message sounds like a health complaint even though it
    didn't name a symptom SYMPTOM_KB recognizes — the signal for asking a
    clarifying question rather than giving up entirely."""
    return any(w in message_lower for w in HEALTH_HINT_WORDS)
