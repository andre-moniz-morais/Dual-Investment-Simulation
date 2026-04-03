from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Subquery, OuterRef, FloatField

from core.models import Simulation, SimulationBalance
from core.serializers import SimulationSerializer, SimulationBalanceSerializer


def _annotate_latest_balance(qs):
    """Annotate a Simulation queryset with the latest usdc_amount and btc_amount."""
    latest_balance_qs = SimulationBalance.objects.filter(
        simulation=OuterRef('pk')
    ).order_by('-created_at')

    return qs.annotate(
        latest_usdc=Subquery(latest_balance_qs.values('usdc_amount')[:1], output_field=FloatField()),
        latest_btc=Subquery(latest_balance_qs.values('btc_amount')[:1], output_field=FloatField()),
    )


class SimulationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only Simulation ViewSet with ordering and pagination."""
    serializer_class = SimulationSerializer

    def get_queryset(self):
        qs = _annotate_latest_balance(Simulation.objects.all())
        ordering = self.request.query_params.get('ordering', '-created_at')
        allowed_orderings = {
            'usdc_balance': 'latest_usdc',
            '-usdc_balance': '-latest_usdc',
            'btc_balance': 'latest_btc',
            '-btc_balance': '-latest_btc',
            'created_at': 'created_at',
            '-created_at': '-created_at',
        }
        db_ordering = allowed_orderings.get(ordering, '-created_at')
        return qs.order_by(db_ordering)

    @action(detail=False, methods=['get'], url_path='top-simulations')
    def top_simulations(self, request):
        """Return Top 5 by USDC balance and Top 5 by BTC balance with full balance history."""
        qs = _annotate_latest_balance(Simulation.objects.all())

        top_usdc = qs.order_by('-latest_usdc').exclude(latest_usdc=0)[:5]
        top_btc = qs.order_by('-latest_btc').exclude(latest_btc=0)[:5]

        def serialize_with_history(simulations):
            result = []
            for sim in simulations:
                data = SimulationSerializer(sim).data
                data['balance_history'] = SimulationBalanceSerializer(
                    sim.balances.all(), many=True
                ).data
                result.append(data)
            return result

        return Response({
            'top_usdc': serialize_with_history(top_usdc),
            'top_btc': serialize_with_history(top_btc),
        })
