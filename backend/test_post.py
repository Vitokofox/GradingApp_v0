import requests
import json

payload = {
    "reception_date": "2026-02-24",
    "cutting_date": "2026-02-12",
    "guide_number": "525632",
    "estate": "EL RECUERDO- NORTE",
    "characteristic": "Mancha Azul",
    "logging_team": "S207",
    "quantity": 5.0,
    "responsible": "Admin"
}

try:
    response = requests.post("http://localhost:8000/api/truck-studies/", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
