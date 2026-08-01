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
import pandas as pd
from django.test import SimpleTestCase

from . import expiry_analysis, inventory_analysis, sales_analysis, revenue_forecasting, demand_forecasting


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


class RevenueForecastingRouteTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')
        self.patcher = patch.object(revenue_forecasting, 'get_db', return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_get_route_returns_analysis_key_when_nothing_has_run_yet(self):
        response = self.client.get('/api/revenue-forecast')
        self.assertEqual(response.status_code, 200)
        self.assertIn('analysis', response.json())
        self.assertIsNone(response.json()['analysis'])

    def test_get_route_returns_the_latest_snapshot(self):
        self.db[revenue_forecasting.RESULT_COLLECTION].insert_one({'generatedAt': datetime(2026, 1, 1), 'totalForecastedRevenue': 15000.0})
        response = self.client.get('/api/revenue-forecast')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['analysis']['totalForecastedRevenue'], 15000.0)

    def test_run_route_requires_post(self):
        response = self.client.get('/api/revenue-forecast/run')
        self.assertEqual(response.status_code, 405)


class DemandForecastRouteTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')
        self.patcher = patch.object(demand_forecasting, 'get_db', return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_get_route_returns_analysis_key_when_nothing_has_run_yet(self):
        response = self.client.get('/api/demand-forecast')
        self.assertEqual(response.status_code, 200)
        self.assertIn('analysis', response.json())
        self.assertIsNone(response.json()['analysis'])

    def test_get_route_returns_the_latest_snapshot(self):
        self.db[demand_forecasting.RESULT_COLLECTION].insert_one({'generatedAt': datetime(2026, 1, 1), 'predictions': []})
        response = self.client.get('/api/demand-forecast')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['analysis']['predictions'], [])

    def test_run_route_requires_post(self):
        response = self.client.get('/api/demand-forecast/run')
        self.assertEqual(response.status_code, 405)


class ModelDriftRouteTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')
        self.patcher = patch.object(demand_forecasting, 'get_db', return_value=self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_get_route_returns_drift_report(self):
        response = self.client.get('/api/analytics/model-drift')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')
        self.assertIn('driftReport', response.json())


# ---------------------------------------------------------------------------
# ML Logic & Sanity Unit Tests (Item #5)
# ---------------------------------------------------------------------------

class DemandForecastingMLTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')

    def test_demand_forecasting_non_negative_predictions(self):
        from . import predict_demand
        # Seed mock medicine
        med_id = self.db.medicines.insert_one({'name': 'Paracetamol 500mg', 'stock': 10, 'isDiscontinued': False}).inserted_id

        # Seed mock POS sales
        self.db.possales.insert_one({
            'status': 'Completed',
            'createdAt': datetime.now(),
            'items': [{'medicine': med_id, 'quantity': 5}]
        })

        result = predict_demand.generate_forecast(self.db)
        self.assertIn('predictions', result)
        self.assertGreaterEqual(len(result['predictions']), 1)
        for pred in result['predictions']:
            self.assertGreaterEqual(pred['predictedWeeklyDemand'], 0.0)
            self.assertGreaterEqual(pred['suggestedRestockQty'], 0)

    def test_demand_forecasting_low_history_fallback(self):
        from . import predict_demand
        med_id = self.db.medicines.insert_one({'name': 'Rare Medicine', 'stock': 5, 'isDiscontinued': False}).inserted_id
        result = predict_demand.generate_forecast(self.db)
        pred = next(p for p in result['predictions'] if p['medicineId'] == str(med_id))
        self.assertEqual(pred['predictedWeeklyDemand'], 0.0)
        self.assertEqual(pred['suggestedRestockQty'], 0)


class RevenueForecastingMLTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')

    def test_revenue_forecasting_non_negative_projections(self):
        from . import predict_revenue
        self.db.orders.insert_one({
            'orderStatus': 'Delivered',
            'createdAt': datetime.now(),
            'totalAmount': 500.0
        })

        result = predict_revenue.generate_forecast(self.db)
        self.assertIn('totalForecastedRevenue', result)
        self.assertGreaterEqual(result['totalForecastedRevenue'], 0.0)
        for p in result['predictions']:
            self.assertGreaterEqual(p['predictedRevenue'], 0.0)


class InventoryDeepMLTests(SimpleTestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database('pharmasync_test')

    def test_inventory_deep_analysis_segmentation_and_anomalies(self):
        from . import inventory_deep_analysis
        # Seed 12 mock medicines
        for i in range(12):
            self.db.medicines.insert_one({
                'name': f'Med {i}',
                'price': (i + 1) * 20.0,
                'stock': (i + 1) * 5,
                'category': 'General',
                'isDiscontinued': False
            })

        result = inventory_deep_analysis.generate_deep_analysis()
        self.assertIn('summary', result)
        self.assertIn('segments', result)
        self.assertIn('anomalies', result)
        self.assertTrue(result['summary']['totalMedicines'] >= 12)

    def test_inventory_deep_analysis_handles_missing_price_column(self):
        from . import inventory_deep_analysis

        medicines_df = pd.DataFrame([
            {'_id': 'med-1', 'name': 'Sample', 'stock': 5, 'category': 'General', 'isDiscontinued': False},
        ])
        sales_df = pd.DataFrame([
            {'medicineId': 'med-1', 'quantity': 3, 'price': 100.0, 'date': datetime.now()},
        ])

        result = inventory_deep_analysis.build_analysis(medicines_df, sales_df)
        self.assertEqual(result['summary']['totalMedicines'], 1)
        self.assertIn('priceSensitivityRecommendations', result)
        self.assertEqual(result['priceSensitivityRecommendations'][0]['medicineId'], 'med-1')


class ChatbotIntentMLTests(SimpleTestCase):
    def test_intent_classifier_prediction_and_explainability(self):
        from chatbot.intent_classifier import get_classifier
        clf = get_classifier()
        
        intent, confidence = clf.predict_intent("where is my order")
        self.assertEqual(intent, "order_status")
        self.assertGreater(confidence, 0.4)

        explanation = clf.explain_prediction("where is my order")
        self.assertEqual(explanation['intent'], "order_status")
        self.assertIn("order", [w[0] for w in explanation['top_contributing_words']])
        self.assertIn("Classification driven by key terms", explanation['explanation'])




