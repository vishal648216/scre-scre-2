#!/usr/bin/env bash
# Test POST /api/generate-certificates (issue now — no scheduled_at).
#
# Usage:
#   export TEMPLATE_ID=... STUDENT_IDS='["...","..."]'
#   ./scripts/curl_generate_certificate.sh
#
# Optional: API_BASE=http://127.0.0.1:3008 ADMIN_USER=super-admin ADMIN_PASS='...'
set -euo pipefail
API_BASE="${API_BASE:-http://127.0.0.1:3008}"
ADMIN_USER="${ADMIN_USER:-super-admin}"
ADMIN_PASS="${ADMIN_PASS:-Codearya@1238}"

if [[ -z "${TEMPLATE_ID:-}" || -z "${STUDENT_IDS:-}" ]]; then
  echo "Set TEMPLATE_ID and STUDENT_IDS (JSON array of student ObjectId hex strings)." >&2
  echo "Example:" >&2
  echo "  export TEMPLATE_ID=69ca67624bc6365a25dc703c" >&2
  echo "  export STUDENT_IDS='[\"69b95dff7b3199f886ad0be3\"]'" >&2
  echo "  $0" >&2
  exit 1
fi

TOKEN="$(
  curl -sS -X POST "${API_BASE}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('token'), d; print(d['token'])"
)"

BODY="$(python3 -c "import json,os; print(json.dumps({'template_id':os.environ['TEMPLATE_ID'],'student_ids':json.loads(os.environ['STUDENT_IDS'])}))")"

curl -sS -X POST "${API_BASE}/api/generate-certificates" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "${BODY}" | python3 -m json.tool
