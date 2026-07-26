"""
URL configuration for config project.
"""
from django.http import JsonResponse
from django.urls import path

from medicine_api import views as medicine_views
from chatbot import views as chatbot_views
from analytics import views as analytics_views


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
    path('api/expiry-analysis', analytics_views.expiry_analysis),
    path('api/expiry-analysis/run', analytics_views.run_expiry_analysis),
]
