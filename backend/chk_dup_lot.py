import requests
import datetime

BASE_URL = "http://localhost:8000/api"
INSPECTION_DATA = {
    "shift": "A",
    "supervisor": "Test Supervisor",
    "product_name": "Test Product",
    "market_id": 1,
    "lot": "DUPLICATE_TEST_001",
    "date": datetime.date.today().isoformat(),
    "pieces_inspected": 100
}

def create_inspection(data):
    try:
        response = requests.post(f"{BASE_URL}/inspections", json=data)
        return response
    except Exception as e:
        print(f"Error: {e}")
        return None

def test_duplicate_lot():
    print("Test 1: Create First Inspection")
    r1 = create_inspection(INSPECTION_DATA)
    if r1 and r1.status_code == 200:
        print("Success: First inspection created.")
    else:
        print(f"Failed to create first inspection: {r1.status_code if r1 else 'Conn Err'}")
        if r1: print(r1.text)
        return

    print("\nTest 2: Create Duplicate Inspection")
    r2 = create_inspection(INSPECTION_DATA)
    if r2.status_code == 400:
        print("Success Check: Duplicate detected correctly (400 Bad Request).")
        print(f"Message: {r2.json().get('detail')}")
    else:
        print(f"Failure: Expected 400, got {r2.status_code}")
        print(r2.text)

if __name__ == "__main__":
    test_duplicate_lot()
