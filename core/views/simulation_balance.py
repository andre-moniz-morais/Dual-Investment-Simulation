from rest_framework import viewsets, mixins
from core.models import SimulationBalance
from core.serializers import SimulationBalanceSerializer


class SimulationBalanceViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only list of balance entries for a specific simulation."""
    serializer_class = SimulationBalanceSerializer

    def get_queryset(self):
        simulation_id = self.kwargs.get('simulation_pk')
        return SimulationBalance.objects.filter(simulation_id=simulation_id).order_by('created_at')
