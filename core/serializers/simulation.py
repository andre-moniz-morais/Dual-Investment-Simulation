from rest_framework import serializers
from core.models import Simulation
from .simulation_balance import SimulationBalanceSerializer


class SimulationSerializer(serializers.ModelSerializer):
    latest_balance = serializers.SerializerMethodField()

    class Meta:
        model = Simulation
        fields = [
            'id', 'created_at', 'threshold_up', 'threshold_down',
            'apy_up', 'apy_down', 'initial_usdc', 'starter_btc_price',
            'interval', 'latest_balance',
        ]

    def get_latest_balance(self, obj):
        latest = obj.balances.last()
        if latest:
            return SimulationBalanceSerializer(latest).data
        return None
