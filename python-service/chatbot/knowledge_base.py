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

import random
import re

DISCLAIMER = (
    "This is for informational purposes only and is not a substitute for "
    "professional medical advice, diagnosis, or treatment."
)

# Reused by a few entries that share identical OTC guidance under
# different common names for the same thing.
_ANTACID = ['Antacid tablets/syrup', 'Pantoprazole (OTC strength)']
_PAIN_RELIEF = ['Paracetamol (Acetaminophen)', 'Ibuprofen']
_ANTIHISTAMINE = ['Cetirizine', 'Loratadine']

# Common spelling slips and shorthand that people use in chat messages.
# These are applied before the symptom matcher so casual typos still map
# to the proper knowledge-base entry instead of being ignored.
_COMMON_SYMPTOM_TYPO_FIXES = {
    'fevver': 'fever', 'fevr': 'fever', 'feverr': 'fever',
    'throt': 'throat', 'throat': 'throat', 'sorethrot': 'sore throat',
    'sore throt': 'sore throat', 'sorethroat': 'sore throat', 'sore throt': 'sore throat',
    'sore thro': 'sore throat', 'headach': 'headache', 'head ache': 'headache',
    'headachee': 'headache', 'caugh': 'cough', 'coughh': 'cough', 'cought': 'cough',
    'fluu': 'flu', 'allergie': 'allergy', 'allergys': 'allergy', 'alergy': 'allergy',
    'rashes': 'rash', 'rashs': 'rash', 'migrain': 'migraine', 'migrainee': 'migraine',
    'stomache': 'stomach ache', 'stomachache': 'stomach ache', 'stomacheache': 'stomach ache',
    'foodpoisioning': 'food poisoning', 'foodpoisoning': 'food poisoning', 'foood poisoning': 'food poisoning',
    'diarreah': 'diarrhea', 'diarrhoea': 'diarrhea', 'dirrhea': 'diarrhea', 'dirrhoea': 'diarrhea',
    'nausia': 'nausea', 'nausea': 'nausea', 'vomitting': 'vomiting', 'dehydratd': 'dehydration',
    'dehydrationn': 'dehydration', 'sneez': 'sneeze', 'sneezingg': 'sneezing', 'conjest': 'congestion',
    'congestionn': 'congestion', 'sinusitis': 'sinus infection', 'earachee': 'earache',
    'tootheache': 'toothache', 'tooh ache': 'toothache', 'itchingg': 'itching',
    'eczemae': 'eczema', 'hives': 'hives', 'skin rash': 'rash',
}


def normalize_message_for_symptoms(message):
    """Lowercase and lightly clean up chatty spelling mistakes before matching."""
    text = (message or '').lower().strip()
    text = re.sub(r'[^a-z0-9\s]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    for typo, replacement in _COMMON_SYMPTOM_TYPO_FIXES.items():
        text = text.replace(typo, replacement)
    return re.sub(r'\s+', ' ', text).strip()


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

    # --- Expanded everyday complaints ---------------------------------
    'stomach pain': {
        'medicines': ['Antacid tablets/syrup', 'An antispasmodic'],
        'precautions': ['Eat bland food', 'Avoid spicy or oily meals', 'Stay hydrated and rest'],
    },
    'upset stomach': {
        'medicines': ['Antacid tablets/syrup', 'ORS (oral rehydration solution)'],
        'precautions': ['Avoid heavy meals', 'Sip water slowly', 'Eat bland food until it eases'],
    },
    'acid reflux': {
        'medicines': _ANTACID,
        'precautions': ['Avoid late meals', 'Avoid spicy and acidic foods', 'Don’t lie down right after eating'],
    },
    'gastric pain': {
        'medicines': ['Antacid tablets/syrup', 'A digestive enzyme supplement'],
        'precautions': ['Avoid oily foods', 'Eat smaller portions', 'Seek care if it’s severe or frequent'],
    },
    'food poisoning': {
        'medicines': ['ORS (oral rehydration solution)'],
        'precautions': ['Rest and stay hydrated', 'Avoid dairy and greasy foods', 'Seek urgent care if you have severe vomiting, blood, or weakness'],
    },
    'stomach flu': {
        'medicines': ['ORS (oral rehydration solution)', 'Paracetamol for fever'],
        'precautions': ['Stay hydrated', 'Rest and avoid work/school until symptoms improve', 'Seek advice if symptoms persist'],
    },
    'bloated': {
        'medicines': ['An anti-gas/simethicone tablet'],
        'precautions': ['Avoid carbonated drinks', 'Eat slowly', 'A short walk after meals can help'],
    },
    'stomach bloating': {
        'medicines': ['An anti-gas/simethicone tablet'],
        'precautions': ['Avoid fizzy drinks and beans', 'Eat smaller meals', 'Gentle walking may help'],
    },
    'stomach cramps': {
        'medicines': ['An antispasmodic', 'Paracetamol'],
        'precautions': ['Apply warmth to the abdomen', 'Sip water slowly', 'Rest until it settles'],
    },
    'loose stools': {
        'medicines': ['ORS (oral rehydration solution)', 'A short course of loperamide if needed'],
        'precautions': ['Stay hydrated', 'Eat bland food', 'Seek medical advice if it lasts more than two days'],
    },
    'loose motions': {
        'medicines': ['ORS (oral rehydration solution)'],
        'precautions': ['Stay hydrated', 'Avoid greasy food', 'Seek help if there is blood or severe weakness'],
    },
    'constipation': {
        'medicines': ['A mild laxative (short-term use)', 'A fiber supplement'],
        'precautions': ['Increase fiber and water', 'Gentle movement helps', 'Avoid overusing laxatives'],
    },
    'piles': {
        'medicines': ['A soothing hemorrhoid cream or ointment'],
        'precautions': ['Avoid straining', 'Increase fiber and water', 'Seek care if bleeding is severe or persistent'],
    },
    'hemorrhoids': {
        'medicines': ['A soothing hemorrhoid cream or ointment'],
        'precautions': ['Avoid straining', 'Keep the area clean and dry', 'Seek care if symptoms worsen'],
    },
    'burning urine': {
        'medicines': [],
        'precautions': ['Drink plenty of water', 'Avoid holding urine', 'Seek a doctor if it persists or is severe'],
    },
    'urinary infection': {
        'medicines': [],
        'precautions': ['Drink plenty of water', 'Avoid delaying urination', 'See a doctor—this often needs proper treatment'],
    },
    'urine infection': {
        'medicines': [],
        'precautions': ['Drink plenty of water', 'Avoid delaying urination', 'See a doctor—this often needs proper treatment'],
    },
    'itching': {
        'medicines': ['Cetirizine', 'A topical anti-itch cream'],
        'precautions': ['Avoid scratching', 'Keep the skin cool and moisturized', 'See a clinician if it spreads or blisters'],
    },
    'eczema': {
        'medicines': ['A fragrance-free moisturizer', 'A mild topical steroid if advised'],
        'precautions': ['Avoid harsh soaps and allergens', 'Keep skin moisturized', 'Seek care if it becomes infected'],
    },
    'psoriasis': {
        'medicines': ['A mild topical steroid if advised'],
        'precautions': ['Keep skin moisturized', 'Avoid skin trauma', 'See a dermatologist for ongoing flares'],
    },
    'hives': {
        'medicines': ['Cetirizine'],
        'precautions': ['Avoid the trigger if you can identify it', 'Keep the skin cool', 'Seek urgent care if breathing or swallowing is affected'],
    },
    'ringworm': {
        'medicines': ['A topical antifungal cream'],
        'precautions': ['Keep the area clean and dry', 'Avoid sharing towels or clothing', 'Continue treatment as directed'],
    },
    'skin allergy': {
        'medicines': ['Cetirizine', 'A mild topical anti-itch cream'],
        'precautions': ['Avoid the trigger if known', 'Keep the area cool', 'See a doctor if it worsens'],
    },
    'skin irritation': {
        'medicines': ['A fragrance-free moisturizer', 'A mild anti-itch cream'],
        'precautions': ['Avoid harsh soaps and fragrances', 'Keep the skin clean and dry', 'Seek help if it becomes infected'],
    },
    'dry skin': {
        'medicines': ['A fragrance-free moisturizer'],
        'precautions': ['Use lukewarm water', 'Apply moisturizer after bathing', 'Avoid very hot showers'],
    },
    'chapped lips': {
        'medicines': ['A lip balm with petrolatum'],
        'precautions': ['Avoid licking your lips', 'Use a humidifier if the air is dry'],
    },
    'cracked lips': {
        'medicines': ['A lip balm with petrolatum'],
        'precautions': ['Avoid licking your lips', 'Use a humidifier if the air is dry'],
    },
    'mouth pain': {
        'medicines': ['Paracetamol', 'A topical oral gel'],
        'precautions': ['Avoid spicy food', 'Rinse with warm salt water', 'See a dentist if it persists'],
    },
    'sore gums': {
        'medicines': ['Paracetamol', 'A salt-water rinse'],
        'precautions': ['Use a soft toothbrush', 'Avoid hard or spicy food', 'See a dentist if swelling or bleeding continues'],
    },
    'tooth sensitivity': {
        'medicines': ['A desensitizing toothpaste'],
        'precautions': ['Avoid very hot, cold, or acidic foods', 'See a dentist for persistent sensitivity'],
    },
    'bad breath': {
        'medicines': [],
        'precautions': ['Brush and floss regularly', 'Drink water', 'See a dentist if it persists'],
    },
    'mouth smell': {
        'medicines': [],
        'precautions': ['Brush and floss regularly', 'Drink water', 'See a dentist if it persists'],
    },
    'blocked nose': {
        'medicines': ['A decongestant (short-term use only)', 'Saline nasal spray'],
        'precautions': ['Steam inhalation', 'Stay hydrated', 'Avoid lying flat'],
    },
    'nasal drip': {
        'medicines': ['Cetirizine', 'Saline nasal spray'],
        'precautions': ['Stay hydrated', 'Avoid known allergens/irritants', 'Steam can help'],
    },
    'post nasal drip': {
        'medicines': ['Cetirizine', 'Saline nasal spray'],
        'precautions': ['Stay hydrated', 'Use a humidifier', 'Avoid smoke and dust'],
    },
    'ear blockage': {
        'medicines': ['Paracetamol if painful'],
        'precautions': ['Avoid inserting anything into the ear', 'Try a warm compress', 'Seek care if hearing changes or pain persists'],
    },
    'ringing in ears': {
        'medicines': [],
        'precautions': ['Avoid loud noise', 'Rest in a quiet space', 'See a doctor if it is persistent or severe'],
    },
    'tinnitus': {
        'medicines': [],
        'precautions': ['Avoid loud noise and stress', 'Try a quiet environment', 'Seek care if it suddenly begins or bothers you a lot'],
    },
    'lightheadedness': {
        'medicines': [],
        'precautions': ['Sit or lie down until it passes', 'Stay hydrated', 'Seek care if it keeps happening'],
    },
    'faintness': {
        'medicines': [],
        'precautions': ['Sit or lie down', 'Avoid standing too quickly', 'Seek medical advice if it recurs'],
    },
    'low energy': {
        'medicines': [],
        'precautions': ['Try a balanced meal and rest', 'Stay hydrated', 'See a doctor if it is sudden or unexplained'],
    },
    'exhaustion': {
        'medicines': [],
        'precautions': ['Prioritize sleep and hydration', 'Reduce stress where possible', 'Seek care if it is severe or unexplained'],
    },
    'tiredness': {
        'medicines': [],
        'precautions': ['Rest and hydrate', 'Eat regular meals', 'See a doctor if it persists'],
    },
    'sleepy': {
        'medicines': [],
        'precautions': ['Try to rest in a dark quiet room', 'Avoid caffeine late in the day'],
    },
    'restless': {
        'medicines': [],
        'precautions': ['Try calming music or breathing', 'Avoid caffeine late in the day', 'Seek help if it keeps you from sleeping'],
    },
    'stress': {
        'medicines': [],
        'precautions': ['Try slow breathing or a short walk', 'Keep a regular sleep schedule', 'Talk to a professional if it feels overwhelming'],
    },
    'anxiety': {
        'medicines': [],
        'precautions': ['Limit caffeine', 'Try slow breathing', 'Consider professional support if it feels persistent'],
    },
    'panic': {
        'medicines': [],
        'precautions': ['Sit down and breathe slowly', 'Avoid caffeine', 'Seek urgent help if you feel you may pass out or hurt yourself'],
    },
    'insomnia': {
        'medicines': [],
        'precautions': ['Avoid screens and caffeine before bed', 'Keep a regular sleep routine', 'See a doctor if it persists'],
    },
    'backache': {
        'medicines': ['Paracetamol', 'Ibuprofen', 'A topical pain-relief gel'],
        'precautions': ['Avoid heavy lifting', 'Gentle stretching helps', 'Seek care if there is weakness or numbness'],
    },
    'waist pain': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Avoid twisting or lifting', 'Gentle movement and rest', 'Seek care if pain is severe or radiates down a leg'],
    },
    'leg pain': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Rest the leg', 'Apply ice if there is swelling', 'Seek care for sudden or severe pain'],
    },
    'foot pain': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Rest and elevate the foot', 'Avoid standing for long periods', 'Seek care if there’s swelling or bruising'],
    },
    'swollen ankle': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Rest and elevate the ankle', 'Apply ice', 'Seek care if it’s severe or after an injury'],
    },
    'swollen feet': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Elevate the feet', 'Avoid standing for long periods', 'Seek care if it is sudden or severe'],
    },
    'wrist pain': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Rest the wrist', 'Ice it if there was an injury', 'Seek care if you cannot move it normally'],
    },
    'sore eyes': {
        'medicines': ['Lubricating eye drops'],
        'precautions': ['Avoid rubbing the eyes', 'Remove contact lenses if worn', 'Seek help if vision changes'],
    },
    'burning eyes': {
        'medicines': ['Lubricating eye drops'],
        'precautions': ['Avoid rubbing the eyes', 'Take breaks from screens', 'Seek care if it’s severe or persistent'],
    },
    'swollen eyelid': {
        'medicines': ['Lubricating eye drops'],
        'precautions': ['Avoid rubbing the eye', 'Apply a cool compress', 'See a doctor if the swelling is severe'],
    },
    'itchy eyes': {
        'medicines': ['Lubricating eye drops', 'Cetirizine if allergy-related'],
        'precautions': ['Avoid rubbing', 'Avoid allergens/irritants', 'Seek help if it is severe or persistent'],
    },
    'sore nose': {
        'medicines': ['A saline nasal spray'],
        'precautions': ['Avoid rubbing', 'Use a humidifier', 'Seek care if it bleeds or is severe'],
    },
    'nosebleed': {
        'medicines': [],
        'precautions': ['Pinch the nose and lean forward', 'Keep the head elevated', 'Seek urgent care if it does not stop or is heavy'],
    },
    'wheezing': {
        'medicines': [],
        'precautions': ['Avoid smoke and triggers', 'Seek urgent care if it is severe or breathing is affected'],
    },
    'shortness of breath': {
        'medicines': [],
        'precautions': ['Seek emergency care right away if breathing is difficult', 'Do not wait to see whether it improves'],
    },
    'trouble breathing': {
        'medicines': [],
        'precautions': ['Seek emergency care right away', 'Do not wait to see whether it improves'],
    },
    'nose congestion': {
        'medicines': ['A decongestant (short-term use only)', 'Saline nasal spray'],
        'precautions': ['Steam inhalation', 'Stay hydrated', 'Use a humidifier'],
    },
    'sinus pain': {
        'medicines': ['Paracetamol', 'A decongestant (short-term use only)'],
        'precautions': ['Use steam inhalation', 'A warm compress over the face can help', 'See a clinician if it persists'],
    },
    'sinus infection': {
        'medicines': ['Paracetamol', 'A decongestant (short-term use only)'],
        'precautions': ['Rest and stay hydrated', 'Steam inhalation can help', 'See a doctor if it lasts more than a week or gets worse'],
    },
    'cold sore': {
        'medicines': ['A topical antiviral cream'],
        'precautions': ['Avoid touching or picking it', 'Keep the area clean', 'See a clinician if it is severe or recurrent'],
    },
    'canker sore': {
        'medicines': ['A topical oral gel'],
        'precautions': ['Avoid spicy foods', 'Rinse with warm salt water', 'See a dentist if it recurs often'],
    },
    'sore lip': {
        'medicines': ['A lip balm with petrolatum', 'Paracetamol if painful'],
        'precautions': ['Avoid licking', 'Use a protectant balm', 'Seek care if it bleeds or swells'],
    },
    'sore eyelid': {
        'medicines': ['Lubricating eye drops'],
        'precautions': ['Avoid rubbing', 'Use a cool compress', 'See a doctor if swelling persists'],
    },
    'joint swelling': {
        'medicines': ['Ibuprofen', 'A topical anti-inflammatory gel'],
        'precautions': ['Rest the joint', 'Apply ice', 'Seek care if the swelling is severe or sudden'],
    },
    'redness': {
        'medicines': ['A mild topical anti-itch cream'],
        'precautions': ['Avoid rubbing or scratching', 'Keep the area clean', 'Seek care if it spreads or becomes painful'],
    },
    'blister': {
        'medicines': ['A topical antiseptic or wound ointment'],
        'precautions': ['Keep it clean and covered', 'Avoid popping it', 'Seek care if it becomes infected'],
    },
    'blisters': {
        'medicines': ['A topical antiseptic or wound ointment'],
        'precautions': ['Keep them clean and covered', 'Avoid popping them', 'Seek care if they become infected'],
    },
    'swelling': {
        'medicines': ['Paracetamol', 'Ibuprofen'],
        'precautions': ['Elevate the area if possible', 'Apply ice for injury-related swelling', 'Seek care if it is severe or sudden'],
    },
    'feeling low': {
        'medicines': [],
        'precautions': ['Talk to someone you trust', 'Try a walk or a little rest', 'Seek professional support if it persists'],
    },
    'depression': {
        'medicines': [],
        'precautions': ['Please consider speaking with a mental-health professional', 'Keep regular sleep and meals', 'Seek urgent help if you feel unsafe'],
    },
    'mood swings': {
        'medicines': [],
        'precautions': ['Try resting and eating regularly', 'Avoid alcohol and excessive caffeine', 'Seek support if they’re intense or persistent'],
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
    'high temperature': {
        'medicines': ['Paracetamol (Acetaminophen)'],
        'precautions': ['Rest and stay hydrated', 'Seek medical care if it is very high or persistent', 'Keep the room cool and use light bedding'],
    },
    'temperature': {
        'medicines': ['Paracetamol (Acetaminophen)'],
        'precautions': ['Rest and stay hydrated', 'Monitor the temperature', 'Seek help if it rises quickly or comes with confusion'],
    },
    'feverish': {
        'medicines': ['Paracetamol (Acetaminophen)'],
        'precautions': ['Rest and keep fluids up', 'Watch for worsening symptoms', 'Seek care if it lasts beyond a day or two'],
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
    'bad breath': {
        'medicines': [],
        'precautions': ['Brush and floss regularly', 'Drink water', 'See a dentist if it persists'],
    },
    'mouth smell': {
        'medicines': [],
        'precautions': ['Brush and floss regularly', 'Drink water', 'See a dentist if it persists'],
    },
    'mouth ulcer': {
        'medicines': ['A topical oral gel for mouth ulcers'],
        'precautions': ['Avoid spicy/acidic food', 'Rinse with warm salt water', 'Usually heals within a week or two'],
    },
    'burning sensation': {
        'medicines': [],
        'precautions': ['Stop any irritant if you can identify one', 'Seek medical advice if it is severe or persistent'],
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
    'cuts': {
        'medicines': ['An antiseptic solution/cream'],
        'precautions': ['Clean the wound and apply antiseptic', 'Cover with a clean bandage', 'Watch for signs of infection'],
    },
    'scratches': {
        'medicines': ['An antiseptic solution/cream'],
        'precautions': ['Clean the wound', 'Cover with a clean bandage', 'Watch for signs of infection'],
    },
    'rash': {
        'medicines': ['Cetirizine', 'A mild topical anti-itch cream'],
        'precautions': ['Avoid scratching', 'Wear loose breathable clothing', 'See a doctor if it spreads or blisters'],
    },
    'itchy skin': {
        'medicines': ['Cetirizine', 'A topical antihistamine cream'],
        'precautions': ['Avoid scratching', 'Use a fragrance-free moisturizer', 'Keep the area cool'],
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
    'severe allergy': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency care right away if breathing or swallowing is affected', 'Use an epinephrine auto-injector if prescribed and available'],
    },
    'breathing trouble': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency medical care right away', 'Do not wait to see whether it improves on its own'],
    },
    'trouble breathing': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek emergency medical care right away', 'Do not wait to see whether it improves on its own'],
    },
    'wheezing': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek urgent care if it is severe or you have trouble speaking or breathing', 'Avoid any known trigger if possible'],
    },
    'high fever': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek urgent care if it is very high, persistent, or comes with confusion', 'Rest and stay hydrated while getting help'],
    },
    'confusion': {
        'medicines': [], 'urgent': True,
        'precautions': ['Seek urgent medical care right away', 'Do not drive yourself and avoid being alone until you are evaluated'],
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
# clarifying question (see clarify_response()) instead of falling straight
# through to the generic Gemini/static fallback, which had no way to ask
# "which symptom?" and just gave up.
#
# Deliberately broad and repetitive (many "feel X" / "feeling X" pairs) —
# people phrase "something's wrong" in a lot of different ways, and this
# only needs to catch the message, not classify it precisely; the actual
# specific-symptom matching still happens in SYMPTOM_KB above. ~168
# phrases now, roughly 10x the original 18.
HEALTH_HINT_WORDS = (
    # -- original core set --
    'sick', 'unwell', 'not feeling well', 'not well', 'not okay', 'not ok',
    'ill', 'pain', 'ache', 'aches', 'hurts', 'hurting', 'symptom', 'symptoms',
    'feel bad', 'feeling bad', 'feel awful', 'feeling awful',

    # -- "feel/feeling X" variants --
    'feel off', 'feeling off', 'feel weird', 'feeling weird',
    'feel strange', 'feeling strange', 'feel funny', 'feeling funny',
    'feel odd', 'feeling odd', 'feel gross', 'feeling gross',
    'feel rough', 'feeling rough', 'feel terrible', 'feeling terrible',
    'feel horrible', 'feeling horrible', 'feel lousy', 'feeling lousy',
    'feel crummy', 'feeling crummy', 'feel miserable', 'feeling miserable',
    'feel sick', 'feeling sick', 'feel unwell', 'feeling unwell',
    'feel ill', 'feeling ill', 'feel down', 'feeling down',
    'feel low', 'feeling low', 'feel worn out', 'feeling worn out',
    'feel drained', 'feeling drained', 'feel exhausted', 'feeling exhausted',
    'feel out of sorts', 'feeling out of sorts',
    'feel under the weather', 'feeling under the weather',
    'feel poorly', 'feeling poorly', 'feel seedy', 'feeling seedy',
    'feel queasy', 'feeling queasy', 'feel faint', 'feeling faint',
    'feel weak', 'feeling weak', 'feel tired', 'feeling tired',
    'feel nauseous', 'feeling nauseous', 'feel dizzy', 'feeling dizzy',
    'feel uncomfortable', 'feeling uncomfortable',

    # -- "under the weather" / general malaise phrasings --
    'under the weather', 'run down', 'feeling run down', 'run-down',
    'not myself', 'not feeling myself', 'not at my best', 'not at 100%',
    'not at 100 percent', 'not doing well', 'not doing so well',
    'not doing great', 'not doing so great', 'having a rough day',
    'having a bad day health wise', "health isn't great",
    'health is not great', 'poor health', 'not in good health',
    'stomach upset', 'upset stomach', 'stomach ache', 'stomach pain',
    'gastric pain', 'acid reflux', 'food poisoning', 'stomach flu',
    'indigestion', 'bloating', 'bloated', 'constipated', 'loose stools',
    'loose motions', 'diarrhoea', 'diarrhea', 'vomiting', 'throwing up',
    'nauseated', 'itchy skin', 'skin irritation', 'dry skin', 'eczema',
    'hives', 'rash', 'rashes', 'redness', 'blister', 'blisters',
    'sore throat', 'throat pain', 'tickly throat', 'scratchy throat',
    'blocked nose', 'stuffy nose', 'runny nose', 'nasal drip', 'sinus pain',
    'backache', 'body aches', 'leg pain', 'foot pain', 'ankle swelling',
    'earache', 'ear blockage', 'ringing in ears', 'tinnitus', 'sore eyes',
    'itchy eyes', 'burning eyes', 'swollen eyelid', 'lightheaded', 'faint',
    'low energy', 'no energy', 'exhausted', 'sleepy', 'restless',
    'anxious', 'panic', 'stressed', 'depressed', 'feeling low', 'mood swings',

    # -- "something's wrong" phrasings --
    "something's wrong", 'something is wrong', "something's off",
    'something feels wrong', 'something feels off', 'not right',
    "doesn't feel right", 'does not feel right', 'feels wrong',
    'body feels off', 'body feels weird', 'body feels strange',

    # -- pain / discomfort phrasings --
    'body hurts', 'my body hurts', 'everything hurts', 'whole body hurts',
    'sore', 'very sore', 'painful', 'hurting badly', 'tender', 'swollen',
    'runny nose', 'blocked nose', 'stuffy nose', 'congested', 'sniffly',
    'coughing', 'cough', 'sneezing', 'sneezy', 'scratchy throat', 'throat feels sore',
    'feverish', 'high fever', 'temperature', 'hot and sweaty',
    'itchy', 'itching', 'rashes', 'redness', 'swelling', 'blister', 'blisters',
    'diarrhoea', 'diarrhea', 'loose stools', 'constipated', 'stomach cramps',
    'nauseated', 'throwing up', 'vomiting', 'queasy', 'upset stomach',
    'dizzy', 'lightheaded', 'woozy', 'head spinning', 'tired', 'exhausted',
    'sleepy', 'trouble sleeping', 'cant sleep', 'insomnia', 'restless',
    'anxious', 'panic', 'stressed', 'overwhelmed', 'worried', 'nervous',
    'in pain', 'in a lot of pain', 'having pain', 'having discomfort',
    'feel discomfort', 'feeling discomfort', 'in discomfort',
    'uncomfortable', 'something hurts', "something's hurting",
    'physically unwell', 'physically not well',

    # -- illness / getting sick phrasings --
    'have symptoms', 'having symptoms', 'showing symptoms',
    'developed symptoms', 'come down with something',
    'coming down with something', 'catching something',
    'might be coming down with something',
    "feel like i'm getting sick", 'feel like i am getting sick',
    'getting sick', 'falling sick', 'fell sick', 'fallen ill',
    'taken ill', 'medically unwell',

    # -- "don't feel good" phrasings --
    "don't feel good", 'dont feel good', 'do not feel good',
    'not feeling good', "isn't feeling good", 'is not feeling good',

    # -- functional/energy complaints --
    "can't function", 'cant function', 'cannot function',
    "can't get out of bed", 'cant get out of bed',
    'cannot get out of bed', 'no energy', 'zero energy',

    # -- seeking help phrasings --
    'health issue', 'health problem', 'health concern',
    'medical issue', 'medical problem', 'medical concern',
    'worried about my health', 'need medical help', 'need medical advice',
    'need a doctor', 'need to see a doctor', 'should i see a doctor',
    'should i go to the doctor', "i'm worried", 'i am worried',
    'need advice', 'looking for advice', 'need help with this', 'what should i do',
    'what can i take', 'can you advise me', 'what medicine can i use',
    'is this serious', 'should i be worried', 'what does this mean',
    'is this normal', 'is this urgent', 'does it need a doctor',
)

# Predefined canned responses — the diagram's "Predefined responses" and
# rule-driven FAQ boxes (Prescription question / Delivery question).
#
# Each of these is now a tuple of ~10 differently-worded variants (same
# meaning, different phrasing) rather than one fixed string. A chatbot
# that says the exact same sentence every single time it's asked about
# delivery, or every time someone says "hi", reads as obviously canned;
# picking a random variant per reply (see the *_response()/greeting()
# helpers below) makes repeated use feel less robotic without changing
# what's actually being said. `chat()` in views.py calls these helpers —
# it never reads GREETING_RESPONSES[0] or a bare FALLBACK_RESPONSE string
# directly.
GREETING_RESPONSES = (
    "Hi! I'm PharmaSync's assistant. Ask me about a medicine, your order status, or a symptom like a headache or fever.",
    "Hello! I can help with medicine info, order tracking, or general symptom guidance — what's up?",
    "Hey there! Tell me what's going on — a symptom, an order question, or a medicine you're looking for.",
    "Hi, welcome to PharmaSync! I can look up medicines, check your order status, or suggest OTC options for common symptoms.",
    "Hello! Feeling unwell, or here about an order or a medicine? I can help with any of those.",
    "Hey! I'm here to help — ask about a symptom (like fever or headache), an order, or a medicine's price/stock.",
    "Hi there! What can I help you with today — a health question, an order update, or something in our catalog?",
    "Hello, I'm the PharmaSync assistant. Let me know your symptom, order number question, or medicine query.",
    "Hey! Ready when you are — symptoms, orders, prescriptions, or medicine details, I've got you covered.",
    "Hi! Whether it's a symptom, a medicine, or an order, just tell me what's on your mind.",
)

PRESCRIPTION_FAQ = (
    "Some medicines on PharmaSync require a valid prescription. When your cart has one of those, "
    "you'll be asked to upload a prescription at checkout — our pharmacist team reviews it, and your "
    "order proceeds once it's approved. You can check an order's prescription status on its Order Details page.",

    "For prescription-only medicines, you'll need to upload a valid prescription at checkout. Our pharmacist "
    "team reviews it before the order is confirmed, and you can track its approval status from your Order Details page.",

    "Prescription-only items in your cart trigger an upload step at checkout. Once our pharmacists approve it, "
    "your order moves forward — you can always check where that review stands on the Order Details page.",

    "If you've added a prescription-required medicine, checkout will ask you to upload a valid prescription. "
    "A pharmacist reviews and approves it, and the order's Order Details page shows exactly where that stands.",

    "Certain medicines need a prescription on file before we can ship them. Upload yours at checkout, our "
    "pharmacist team will review it, and you'll see the approval status on the relevant Order Details page.",

    "You'll be prompted to upload a prescription at checkout for any medicine that requires one. Our pharmacists "
    "review every upload, and approval status is always visible on that order's details page.",

    "Prescription requirement works like this: add the medicine, upload your prescription at checkout, and a "
    "pharmacist reviews it before the order is confirmed. Status updates live on the Order Details page.",

    "For Rx-required medicines, checkout includes a prescription upload step. A pharmacist reviews it, and once "
    "approved your order proceeds — check status any time from Order Details.",

    "Medicines that need a prescription will prompt you to upload one during checkout. Our pharmacist team "
    "reviews each upload, and you can follow its approval status on that order's Order Details page.",

    "When your order includes a prescription-only medicine, you'll upload your prescription at checkout for "
    "pharmacist review. Once approved, the order moves ahead — track that on Order Details.",
)

DELIVERY_FAQ = (
    "Orders move through Pending \u2192 Confirmed \u2192 Packed \u2192 Out for Delivery \u2192 Delivered. "
    "You can track any order's current status from My Orders.",

    "Every order goes through the same stages: Pending, Confirmed, Packed, Out for Delivery, then Delivered. "
    "Check My Orders any time to see exactly where yours is.",

    "Delivery tracking is simple — Pending \u2192 Confirmed \u2192 Packed \u2192 Out for Delivery \u2192 Delivered, "
    "all visible from your My Orders page.",

    "You can follow your order's journey (Pending, Confirmed, Packed, Out for Delivery, Delivered) from the "
    "My Orders section at any time.",

    "Orders progress step by step: Pending, then Confirmed, Packed, Out for Delivery, and finally Delivered. "
    "My Orders always shows the current stage.",

    "From the moment you place an order it moves through Pending \u2192 Confirmed \u2192 Packed \u2192 Out for "
    "Delivery \u2192 Delivered — check My Orders for live status.",

    "Wondering where your order is? It moves through five stages (Pending, Confirmed, Packed, Out for Delivery, "
    "Delivered), all trackable from My Orders.",

    "Delivery status updates as your order is Confirmed, then Packed, then Out for Delivery, and finally "
    "Delivered — you can check this any time under My Orders.",

    "Each order passes through Pending, Confirmed, Packed, Out for Delivery, and Delivered in that order. "
    "My Orders shows exactly which stage yours is at right now.",

    "You can track exactly where your order is — Pending, Confirmed, Packed, Out for Delivery, or Delivered — "
    "from the My Orders page.",
)

FALLBACK_RESPONSE = (
    "I'm not able to help with that one directly \u2014 for anything specific to your health, "
    "please consult a doctor or pharmacist.",

    "That's a bit outside what I can help with directly \u2014 for anything specific to your health, "
    "a doctor or pharmacist would be the right person to ask.",

    "I don't have a good answer for that one \u2014 please check with a doctor or pharmacist for "
    "anything specific to your health.",

    "I'm not confident I can help with that directly. For anything health-specific, it's best to "
    "consult a doctor or pharmacist.",

    "That one's outside what I can reliably answer \u2014 a doctor or pharmacist would be able to "
    "give you proper guidance on it.",

    "I'd rather not guess on that one. For anything specific to your health, please reach out to a "
    "doctor or pharmacist.",

    "I'm not the right source for that \u2014 please consult a doctor or pharmacist for anything "
    "specific to your health.",

    "That's beyond what I can confidently help with here \u2014 a doctor or pharmacist can give you "
    "an accurate answer.",

    "I can't give a reliable answer on that one. Please check with a doctor or pharmacist for "
    "anything specific to your health.",

    "I'm not equipped to answer that directly \u2014 for anything specific to your health, please "
    "consult a doctor or pharmacist.",
)


def greeting_response():
    return random.choice(GREETING_RESPONSES)


def prescription_faq_response():
    return random.choice(PRESCRIPTION_FAQ)


def delivery_faq_response():
    return random.choice(DELIVERY_FAQ)

def fallback_response():
    return random.choice(FALLBACK_RESPONSE)


# What SYMPTOM_KB actually covers, sampled for the clarifying question
# below. Previously this was a fixed 10-item tuple always shown in full —
# expanded here to every non-urgent SYMPTOM_KB entry (~86, as close to a
# 10x increase over the original 10 as the actual knowledge base
# supports — it's built from real SYMPTOM_KB keys rather than padded with
# invented ones, so every example clarify_response() gives is guaranteed
# to actually match if the person repeats it back). Urgent/red-flag
# entries (chest pain, dengue, ...) are deliberately excluded — those
# should never be offered up as a casual "try telling me about this"
# example.
#
# Showing all ~86 in one message would still be a wall of text, so
# clarify_response() below randomly samples a short, readable handful from
# this larger pool each time instead of printing the whole thing — bigger
# underlying variable, still a readable reply, and it varies from one
# conversation to the next rather than always listing the same 10.
_CLARIFY_SAMPLE = tuple(sorted(symptom for symptom, info in SYMPTOM_KB.items() if not info.get('urgent')))

_CLARIFY_SAMPLE_SIZE = 10  # how many examples clarify_response() shows per reply


def _known_symptoms_list():
    pool = list(_CLARIFY_SAMPLE)
    sample_size = min(_CLARIFY_SAMPLE_SIZE, len(pool))
    return ', '.join(random.sample(pool, sample_size))


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
    normalized_message = normalize_message_for_symptoms(message_lower)
    raw_matches = [symptom for symptom in SYMPTOM_KB if symptom in normalized_message]
    if not raw_matches:
        raw_matches = [symptom for symptom in SYMPTOM_KB if symptom in message_lower]

    kept_set = set(_drop_nested_matches(raw_matches))
    ordered = [symptom for symptom in SYMPTOM_KB if symptom in kept_set]
    ordered.sort(key=lambda symptom: not SYMPTOM_KB[symptom].get('urgent', False))
    return [(symptom, SYMPTOM_KB[symptom]) for symptom in ordered]


def get_symptom_summary(message_lower):
    """A light-weight helper returning the matched symptoms and urgency state."""
    matches = match_all_symptoms(message_lower)
    return {
        'symptoms': [symptom for symptom, _ in matches],
        'urgent': any(info.get('urgent', False) for _, info in matches),
    }


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
    normalized = normalize_message_for_symptoms(message_lower)
    return any(w in normalized for w in HEALTH_HINT_WORDS)
