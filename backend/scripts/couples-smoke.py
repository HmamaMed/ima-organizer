#!/usr/bin/env python3
"""Exercise the isolated local couples stack through HTTP, SMTP and private S3. Never uses personal accounts."""
import argparse, datetime, io, json, math, re, secrets, struct, time, urllib.error, urllib.parse, urllib.request, wave, zlib

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:8082')
parser.add_argument('--mail', default='http://localhost:8025')
parser.add_argument('--keep', action='store_true', help='Keep synthetic accounts for manual inspection')
args = parser.parse_args()
for origin in (args.base, args.mail):
    if urllib.parse.urlsplit(origin).hostname not in ('localhost', '127.0.0.1'):
        parser.error('This smoke test only operates on the local development stack')
password = 'smoke-only-correct-horse'
run = secrets.token_hex(5)
accounts, created, signed_urls = [], [], []


def api(path, body=None, token=None, method=None, expected=200, headers=None, raw=None):
    outgoing = {'Content-Type': 'application/json', **(headers or {})}
    if token:
        outgoing['Authorization'] = 'Bearer ' + token
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    request = urllib.request.Request(args.base + path, data=data, method=method or ('POST' if data is not None else 'GET'), headers=outgoing)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, payload = response.status, response.read()
    except urllib.error.HTTPError as failure:
        status, payload = failure.code, failure.read()
    if status != expected:
        raise AssertionError(f'{request.method} {path.split("?")[0]} returned {status}, expected {expected}')
    return json.loads(payload) if payload else None


def wait_for(check, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.4)
    raise AssertionError('Timed out waiting for the local worker')


def verification(email):
    with urllib.request.urlopen(args.mail + '/api/v1/messages', timeout=10) as response:
        messages = json.load(response)['messages']
    for message in messages:
        if email not in json.dumps(message.get('To', [])):
            continue
        with urllib.request.urlopen(args.mail + '/api/v1/message/' + message['ID'], timeout=10) as response:
            body = json.load(response)['Text']
        match = re.search(r'/verify#token=([\w-]+)', body)
        if match:
            return match.group(1)
    return None


def png():
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    pixels = b''.join(b'\0' + b''.join(bytes((x * 4, y * 4, 150)) for x in range(64)) for y in range(48))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', 64, 48, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')


def audio(seconds=1):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(8000)
        output.writeframes(b''.join(struct.pack('<h', int(1000 * math.sin(2 * math.pi * 440 * x / 8000))) for x in range(8000 * seconds)))
    return buffer.getvalue()


def upload(path, token, content, kind, expected=201):
    boundary = 'smoke-' + secrets.token_hex(10)
    raw = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture"\r\nContent-Type: {kind}\r\n\r\n').encode() + content + f'\r\n--{boundary}--\r\n'.encode()
    result = api(path, token=token, method='POST', expected=expected, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary}, raw=raw)
    return result['id'] if expected == 201 else result


def create(path, token, body):
    return api(path, body, token, expected=201, headers={'Idempotency-Key': secrets.token_hex(16)[:8] + '-1234-4234-8234-' + secrets.token_hex(6)})


try:
    for index in range(4):
        email = f'couples-smoke-{run}-{index}@couples.test'
        api('/api/identity/register', {'email': email, 'name': f'Smoke {index + 1}', 'password': password, 'locale': 'fr', 'timeZone': 'UTC'}, expected=202)
        created.append(email)
    for email in created:
        api('/api/identity/verify', {'token': wait_for(lambda: verification(email))}, expected=204)
        accounts.append(api('/api/identity/login', {'email': email, 'password': password, 'deviceName': 'Local smoke test'}))
    a, b, c, d = [account['token'] for account in accounts]
    for inviter, recipient in ((a, b), (c, d)):
        api('/api/couples', token=inviter, method='POST', expected=201)
        invitation = api('/api/couples/invitations', {'email': None}, inviter, expected=201)
        api('/api/couples/invitations/preview', {'token': invitation['token']}, recipient)
        api('/api/couples/invitations/accept', {'token': invitation['token']}, recipient)
    for token, title in ((a, 'First private watchlist'), (c, 'Second private watchlist')):
        create('/api/watchlist', token, {'title': title, 'kind': 'FILM', 'status': 'WATCHED'})
    assert [item['title'] for item in api('/api/watchlist', token=b)] == ['First private watchlist']
    assert [item['title'] for item in api('/api/watchlist', token=d)] == ['Second private watchlist']
    draft = create('/api/notes', a, {'content': 'Private draft', 'mode': 'DRAFT'})
    api('/api/notes/' + draft['id'], token=b, expected=404)
    for sender, recipient in ((a, b), (b, a)):
        note = create('/api/notes', sender, {'content': 'Two-way delivery', 'mode': 'SEND'})
        assert note['id'] in [item['id'] for item in api('/api/notes?view=received', token=recipient)]
        api('/api/notes/' + note['id'], token=c, expected=404)
    due = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=3)).isoformat()
    scheduled = create('/api/notes', a, {'content': 'Durable scheduled delivery', 'mode': 'SCHEDULE', 'scheduledFor': due})
    wait_for(lambda: scheduled['id'] in [item['id'] for item in api('/api/notes?view=received', token=b)])
    moment_ids = []
    for owner in (a, b, c):
        group = create('/api/memories/groups', owner, {'name': 'Smoke moments'})
        photo = upload('/api/memories/groups/' + group['id'] + '/media', owner, png(), 'image/png')
        if owner == a:
            upload('/api/memories/groups/' + group['id'] + '/media', owner, audio(61), 'audio/wav', expected=400)
        sound = upload('/api/memories/groups/' + group['id'] + '/media', owner, audio(), 'audio/wav')
        moment = create('/api/memories', owner, {'groupId': group['id'], 'photoAssetId': photo, 'audioAssetId': sound, 'caption': 'Synthetic fixture', 'memoryDate': '2026-10-24'})
        moment_ids.append(moment['id']); signed_urls.extend((moment['photoUrl'], moment['audioUrl']))
        with urllib.request.urlopen(moment['photoUrl'], timeout=10) as response:
            assert response.read().startswith(b'\x89PNG')
        unsigned = urllib.parse.urlsplit(moment['photoUrl'])._replace(query='').geturl()
        try:
            urllib.request.urlopen(unsigned, timeout=10)
            raise AssertionError('The local object store allowed an unsigned read')
        except urllib.error.HTTPError as failure:
            assert failure.code == 403
    assert {item['id'] for item in api('/api/memories', token=a)} == set(moment_ids[:2])
    api('/api/memories/' + moment_ids[0], token=c, expected=404)
    wish_photo = upload('/api/wishes/photos', a, png(), 'image/png')
    wish = create('/api/wishes', a, {'title': 'My own wish', 'category': 'BOOK', 'photoId': wish_photo})
    signed_urls.append(wish['photoUrl'])
    api('/api/wishes/' + wish['id'], token=b, method='DELETE', expected=404)
    api('/api/wishes/' + wish['id'], token=c, expected=404)
    recipe = create('/api/recipes', a, {'title': 'Shared recipe', 'status': 'TO_TRY', 'servings': 2, 'ingredients': [{'name': 'Lemon'}], 'steps': ['Cook.']})
    api('/api/recipes/' + recipe['id'] + '/status', {'status': 'FAVORITE'}, b, method='PATCH')
    assert len(api('/api/recipes?q=Lemon', token=b)) == 1
    api('/api/recipes/' + recipe['id'], token=c, expected=404)
    api('/api/birthdays', {'label': 'Private reminder', 'month': 11, 'day': 7, 'timeZone': 'UTC'}, a, expected=201)
    assert api('/api/birthdays', token=b) == []
    api('/api/couples/disconnect', token=a, method='POST', expected=204)
    api('/api/notes?view=sent', token=a, expected=403)
    api('/api/memories', token=b, expected=403)
    assert len(api('/api/birthdays', token=a)) == 1
    print('PASS: four verified accounts, two isolated couples, invitations, both note directions, private drafts, scheduled jobs, private photo/audio storage, memories, wishes, recipes, personal birthdays and disconnect.', flush=True)
finally:
    if not args.keep:
        for email in created:
            try:
                login = api('/api/identity/login', {'email': email, 'password': password, 'deviceName': 'Smoke cleanup'})
                api('/api/privacy/deletion', token=login['token'], method='POST', expected=202)
            except Exception:
                print('Synthetic cleanup remains pending for a smoke account.', flush=True)
        if signed_urls:
            def removed():
                for url in signed_urls:
                    try:
                        with urllib.request.urlopen(url, timeout=10) as response:
                            response.read(1)
                        return False
                    except urllib.error.HTTPError as failure:
                        if failure.code != 404:
                            return False
                return True
            wait_for(removed, timeout=35)
            print('PASS: account-deletion jobs removed all issued synthetic media objects.', flush=True)
    else:
        print('Kept synthetic accounts: ' + ', '.join(created), flush=True)
