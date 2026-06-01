#!/usr/bin/env python3
"""Send the medieval invitation-to-build letter to Matt Monzingo via Resend API."""

import json
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent

# Load env vars from .env.local
env_path = PROJECT_DIR / ".env.local"
env_vars: dict[str, str] = {}
for line in env_path.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        key, val = line.split("=", 1)
        env_vars[key.strip()] = val.strip()

api_key = env_vars.get("RESEND_API_KEY")
if not api_key:
    raise SystemExit("RESEND_API_KEY not found in .env.local")

TO = "matthew.monzingo@gmail.com"
FROM = "Bart <noreply@bart.monster>"

# Parse the letter: first line is "Subject: ...", remainder is the body
raw = (PROJECT_DIR / "emails" / "matt-the-invitation.txt").read_text().splitlines()
subject = raw[0].replace("Subject:", "").strip()
body = "\n".join(raw[1:]).strip()
html_body = body.replace("\n", "<br>")

payload = json.dumps({
    "from": FROM,
    "to": [TO],
    "subject": subject,
    "html": html_body,
})

print(f"Sending invitation to {TO}...")
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
resp = json.loads(result.stdout)
if "id" in resp:
    print(f"  Sent! ID: {resp['id']}")
else:
    raise SystemExit(f"  Error: {resp.get('message', result.stdout)}")
