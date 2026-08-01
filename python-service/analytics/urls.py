from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health),
    path('api/sales-analysis', views.sales_analysis),
    path('api/sales-analysis/run', views.run_sales_analysis),
    path('api/inventory-analysis', views.inventory_analysis),
    path('api/inventory-analysis/run', views.run_inventory_analysis),
    path('api/inventory-analysis/deep', views.inventory_deep_analysis),
    path('api/inventory-analysis/deep/run', views.run_inventory_deep_analysis),
    path('api/expiry-analysis', views.expiry_analysis),
    path('api/expiry-analysis/run', views.run_expiry_analysis),
    path('api/demand-forecast', views.demand_forecast),
    path('api/demand-forecast/run', views.run_demand_forecast),
    path('api/revenue-forecast', views.revenue_forecast),
    path('api/revenue-forecast/run', views.run_revenue_forecast),
    path('api/market-basket-analysis', views.market_basket_analysis),
    path('api/market-basket-analysis/run', views.run_market_basket_analysis),
]
