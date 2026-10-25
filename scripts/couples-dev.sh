#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
if [[ ! -f .couples-dev.env ]]; then
  python3 - <<'PY'
from pathlib import Path
import secrets
values = {
    'COUPLES_DB_URL': 'jdbc:postgresql://localhost:5544/couples_local',
    'COUPLES_DB_USERNAME': 'couples_local',
    'COUPLES_DB_PASSWORD': secrets.token_hex(24),
    'COUPLES_JWT_SECRET': secrets.token_hex(32),
    'COUPLES_TOKEN_SECRET': secrets.token_hex(32),
    'COUPLES_REGISTRATION_ENABLED': 'true',
    'COUPLES_PUBLIC_URL': 'http://localhost:5173',
    'COUPLES_SMTP_HOST': 'localhost',
    'COUPLES_SMTP_PORT': '1025',
    'COUPLES_MAIL_FROM': 'couples@local.test',
    'COUPLES_R2_ENDPOINT': 'http://localhost:8333',
    'COUPLES_R2_BUCKET': 'couples-local',
    'COUPLES_R2_ACCESS_KEY_ID': 'couples-local',
    'COUPLES_R2_SECRET_ACCESS_KEY': secrets.token_hex(24),
    'CORS_ALLOWED_ORIGINS': 'http://localhost:5173,http://127.0.0.1:5173',
}
path = Path('.couples-dev.env')
path.touch(mode=0o600, exist_ok=False)
path.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
PY
fi
compose=(docker compose --env-file .couples-dev.env -f compose.couples.yml)
case "${1:-backend}" in
  stop) docker rm -f life-organizer-couples-backend >/dev/null 2>&1 || true; "${compose[@]}" down; exit 0 ;;
  status) "${compose[@]}" ps; exit 0 ;;
  backend|container|services) "${compose[@]}" up -d --wait ;;
  *) echo 'Usage: scripts/couples-dev.sh [backend|container|services|status|stop]' >&2; exit 2 ;;
esac
if [[ "${1:-backend}" == services ]]; then exit 0; fi
if [[ "${1:-backend}" == container ]] || ! command -v ffprobe >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  docker build -t life-organizer-couples:local ./backend
  exec docker run --rm --name life-organizer-couples-backend --network host --env-file .couples-dev.env \
    -e SPRING_PROFILES_ACTIVE=couples -e SERVER_PORT=8082 -e SERVER_ADDRESS=127.0.0.1 life-organizer-couples:local
fi
set -a
# This file is generated locally above; it contains no copied personal-deployment secrets.
source .couples-dev.env
set +a
cd backend
exec ./mvnw spring-boot:run -Dspring-boot.run.profiles=couples -Dspring-boot.run.arguments=--server.port=8082
