from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health),
    path('api/medicine-info', views.medicine_info),
]
