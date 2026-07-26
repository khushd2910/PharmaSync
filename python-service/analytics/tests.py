"""
Route tests for the three analytics endpoints.

The GET routes (get_sales_analysis, etc.) call straight into
sales_analysis.get_db() / inventory_analysis.get_db() /
expiry_analysis.get_db() — real pymongo connections. Without mocking that,
these tests would try to reach an actual MongoDB on every run: they'd
hang for the full connection timeout (30s+ each) and then fail outright
on any machine without MongoDB running, including CI and a fresh clone
that hasn't set one up yet. mongomock stands in for that connection the
same way it does in the rest of this project's Mongo-touching tests, so
these run in milliseconds and don't require any external service.

The POST /run routes each get_db() too, but they're only exercised here
via a GET (which 405s before ever reaching the view body), so they don't
need the same mocking — see test_run_route_requires_post below.
"""

from datetime import datetime
from unittest.mock import patch

import mongomock
from django.test import SimpleTestCase

from . import expiry_analysis, inventory_analysis, sales_analysis


class SalesAnalysisRouteTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')
        self.patcher = patch.object(sales_analysis, 'get_db', return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_get_route_returns_analysis_key_when_nothing_has_run_yet(self):
        response = self.client.get('/api/sales-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertIn('analysis', response.json())
        self.assertIsNone(response.json()['analysis'])

    def test_get_route_returns_the_latest_snapshot(self):
        self.db[sales_analysis.RESULT_COLLECTION].insert_one({'generatedAt': datetime(2026, 1, 1), 'totalRevenue': 4200})
        response = self.client.get('/api/sales-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['analysis']['totalRevenue'], 4200)

    def test_run_route_requires_post(self):
        response = self.client.get('/api/sales-analysis/run')
        self.assertEqual(response.status_code, 405)


class InventoryAnalysisRouteTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')
        self.patcher = patch.object(inventory_analysis, 'get_db', return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_get_route_returns_analysis_key_when_nothing_has_run_yet(self):
        response = self.client.get('/api/inventory-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertIn('analysis', response.json())
        self.assertIsNone(response.json()['analysis'])

    def test_get_route_returns_the_latest_snapshot(self):
        self.db[inventory_analysis.RESULT_COLLECTION].insert_one({'generatedAt': datetime(2026, 1, 1), 'lowStockCount': 7})
        response = self.client.get('/api/inventory-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['analysis']['lowStockCount'], 7)

    def test_run_route_requires_post(self):
        response = self.client.get('/api/inventory-analysis/run')
        self.assertEqual(response.status_code, 405)


class ExpiryAnalysisRouteTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')
        self.patcher = patch.object(expiry_analysis, 'get_db', return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_get_route_returns_analysis_key_when_nothing_has_run_yet(self):
        response = self.client.get('/api/expiry-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertIn('analysis', response.json())
        self.assertIsNone(response.json()['analysis'])

    def test_get_route_returns_the_latest_snapshot(self):
        self.db[expiry_analysis.RESULT_COLLECTION].insert_one({'generatedAt': datetime(2026, 1, 1), 'expiredCount': 3})
        response = self.client.get('/api/expiry-analysis')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['analysis']['expiredCount'], 3)

    def test_run_route_requires_post(self):
        response = self.client.get('/api/expiry-analysis/run')
        self.assertEqual(response.status_code, 405)
