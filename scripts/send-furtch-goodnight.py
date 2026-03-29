#!/usr/bin/env python3
"""Send Furtch good night email to all friends via Resend API."""

import json
import subprocess
import time
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

supabase_url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_url or not supabase_key:
    raise SystemExit("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local")

# Fetch all profiles with emails from Supabase
result = subprocess.run(
    [
        "curl", "-s",
        f"{supabase_url}/rest/v1/profiles?select=display_name,email&email=not.is.null",
        "-H", f"apikey: {supabase_key}",
        "-H", f"Authorization: Bearer {supabase_key}",
    ],
    capture_output=True,
    text=True,
)
profiles = json.loads(result.stdout)
if not isinstance(profiles, list) or len(profiles) == 0:
    raise SystemExit(f"No profiles found or error: {result.stdout}")

print(f"Found {len(profiles)} recipients\n")

template = (PROJECT_DIR / "emails" / "05-furtch-the-pile-is-warm-3-29.txt").read_text()

FROM = "Furtch <noreply@bart.monster>"
SUBJECT = "do not open your window"

for profile in profiles:
    name = profile["display_name"].split()[0]
    email = profile["email"]
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
