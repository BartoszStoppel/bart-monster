#!/usr/bin/env bash
# Send Furtch good night email to all friends via Resend API

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../.env.local"
API_KEY="$RESEND_API_KEY"
FROM="Furtch <furtch@bart.monster>"
SUBJECT="schklp schklp"
TEMPLATE_FILE="$(dirname "$0")/../emails/02-furtch-good-night-3-12.txt"

FRIENDS_FILE="$(dirname "$0")/../friend_emails.txt"

while IFS=, read -r name email; do
  name=$(echo "$name" | xargs)
  email=$(echo "$email" | xargs)

  body=$(sed "s/<name>/$name/g" "$TEMPLATE_FILE")

  # Convert newlines to <br> for HTML email
  html_body=$(echo "$body" | sed 's/$/\<br\>/g')

  json_payload=$(jq -n \
    --arg from "$FROM" \
    --arg to "$email" \
    --arg subject "$SUBJECT" \
    --arg html "$html_body" \
    '{from: $from, to: [$to], subject: $subject, html: $html}')

  echo "Sending to $name ($email)..."
  response=$(curl -s -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json_payload")

  echo "  Response: $response"
  echo ""
done < "$FRIENDS_FILE"

echo "Done."
