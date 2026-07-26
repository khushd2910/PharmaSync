from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health),
    path('api/sales-analysis', views.sales_analysis),
    path('api/sales-analysis/run', views.run_sales_analysis),
    path('api/inventory-analysis', views.inventory_analysis),
    path('api/inventory-analysis/run', views.run_inventory_analysis),
    path('api/expiry-analysis', views.expiry_analysis),
    path('api/expiry-analysis/run', views.run_expiry_analysis),
]
