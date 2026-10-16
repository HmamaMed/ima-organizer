/** Use the isolated NotificationPreview fixture; never run against hosted data. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const imported = await import(process.env.LIFE_ORGANIZER_PUPPETEER_MODULE || 'puppeteer');
const puppeteer = imported.puppeteer ?? imported.default;
const api = process.env.LIFE_ORGANIZER_API_URL || 'http://127.0.0.1:8087';
const app = process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5175';
for (const address of [api, app]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(address).hostname));
const output = fileURLToPath(new URL('../../design-validation/notification-inbox/', import.meta.url));
await mkdir(output, { recursive: true });
const checks = [];
async function login(username) {
  const response = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'local-notification-password' }) });
  assert.equal(response.status, 200); return response.json();
}
const owner = await login('NotificationOwner');
const partner = await login('NotificationPartner');
async function request(user, path = '/api/notifications', method = 'GET') {
  const response = await fetch(api + path, { method, headers: { Authorization: `Bearer ${user.token}` } });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.LIFE_ORGANIZER_CHROME || undefined });
async function open(user, path) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.emulateTimezone('Asia/Tokyo');
  await page.evaluateOnNewDocument(session => {
    localStorage.setItem('life-organizer.token', session.token);
    localStorage.setItem('life-organizer.user', JSON.stringify({ userId: session.userId, role: session.role, name: session.name }));
  }, user);
  await page.goto(app + path); return page;
}
async function click(page, label) {
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text), {}, label);
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text), label);
  await handle.asElement().evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await handle.asElement().click(); await handle.dispose();
}
async function settled(page) {
  await page.waitForSelector('.notification-inbox[aria-busy="false"]');
  await page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === 'running'));
}
try {
  const page = await open(owner, '/profile');
  await page.waitForSelector('.settings-list');
  await page.screenshot({ path: output + 'profile.png' });
  await click(page, 'Notifications'); await settled(page);
  assert.equal(new URL(page.url()).pathname, '/notifications');
  assert.equal(await page.$$eval('.notification-card', cards => cards.length), 2);
  assert.match(await page.$eval('.notification-card time', el => el.textContent), /07:00 PM/i);
  checks.push('Profile opens inbox; Morocco 7pm timestamp stays correct with device timezone set to Tokyo.');
  await page.screenshot({ path: output + 'inbox-390.png' });
  for (const width of [320, 768]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    assert.equal(await page.$eval('.lo-screen__inner', el => el.scrollWidth <= el.clientWidth + 1), true);
    await page.screenshot({ path: output + `inbox-${width}.png` });
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  assert.equal(await page.$eval('.lo-screen__inner', el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.screenshot({ path: output + 'inbox-large-text.png' });
  await page.reload(); await settled(page);
  checks.push('No horizontal overflow at 320px, 390px, 768px, or 200% text.');
  const messages = (await request(owner)).data;
  assert.equal((await request(partner, `/api/notifications/${messages[0].id}`, 'DELETE')).status, 404);
  const partnerPage = await open(partner, '/notifications'); await settled(partnerPage);
  assert.ok((await partnerPage.$eval('.notification-inbox', el => el.textContent)).includes('Mum’s birthday'));
  assert.ok(!(await partnerPage.$eval('.notification-inbox', el => el.textContent)).includes('Sister’s birthday'));
  checks.push('Recipient inbox is private; cross-account delete returns 404.');
  const label = `Delete notification: ${messages[0].body}`;
  await click(page, label);
  await page.waitForSelector('ion-modal.show-modal');
  await page.screenshot({ path: output + 'delete-confirmation.png' });
  await click(page, 'Cancel');
  await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal'));
  assert.equal((await request(owner)).data.length, 2);
  await click(page, label);
  await page.setRequestInterception(true);
  let failOnce = true;
  page.on('request', req => {
    if (failOnce && req.method() === 'DELETE' && req.url().includes('/api/notifications/')) {
      failOnce = false; void req.respond({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic failure"}' });
    } else void req.continue();
  });
  await click(page, 'Delete notification');
  await page.waitForFunction(() => document.querySelector('ion-modal.show-modal')?.textContent.includes('Could not delete'));
  assert.equal((await request(owner)).data.length, 2);
  await click(page, 'Delete notification');
  await page.waitForFunction(() => document.querySelectorAll('.notification-card').length === 1);
  await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal'));
  await page.reload(); await settled(page);
  assert.equal(await page.$$eval('.notification-card', cards => cards.length), 1);
  checks.push('Cancel preserves message; failed delete stays retryable; successful deletion persists after reload.');
  const remaining = (await request(owner)).data[0];
  await click(page, `Delete notification: ${remaining.body}`);
  await click(page, 'Delete notification');
  await page.waitForSelector('.notification-empty');
  await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal'));
  await page.screenshot({ path: output + 'empty.png' });
  assert.equal((await request(owner, '/api/birthdays')).data.length, 1);
  assert.equal((await request(partner)).data.length, 2);
  await click(page, 'Your birthdays'); await page.waitForSelector('.birthdays[aria-busy="false"]');
  assert.equal(new URL(page.url()).pathname, '/birthdays');
  checks.push('Empty inbox links to saved birthdays; deleting messages preserves birthday and partner inbox.');
  await writeFile(output + 'checks.json', JSON.stringify({ checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally { await browser.close(); }
