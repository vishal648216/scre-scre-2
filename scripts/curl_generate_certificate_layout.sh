#!/usr/bin/env bash
# POST /api/generate-certificates and verify HTML uses absolute field placement (for PDF/layout).
#
#   export API_BASE=http://127.0.0.1:3008
#   export CERT_TEST_USER=super-admin CERT_TEST_PASS='…'
#   export TEMPLATE_ID=… STUDENT_IDS='["…"]'   # optional; defaults try MongoDB locals
#
set -euo pipefail
BASE="${API_BASE:-http://127.0.0.1:3008}"
BASE="${BASE%/}"

TOKEN="${CERT_TOKEN:-}"
if [[ -z "$TOKEN" && -n "${CERT_TEST_USER:-}" && -n "${CERT_TEST_PASS:-}" ]]; then
  TOKEN=$(curl -sS -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$CERT_TEST_USER\",\"password\":\"$CERT_TEST_PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token') or '')")
fi
if [[ -z "$TOKEN" ]]; then
  echo "Set CERT_TOKEN or CERT_TEST_USER + CERT_TEST_PASS" >&2
  exit 1
fi

TEMPLATE_ID="${TEMPLATE_ID:-}"
STUDENT_JSON="${STUDENT_IDS:-}"
if [[ -z "$TEMPLATE_ID" || -z "$STUDENT_JSON" ]]; then
  if command -v mongosh >/dev/null 2>&1; then
    IFS=$'\t' read -r TEMPLATE_ID STUDENT_JSON <<<"$(mongosh "mongodb://localhost:27017/scre_db" --quiet --eval '
      const t = db.templates.findOne({ template_type: "certificate" });
      const s = db.users.findOne({ role: "student" });
      if (!t || !s) { print(""); }
      else { print(t._id.toString() + "\t" + JSON.stringify([s._id.toString()])); }
    ' 2>/dev/null | tr -d "\r")"
  fi
fi
if [[ -z "$TEMPLATE_ID" || -z "$STUDENT_JSON" ]]; then
  echo "Set TEMPLATE_ID and STUDENT_IDS (JSON array of student ObjectId strings), or install mongosh for defaults." >&2
  exit 1
fi

echo "== POST $BASE/api/generate-certificates template=$TEMPLATE_ID =="
export _GC_TEMPLATE_ID="$TEMPLATE_ID"
export _GC_STUDENT_IDS_JSON="$STUDENT_JSON"
BODY=$(python3 <<'PY'
import json, os
print(json.dumps({
  "template_id": os.environ["_GC_TEMPLATE_ID"],
  "student_ids": json.loads(os.environ["_GC_STUDENT_IDS_JSON"]),
  "reissue": True,
}))
PY
)

RESP=$(curl -sS -X POST "$BASE/api/generate-certificates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY")

echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
html = d.get('html') or ''
ok = 'position: absolute' in html and 'left:' in html and 'mm' in html
print('success:', d.get('success'), 'message:', (d.get('message') or '')[:120])
print('html_len:', len(html))
print('has_absolute_mm_layout:', ok)
if not ok and html:
    print(html[:500])
"
