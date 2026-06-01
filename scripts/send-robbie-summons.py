#!/usr/bin/env python3
"""Send the medieval summons letter to Robbie Lofland via Resend API."""

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

supabase_url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_url or not supabase_key:
    raise SystemExit("Supabase URL or service role key not found in .env.local")

# Fetch only Robbie Lofland's profile
result = subprocess.run(
    [
        "curl", "-s",
        f"{supabase_url}/rest/v1/profiles?select=display_name,email&display_name=eq.Robbie%20Lofland",
        "-H", f"apikey: {supabase_key}",
        "-H", f"Authorization: Bearer {supabase_key}",
    ],
    capture_output=True,
    text=True,
)
profiles = json.loads(result.stdout)
if not isinstance(profiles, list) or len(profiles) == 0:
    raise SystemExit(f"Robbie Lofland not found or error: {result.stdout}")

email = profiles[0]["email"]
if not email:
    raise SystemExit("Robbie Lofland has no email on file")

# Parse the letter: first line is "Subject: ...", remainder is the body
raw = (PROJECT_DIR / "emails" / "robbie-the-summons.txt").read_text().splitlines()
subject = raw[0].replace("Subject:", "").strip()
body = "\n".join(raw[1:]).strip()
html_body = body.replace("\n", "<br>")

FROM = "Bart <noreply@bart.monster>"

payload = json.dumps({
    "from": FROM,
    "to": [email],
    "subject": subject,
    "html": html_body,
})

print(f"Sending summons to {profiles[0]['display_name']} ({email})...")
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
