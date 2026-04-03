import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks(['core.tasks'])

# ─── Celery Beat Schedule ──────────────────────────────────────────────────────
app.conf.beat_schedule = {
    'spawn-new-simulation-every-hour': {
        'task': 'core.tasks.spawn_simulation.spawn_simulation_task',
        'schedule': crontab(minute=0),  # Every hour at :00
    },
}
