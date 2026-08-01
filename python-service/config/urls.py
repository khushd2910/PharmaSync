"""
URL configuration for config project.
"""
from django.http import JsonResponse
from django.urls import path

from medicine_api import views as medicine_views
from chatbot import views as chatbot_views
from analytics import views as analytics_views
from reviews import views as reviews_views


def root_health(request):
    return JsonResponse({'status': 'ok', 'module': 'PharmaSync Django Services'})


urlpatterns = [
    path('', root_health),
    path('health', root_health),
    path('api/medicine-info', medicine_views.medicine_info),
    path('api/chat', chatbot_views.chat),
    path('api/sales-analysis', analytics_views.sales_analysis),
    path('api/sales-analysis/run', analytics_views.run_sales_analysis),
    path('api/inventory-analysis', analytics_views.inventory_analysis),
    path('api/inventory-analysis/run', analytics_views.run_inventory_analysis),
    path('api/inventory-analysis/deep', analytics_views.inventory_deep_analysis),
    path('api/inventory-analysis/deep/run', analytics_views.run_inventory_deep_analysis),
    path('api/expiry-analysis', analytics_views.expiry_analysis),
    path('api/expiry-analysis/run', analytics_views.run_expiry_analysis),
    path('api/demand-forecast', analytics_views.demand_forecast),
    path('api/demand-forecast/run', analytics_views.run_demand_forecast),
    path('api/revenue-forecast', analytics_views.revenue_forecast),
    path('api/revenue-forecast/run', analytics_views.run_revenue_forecast),
    path('api/market-basket-analysis', analytics_views.market_basket_analysis),
    path('api/market-basket-analysis/run', analytics_views.run_market_basket_analysis),
    path('api/medicines/<str:medicine_id>/reviews', reviews_views.medicine_reviews),
    path('api/reviews/<str:review_id>', reviews_views.review_detail),
]
