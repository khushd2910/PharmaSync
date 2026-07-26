from django.test import SimpleTestCase


class ChatbotCompatibilityTests(SimpleTestCase):
    def test_chat_route_accepts_post(self):
        response = self.client.post('/api/chat', data={'message': 'hello'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('reply', response.json())


class SymptomIntentTests(SimpleTestCase):
    """Regression coverage for the bug where any message opening with a
    greeting word ("hi", "hey", "hello") was swallowed whole by the
    greeting branch and never reached symptom matching — so a completely
    ordinary opener like "hi, I have a fever" got only a generic "hi
    there!" reply and never any medicine suggestion."""

    def _reply(self, message):
        response = self.client.post('/api/chat', data={'message': message}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_plain_symptom_message_gets_medicine_suggestion(self):
        data = self._reply('i had a fever')
        self.assertEqual(data['intent'], 'symptom_advice')
        self.assertIn('Paracetamol', data['reply'])

    def test_symptom_message_with_a_greeting_prefix_still_matches(self):
        data = self._reply('hi, i have a fever')
        self.assertEqual(data['intent'], 'symptom_advice')
        self.assertIn('Paracetamol', data['reply'])

    def test_pure_greeting_still_detected_as_greeting(self):
        data = self._reply('hi')
        self.assertEqual(data['intent'], 'greeting')

    def test_multiple_symptoms_are_all_addressed(self):
        data = self._reply('i have a fever and headache')
        self.assertEqual(data['intent'], 'symptom_advice')
        self.assertEqual(set(data['data']['symptoms']), {'fever', 'headache'})

    def test_vague_health_complaint_asks_a_clarifying_question(self):
        data = self._reply('i am not feeling well')
        self.assertEqual(data['intent'], 'symptom_clarify')
        self.assertIn('?', data['reply'])
