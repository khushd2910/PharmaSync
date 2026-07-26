/**
 * Local, dependency-free fallback for the AI Chatbot (Module 9).
 *
 * The "real" chatbot logic lives in python-service/chatbot (Django +
 * MongoDB + optional Gemini). This file is a small, deliberately limited
 * JS mirror of just its symptom knowledge base — used ONLY when the
 * Django service can't be reached at all (not running, network error,
 * timeout). Without this, the entire chatbot silently died the moment
 * that one Python process wasn't up: chatController.js would show
 * "Sorry, the assistant is temporarily unavailable" for every single
 * message, including something as basic as "I have a fever" — which
 * needs no database or AI call to answer, just a lookup table.
 *
 * Keep this in sync with python-service/chatbot/knowledge_base.py's
 * SYMPTOM_KB by hand if that one changes — there's no code sharing across
 * the language boundary. This mirror intentionally only covers greetings
 * and the symptom knowledge base, not order lookups, medicine search, or
 * Gemini — those genuinely need the Django service (MongoDB / an LLM),
 * so for those `getLocalFallbackReply` returns null and the caller falls
 * through to the normal "temporarily unavailable" message.
 */

const SYMPTOM_KB = {
  headache: {
    medicines: ['Paracetamol (Acetaminophen)', 'Ibuprofen'],
    precautions: ['Rest in a quiet, dimly lit room', 'Stay hydrated', 'Limit screen time until it eases'],
  },
  fever: {
    medicines: ['Paracetamol (Acetaminophen)'],
    precautions: ['Rest and stay hydrated', 'Monitor your temperature every few hours', 'Wear light clothing and keep the room cool'],
  },
  cold: {
    medicines: ['Cetirizine', 'Paracetamol'],
    precautions: ['Drink warm fluids', 'Try steam inhalation', 'Get extra rest'],
  },
  cough: {
    medicines: ['A cough syrup suited to dry vs. productive cough', 'Cetirizine (if allergy-related)'],
    precautions: ['Avoid cold drinks and smoke exposure', 'Try warm water with honey'],
  },
  acidity: {
    medicines: ['Antacid tablets/syrup', 'Pantoprazole (OTC strength)'],
    precautions: ['Avoid spicy, oily, or acidic foods', "Don't lie down immediately after eating"],
  },
  heartburn: {
    medicines: ['Antacid tablets/syrup'],
    precautions: ['Avoid large meals late at night', 'Sit upright for a while after eating'],
  },
  'body pain': {
    medicines: ['Paracetamol', 'Ibuprofen'],
    precautions: ['Rest the affected area', 'Gentle stretching once pain eases'],
  },
  allergy: {
    medicines: ['Cetirizine', 'Loratadine'],
    precautions: ['Avoid the known trigger/allergen where possible', 'Keep the environment dust-free'],
  },
};

const HEALTH_HINT_WORDS = [
  'sick', 'unwell', 'not feeling well', 'not well', 'not okay', 'not ok',
  'ill', 'pain', 'ache', 'aches', 'hurts', 'hurting', 'symptom', 'symptoms',
  'feel bad', 'feeling bad', 'feel awful', 'feeling awful',
];

const GREETING_WORDS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
const GREETING_MAX_WORDS = 4; // "hi there" is a greeting; "hi, i have a fever" is not — see isPureGreeting

const DISCLAIMER =
  'This is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.';

const isPureGreeting = (messageLower) => {
  const stripped = messageLower.trim().replace(/[.,!?]+$/, '');
  if (GREETING_WORDS.includes(stripped)) return true;
  if (!GREETING_WORDS.some((w) => stripped.startsWith(w))) return false;
  return stripped.split(/\s+/).filter(Boolean).length <= GREETING_MAX_WORDS;
};

const matchAllSymptoms = (messageLower) => Object.entries(SYMPTOM_KB).filter(([symptom]) => messageLower.includes(symptom));

const isHealthRelated = (messageLower) => HEALTH_HINT_WORDS.some((w) => messageLower.includes(w));

/**
 * Returns a chat reply object ({ reply, intent, disclaimer? }) if this
 * message is something the local mirror can confidently answer, or null
 * if it's outside this fallback's scope (order lookups, medicine catalog
 * search, anything needing Gemini) — in which case the caller should show
 * its own "temporarily unavailable" message instead of guessing.
 */
const getLocalFallbackReply = (message) => {
  const messageLower = message.toLowerCase();

  if (isPureGreeting(messageLower)) {
    return {
      reply: "Hi! I'm PharmaSync's assistant. Ask me about a symptom like a headache or fever and I can suggest common OTC options.",
      intent: 'greeting',
    };
  }

  const matches = matchAllSymptoms(messageLower);
  if (matches.length > 0) {
    const sections = matches.map(
      ([symptom, info]) => `For ${symptom}: ${info.medicines.join(', ')}. (${info.precautions.join('; ')}.)`
    );
    return {
      reply: `${sections.join('\n')}\nConsult a doctor if symptoms persist or worsen.`,
      intent: 'symptom_advice',
      disclaimer: DISCLAIMER,
    };
  }

  if (isHealthRelated(messageLower)) {
    const known = Object.keys(SYMPTOM_KB).sort().join(', ');
    return {
      reply: `Sorry to hear that — could you tell me a bit more about what you're experiencing? I can help with common symptoms like: ${known}.`,
      intent: 'symptom_clarify',
      disclaimer: DISCLAIMER,
    };
  }

  return null;
};

module.exports = { getLocalFallbackReply };
