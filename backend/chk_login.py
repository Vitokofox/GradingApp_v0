import requests

def test_login():
    url = "http://localhost:8000/token"
    payload = {
        "username": "admin",
        "password": "admin"
    }
    try:
        response = requests.post(url, data=payload)
        if response.status_code == 200:
            print("Login Successful!")
            print(response.json())
        else:
            print(f"Login Failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error connecting: {e}")

if __name__ == "__main__":
    test_login()
