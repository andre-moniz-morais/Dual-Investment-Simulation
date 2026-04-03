import uuid
from django.db import models


class Settings(models.Model):
    create_new_simulations = models.BooleanField(default=True)
    threshold_up = models.FloatField()
    threshold_down = models.FloatField()
    apy_up = models.FloatField()
    apy_down = models.FloatField()
    initial_usdc = models.FloatField()
    interval = models.IntegerField(help_text='Number of days per iteration')

    class Meta:
        verbose_name_plural = 'Settings'

    def save(self, *args, **kwargs):
        """Enforce singleton — only one Settings record is allowed."""
        if not self.pk and Settings.objects.exists():
            raise ValueError('Only one Settings instance is allowed. Edit the existing record.')
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'Settings (interval={self.interval}d, USDC={self.initial_usdc})'
