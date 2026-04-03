from django.contrib import admin
from core.models import Settings, Simulation, SimulationBalance


@admin.register(Settings)
class SettingsAdmin(admin.ModelAdmin):
    list_display = ['id', 'create_new_simulations', 'threshold_up', 'threshold_down',
                    'apy_up', 'apy_down', 'initial_usdc', 'interval']


@admin.register(Simulation)
class SimulationAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_at', 'threshold_up', 'threshold_down',
                    'apy_up', 'apy_down', 'initial_usdc', 'starter_btc_price', 'interval']
    list_filter = ['created_at']
    readonly_fields = ['id', 'created_at']


@admin.register(SimulationBalance)
class SimulationBalanceAdmin(admin.ModelAdmin):
    list_display = ['id', 'simulation', 'usdc_amount', 'btc_amount', 'btc_price', 'created_at']
    list_filter = ['created_at']
    readonly_fields = ['id', 'created_at']
