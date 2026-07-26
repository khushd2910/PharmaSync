from django.test import SimpleTestCase


class SalesAnalysisRouteTests(SimpleTestCase):
    def test_get_route_returns_analysis_key(self):
        response = self.client.get('/api/sales-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertIn('analysis', response.json())

    def test_run_route_requires_post(self):
        response = self.client.get('/api/sales-analysis/run')
        self.assertEqual(response.status_code, 405)
