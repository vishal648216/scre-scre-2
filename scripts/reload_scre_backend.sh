#!/usr/bin/env bash
# Rebuild the Rust API and restart PM2 so Linux loads the NEW backend binary.
# If you only `cargo build` without restarting, the old process may keep running
# a "(deleted)" inode — you still see "Generated 0 certificate(s)" and empty preview.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
cargo build --release

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart scre-backend --update-env || pm2 restart all --update-env
  sleep 2
else
  echo "pm2 not found; start the binary manually, e.g.:" >&2
  echo "  cd $ROOT/backend && set -a && source .env && set +a && ./target/release/backend" >&2
  exit 1
fi

PORT="${PORT:-3008}"
TOKEN="$(
  curl -sS -X POST "http://127.0.0.1:${PORT}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"username":"super-admin","password":"Codearya@1238"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or '')"
)"
if [[ -z "$TOKEN" ]]; then
  echo "Login failed on port ${PORT} — check ADMIN credentials / PORT." >&2
  exit 1
fi

echo "Smoke: GET templates (certificate)…"
curl -sS "http://127.0.0.1:${PORT}/api/templates?template_type=certificate" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys,json; a=json.load(sys.stdin); print('templates', len(a) if isinstance(a,list) else 0)"

echo "Done. If generate still returns 0, run the curl script:" >&2
echo "  TEMPLATE_ID=... STUDENT_IDS='[\"...\"]' $ROOT/scripts/curl_generate_certificate.sh" >&2
echo "" >&2
echo "If the browser shows 404 on /api/* (e.g. certificate download), configure the web server to proxy /api to this backend." >&2
echo "  Nginx: $ROOT/scripts/nginx-spa.example.conf" >&2
echo "  Apache: $ROOT/scripts/apache-api-proxy.example.conf" >&2
