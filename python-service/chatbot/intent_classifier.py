import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

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
    
    # prescription_question
    ("how do i upload my prescription", "prescription_question"),
    ("do i need a prescription", "prescription_question"),
    ("upload prescription", "prescription_question"),
    ("rx medicine request", "prescription_question"),
    ("prescription verification", "prescription_question"),
    ("why was my prescription rejected", "prescription_question"),
    ("prescription approval time", "prescription_question"),
    ("can i buy this without prescription", "prescription_question"),
    ("does this require rx", "prescription_question"),
    ("prescription status info", "prescription_question"),
    ("who approves my prescription", "prescription_question"),
    
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
]

class IntentClassifier:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', lowercase=True)
        self.classifier = LogisticRegression(C=10.0, max_iter=200)
        self.is_trained = False
        self._train()
        
    def _train(self):
        try:
            texts = [item[0] for item in TRAINING_DATA]
            labels = [item[1] for item in TRAINING_DATA]
            X = self.vectorizer.fit_transform(texts)
            self.classifier.fit(X, labels)
            self.is_trained = True
            logger.info("Intent classifier trained successfully on %d records", len(TRAINING_DATA))
        except Exception as e:
            logger.exception("Failed to train intent classifier: %s", str(e))
            self.is_trained = False

    def predict_intent(self, message):
        """
        Predict the intent of the message and return (intent_name, confidence_score).
        Falls back to a default value if classifier is not trained.
        """
        if not self.is_trained:
            return "general_question", 0.0
            
        try:
            # Vectorize input query
            X_msg = self.vectorizer.transform([message])
            # Predict intent probabilities
            probs = self.classifier.predict_proba(X_msg)[0]
            max_idx = probs.argmax()
            intent = self.classifier.classes_[max_idx]
            confidence = probs[max_idx]
            
            return intent, float(confidence)
        except Exception as e:
            logger.error("Error predicting intent: %s", str(e))
            return "general_question", 0.0

# Singleton instance of classifier
_instance = None

def get_classifier():
    global _instance
    if _instance is None:
        _instance = IntentClassifier()
    return _instance
