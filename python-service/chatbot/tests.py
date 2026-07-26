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

    def test_chest_pain_gets_no_medicine_suggestion(self):
        """Chest pain must never get a casual OTC reply — only a redirect
        to emergency care."""
        data = self._reply('i have chest pain')
        self.assertEqual(data['intent'], 'symptom_advice')
        self.assertTrue(data['data']['urgent'])
        self.assertIn('emergency', data['reply'].lower())
        self.assertNotIn('Paracetamol', data['reply'])
        self.assertNotIn('Ibuprofen', data['reply'])

    def test_dengue_fever_does_not_also_trigger_the_plain_fever_entry(self):
        """"dengue fever" contains "fever" as a literal substring — without
        the nested-match de-dup, this would incorrectly also suggest
        Paracetamol/ibuprofen-adjacent fever advice alongside the dengue
        safety redirect."""
        data = self._reply('i think i have dengue fever')
        self.assertEqual(data['data']['symptoms'], ['dengue fever'])
        self.assertNotIn('fever and headache', data['reply'])  # sanity: not the multi-symptom path

    def test_cold_sore_does_not_also_match_plain_cold(self):
        data = self._reply('i have a cold sore on my lip')
        self.assertEqual(data['data']['symptoms'], ['cold sore'])

    def test_ordinary_symptom_still_gets_a_medicine_suggestion(self):
        """Broad regression check that expanding the knowledge base didn't
        break plain, everyday symptom matching."""
        data = self._reply('i have a bad sore throat')
        self.assertEqual(data['intent'], 'symptom_advice')
        self.assertIn('sore throat', data['data']['symptoms'])
        self.assertIn('lozenges', data['reply'].lower())


class ExpandedResponseVarietyTests(SimpleTestCase):
    """Coverage for the 10x expansion of HEALTH_HINT_WORDS,
    GREETING_RESPONSES, PRESCRIPTION_FAQ, DELIVERY_FAQ, FALLBACK_RESPONSE,
    and _CLARIFY_SAMPLE — checks both that each pool actually grew and
    that the reply-picking functions draw from the full pool rather than
    always returning the same single variant."""

    def _reply(self, message):
        response = self.client.post('/api/chat', data={'message': message}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_health_hint_words_grew_roughly_tenfold(self):
        from chatbot.knowledge_base import HEALTH_HINT_WORDS
        self.assertGreaterEqual(len(HEALTH_HINT_WORDS), 150)

    def test_clarify_sample_grew_and_stays_readable(self):
        from chatbot.knowledge_base import _CLARIFY_SAMPLE, SYMPTOM_KB
        # Grew well beyond the original 10 (capped by how many non-urgent
        # SYMPTOM_KB entries actually exist, not padded with invented ones).
        self.assertGreaterEqual(len(_CLARIFY_SAMPLE), 50)
        # Every sampled name must be a real, non-urgent SYMPTOM_KB key —
        # clarify_response() should never offer an example it can't match.
        for symptom in _CLARIFY_SAMPLE:
            self.assertIn(symptom, SYMPTOM_KB)
            self.assertFalse(SYMPTOM_KB[symptom].get('urgent'))

    def test_clarify_response_stays_short_despite_larger_pool(self):
        data = self._reply('i am not feeling well')
        # A bigger underlying pool shouldn't turn the reply itself into an
        # unreadable wall of text — only a handful of examples per reply.
        shown = data['reply'].split('like:')[1]
        self.assertLessEqual(shown.count(','), 12)

    def test_greeting_responses_grew_and_vary(self):
        from chatbot.knowledge_base import GREETING_RESPONSES
        self.assertGreaterEqual(len(GREETING_RESPONSES), 10)
        seen = {self._reply('hi')['reply'] for _ in range(30)}
        self.assertGreater(len(seen), 1)

    def test_prescription_faq_grew_and_varies(self):
        from chatbot.knowledge_base import PRESCRIPTION_FAQ
        self.assertGreaterEqual(len(PRESCRIPTION_FAQ), 10)
        seen = {self._reply('do I need a prescription for this')['reply'] for _ in range(30)}
        self.assertGreater(len(seen), 1)

    def test_delivery_faq_grew_and_varies(self):
        from chatbot.knowledge_base import DELIVERY_FAQ
        self.assertGreaterEqual(len(DELIVERY_FAQ), 10)
        seen = {self._reply('what is the delivery process')['reply'] for _ in range(30)}
        self.assertGreater(len(seen), 1)

    def test_fallback_response_grew(self):
        from chatbot.knowledge_base import FALLBACK_RESPONSE
        self.assertGreaterEqual(len(FALLBACK_RESPONSE), 10)
