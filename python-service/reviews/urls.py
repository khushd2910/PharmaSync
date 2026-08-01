from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health),
    path('api/medicines/reviews/summary', views.medicines_rating_summary),
    path('api/medicines/<str:medicine_id>/reviews', views.medicine_reviews),
    path('api/reviews/<str:review_id>', views.review_detail),
]
