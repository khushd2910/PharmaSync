from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health),
    path('api/sales-analysis', views.sales_analysis),
    path('api/sales-analysis/run', views.run_sales_analysis),
]
