"""
URL configuration for config project.
"""
from django.http import JsonResponse
from django.urls import path

from medicine_api import views as medicine_views
from chatbot import views as chatbot_views


def root_health(request):
    return JsonResponse({'status': 'ok', 'module': 'PharmaSync Django Services'})


urlpatterns = [
    path('', root_health),
    path('health', root_health),
    path('api/medicine-info', medicine_views.medicine_info),
    path('api/chat', chatbot_views.chat),
]
