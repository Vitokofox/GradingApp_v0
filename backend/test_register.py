import requests
import json

url = "http://localhost:8000/users/"
headers = {"Content-Type": "application/json"}
data = {
    "username": "Vitoko",
    "password": "password123",
    "first_name": "Victor",
    "last_name": "Valenzuela",
    "position": "Operador Experto",
    "level": "admin",
    "process_type": "Seco"
}

try:
    print(f"Sending request to {url} with data: {data}")
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
