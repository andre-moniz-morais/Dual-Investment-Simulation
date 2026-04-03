from django.urls import path, include
from rest_framework.routers import DefaultRouter

from core.views import SettingsViewSet, SimulationViewSet, SimulationBalanceViewSet
from core.template_views import login_view, logout_view, dashboard_view, simulations_view

router = DefaultRouter()
router.register(r'settings', SettingsViewSet, basename='settings')
router.register(r'simulations', SimulationViewSet, basename='simulation')

urlpatterns = [
    # ─── Template Pages ───────────────────────────────────────────────────────
    path('', dashboard_view, name='dashboard'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('simulations/', simulations_view, name='simulations'),

    # ─── API Endpoints ────────────────────────────────────────────────────────
    path('api/', include(router.urls)),

    # Nested balances: /api/simulations/<simulation_pk>/balances/
    path(
        'api/simulations/<uuid:simulation_pk>/balances/',
        SimulationBalanceViewSet.as_view({'get': 'list'}),
        name='simulation-balances',
    ),
]
