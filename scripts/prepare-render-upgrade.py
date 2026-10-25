#!/usr/bin/env python3
"""Prepare private Render settings and matching SQL; never connect to a database or send email."""
import argparse
import os
from pathlib import Path
import re
import secrets
from urllib.parse import urlsplit

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--owner-email', required=True)
parser.add_argument('--recipient-email', required=True)
parser.add_argument('--public-url', required=True)
parser.add_argument('--output-directory', type=Path, help='Optional private output directory, for an isolated rehearsal')
args = parser.parse_args()
owner, recipient = args.owner_email.strip().lower(), args.recipient_email.strip().lower()
if any(not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) for email in (owner, recipient)) or owner == recipient:
    parser.error('Provide two different valid email addresses')
url = urlsplit(args.public_url)
if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
    parser.error('Provide the public HTTPS origin, without a path')
root = Path(__file__).resolve().parent.parent
output_directory = args.output_directory.resolve() if args.output_directory else root
output_directory.mkdir(parents=True, exist_ok=True)
environment = output_directory / '.render-upgrade.env'
sql_file = output_directory / '.render-upgrade.sql'
if environment.exists() or sql_file.exists():
    parser.error('Private upgrade files already exist; keep them so the database password and settings continue to match')
password = secrets.token_urlsafe(36)
origin = args.public_url.rstrip('/')
values = {
    'SPRING_PROFILES_ACTIVE': 'couples,couples-production',
    'COUPLES_DB_SCHEMA': 'couples_app',
    'COUPLES_DB_USERNAME': 'lifeorganizer_runtime',
    'COUPLES_DB_PASSWORD': password,
    'COUPLES_TOKEN_SECRET': secrets.token_hex(32),
    'COUPLES_PUBLIC_URL': origin,
    'COUPLES_SUPPORT_EMAIL': owner,
    'COUPLES_CLOSED_RETENTION_DAYS': '30',
    'COUPLES_REGISTRATION_ENABLED': 'false',
    'COUPLES_EMAIL_ENABLED': 'false',
    'COUPLES_PRIVATE_ACCOUNT_EMAILS': f'{owner},{recipient}',
    'COUPLES_IMPORT_PERSONAL': 'true',
    'COUPLES_IMPORT_SOURCE_SCHEMA': 'public',
    'COUPLES_IMPORT_OWNER_EMAIL': owner,
    'COUPLES_IMPORT_RECIPIENT_EMAIL': recipient,
    'COUPLES_IMPORT_SHARED_AUTHOR': 'OWNER',
    'COUPLES_IMPORT_TIME_ZONE': 'Africa/Casablanca',
    'CORS_ALLOWED_ORIGINS': f'http://localhost:5173,http://127.0.0.1:5173,https://localhost,http://localhost,{origin}',
}
text = '# Add these settings to the EXISTING Render environment; retain DB_*, JWT_SECRET, R2_* and FIREBASE_SERVICE_ACCOUNT_PATH.\n'
text += '# Email delivery is disabled for the approved existing accounts. Never commit or share this file.\n'
text += ''.join(f'{key}={value}\n' for key, value in values.items())
template = (root / 'backend/scripts/freeze-personal.sql').read_text()
role = f"create role lifeorganizer_runtime login nosuperuser nocreatedb nocreaterole noinherit password '{password}';"
sql = template.replace('-- RUNTIME_ROLE_SETUP', role)
for path, content in ((environment, text), (sql_file, sql)):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        output.write(content)
print('Prepared .render-upgrade.env and .render-upgrade.sql with private permissions.')
print('No database was contacted. No SMTP setup is needed; follow backend/RENDER_UPGRADE.md.')
