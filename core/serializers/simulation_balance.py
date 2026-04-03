from rest_framework import serializers
from core.models import SimulationBalance


class SimulationBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SimulationBalance
        fields = '__all__'
