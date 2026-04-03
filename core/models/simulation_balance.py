import uuid
from django.db import models


class SimulationBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    simulation = models.ForeignKey(
        'Simulation',
        on_delete=models.CASCADE,
        related_name='balances',
    )
    usdc_amount = models.FloatField(default=0)
    btc_amount = models.FloatField(default=0)
    btc_price = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        if self.usdc_amount > 0:
            return f'Balance {str(self.id)[:8]} — ${self.usdc_amount:.2f} USDC'
        return f'Balance {str(self.id)[:8]} — {self.btc_amount:.6f} BTC'
