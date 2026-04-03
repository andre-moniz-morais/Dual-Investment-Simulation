import uuid
from django.db import models


class Simulation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    threshold_up = models.FloatField()
    threshold_down = models.FloatField()
    apy_up = models.FloatField()
    apy_down = models.FloatField()
    initial_usdc = models.FloatField()
    starter_btc_price = models.FloatField()
    interval = models.IntegerField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Simulation {str(self.id)[:8]} (created {self.created_at:%Y-%m-%d})'
