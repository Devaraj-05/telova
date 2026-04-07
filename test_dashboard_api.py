import asyncio
from fastapi.testclient import TestClient
from telova_api.main import app

def test():
    client = TestClient(app)
    try:
        response = client.get("/api/v1/dashboard?user_id=demo-user")
        print("Status code:", response.status_code)
        print("Response JSON:", response.json())
    except Exception as e:
        import traceback
        traceback.print_exc()

test()
