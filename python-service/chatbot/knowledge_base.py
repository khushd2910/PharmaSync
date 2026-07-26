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


def match_symptom(message_lower):
    """Returns the first SYMPTOM_KB entry whose key appears in the message,
    or None. Dict insertion order is stable in Python 3.7+, so this is
    deterministic."""
    for symptom, info in SYMPTOM_KB.items():
        if symptom in message_lower:
            return symptom, info
    return None
