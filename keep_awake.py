import time
import urllib.request
import datetime

url = "https://ai-qv89.onrender.com/api/ping"

print(f"[{datetime.datetime.now()}] Keep-alive pinger started for {url}")

while True:
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Aetheris Keep-Alive Pinger)'}
        )
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            print(f"[{datetime.datetime.now()}] Ping sent. Status code: {status}")
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Ping failed: {str(e)}")
    
    # Sleep for 9 minutes (540 seconds) to ensure the 15-minute Render sleep threshold is never hit
    time.sleep(540)
