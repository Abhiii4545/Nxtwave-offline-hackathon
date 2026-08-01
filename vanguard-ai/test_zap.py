import httpx
import time

ZAP_URL = "http://localhost:8080"
ZAP_KEY = "vanguard-zap-key"
TARGET = "https://skill-bridgeai-nxtwave.vercel.app/"

def test_zap():
    try:
        print("1. Checking ZAP version...")
        resp = httpx.get(f"{ZAP_URL}/JSON/core/view/version/", params={"apikey": ZAP_KEY})
        print(resp.json())

        print(f"\n2. Spidering {TARGET}...")
        resp = httpx.get(f"{ZAP_URL}/JSON/spider/action/scan/", params={"apikey": ZAP_KEY, "url": TARGET})
        print(resp.json())
        spider_id = resp.json().get("scan")

        print("\n3. Waiting for spider to finish...")
        while True:
            resp = httpx.get(f"{ZAP_URL}/JSON/spider/view/status/", params={"apikey": ZAP_KEY, "scanId": spider_id})
            status = int(resp.json().get("status", 0))
            print(f"Spider status: {status}%")
            if status >= 100:
                break
            time.sleep(1)
            
        print("\n4. Starting Active Scan...")
        resp = httpx.get(f"{ZAP_URL}/JSON/ascan/action/scan/", params={"apikey": ZAP_KEY, "url": TARGET})
        if resp.status_code != 200:
            print(f"FAILED! Status: {resp.status_code}")
            print(f"Error body: {resp.text}")
        else:
            print(resp.json())
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_zap()
