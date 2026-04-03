import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from core.models import Settings, Simulation, SimulationBalance
from core.services import get_current_btc_price

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def spawn_simulation_task(self):
    """Hourly task: create a new Simulation if Settings.create_new_simulations is True."""
    try:
        settings = Settings.objects.first()
        if settings is None:
            logger.warning('spawn_simulation_task: No Settings found, skipping.')
            return

        if not settings.create_new_simulations:
            logger.info('spawn_simulation_task: create_new_simulations=False, skipping.')
            return

        btc_price = get_current_btc_price()
        logger.info(f'spawn_simulation_task: BTC price fetched = {btc_price}')

        sim = Simulation.objects.create(
            threshold_up=settings.threshold_up,
            threshold_down=settings.threshold_down,
            apy_up=settings.apy_up,
            apy_down=settings.apy_down,
            initial_usdc=settings.initial_usdc,
            starter_btc_price=btc_price,
            interval=settings.interval,
        )

        # Initial balance: holding USDC
        SimulationBalance.objects.create(
            simulation=sim,
            usdc_amount=settings.initial_usdc,
            btc_amount=0,
            btc_price=btc_price,
        )

        logger.info(f'spawn_simulation_task: Created Simulation {sim.id}')

        # Schedule the first iteration resolution
        from core.tasks.resolve_iteration import resolve_iteration_task
        eta = timezone.now() + timedelta(days=settings.interval)
        resolve_iteration_task.apply_async(args=[str(sim.id)], eta=eta)

        logger.info(f'spawn_simulation_task: Scheduled resolve_iteration_task for {eta}')

    except Exception as exc:
        logger.exception(f'spawn_simulation_task: Unexpected error: {exc}')
        raise self.retry(exc=exc)
