from django.test import SimpleTestCase


class ChatbotCompatibilityTests(SimpleTestCase):
    def test_chat_route_accepts_post(self):
        response = self.client.post('/api/chat', data={'message': 'hello'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('reply', response.json())
