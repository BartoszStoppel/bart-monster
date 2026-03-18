#!/usr/bin/env python3
"""Send Furtch good night email to all friends via Resend API."""

import json
import subprocess
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent

# Load API key from .env.local
env_path = PROJECT_DIR / ".env.local"
api_key = None
for line in env_path.read_text().splitlines():
    if line.startswith("RESEND_API_KEY="):
        api_key = line.split("=", 1)[1].strip()
        break

if not api_key:
    raise SystemExit("RESEND_API_KEY not found in .env.local")

template = (PROJECT_DIR / "emails" / "02-furtch-good-night-3-12.txt").read_text()
friends = (PROJECT_DIR / "friend_emails.txt").read_text().strip().splitlines()

FROM = "Furtch <noreply@bart.monster>"
SUBJECT = "URGENT: beetle news"

for line in friends:
    name, email = [s.strip() for s in line.split(",", 1)]
    body = template.replace("<name>", name)
    html_body = body.replace("\n", "<br>")

    payload = json.dumps({
        "from": FROM,
        "to": [email],
        "subject": SUBJECT,
        "html": html_body,
    })

    print(f"Sending to {name} ({email})...")
    result = subprocess.run(
        [
            "curl", "-s", "-X", "POST", "https://api.resend.com/emails",
            "-H", f"Authorization: Bearer {api_key}",
            "-H", "Content-Type: application/json",
            "-d", payload,
        ],
        capture_output=True,
        text=True,
    )
    try:
        resp = json.loads(result.stdout)
        if "id" in resp:
            print(f"  Sent! ID: {resp['id']}")
        else:
            print(f"  Error: {resp.get('message', result.stdout)}")
    except json.JSONDecodeError:
        print(f"  Error: {result.stdout}")

    time.sleep(5)

print("\nDone.")
