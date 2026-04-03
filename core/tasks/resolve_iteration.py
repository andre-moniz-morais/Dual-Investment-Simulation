import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from core.models import Simulation, SimulationBalance
from core.services import get_current_btc_price

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def resolve_iteration_task(self, simulation_id: str):
    """
    Resolve a dual investment iteration for a given simulation.
    Applies Buy-Low or Sell-High logic based on the latest balance.
    Schedules the next iteration automatically.
    """
    try:
        sim = Simulation.objects.get(id=simulation_id)
    except Simulation.DoesNotExist:
        logger.error(f'resolve_iteration_task: Simulation {simulation_id} not found.')
        return

    latest = sim.balances.last()
    if latest is None:
        logger.error(f'resolve_iteration_task: No balance found for Simulation {simulation_id}.')
        return

    try:
        current_btc_price = get_current_btc_price()
        logger.info(f'resolve_iteration_task [{simulation_id}]: BTC price = {current_btc_price}')
    except Exception as exc:
        logger.exception(f'resolve_iteration_task: Failed to fetch BTC price: {exc}')
        raise self.retry(exc=exc)

    if latest.usdc_amount > 0:
        # ─── Buy-Low Logic ────────────────────────────────────────────────────
        target_price = current_btc_price * (1 - sim.threshold_down)
        interest = latest.usdc_amount * (sim.apy_down / 365) * sim.interval
        total_usdc = latest.usdc_amount + interest

        if current_btc_price <= target_price:
            # BTC dipped to target — buy
            new_btc = total_usdc / target_price
            new_balance = SimulationBalance.objects.create(
                simulation=sim,
                btc_amount=new_btc,
                usdc_amount=0,
                btc_price=current_btc_price,
            )
            logger.info(f'resolve_iteration_task [{simulation_id}]: Bought {new_btc:.6f} BTC @ {target_price}')
        else:
            # BTC stayed above target — keep USDC + interest
            new_balance = SimulationBalance.objects.create(
                simulation=sim,
                usdc_amount=total_usdc,
                btc_amount=0,
                btc_price=current_btc_price,
            )
            logger.info(f'resolve_iteration_task [{simulation_id}]: Kept ${total_usdc:.2f} USDC')

    elif latest.btc_amount > 0:
        # ─── Sell-High Logic ──────────────────────────────────────────────────
        target_price = current_btc_price * (1 + sim.threshold_up)
        interest = latest.btc_amount * (sim.apy_up / 365) * sim.interval
        total_btc = latest.btc_amount + interest

        if current_btc_price >= target_price:
            # BTC rose to target — sell
            new_usdc = total_btc * target_price
            new_balance = SimulationBalance.objects.create(
                simulation=sim,
                usdc_amount=new_usdc,
                btc_amount=0,
                btc_price=current_btc_price,
            )
            logger.info(f'resolve_iteration_task [{simulation_id}]: Sold for ${new_usdc:.2f} USDC @ {target_price}')
        else:
            # BTC stayed below target — keep BTC + interest
            new_balance = SimulationBalance.objects.create(
                simulation=sim,
                btc_amount=total_btc,
                usdc_amount=0,
                btc_price=current_btc_price,
            )
            logger.info(f'resolve_iteration_task [{simulation_id}]: Kept {total_btc:.6f} BTC')
    else:
        logger.error(f'resolve_iteration_task [{simulation_id}]: Balance has no USDC or BTC — skipping.')
        return

    # Schedule the next iteration
    eta = timezone.now() + timedelta(days=sim.interval)
    resolve_iteration_task.apply_async(args=[str(sim.id)], eta=eta)
    logger.info(f'resolve_iteration_task [{simulation_id}]: Next iteration scheduled for {eta}')
