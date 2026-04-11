import requests

BASE_URL = "http://127.0.0.1:5001"

# Test 1: A Valid Successful update
response = requests.patch(f"{BASE_URL}/api/update-price/1", params={"new_price": "$3.00"})
print("Valid update:", response.status_code, response.json())

# Test 2: An Invalid price format
response = requests.patch(f"{BASE_URL}/api/update-price/1", params={"new_price": "3.00"})
print("Bad price format:", response.status_code, response.json())

# Test 3: A Cafe ID that doesn't exist
response = requests.patch(f"{BASE_URL}/api/update-price/9999", params={"new_price": "$3.00"})
print("Not found:", response.status_code, response.json())

# Test 4: Missing the new_price query parameter
response = requests.patch(f"{BASE_URL}/api/update-price/1")
print("Missing param:", response.status_code, response.json())
