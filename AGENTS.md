# dual investment - Project Documentation

## 1. Project Overview
"dual investment" is a Django-based web application designed to simulate and test Binance's Dual Investment strategies (Buy-Low and Sell-High). The platform automates continuous investment iterations, tracking the performance of different threshold and APY settings over time.

### 1.1. UI/UX Specifications
* **Theme:** Binance-inspired color palette featuring black and yellow/gold tones.
* **Typography:** `Montserrat Alternates` as the primary font.
* **Icons:** Integration of free icon libraries (e.g., FontAwesome, Phosphor Icons, or Heroicons).
* **Frontend Rendering:** Django Templates for layout structure, with data populated via frontend API calls.

### 1.2. Development Environment
* **Virtual Environment:** Before starting the server or installing any packages, the agent MUST activate the virtual environment:
  * **macOS/Linux:** `source venv/bin/activate`
  * **Windows:** `.\venv\Scripts\activate.ps1`

## 2. Platform Architecture

### 2.1. Pages
1.  **Login Page:** Simple authentication requiring `username` and `password`.
2.  **Home (Dashboard):**
    * Displays the top 10 most profitable simulations (Top 5 with the highest USDC balance + Top 5 with the highest BTC balance).
    * Includes an interactive chart for simulations, allowing users to toggle between viewing the historical balance in BTC and USDC.
3.  **Simulations Page:**
    * A comprehensive list of all created simulations.
    * **Pagination:** 24 items per page.
    * **Sorting Capabilities:** Sortable by BTC balance, USDC balance, and creation date.

### 2.2. Tech Stack & Infrastructure
* **Backend Framework:** Django / Django REST Framework.
* **Database:** PostgreSQL (Connection URL managed via `.env` file).
* **Task Queue & Caching:** Celery, Celery Beat, and Redis.
* **Containerization:** Docker Compose setup with dedicated containers for:
    * `website` (Django app)
    * `celery` (Background task workers)
    * `celery-beat` (Task scheduler)
    * `redis` (Broker and cache)

## 3. Database Schema

### Table: `Settings`
Global configuration for the simulation engine.
* `create_new_simulations` (bool): If False, the background script stops spawning new simulations.
* `threshold_up` (float)
* `threshold_down` (float)
* `apy_up` (float)
* `apy_down` (float)
* `initial_usdc` (float)
* `interval` (int): Number of days per iteration.

### Table: `Simulation`
Represents an individual automated strategy.
* `id` (uuid): Primary Key.
* `created_at` (datetime): Auto-generated timestamp.
* `threshold_up` (float)
* `threshold_down` (float)
* `apy_up` (float)
* `apy_down` (float)
* `initial_usdc` (float)
* `starter_btc_price` (float): BTC price at the moment the simulation was created.
* `interval` (int): Duration in days for each compounding period.

### Table: `SimulationBalance`
Logs the periodic balance states (1-to-N relationship with `Simulation`).
* `id` (uuid): Primary Key.
* `simulation` (ForeignKey): Links to `Simulation`.
* `usdc_amount` (float): Current USDC balance (0 if holding BTC).
* `btc_amount` (float): Current BTC balance (0 if holding USDC).
* `btc_price` (float): BTC price at the exact moment this record was created.
* `created_at` (datetime): Timestamp of the iteration's end.

## 4. Core Logic & Processes

### 4.1. Background Process (Celery & Celery Beat)
* **Hourly Script:** Every hour, Celery Beat triggers a task to spawn a new `Simulation` (if `Settings.create_new_simulations` is True), inheriting the parameters from the `Settings` table.
* **Iteration Scheduling:** Upon creation of a new simulation (or completion of an iteration), a Celery background task is scheduled to run exactly `<interval>` days later to resolve the outcome and calculate the next `SimulationBalance` entry.

### 4.2. Dual Investment Math Logic
Every `<interval>` days, the scheduled task executes and applies the following logic based on the current holding currency:

#### A. Buy-Low (Currently holding USDC)
* **Target Price:** `Current BTC Price * (1 - threshold_down)`
* **Accrued Interest:** `Current USDC * (apy_down / 365) * interval`
* **Total USDC:** `Current USDC + Accrued Interest`
* **Resolution:**
    * If BTC Price drops at or below the Target Price: The system "buys the dip". The new `SimulationBalance` entry will have `btc_amount = Total USDC / Target Price` and `usdc_amount = 0`.
    * If BTC Price stays above the Target Price: The system keeps the stablecoin plus interest. The new entry will have `usdc_amount = Total USDC` and `btc_amount = 0`.

#### B. Sell-High (Currently holding BTC)
* **Target Price:** `Current BTC Price * (1 + threshold_up)`
* **Accrued Interest:** `Current BTC * (apy_up / 365) * interval`
* **Total BTC:** `Current BTC + Accrued Interest`
* **Resolution:**
    * If BTC Price rises at or above the Target Price: The system takes profit. The new `SimulationBalance` entry will have `usdc_amount = Total BTC * Target Price` and `btc_amount = 0`.
    * If BTC Price stays below the Target Price: The system keeps the crypto asset plus interest. The new entry will have `btc_amount = Total BTC` and `usdc_amount = 0`.