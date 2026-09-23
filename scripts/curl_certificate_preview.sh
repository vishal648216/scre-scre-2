#!/usr/bin/env bash
# POST /api/generate-certificates and save the returned HTML preview for debugging layout.
#
# Usage:
#   export API_BASE=http://127.0.0.1:3008
#   export CERT_TOKEN='your_jwt'
#   ./scripts/curl_certificate_preview.sh <template_24_hex_id> <student_24_hex_id> [out.html]
#
# Or login:
#   CERT_TEST_USER=admin CERT_TEST_PASS='…' ./scripts/curl_certificate_preview.sh <tpl_id> <stu_id>
#
# `reissue` is set true so you can repeat the call when the student already has this template.
set -euo pipefail

BASE="${API_BASE:-http://127.0.0.1:3008}"
BASE="${BASE%/}"
TPL="${1:?template_id (24-char hex)}"
STU="${2:?student_id (24-char hex)}"
OUT="${3:-/tmp/certificate_preview.html}"

TOKEN="${CERT_TOKEN:-}"
if [[ -z "$TOKEN" && -n "${CERT_TEST_USER:-}" && -n "${CERT_TEST_PASS:-}" ]]; then
  TOKEN=$(curl -sS -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$CERT_TEST_USER\",\"password\":\"$CERT_TEST_PASS\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' || true)
fi

if [[ -z "$TOKEN" ]]; then
  echo "Set CERT_TOKEN or CERT_TEST_USER + CERT_TEST_PASS" >&2
  exit 1
fi

echo "POST $BASE/api/generate-certificates -> $OUT" >&2
curl -sS -X POST "$BASE/api/generate-certificates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"template_id\":\"$TPL\",\"student_ids\":[\"$STU\"],\"reissue\":true}" \
  -o /tmp/generate_certificates_response.json

python3 -c "
import json, sys
out = sys.argv[1]
with open('/tmp/generate_certificates_response.json', encoding='utf-8') as f:
    data = json.load(f)
html = data.get('html')
if not html:
    print('No html in response. JSON:', file=sys.stderr)
    print(json.dumps(data, indent=2)[:2500], file=sys.stderr)
    sys.exit(2)
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print('Wrote', len(html), 'chars to', out)
" "$OUT"

echo "Inspect: file://$OUT (browser) or grep 'left:' $OUT | head" >&2
