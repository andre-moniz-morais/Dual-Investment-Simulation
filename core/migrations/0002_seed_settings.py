from django.db import migrations


def seed_settings(apps, schema_editor):
    Settings = apps.get_model('core', 'Settings')
    if not Settings.objects.exists():
        Settings.objects.create(
            create_new_simulations=True,
            threshold_up=0.05,
            threshold_down=0.05,
            apy_up=0.15,
            apy_down=0.15,
            initial_usdc=2000.0,
            interval=2,
        )


def reverse_seed(apps, schema_editor):
    Settings = apps.get_model('core', 'Settings')
    Settings.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_settings, reverse_seed),
    ]
