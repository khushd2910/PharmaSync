import logging
import os
import sys
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analytics'))
from model_registry import save_model, load_model, is_stale
from ml_config import (
    CHATBOT_CONFIDENCE_THRESHOLD as DEFAULT_CONFIDENCE_THRESHOLD,
    CHATBOT_LOGREG_C,
    CHATBOT_LOGREG_MAX_ITER,
    CHATBOT_MODEL_NAME as MODEL_NAME,
    CHATBOT_MAX_MODEL_AGE_HOURS as MAX_MODEL_AGE_HOURS,
)

logger = logging.getLogger(__name__)


# Labeled training dataset for supervised learning
TRAINING_DATA = [
    # greeting
    ("hi", "greeting"),
    ("hello", "greeting"),
    ("hey", "greeting"),
    ("good morning", "greeting"),
    ("good afternoon", "greeting"),
    ("good evening", "greeting"),
    ("hi there", "greeting"),
    ("hello assistant", "greeting"),
    ("yo", "greeting"),
    ("hey chatbot", "greeting"),
    ("is anyone there", "greeting"),
    ("greetings", "greeting"),
    ("good to see you", "greeting"),
    ("nice to meet you", "greeting"),
    ("hello there", "greeting"),
    ("hey there", "greeting"),

    # disambiguation
    ("i need something for my fever", "disambiguation"),
    ("i need something for my cough", "disambiguation"),

    # order_status
    ("where is my order", "order_status"),
    ("track my shipment", "order_status"),
    ("check my order status", "order_status"),
    ("where is my package", "order_status"),
    ("has my order shipped", "order_status"),
    ("status of order", "order_status"),
    ("order delivery status", "order_status"),
    ("track package", "order_status"),
    ("my order has not arrived", "order_status"),
    ("can i track my order", "order_status"),
    ("where is my delivery", "order_status"),
    ("track invoice status", "order_status"),
    ("please tell me where my parcel is", "order_status"),
    ("has my package been dispatched", "order_status"),
    ("help me check my order progress", "order_status"),
    ("i need to know if my delivery is out", "order_status"),
    ("can you check shipment status", "order_status"),
    ("find my last order", "order_status"),
    ("why hasn't my parcel arrived", "order_status"),
    ("why has my parcel not arrived", "order_status"),

    # prescription_question
    ("how do i upload my prescription", "prescription_question"),
    ("do i need a prescription", "prescription_question"),
    ("upload prescription", "prescription_question"),
    ("rx medicine request", "prescription_question"),
    ("prescription verification", "prescription_question"),
    ("why was my prescription rejected", "prescription_question"),
    ("prescription approval time", "prescription_question"),
    ("can i buy this without prescription", "prescription_question"),
    ("can i order this without a doctor's note", "prescription_question"),
    ("does this require rx", "prescription_question"),
    ("prescription status info", "prescription_question"),
    ("who approves my prescription", "prescription_question"),
    ("can i upload a doctor prescription", "prescription_question"),
    ("how long does prescription review take", "prescription_question"),
    ("what happens after i upload rx", "prescription_question"),

    # delivery_question
    ("how long does delivery take", "delivery_question"),
    ("shipping cost", "delivery_question"),
    ("do you deliver to my area", "delivery_question"),
    ("shipping policy", "delivery_question"),
    ("when will it be delivered", "delivery_question"),
    ("delivery timing", "delivery_question"),
    ("express shipping options", "delivery_question"),
    ("how do you ship packages", "delivery_question"),
    ("delivery locations", "delivery_question"),
    ("shipping charges", "delivery_question"),
    ("what is the delivery process", "delivery_question"),
    ("how does delivery work", "delivery_question"),
    ("delivery process details", "delivery_question"),
    ("what is the shipping fee", "delivery_question"),
    ("how quickly will my order arrive", "delivery_question"),
    ("can you ship to my city", "delivery_question"),

    # recommendation
    ("what should i buy", "recommendation"),
    ("recommend some products", "recommendation"),
    ("what are the best sellers", "recommendation"),
    ("suggest a medicine", "recommendation"),
    ("recommend a general multivitamin", "recommendation"),
    ("popular products right now", "recommendation"),
    ("what is recommended for health", "recommendation"),
    ("any good medicine suggestions", "recommendation"),
    ("suggest featured items", "recommendation"),
    ("what would you suggest for everyday wellness", "recommendation"),
    ("show me popular items", "recommendation"),
    ("can you recommend a trusted supplement", "recommendation"),
    ("what's the best painkiller i can buy", "recommendation"),

    # medicine_question
    ("what is the price of paracetamol", "medicine_question"),
    ("is aspirin in stock", "medicine_question"),
    ("do you have cough syrup in stock", "medicine_question"),
    ("cost of ibuprofen", "medicine_question"),
    ("how much does insulin cost", "medicine_question"),
    ("stock availability of tablets", "medicine_question"),
    ("check price of dolo 650", "medicine_question"),
    ("is cetirizine available", "medicine_question"),
    ("price of capsule", "medicine_question"),
    ("is this drug in stock", "medicine_question"),
    ("do you stock vitamin c", "medicine_question"),
    ("tell me the current price of amoxicillin", "medicine_question"),
    ("is paracetamol available today", "medicine_question"),
    ("i'm asking about a cough syrup", "medicine_question"),

    # symptom_advice
    ("i have a fever and headache", "symptom_advice"),
    ("my head hurts and i have a cold", "symptom_advice"),
    ("coughing and sneezing remedies", "symptom_advice"),
    ("i have stomach ache", "symptom_advice"),
    ("what is good for diarrhea", "symptom_advice"),
    ("treatment for sore throat", "symptom_advice"),
    ("migraine pain relief", "symptom_advice"),
    ("my muscles are cramping", "symptom_advice"),
    ("remedy for bloating", "symptom_advice"),
    ("constipation cure", "symptom_advice"),
    ("what to take for back pain", "symptom_advice"),
    ("remedy for chest pain", "symptom_advice"),
    ("remedy for difficulty breathing", "symptom_advice"),
    ("hi i have a fever", "symptom_advice"),
    ("hello i feel sick with a cold", "symptom_advice"),
    ("hey can you help with my sore throat", "symptom_advice"),
    ("good morning i have headache and nausea", "symptom_advice"),
    ("i need advice for stomach pain", "symptom_advice"),
    ("which medicine helps with vomiting", "symptom_advice"),

    # symptom_clarify
    ("i feel sick", "symptom_clarify"),
    ("i am feeling unwell", "symptom_clarify"),
    ("not feeling great today", "symptom_clarify"),
    ("something feels off with my body", "symptom_clarify"),
    ("i feel horrible", "symptom_clarify"),
    ("feeling down", "symptom_clarify"),
    ("under the weather", "symptom_clarify"),
    ("not feeling myself today", "symptom_clarify"),
    ("i feel terrible", "symptom_clarify"),
    ("feeling bad", "symptom_clarify"),
    ("i am not feeling well", "symptom_clarify"),
    ("i feel a little off", "symptom_clarify"),
    ("something is wrong with me", "symptom_clarify"),
]

DEFAULT_CONFIDENCE_THRESHOLD = 0.42

class IntentClassifier:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', lowercase=True)
        self.classifier = LogisticRegression(C=CHATBOT_LOGREG_C, max_iter=CHATBOT_LOGREG_MAX_ITER, class_weight='balanced')
        self.is_trained = False
        self._load_or_train()


    def _load_or_train(self):
        saved, meta = load_model(MODEL_NAME)
        if saved is not None and not is_stale(meta, MAX_MODEL_AGE_HOURS):
            try:
                self.vectorizer, self.classifier = saved
                self.is_trained = True
                logger.info(
                    "Loaded saved intent classifier (trained_at=%s, %d records) instead of retraining",
                    meta.get('trained_at'), meta.get('training_records'),
                )
                return
            except Exception as e:
                logger.warning("Saved intent classifier could not be loaded, retraining: %s", str(e))
        self._train()

    def _train(self):
        try:
            texts = [item[0] for item in TRAINING_DATA]
            labels = [item[1] for item in TRAINING_DATA]
            X = self.vectorizer.fit_transform(texts)
            self.classifier.fit(X, labels)
            self.is_trained = True
            logger.info("Intent classifier trained successfully on %d records", len(TRAINING_DATA))
            save_model(MODEL_NAME, (self.vectorizer, self.classifier), {
                'training_records': len(TRAINING_DATA),
                'num_intents': len(set(labels)),
            })
        except Exception as e:
            logger.exception("Failed to train intent classifier: %s", str(e))
            self.is_trained = False

    def predict_intent(self, message):
        """
        Predict the intent of the message and return (intent_name, confidence_score).
        Returns a low-confidence fallback when the classifier is not trained or its
        confidence fails the guard threshold.
        """
        if not self.is_trained:
            return "general_question", 0.0

        try:
            X_msg = self.vectorizer.transform([message])
            probs = self.classifier.predict_proba(X_msg)[0]
            max_idx = probs.argmax()
            intent = self.classifier.classes_[max_idx]
            confidence = float(probs[max_idx])

            if confidence < DEFAULT_CONFIDENCE_THRESHOLD:
                return "general_question", confidence

            return intent, confidence
        except Exception as e:
            logger.error("Error predicting intent: %s", str(e))
            return "general_question", 0.0

    def explain_prediction(self, message):
        """
        Feature explainability (LogisticRegression.coef_ x TF-IDF token weights).
        Returns a dictionary containing predicted intent, confidence score,
        and human-readable explanations of which words/ngrams drove the classification.
        """
        intent, confidence = self.predict_intent(message)
        if not self.is_trained or intent == "general_question":
            return {
                'intent': intent,
                'confidence': confidence,
                'explanation': 'Low confidence or unclassified message; fallback to general conversation.',
                'top_contributing_words': []
            }

        try:
            feature_names = self.vectorizer.get_feature_names_out()
            X_msg = self.vectorizer.transform([message])
            nonzero_indices = X_msg.nonzero()[1]

            if len(nonzero_indices) == 0:
                return {
                    'intent': intent,
                    'confidence': confidence,
                    'explanation': 'No trained vocabulary terms present in message.',
                    'top_contributing_words': []
                }

            class_idx = list(self.classifier.classes_).index(intent)
            coefs = self.classifier.coef_[class_idx]

            word_scores = []
            for idx in nonzero_indices:
                feature_word = feature_names[idx]
                tfidf_val = X_msg[0, idx]
                weight = coefs[idx]
                contribution = tfidf_val * weight
                if contribution > 0:
                    word_scores.append((feature_word, float(round(contribution, 3))))

            word_scores.sort(key=lambda x: x[1], reverse=True)
            top_words = word_scores[:5]

            if top_words:
                formatted_terms = ", ".join([f"'{term}' (+{score:.2f})" for term, score in top_words])
                explanation = f"Classification driven by key terms: {formatted_terms}"
            else:
                explanation = f"Matched intent '{intent}' based on global context distribution."

            return {
                'intent': intent,
                'confidence': confidence,
                'explanation': explanation,
                'top_contributing_words': top_words
            }
        except Exception as e:
            logger.error("Error explaining intent prediction: %s", str(e))
            return {
                'intent': intent,
                'confidence': confidence,
                'explanation': f"Explanation unavailable: {str(e)}",
                'top_contributing_words': []
            }


# Singleton instance of classifier
_instance = None

def get_classifier():
    global _instance
    if _instance is None:
        _instance = IntentClassifier()
    return _instance


if __name__ == '__main__':
    clf = get_classifier()
    test_queries = [
        "where is my order",
        "how do i upload my prescription",
        "i have a fever and headache",
        "recommend some vitamins"
    ]
    print("\n--- Intent Classifier Explainability Demo ---")
    for q in test_queries:
        exp = clf.explain_prediction(q)
        print(f"\nQuery: '{q}'")
        print(f"  -> Predicted Intent: {exp['intent']} (Confidence: {exp['confidence']:.2f})")
        print(f"  -> Explanation: {exp['explanation']}")

