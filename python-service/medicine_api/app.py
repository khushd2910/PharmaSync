"""
Medicine Information API — Module 8 (Django)

This module now acts as a compatibility shim for the Django-based
medicine API implementation. Existing imports such as
``from medicine_api import app as medicine_app`` continue to work while
using the Django view functions underneath.
"""

from .views import health, medicine_info

__all__ = ['health', 'medicine_info']
