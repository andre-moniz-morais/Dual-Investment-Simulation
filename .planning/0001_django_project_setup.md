# Plan: Django Project Setup — Dual Investment Simulation

## 1. Goal

Set up a fully functional Django project from scratch that implements the Dual Investment Simulation platform as specified in `AGENTS.md`. By the end, the project should have:

- A working Django app with REST API endpoints
- PostgreSQL database integration
- Celery + Celery Beat + Redis for background tasks
- Docker Compose for containerized deployment
- Django Templates for the frontend (Login, Dashboard, Simulations)
- Binance-inspired UI theme (black/yellow/gold)

---

## 2. Project Directory Structure (Target)

```
Dual-Investment-Simulation/
├── .env                          # Environment variables (DB URL, Redis, Secret Key)
├── .env.example                  # Template for .env
├── .gitignore                    # Already exists
├── .planning/                    # Planning documents
├── AGENTS.md                     # Project spec (already exists)
├── README.md                     # Updated project documentation
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Django app container
├── docker-compose.yml            # Multi-container orchestration
├── manage.py                     # Django management script
│
├── config/                       # Django project configuration
│   ├── __init__.py
│   ├── settings.py               # Main settings (DB, Celery, DRF, etc.)
│   ├── urls.py                   # Root URL configuration
│   ├── wsgi.py                   # WSGI entry point
│   ├── asgi.py                   # ASGI entry point
│   └── celery.py                 # Celery app initialization
│
└── core/                         # Main Django app
    ├── __init__.py
    ├── admin.py                  # Admin site registrations
    ├── apps.py                   # App configuration
    │
    ├── models/                   # Database models (one file per model)
    │   ├── __init__.py           # Imports all models
    │   ├── settings.py           # Settings model
    │   ├── simulation.py         # Simulation model
    │   └── simulation_balance.py # SimulationBalance model
    │
    ├── serializers/              # DRF serializers (one file per model)
    │   ├── __init__.py
    │   ├── settings.py
    │   ├── simulation.py
    │   └── simulation_balance.py
    │
    ├── views/                    # DRF ViewSets (one file per model)
    │   ├── __init__.py
    │   ├── settings.py
    │   ├── simulation.py
    │   └── simulation_balance.py
    │
    ├── tasks/                    # Celery tasks
    │   ├── __init__.py
    │   ├── spawn_simulation.py   # Hourly task to create new simulations
    │   └── resolve_iteration.py  # Task to resolve a simulation iteration
    │
    ├── services/                 # Business logic / external APIs
    │   ├── __init__.py
    │   └── btc_price.py          # Fetch current BTC price (Binance API)
    │
    ├── templates/                # Django HTML templates
    │   └── core/
    │       ├── base.html         # Base layout (navbar, footer, CSS/JS)
    │       ├── login.html        # Login page
    │       ├── dashboard.html    # Home / Dashboard page
    │       └── simulations.html  # Simulations list page
    │
    ├── static/                   # Static assets
    │   └── core/
    │       ├── css/
    │       │   └── styles.css    # Global Binance-inspired styles
    │       └── js/
    │           ├── dashboard.js  # Dashboard API calls + Chart.js
    │           └── simulations.js # Simulations list API calls
    │
    ├── template_views.py         # View functions to render Django Templates
    ├── urls.py                   # App-level URL routing (API + Template views)
    └── migrations/               # Auto-generated migrations
        └── __init__.py
```

---

## 3. Step-by-Step Implementation

### Phase 1 — Environment & Scaffolding

#### Step 1.1: Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
```

#### Step 1.2: Install Dependencies & Create `requirements.txt`

```txt
# Core
Django>=5.1,<5.2
djangorestframework>=3.15,<4.0
django-environ>=0.12,<1.0

# Database
psycopg2-binary>=2.9,<3.0

# Task Queue
celery>=5.4,<6.0
django-celery-beat>=2.7,<3.0
redis>=5.2,<6.0

# BTC Price
requests>=2.32,<3.0

# CORS (for frontend API calls from templates)
django-cors-headers>=4.6,<5.0

# Production server
gunicorn>=23.0,<24.0
```

```bash
pip install -r requirements.txt
```

#### Step 1.3: Scaffold Django Project & App

```bash
django-admin startproject config .
python manage.py startapp core
```

> **Note:** The project is named `config` so the settings module lives in `config/settings.py`. The main app is `core`.

#### Step 1.4: Restructure `core/models.py` → `core/models/` directory

- Delete `core/models.py`
- Create `core/models/` directory with `__init__.py`
- Same pattern for serializers and views directories

#### Step 1.5: Create `.env.example` and `.env`

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgres://dual_user:dual_pass@localhost:5432/dual_investment

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

---

### Phase 2 — Django Configuration

#### Step 2.1: `config/settings.py`

Key configurations to set up:

- **`django-environ`**: Read all config from `.env`
- **`INSTALLED_APPS`**: Add `rest_framework`, `django_celery_beat`, `corsheaders`, `core`
- **`DATABASES`**: PostgreSQL via `DATABASE_URL`
- **`REST_FRAMEWORK`**: Default authentication classes (Session + Basic), default pagination
- **`CELERY_*`**: Broker URL, Result Backend, serializer settings, timezone
- **`STATIC_URL`** and **`STATICFILES_DIRS`**: For serving CSS/JS in templates
- **`LOGIN_URL`** and **`LOGIN_REDIRECT_URL`**: For Django auth redirects
- **`AUTH_USER_MODEL`**: Use default Django User (no custom model needed)

#### Step 2.2: `config/celery.py`

- Create the Celery app instance bound to `config.settings`
- Auto-discover tasks from `core.tasks`
- Configure Celery Beat schedule:
  - `spawn-new-simulation`: runs every **1 hour** → calls `core.tasks.spawn_simulation.spawn_simulation_task`

#### Step 2.3: `config/__init__.py`

- Import the Celery app so it's loaded when Django starts:
  ```python
  from .celery import app as celery_app
  __all__ = ('celery_app',)
  ```

#### Step 2.4: `config/urls.py`

- Include `core.urls` under the root
- Include Django auth URLs for login/logout
- Serve static files in DEBUG mode

---

### Phase 3 — Database Models

#### Step 3.1: `core/models/settings.py` — `Settings` Model

```python
class Settings(models.Model):
    create_new_simulations = models.BooleanField(default=True)
    threshold_up = models.FloatField()
    threshold_down = models.FloatField()
    apy_up = models.FloatField()
    apy_down = models.FloatField()
    initial_usdc = models.FloatField()
    interval = models.IntegerField(help_text="Number of days per iteration")

    class Meta:
        verbose_name_plural = "Settings"
```

> **Design Decision:** This is a singleton table. We enforce at most one row via Django admin or a custom `save()` override. The admin registration will provide an easy UI to toggle `create_new_simulations` and adjust parameters.

#### Step 3.2: `core/models/simulation.py` — `Simulation` Model

```python
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
```

#### Step 3.3: `core/models/simulation_balance.py` — `SimulationBalance` Model

```python
class SimulationBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    simulation = models.ForeignKey(
        'Simulation',
        on_delete=models.CASCADE,
        related_name='balances'
    )
    usdc_amount = models.FloatField(default=0)
    btc_amount = models.FloatField(default=0)
    btc_price = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
```

#### Step 3.4: `core/models/__init__.py`

```python
from .settings import Settings
from .simulation import Simulation
from .simulation_balance import SimulationBalance
```

#### Step 3.5: `core/admin.py`

- Register all 3 models with the Django admin
- Add list_display columns for easy inspection

#### Step 3.6: Seed Migration — `core/migrations/0002_seed_settings.py`

After the initial auto-generated migration (`0001_initial.py`), create a **data migration** to pre-populate the `Settings` singleton with sensible defaults:

```bash
python manage.py makemigrations core --empty --name seed_settings
```

Then edit the generated file:

```python
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
```

> **Design Decision:** This ensures the `Settings` row exists immediately after `migrate`, so the Celery tasks never fail due to a missing settings object. The values can be adjusted later via the Django Admin.

---

### Phase 4 — REST API (Serializers + ViewSets)

#### Step 4.1: Serializers

| File | Serializer | Fields | Notes |
|------|-----------|--------|-------|
| `serializers/settings.py` | `SettingsSerializer` | All fields | Read/Write for admin adjustments |
| `serializers/simulation.py` | `SimulationSerializer` | All fields + `latest_balance` (nested) | Annotate with latest USDC/BTC balance for sorting |
| `serializers/simulation_balance.py` | `SimulationBalanceSerializer` | All fields | Filtered by simulation FK |

#### Step 4.2: ViewSets

| File | ViewSet | Endpoint | Methods | Notes |
|------|---------|----------|---------|-------|
| `views/settings.py` | `SettingsViewSet` | `/api/settings/` | GET, PUT | Singleton — always retrieves/updates the single row |
| `views/simulation.py` | `SimulationViewSet` | `/api/simulations/` | GET (list + detail) | Read-only. Supports `ordering` filter for `btc_balance`, `usdc_balance`, `created_at`. Pagination = 24 per page. |
| `views/simulation_balance.py` | `SimulationBalanceViewSet` | `/api/simulations/<id>/balances/` | GET (list) | Read-only. Nested under Simulation for chart data. |

#### Step 4.3: Additional API Endpoints

| Endpoint | Purpose | Details |
|----------|---------|---------|
| `GET /api/dashboard/top-simulations/` | Dashboard data | Returns Top 5 by USDC balance + Top 5 by BTC balance. Annotates each simulation with its latest balance entry. |

#### Step 4.4: `core/urls.py`

- Use DRF's `DefaultRouter` for ViewSet registration
- Add the custom dashboard endpoint
- Add template view URLs (login, dashboard, simulations)

---

### Phase 5 — BTC Price Service

#### Step 5.1: `core/services/btc_price.py`

```python
import requests

def get_current_btc_price() -> float:
    """Fetch the current BTC/USDT price from Binance public API."""
    url = "https://api.binance.com/api/v3/ticker/price"
    params = {"symbol": "BTCUSDT"}
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return float(response.json()["price"])
```

> **No API key required** — Binance's public ticker endpoint is free and unauthenticated.

---

### Phase 6 — Celery Tasks (Background Logic)

#### Step 6.1: `core/tasks/spawn_simulation.py`

**Trigger:** Celery Beat — every 1 hour.

**Logic:**
1. Load the `Settings` singleton
2. If `create_new_simulations` is `False`, return early
3. Fetch current BTC price via `get_current_btc_price()`
4. Create a new `Simulation` record with params from `Settings` + the fetched `starter_btc_price`
5. Create an initial `SimulationBalance` entry: `usdc_amount = initial_usdc`, `btc_amount = 0`, `btc_price = starter_btc_price`
6. Schedule `resolve_iteration_task` to run in `interval` days (using `apply_async(eta=...)`)

#### Step 6.2: `core/tasks/resolve_iteration.py`

**Trigger:** Scheduled via `apply_async(eta=...)` when a simulation is created or an iteration completes.

**Input:** `simulation_id` (UUID)

**Logic:**
1. Load the `Simulation` by ID
2. Get the **latest** `SimulationBalance` for that simulation
3. Fetch the current BTC price
4. Determine the current holding currency:
   - If `usdc_amount > 0` → **Buy-Low** logic
   - If `btc_amount > 0` → **Sell-High** logic
5. Apply the dual investment math (as described in AGENTS.md §4.2)
6. Create a new `SimulationBalance` entry with the resolved amounts
7. Schedule the **next** `resolve_iteration_task` to run in `interval` days

**Buy-Low Math (holding USDC):**
```python
target_price = current_btc_price * (1 - simulation.threshold_down)
interest = latest.usdc_amount * (simulation.apy_down / 365) * simulation.interval
total_usdc = latest.usdc_amount + interest

if current_btc_price <= target_price:
    # Bought the dip
    new_btc = total_usdc / target_price
    SimulationBalance.objects.create(simulation=sim, btc_amount=new_btc, usdc_amount=0, btc_price=current_btc_price)
else:
    # Kept USDC + interest
    SimulationBalance.objects.create(simulation=sim, usdc_amount=total_usdc, btc_amount=0, btc_price=current_btc_price)
```

**Sell-High Math (holding BTC):**
```python
target_price = current_btc_price * (1 + simulation.threshold_up)
interest = latest.btc_amount * (simulation.apy_up / 365) * simulation.interval
total_btc = latest.btc_amount + interest

if current_btc_price >= target_price:
    # Took profit
    new_usdc = total_btc * target_price
    SimulationBalance.objects.create(simulation=sim, usdc_amount=new_usdc, btc_amount=0, btc_price=current_btc_price)
else:
    # Kept BTC + interest
    SimulationBalance.objects.create(simulation=sim, btc_amount=total_btc, usdc_amount=0, btc_price=current_btc_price)
```

---

### Phase 7 — Django Templates & Frontend

#### Step 7.1: `core/templates/core/base.html`

- HTML5 boilerplate
- Load Google Fonts: **Montserrat Alternates**
- Load **FontAwesome** (free CDN)
- Load **Chart.js** (CDN) for dashboard charts
- Responsive meta viewport tag
- Navigation bar with links to Dashboard and Simulations
- Logout button (if authenticated)
- `{% block content %}` for page-specific content
- Link to `core/css/styles.css`

#### Step 7.2: `core/static/core/css/styles.css`

Binance-inspired design system:

```css
/* Color Palette */
--bg-primary: #0B0E11;       /* Near-black background */
--bg-secondary: #1E2329;     /* Card backgrounds */
--bg-tertiary: #2B3139;      /* Hover states, borders */
--accent-gold: #F0B90B;      /* Binance gold */
--accent-gold-hover: #F8D12F;
--text-primary: #EAECEF;     /* Main text */
--text-secondary: #848E9C;   /* Muted text */
--success: #0ECB81;          /* Green for gains */
--danger: #F6465D;           /* Red for losses */
```

Reusable CSS classes:
- `.card` — Dark card with subtle border and hover elevation
- `.btn-primary` — Gold button
- `.btn-secondary` — Outlined button
- `.table` — Styled data table
- `.badge` — Status badges (holding BTC vs USDC)
- `.pagination` — Navigation for simulation list
- `.input-field` — Styled form inputs
- `.chart-container` — Wrapper for Chart.js canvas

#### Step 7.3: `core/templates/core/login.html`

- Centered card with logo/title
- Username + Password fields
- Gold "Sign In" button
- Uses Django's `AuthenticationForm`

#### Step 7.4: `core/templates/core/dashboard.html`

The dashboard has two main visual sections:

**A. Top Overlay Chart (Top 5 Simulations)**
- A single Chart.js **line chart** with **5 lines overlaid** — one per top simulation
- Each line uses a distinct color from a curated palette (gold, teal, coral, violet, cyan)
- Toggle button to switch the Y-axis between **USDC balance** and **BTC balance**
- X-axis shows time (balance `created_at` dates)
- Data fetched from `/api/dashboard/top-simulations/` which returns the top 5 by USDC and top 5 by BTC, each with their full balance history
- Legend shows simulation ID (short UUID) for each line

**B. Top Simulations Grid — Individual Charts**
- Below the overlay chart, display a **grid of 10 cards** (Top 5 USDC + Top 5 BTC)
- Each card shows:
  - Simulation metadata (created date, thresholds, APY, interval)
  - Current balance (USDC or BTC badge)
  - An **individual Chart.js line chart** showing that simulation's balance over time
  - Toggle to switch between USDC and BTC view on the individual chart
- Cards are arranged in a responsive 2-column grid (1 column on mobile)
- Data for individual charts fetched from `/api/simulations/<id>/balances/`

#### Step 7.5: `core/templates/core/simulations.html`

- **Table/Grid** of all simulations
- Columns: Created, Threshold Up/Down, APY Up/Down, Current USDC, Current BTC, Interval
- **Sorting buttons**: BTC balance, USDC balance, Created
- **Pagination**: 24 per page with previous/next navigation
- Data fetched via JS from `/api/simulations/`

#### Step 7.6: `core/template_views.py`

```python
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

def login_view(request):
    return render(request, 'core/login.html')

@login_required
def dashboard_view(request):
    return render(request, 'core/dashboard.html')

@login_required
def simulations_view(request):
    return render(request, 'core/simulations.html')
```

---

### Phase 8 — Docker Compose

#### Step 8.1: `Dockerfile`

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

#### Step 8.2: `docker-compose.yml`

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  website:
    build: .
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      - redis

  celery:
    build: .
    command: celery -A config worker -l info
    env_file: .env
    depends_on:
      - redis
      - website

  celery-beat:
    build: .
    command: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    env_file: .env
    depends_on:
      - redis
      - website
```

> **Note:** PostgreSQL is NOT in docker-compose since the user manages it externally via the `DATABASE_URL` in `.env`. If needed, a `db` service can be added.

---

### Phase 9 — Authentication

#### Step 9.1: Django Built-in Auth

- Use Django's built-in `django.contrib.auth` (already included)
- Login page uses `AuthenticationForm` + `django.contrib.auth.login()`
- Template views protected with `@login_required`
- API endpoints protected with `IsAuthenticated` permission (DRF)
- Superuser created via `python manage.py createsuperuser`

---

## 4. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **PostgreSQL in Docker Compose?** | **No.** An external PostgreSQL instance will be used. The `DATABASE_URL` in `.env` points to the external DB. No `postgres` service in `docker-compose.yml`. |
| 2 | **Initial Settings Data** | **Seed migration.** A data migration (`0002_seed_settings.py`) pre-populates the `Settings` singleton with defaults (see Phase 3, Step 3.6). Values adjustable via Django Admin after deployment. |
| 3 | **Dashboard Chart Layout** | **Overlay + Individual.** The top of the dashboard shows a single chart with 5 lines overlaid (one per top simulation). Below, each simulation gets its own individual chart inside a card (see Phase 7, Step 7.4). |

---

## 5. Execution Order

| # | Phase | Depends on | Estimated Files |
|---|-------|-----------|-----------------|
| 1 | Environment & Scaffolding | — | 5 files |
| 2 | Django Configuration | Phase 1 | 5 files |
| 3 | Database Models + Seed Migration | Phase 2 | 6 files |
| 4 | REST API (Serializers + ViewSets) | Phase 3 | 8 files |
| 5 | BTC Price Service | Phase 2 | 1 file |
| 6 | Celery Tasks | Phase 3, 5 | 3 files |
| 7 | Templates & Frontend | Phase 4 | 8 files |
| 8 | Docker Compose | Phase 1-7 | 2 files |
| 9 | Authentication | Phase 2 | 0 new (config only) |

**Total:** ~38 files to create/modify

---

## 6. Verification Plan

### Automated Tests
1. `python manage.py check` — Validate Django configuration
2. `python manage.py makemigrations --check` — Ensure models have migrations
3. `python manage.py migrate` — Apply migrations to PostgreSQL
4. `python manage.py test` — Run unit tests (will write basic tests for models and tasks)

### Manual Verification
1. Start the dev server (`python manage.py runserver`) and verify:
   - Login page renders at `/login/`
   - Dashboard renders at `/` (requires auth)
   - Simulations page renders at `/simulations/`
2. Verify API endpoints via browser or curl:
   - `GET /api/simulations/`
   - `GET /api/settings/`
   - `GET /api/dashboard/top-simulations/`
3. Test Celery worker + beat locally to confirm tasks execute
4. `docker-compose build` to validate the Docker setup
