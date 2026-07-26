from django.test import RequestFactory, SimpleTestCase
from . import app as medicine_app


class MedicineApiCompatibilityTests(SimpleTestCase):
    def test_root_route_returns_service_info(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def test_legacy_medicine_info_route_is_available(self):
        response = self.client.get('/api/medicine-info')
        self.assertEqual(response.status_code, 400)
        self.assertIn('generic_name', response.json()['error'])

    def test_legacy_module_entry_point_works_as_django_view(self):
        request = RequestFactory().get('/health')
        response = medicine_app.health(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), '{"status": "ok", "module": "Module 8 - Medicine Information API"}')
