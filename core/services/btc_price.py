import requests


def get_current_btc_price() -> float:
    """Fetch the current BTC/USDT price from Binance public API (no API key required)."""
    url = 'https://api.binance.com/api/v3/ticker/price'
    params = {'symbol': 'BTCUSDT'}
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return float(response.json()['price'])
