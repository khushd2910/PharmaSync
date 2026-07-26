"""
Static knowledge the chatbot answers from directly, with no MongoDB or
Gemini call needed — the "Knowledge Base" and "Predefined responses"
boxes in the Module 9 diagram.

This is a hand-picked set of common everyday symptoms — NOT a medical
database, and NOT a diagnostic tool. Every symptom reply carries the same
disclaimer (see DISCLAIMER below) and is worded as general OTC guidance,
never a diagnosis.

A small subset (see the "never just an OTC suggestion" section below)
deliberately has NO medicine suggestions at all — chest pain, difficulty
breathing, and a handful of infectious-disease names (dengue, typhoid,
...) are exactly the cases where a casual "take some ibuprofen" reply
would be actively dangerous (e.g. NSAIDs are specifically contraindicated
in dengue because of bleeding risk) rather than just unhelpful. Those
always redirect to a doctor instead of naming a medicine.
"""

DISCLAIMER = (
    "This is for informational purposes only and is not a substitute for "
    "professional medical advice, diagnosis, or treatment."
)

# Reused by a few entries that share identical OTC guidance under
# different common names for the same thing.
_ANTACID = ['Antacid tablets/syrup', 'Pantoprazole (OTC strength)']
_PAIN_RELIEF = ['Paracetamol (Acetaminophen)', 'Ibuprofen']
_ANTIHISTAMINE = ['Cetirizine', 'Loratadine']

# symptom keyword -> { medicines: [...], precautions: [...] }
# Keys are matched as substrings of the (lowercased) user message. Where
# one key is itself a substring of another (e.g. "cold" inside "cold
# sore", "fever" inside "dengue fever"), match_all_symptoms() below keeps
# only the more specific one — see _drop_nested_matches().
SYMPTOM_KB = {
    # --- Pain -------------------------------------------------------
    'headache': {
        'medicines': _PAIN_RELIEF,
        'precautions': [
            'Rest in a quiet, dimly lit room',
            'Stay hydrated',
            'Limit screen time until it eases',
        ],
    },
    'migraine': {
        'medicines': ['Paracetamol (Acetaminophen)', 'Ibuprofen (early, at first sign)'],
        'precautions': [
            'Lie down in a dark, quiet room',
            'Apply a cold compress to your forehead or neck',
            'Avoid known triggers (bright light, strong smells, skipped meals)',
        ],
    },
    'sinus headache': {
        'medicines': ['Paracetamol', 'A decongestant (short-term use only)'],
        'precautions': ['Try steam inhalation', 'Use a warm compress over the sinuses'],
    },
    'body pain': {
        'medicines': _PAIN_RELIEF,
        'precautions': ['Rest the affected area', 'Gentle stretching once pain eases'],
    },
    'body ache': {
        'medicines': _PAIN_RELIEF,
        'precautions': ['Rest and stay hydrated', 'A warm bath can help ease general aches'],
    },
    'muscle pain': {
        'medicines': ['Ibuprofen', 'A topical pain-relief gel/spray'],
        'precautions': ['Rest the muscle', 'Apply ice for the first 24-48 hours, then warmth', 'Gentle stretching'],
    },
    'muscle cramps': {
        'medicines': ['Paracetamol if painful'],
        'precautions': ['Gently stretch and massage the area', 'Stay hydrated', 'Replenish electrolytes'],
    },
    'joint pain': {
        'medicines': ['Ibuprofen', 'A topical anti-inflammatory gel'],
        'precautions': ['Rest the joint but keep gentle movement', 'Apply ice if swollen', 'Avoid overexertion'],
    },
    'back pain': {
        'medicines': ['Paracetamol', 'Ibuprofen', 'A topical pain-relief gel'],
        'precautions': ['Maintain good posture', 'Avoid heavy lifting', 'Gentle stretching, not bed rest'],
    },
    'lower back pain': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Avoid prolonged sitting', 'Use a firm, supportive mattress', 'Gentle stretching'],
    },
    'neck pain': {
        'medicines': ['Paracetamol', 'A topical pain-relief gel'],
        'precautions': ['Avoid awkward sleeping positions', 'Gentle neck stretches', 'A warm compress can help'],
    },
    'shoulder pain': {
        'medicines': ['Ibuprofen', 'A topical anti-inflammatory gel'],
        'precautions': ['Rest the shoulder', 'Apply ice if there was an injury', 'Avoid overhead lifting'],
    },
    'knee pain': {
        'medicines': ['Ibuprofen', 'A topical anti-inflammatory gel'],
        'precautions': ['Rest and elevate the leg', 'Apply ice if swollen', 'Avoid stairs/squatting until it eases'],
    },
    'toothache': {
        'medicines': ['Paracetamol', 'Ibuprofen', 'A clove-oil based dental gel'],
        'precautions': ['Rinse with warm salt water', 'Avoid very hot, cold, or sugary food', 'See a dentist soon'],
    },
    'earache': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Avoid inserting anything into the ear', 'A warm compress against the ear can help', 'See a doctor if it persists beyond a day or two'],
    },
    'sore throat': {
        'medicines': ['Throat lozenges', 'Paracetamol', 'An antiseptic gargle'],
        'precautions': ['Gargle with warm salt water', 'Drink warm fluids', 'Avoid smoking/smoke exposure'],
    },
    'stomach ache': {
        'medicines': ['Antacid tablets/syrup', 'An antispasmodic (for cramping)'],
        'precautions': ['Eat light, bland food', 'Avoid spicy or oily food', 'Stay hydrated'],
    },
    'abdominal cramps': {
        'medicines': ['An antispasmodic', 'Paracetamol'],
        'precautions': ['Apply a warm compress to the abdomen', 'Sip warm water or herbal tea', 'Rest'],
    },
    'menstrual cramps': {
        'medicines': ['Ibuprofen', 'Paracetamol', 'An antispasmodic'],
        'precautions': ['Apply a warm compress/hot water bottle to the lower abdomen', 'Gentle walking or stretching', 'Stay hydrated'],
    },
    'period pain': {
        'medicines': ['Ibuprofen', 'Paracetamol'],
        'precautions': ['A warm compress on the lower abdomen', 'Rest as needed', 'Gentle exercise can help over time'],
    },

    # --- Cold, flu & respiratory -------------------------------------
    'cold': {
        'medicines': ['Cetirizine', 'Paracetamol'],
        'precautions': ['Drink warm fluids', 'Try steam inhalation', 'Get extra rest'],
    },
    'flu': {
        'medicines': ['Paracetamol', 'Cetirizine (for congestion)'],
        'precautions': ['Rest and stay hydrated', 'Isolate from others where possible', 'Monitor your temperature'],
    },
    'cough': {
        'medicines': ['A cough syrup suited to dry vs. productive cough', 'Cetirizine (if allergy-related)'],
        'precautions': ['Avoid cold drinks and smoke exposure', 'Try warm water with honey'],
    },
    'dry cough': {
        'medicines': ['A cough suppressant (dextromethorphan-based syrup)', 'Throat lozenges'],
        'precautions': ['Warm water with honey', 'Keep the air humidified', 'Avoid smoke and dust'],
    },
    'wet cough': {
        'medicines': ['An expectorant cough syrup'],
        'precautions': ['Stay well hydrated to loosen mucus', 'Steam inhalation', "Avoid suppressing the cough completely — it's clearing mucus"],
    },
    'chest congestion': {
        'medicines': ['An expectorant', 'Steam inhalation aids'],
        'precautions': ['Steam inhalation a few times a day', 'Stay hydrated', 'Sleep slightly propped up'],
    },
    'sinus congestion': {
        'medicines': ['A decongestant (short-term use only)', 'Saline nasal spray'],
        'precautions': ['Steam inhalation', 'Stay hydrated', 'Avoid lying flat'],
    },
    'nasal congestion': {
        'medicines': ['A decongestant (short-term use only)', 'Saline nasal spray'],
        'precautions': ['Steam inhalation', 'Sleep with your head slightly elevated'],
    },
    'blocked nose': {
        'medicines': ['A decongestant (short-term use only)', 'Saline nasal spray'],
        'precautions': ['Steam inhalation', 'Stay hydrated'],
    },
    'runny nose': {
        'medicines': ['Cetirizine', 'Loratadine'],
        'precautions': ['Stay hydrated', 'Avoid known allergens/irritants'],
    },
    'sneezing': {
        'medicines': ['Cetirizine', 'Loratadine'],
        'precautions': ['Identify and avoid the trigger if possible', 'Keep your space dust-free'],
    },
    'hay fever': {
        'medicines': _ANTIHISTAMINE,
        'precautions': ['Avoid the outdoors during high-pollen hours', 'Keep windows closed', 'Shower after being outdoors'],
    },
    'seasonal allergy': {
        'medicines': _ANTIHISTAMINE,
        'precautions': ['Avoid the known trigger/allergen where possible', 'Keep the environment dust-free'],
    },

    # --- Fever -----------------------------------------------------------
    'fever': {
        'medicines': ['Paracetamol (Acetaminophen)'],
        'precautions': [
            'Rest and stay hydrated',
            'Monitor your temperature every few hours',
            'Wear light clothing and keep the room cool',
        ],
    },

    # --- Digestive -----------------------------------------------------
    'acidity': {
        'medicines': _ANTACID,
        'precautions': [
            'Avoid spicy, oily, or acidic foods',
            "Don't lie down immediately after eating",
        ],
    },
    'heartburn': {
        'medicines': ['Antacid tablets/syrup'],
        'precautions': ['Avoid large meals late at night', 'Sit upright for a while after eating'],
    },
    'gastritis': {
        'medicines': _ANTACID,
        'precautions': ['Eat small, frequent meals', 'Avoid alcohol, caffeine, and spicy food', 'See a doctor if pain persists'],
    },
    'indigestion': {
        'medicines': ['Antacid tablets/syrup', 'A digestive enzyme supplement'],
        'precautions': ['Eat smaller meals', 'Avoid lying down right after eating', "Don't overeat"],
    },
    'bloating': {
        'medicines': ['An anti-gas/simethicone tablet'],
        'precautions': ['Avoid carbonated drinks', 'Eat slowly', 'A short walk after meals can help'],
    },
    'gas': {
        'medicines': ['An anti-gas/simethicone tablet'],
        'precautions': ['Avoid gas-forming foods (beans, carbonated drinks)', 'Eat slowly'],
    },
    'flatulence': {
        'medicines': ['An anti-gas/simethicone tablet'],
        'precautions': ['Avoid gas-forming foods', 'Eat slowly and chew thoroughly'],
    },
    'constipation': {
        'medicines': ['A mild laxative (short-term use)', 'A fiber supplement'],
        'precautions': ['Increase fiber and water intake', 'Regular light exercise', "Don't ignore the urge to go"],
    },
    'diarrhea': {
        'medicines': ['ORS (oral rehydration solution)', 'A short course of loperamide if needed'],
        'precautions': ['Stay hydrated with ORS/fluids', 'Eat bland food (rice, banana, toast)', 'See a doctor if it lasts beyond 2 days or has blood'],
    },
    'loose motion': {
        'medicines': ['ORS (oral rehydration solution)'],
        'precautions': ['Stay hydrated', 'Eat bland, easy-to-digest food', 'See a doctor if it persists'],
    },
    'nausea': {
        'medicines': ['An antiemetic (e.g. domperidone)', 'Ginger-based remedies'],
        'precautions': ['Sip water or ginger tea slowly', 'Eat small, bland meals', 'Avoid strong smells'],
    },
    'vomiting': {
        'medicines': ['ORS (oral rehydration solution)', 'An antiemetic if needed'],
        'precautions': ['Sip fluids slowly to stay hydrated', 'Rest', 'See a doctor if it continues beyond a day'],
    },
    'motion sickness': {
        'medicines': ['An antihistamine motion-sickness tablet (e.g. dimenhydrinate)'],
        'precautions': ['Look ahead at a fixed point, not your phone/book', 'Sit where motion is felt least', 'Avoid heavy meals before travel'],
    },
    'travel sickness': {
        'medicines': ['An antihistamine motion-sickness tablet'],
        'precautions': ['Sit facing forward', 'Get fresh air if possible', 'Avoid reading in the vehicle'],
    },
    'food poisoning': {
        'medicines': ['ORS (oral rehydration solution)'],
        'precautions': ['Stay hydrated', 'Rest your stomach with bland food once vomiting eases', "See a doctor if symptoms are severe or don't improve"],
    },
    'hiccups': {
        'medicines': [],
        'precautions': ['Try slow, controlled breathing', 'Sip cold water', 'Usually resolves on its own within minutes'],
    },

    # --- Skin & allergy -------------------------------------------------
    'allergy': {
        'medicines': _ANTIHISTAMINE,
        'precautions': ['Avoid the known trigger/allergen where possible', 'Keep the environment dust-free'],
    },
    'skin rash': {
        'medicines': ['Cetirizine', 'A mild topical antihistamine/hydrocortisone cream'],
        'precautions': ['Avoid scratching', 'Wear loose, breathable clothing', 'See a doctor if it spreads or blisters'],
    },
    'itching': {
        'medicines': ['Cetirizine', 'A topical antihistamine cream'],
        'precautions': ['Avoid scratching', 'Use a fragrance-free moisturizer', 'Keep the area cool'],
    },
    'hives': {
        'medicines': ['Cetirizine', 'Loratadine'],
        'precautions': ['Avoid the suspected trigger', 'Loose, breathable clothing', 'Seek care if breathing is affected'],
    },
    'eczema': {
        'medicines': ['A fragrance-free moisturizer', 'A mild hydrocortisone cream for flare-ups'],
        'precautions': ['Moisturize regularly', 'Avoid harsh soaps and long hot showers', 'Identify and avoid triggers'],
    },
    'dry skin': {
        'medicines': ['A fragrance-free moisturizing lotion/cream'],
        'precautions': ['Moisturize right after bathing', 'Use lukewarm, not hot, water', 'Stay hydrated'],
    },
    'sunburn': {
        'medicines': ['Aloe vera gel', 'Paracetamol for discomfort'],
        'precautions': ['Cool the skin with a damp cloth', 'Stay hydrated', 'Avoid further sun exposure until healed'],
    },
    'insect bite': {
        'medicines': ['A topical antihistamine/calamine cream', 'Cetirizine if itching is widespread'],
        'precautions': ['Avoid scratching', 'Clean the area', 'Watch for signs of infection or spreading redness'],
    },
    'acne': {
        'medicines': ['A benzoyl peroxide or salicylic acid face wash/gel'],
        'precautions': ['Avoid picking or popping', 'Wash your face twice daily', 'Use non-comedogenic products'],
    },
    'dandruff': {
        'medicines': ['An anti-dandruff shampoo (ketoconazole/zinc pyrithione based)'],
        'precautions': ['Use the shampoo consistently as directed', 'Avoid very hot water on the scalp'],
    },
    'fungal infection': {
        'medicines': ['A topical antifungal cream'],
        'precautions': ['Keep the area clean and dry', 'Avoid sharing towels/clothing', 'Continue treatment for the full course'],
    },
    "athlete's foot": {
        'medicines': ['A topical antifungal cream/powder'],
        'precautions': ['Keep feet clean and dry', 'Wear breathable footwear and change socks daily'],
    },
    'cold sore': {
        'medicines': ['A topical antiviral cream (e.g. acyclovir)'],
        'precautions': ['Avoid touching/picking at it', 'Apply cream at the first tingling sign', 'Avoid sharing utensils/lip products'],
    },
    'mouth ulcer': {
        'medicines': ['A topical oral gel for mouth ulcers'],
        'precautions': ['Avoid spicy/acidic food', 'Rinse with warm salt water', 'Usually heals within a week or two'],
    },

    # --- Eyes ------------------------------------------------------------
    'eye irritation': {
        'medicines': ['Lubricating (artificial tear) eye drops'],
        'precautions': ['Avoid rubbing the eyes', 'Remove contact lenses if worn', 'See a doctor if pain or vision changes'],
    },
    'red eyes': {
        'medicines': ['Lubricating eye drops'],
        'precautions': ['Avoid rubbing', 'Avoid irritants like smoke', 'See a doctor if it persists beyond a couple of days'],
    },
    'dry eyes': {
        'medicines': ['Lubricating (artificial tear) eye drops'],
        'precautions': ['Take regular breaks from screens', 'Use a humidifier if the air is dry'],
    },
    'watery eyes': {
        'medicines': ['Lubricating eye drops', 'Cetirizine if allergy-related'],
        'precautions': ['Avoid rubbing', 'Identify and avoid triggers/allergens'],
    },

    # --- Sleep, energy & mild everyday stress ---------------------------
    'insomnia': {
        'medicines': [],
        'precautions': ['Keep a consistent sleep schedule', 'Avoid screens and caffeine before bed', 'See a doctor if it persists beyond a few weeks'],
    },
    'trouble sleeping': {
        'medicines': [],
        'precautions': ['Wind down with a calming routine before bed', 'Avoid caffeine late in the day', 'Keep your room cool and dark'],
    },
    'fatigue': {
        'medicines': [],
        'precautions': ['Prioritize sleep and hydration', 'Eat regular, balanced meals', 'See a doctor if it persists or is unexplained'],
    },
    'weakness': {
        'medicines': [],
        'precautions': ['Rest and stay hydrated', 'Eat regular, nutritious meals', 'See a doctor if it persists or is sudden'],
    },
    'dizziness': {
        'medicines': [],
        'precautions': ['Sit or lie down until it passes', 'Stay hydrated', 'See a doctor if it recurs, is severe, or comes with other symptoms'],
    },
    'stress': {
        'medicines': [],
        'precautions': ['Try slow, deep breathing or a short walk', 'Keep a regular sleep schedule', 'Talk to a doctor or counselor if it feels overwhelming or persistent'],
    },
    'anxiety': {
        'medicines': [],
        'precautions': ['Try slow, deep breathing exercises', 'Limit caffeine', 'Please speak with a doctor or counselor — this deserves real support, not a self-treated OTC fix'],
    },

    # --- First aid & misc -------------------------------------------------
    'hangover': {
        'medicines': ['Paracetamol (avoid ibuprofen on an irritated stomach)', 'ORS (oral rehydration solution)'],
        'precautions': ['Rehydrate well', 'Eat a light, bland meal', 'Rest'],
    },
    'dehydration': {
        'medicines': ['ORS (oral rehydration solution)'],
        'precautions': ['Sip fluids steadily rather than all at once', 'Avoid alcohol and excess caffeine', 'Seek care if unable to keep fluids down'],
    },
    'dry mouth': {
        'medicines': ['Sugar-free lozenges', 'A saliva substitute spray if persistent'],
        'precautions': ['Sip water regularly', 'Avoid excess caffeine and alcohol'],
    },
    'hair fall': {
        'medicines': ['A biotin/multivitamin supplement', 'A mild anti-hair-fall shampoo'],
        'precautions': ['Avoid tight hairstyles and excessive heat styling', 'Eat a balanced, protein-rich diet', "See a doctor if it's sudden or excessive"],
    },
    'minor burn': {
        'medicines': ['Aloe vera gel or a burn ointment'],
        'precautions': ['Cool under running water for several minutes (not ice)', 'Cover loosely with a clean bandage', "Don't apply toothpaste or butter"],
    },
    'minor cuts': {
        'medicines': ['An antiseptic solution/cream'],
        'precautions': ['Clean the wound and apply antiseptic', 'Cover with a clean bandage', 'Watch for signs of infection'],
    },
    'bruise': {
        'medicines': ['Paracetamol if tender', 'A cold compress'],
        'precautions': ['Apply a cold compress for the first day', 'Rest and elevate the area if possible'],
    },
    'muscle strain': {
        'medicines': ['Ibuprofen', 'A topical anti-inflammatory gel'],
        'precautions': ['Rest, ice, compression, elevation (RICE)', 'Avoid strenuous activity until healed'],
    },
    'sprain': {
        'medicines': ['Ibuprofen', 'A topical anti-inflammatory gel'],
        'precautions': ['Rest, ice, compression, elevation (RICE)', "See a doctor if you can't bear weight or it doesn't improve"],
    },
    'burning urination': {
        'medicines': [],
        'precautions': ['Drink plenty of water', 'Avoid holding urine for long periods', 'See a doctor — this usually needs a proper diagnosis and, often, antibiotics'],
    },

    # --- Symptoms that should never just get a casual OTC suggestion ----
    # These deliberately have `medicines: []` and `urgent: True` —
    # handle_symptom() in views.py renders an empty medicines list as a
    # direct "please see a doctor" instead of an odd "For X: . (...)"
    # sentence, and `urgent: True` puts these first in a reply (ahead of
    # any ordinary symptom mentioned in the same message) with stronger
    # "right away" wording rather than "if it persists".
    'chest pain': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency medical care right away', 'Do not drive yourself — call for help or have someone take you'],
    },
    'difficulty breathing': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency medical care right away'],
    },
    'shortness of breath': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency medical care right away'],
    },
    'severe bleeding': {
        'medicines': [], 'urgent': True,
        'precautions': ['Apply firm, direct pressure and seek emergency care immediately'],
    },
    'fainting': {
        'medicines': [], 'urgent': True,
        'precautions': ['Lie down and elevate the legs if breathing normally', 'Seek medical care, especially if it recurs or came with injury'],
    },
    'loss of consciousness': {
        'medicines': [], 'urgent': True,
        'precautions': ['Call for emergency medical help immediately'],
    },
    'seizure': {
        'medicines': [], 'urgent': True,
        'precautions': ["Keep the person safe from injury; don't restrain them", 'Seek emergency medical care'],
    },
    'coughing blood': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek medical care immediately'],
    },
    'blood in vomit': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency medical care immediately'],
    },
    'blood in stool': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly to determine the cause'],
    },
    'severe allergic reaction': {
        'medicines': [], 'urgent': True,
        'precautions': ['Use an epinephrine auto-injector if prescribed and available', 'Call emergency services immediately'],
    },
    'anaphylaxis': {
        'medicines': [], 'urgent': True,
        'precautions': ['Use an epinephrine auto-injector if available', 'Call emergency services immediately'],
    },
    'severe burn': {
        'medicines': [], 'urgent': True,
        'precautions': ['Cool with running water and seek emergency care', 'Do not apply creams, butter, or ice to a severe burn'],
    },
    'heat stroke': {
        'medicines': [], 'urgent': True,
        'precautions': ['Move to a cool place and seek emergency care immediately', 'Cool the body with water/fans while waiting for help'],
    },
    'suspected poisoning': {
        'medicines': [], 'urgent': True,
        'precautions': ['Call emergency/poison control immediately', 'Do not induce vomiting unless a professional tells you to'],
    },
    # Disease names, not symptoms — deliberately no medicine names. The
    # real reason these are here rather than left to fall through to the
    # generic fallback: a message like "I have dengue fever" would
    # otherwise still match the plain "fever" entry above (Paracetamol),
    # and NSAIDs like ibuprofen specifically must be avoided in dengue —
    # so these need their own entry that wins over "fever", not silence.
    'dengue': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly for proper diagnosis and monitoring', 'Avoid ibuprofen/aspirin — they can increase bleeding risk', 'Stay well hydrated'],
    },
    'dengue fever': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly for proper diagnosis and monitoring', 'Avoid ibuprofen/aspirin — they can increase bleeding risk', 'Stay well hydrated'],
    },
    'malaria': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly — malaria needs proper testing and prescription treatment', 'Stay hydrated and rest while arranging care'],
    },
    'typhoid': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly — typhoid needs prescription antibiotics', 'Stay hydrated and eat easily digestible food'],
    },
    'jaundice': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly for proper diagnosis', 'Avoid alcohol and self-medicating for other symptoms in the meantime'],
    },
    'covid': {
        'medicines': [], 'urgent': True,
        'precautions': ['Isolate from others and get tested', 'Monitor for breathing difficulty and seek care if it worsens', 'Rest and stay hydrated'],
    },
    'coronavirus': {
        'medicines': [], 'urgent': True,
        'precautions': ['Isolate from others and get tested', 'Monitor for breathing difficulty and seek care if it worsens'],
    },
    'chicken pox': {
        'medicines': ["Calamine lotion for itching (avoid other medicines without a doctor's advice)"],
        'precautions': ['Avoid scratching to prevent scarring/infection', 'Isolate to avoid spreading it', 'See a doctor, especially for adults or if fever is high'],
    },
    'measles': {
        'medicines': [], 'urgent': True,
        'precautions': ['See a doctor promptly', 'Isolate to avoid spreading it — measles is highly contagious', 'Rest and stay hydrated'],
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

# What SYMPTOM_KB actually covers, sampled for the clarifying question
# below. With 100+ entries now, listing every single one would be an
# unreadable wall of text, so this shows a handful of common,
# easy-to-recognize ones rather than dumping the entire dictionary.
_CLARIFY_SAMPLE = (
    'headache', 'fever', 'cold', 'cough', 'stomach ache', 'body pain',
    'sore throat', 'allergy', 'nausea', 'back pain',
)


def _known_symptoms_list():
    return ', '.join(_CLARIFY_SAMPLE)


def clarify_response():
    return (
        "Sorry to hear that — could you tell me a bit more about what you're experiencing? "
        f"I can help with common symptoms like: {_known_symptoms_list()}, and many more."
    )


def _drop_nested_matches(matched_keys):
    """Keeps only the most specific matches — drops any matched key that
    is itself a substring of another matched key.

    With 100+ symptom phrases, some inevitably nest inside others by
    plain substring rules ("cold" inside "cold sore", "fever" inside
    "dengue fever", "cough" inside "dry cough"). Without this, a message
    like "I have a dengue fever" would get BOTH the safety-redirect
    "dengue fever" entry AND the ordinary "fever" -> Paracetamol entry in
    the same reply — confusing at best, and actively working against the
    "dengue fever" entry's whole reason for existing at worst.
    """
    return [k for k in matched_keys if not any(k != other and k in other for other in matched_keys)]


def match_all_symptoms(message_lower):
    """Returns a list of (symptom, info) for every SYMPTOM_KB entry whose
    key appears in the message — e.g. "fever and headache" matches both,
    so the reply can address everything the user mentioned instead of only
    the first (dict-order-dependent) match. Nested/overlapping matches are
    collapsed to just the most specific one (see _drop_nested_matches).
    Urgent entries are sorted first so a red-flag symptom is never buried
    below routine ones in the same message."""
    raw_matches = [symptom for symptom in SYMPTOM_KB if symptom in message_lower]
    kept_set = set(_drop_nested_matches(raw_matches))
    ordered = [symptom for symptom in SYMPTOM_KB if symptom in kept_set]
    ordered.sort(key=lambda symptom: not SYMPTOM_KB[symptom].get('urgent', False))
    return [(symptom, SYMPTOM_KB[symptom]) for symptom in ordered]


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
