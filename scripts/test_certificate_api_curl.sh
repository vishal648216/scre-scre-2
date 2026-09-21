#!/usr/bin/env bash
# Exercise certificate HTTP endpoints against the Rust API (default http://127.0.0.1:3008).
#
# Usage:
#   ./scripts/test_certificate_api_curl.sh
#   API_BASE=https://screduc.com CERT_TOKEN='jwt…' ./scripts/test_certificate_api_curl.sh
#   CERT_TEST_USER=admin CERT_TEST_PASS='…' ./scripts/test_certificate_api_curl.sh   # obtains token via /api/auth/login
set -euo pipefail
BASE="${API_BASE:-http://127.0.0.1:3008}"
BASE="${BASE%/}"

echo "== GET $BASE/api/health =="
curl -sS "$BASE/api/health"
echo

echo "== GET /api/certificates/download/<id> without Authorization (expect 401) =="
code=$(curl -sS -o /tmp/cert_dl_body.txt -w "%{http_code}" "$BASE/api/certificates/download/000000000000000000000000" || true)
echo "HTTP $code"
head -c 300 /tmp/cert_dl_body.txt || true
echo

TOKEN="${CERT_TOKEN:-}"
if [[ -z "$TOKEN" && -n "${CERT_TEST_USER:-}" && -n "${CERT_TEST_PASS:-}" ]]; then
  echo "== POST /api/auth/login =="
  TOKEN=$(curl -sS -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$CERT_TEST_USER\",\"password\":\"$CERT_TEST_PASS\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' || true)
  if [[ -z "$TOKEN" ]]; then
    echo "Login failed or no token in response (install jq or check credentials)."
  fi
fi

if [[ -n "$TOKEN" ]]; then
  echo "== GET /api/certificates/download/000000000000000000000000 with Bearer (expect 404 JSON CERT_NOT_FOUND) =="
  curl -sS "$BASE/api/certificates/download/000000000000000000000000" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json" | head -c 400
  echo
  if [[ -n "${CERT_DOWNLOAD_TEST_ID:-}" ]]; then
    echo "== GET /api/certificates/download/$CERT_DOWNLOAD_TEST_ID (expect 200 PDF or 422 PDF_MISSING if row exists but file absent) =="
    code=$(curl -sS -o /tmp/curl_cert_dl.bin -w "%{http_code}" \
      "$BASE/api/certificates/download/$CERT_DOWNLOAD_TEST_ID" \
      -H "Authorization: Bearer $TOKEN" || true)
    echo "HTTP $code"
    file /tmp/curl_cert_dl.bin | head -1
    head -c 200 /tmp/curl_cert_dl.bin
    echo
  fi
else
  echo "== Skipping authenticated checks (set CERT_TOKEN or CERT_TEST_USER + CERT_TEST_PASS) =="
fi

echo "Done."
