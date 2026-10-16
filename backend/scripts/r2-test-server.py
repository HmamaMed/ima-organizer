#!/usr/bin/env python3
"""Loopback-only S3 stand-in for isolated tests. Never use as application storage."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
from datetime import datetime, timezone, timedelta
import json, hashlib

objects = {}
events = []
fail_delete = False
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def respond(self, status, body=b'', kind='application/xml', length=None):
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body) if length is None else length))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)
    def run_request(self):
        global fail_delete
        url = urlparse(self.path)
        query = parse_qs(url.query, keep_blank_values=True)
        path = unquote(url.path)
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if path == '/__test__/state':
            self.respond(200, json.dumps({'objects': {k: {'size': len(v[0]), 'type': v[1]} for k,v in objects.items()}, 'events': events}).encode(), 'application/json'); return
        if path == '/__test__/fail-delete':
            fail_delete = json.loads(body)['enabled']; self.respond(200,b'{}','application/json'); return
        if not path.startswith('/memory-test'):
            self.respond(404); return
        key = path.removeprefix('/memory-test').lstrip('/')
        if not self.headers.get('Authorization'):
            if self.command != 'GET' or 'X-Amz-Signature' not in query:
                self.respond(403); return
            signed = datetime.strptime(query['X-Amz-Date'][0],'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > signed + timedelta(seconds=int(query['X-Amz-Expires'][0])):
                self.respond(403); return
        if self.command == 'PUT':
            objects[key] = (body,self.headers.get('Content-Type','application/octet-stream'),datetime.now(timezone.utc))
            events.append({'method':'PUT','key':key,'size':len(body)})
            self.respond(200); return
        if self.command == 'HEAD':
            if key not in objects: self.respond(404); return
            self.respond(200,length=len(objects[key][0]),kind=objects[key][1]); return
        if self.command == 'GET' and 'list-type' in query:
            prefix = query.get('prefix',[''])[0]
            keys = sorted(k for k in objects if k.startswith(prefix))
            xml = '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>memory-test</Name><IsTruncated>false</IsTruncated><KeyCount>'+str(len(keys))+'</KeyCount>'
            for k in keys:
                xml += '<Contents><Key>'+escape(k)+'</Key><LastModified>'+objects[k][2].strftime('%Y-%m-%dT%H:%M:%SZ')+'</LastModified><Size>'+str(len(objects[k][0]))+'</Size></Contents>'
            self.respond(200,(xml+'</ListBucketResult>').encode()); return
        if self.command == 'GET':
            if key not in objects: self.respond(404); return
            self.respond(200, objects[key][0],objects[key][1]); return
        if self.command == 'POST' and 'delete' in query:
            keys = [el.text for el in ET.fromstring(body).iter() if el.tag.split('}')[-1] == 'Key']
            xml = '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
            for k in keys:
                if fail_delete: xml += '<Error><Key>'+escape(k)+'</Key><Code>AccessDenied</Code><Message>Test failure</Message></Error>'
                else:
                    objects.pop(k,None); events.append({'method':'DELETE','key':k}); xml += '<Deleted><Key>'+escape(k)+'</Key></Deleted>'
            self.respond(200,(xml+'</DeleteResult>').encode()); return
        if self.command == 'DELETE':
            objects.pop(key,None); events.append({'method':'DELETE','key':key}); self.respond(204); return
        self.respond(404)
    do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = run_request
print('Isolated R2 test server on 127.0.0.1:8091', flush=True)
ThreadingHTTPServer(('127.0.0.1',8091),Handler).serve_forever()
