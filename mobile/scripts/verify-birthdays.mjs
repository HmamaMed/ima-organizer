/** Run against an isolated local backend seeded with synthetic BirthdayOwner/Partner accounts. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const imported = await import(process.env.LIFE_ORGANIZER_PUPPETEER_MODULE || 'puppeteer');
const puppeteer = imported.puppeteer ?? imported.default;
const app = process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5175';
const api = process.env.LIFE_ORGANIZER_API_URL || 'http://127.0.0.1:8087';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(api).hostname), 'Use an isolated local API; this check creates test records.');
const output = fileURLToPath(new URL('../../design-validation/birthday-reminders/', import.meta.url));
await mkdir(output, { recursive: true });
const checks = [];
async function session(username) {
  const response = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'local-birthday-password' }) });
  assert.equal(response.status, 200);
  return response.json();
}
const owner = await session('BirthdayOwner');
const partner = await session('BirthdayPartner');
async function request(session, path = '/api/birthdays', method = 'GET', body) {
  const response = await fetch(api + path, { method, headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
// Clean only this test module's data on the isolated synthetic accounts.
for (const user of [owner, partner]) {
  for (const entry of (await request(user)).data) await request(user, `/api/birthdays/${entry.id}`, 'DELETE');
}
for (const note of (await request(owner, '/api/notes')).data) {
  if (note.content === 'Morocco scheduling check' && note.status === 'SCHEDULED') {
    await request(owner, `/api/notes/${note.id}`, 'DELETE');
  }
}
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.LIFE_ORGANIZER_CHROME || undefined });
async function open(user, route = '/birthdays') {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.emulateTimezone('Asia/Tokyo');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(session => {
    localStorage.setItem('life-organizer.token', session.token);
    localStorage.setItem('life-organizer.user', JSON.stringify({ userId: session.userId, role: session.role, name: session.name }));
  }, user);
  await page.goto(app + route);
  await page.waitForSelector(route === '/birthdays' ? '.birthdays[aria-busy="false"]' : '.home-clock');
  return page;
}
async function button(page, label) {
  await page.waitForFunction(label => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label), {}, label);
  const result = await page.evaluateHandle(label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label), label);
  assert.ok(result.asElement(), `Missing button: ${label}`);
  await result.asElement().evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await result.asElement().click(); await result.dispose();
}
async function noOverflow(page) {
  const result = await page.evaluate(() => ({ viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, broken: [...document.images].filter(i => !i.complete || !i.naturalWidth).length }));
  assert.equal(result.overflow, false); assert.equal(result.broken, 0); return result;
}
try {
  const page = await open(owner);
  assert.equal(await page.$eval('.birthday-empty', el => el.textContent.includes('Good days')), true);
  await page.screenshot({ path: output + 'empty.png' });
  await button(page, 'Add a birthday');
  await page.waitForSelector('ion-modal.show-modal #birthday-label', { visible: true });
  await page.type('#birthday-label', 'Sister’s birthday');
  await page.select('#birthday-month', '10'); await page.select('#birthday-day', '20');
  assert.ok(await page.$eval('.birthday-reminder-note', el => el.textContent.includes('7pm') && el.textContent.includes('Morocco · GMT')));
  await page.screenshot({ path: output + 'add-birthday.png' });
  await button(page, 'Save birthday');
  await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal') && document.querySelector('.birthday-row__detail h3')?.textContent === 'Sister’s birthday');
  let list = (await request(owner)).data; assert.equal(list.length, 1); const id = list[0].id;
  await page.reload(); await page.waitForSelector('.birthday-row');
  assert.equal((await request(owner)).data.length, 1);
  checks.push({ name: 'Create through UI and retain after reload', passed: true });
  await page.screenshot({ path: output + 'birthdays.png' });
  await button(page, 'Edit Sister’s birthday');
  await page.waitForSelector('ion-modal.show-modal #birthday-label', { visible: true });
  await page.$eval('#birthday-label', input => input.select()); await page.type('#birthday-label', 'Mum’s birthday');
  await page.select('#birthday-day', '21');
  await page.setRequestInterception(true);
  const failSave = request => request.url().includes('/api/birthdays/') && request.method() === 'PUT'
    ? request.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Please try again.' }) }) : request.continue();
  page.on('request', failSave);
  await button(page, 'Save changes'); await page.waitForSelector('.birthday-error');
  assert.equal(await page.$eval('#birthday-label', input => input.value), 'Mum’s birthday');
  assert.equal((await request(owner)).data[0].label, 'Sister’s birthday');
  page.off('request', failSave); await page.setRequestInterception(false);
  await button(page, 'Save changes');
  await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal') && document.querySelector('.birthday-row__detail h3')?.textContent === 'Mum’s birthday');
  assert.equal((await request(owner)).data[0].day, 21);
  checks.push({ name: 'Failed edit preserves input; retry persists correct label/date', passed: true });
  assert.equal((await request(partner)).data.length, 0);
  assert.equal((await request(partner, `/api/birthdays/${id}`, 'PUT', { label: 'Blocked', month: 1, day: 1, timeZone: 'UTC' })).status, 404);
  assert.equal((await request(partner, `/api/birthdays/${id}`, 'DELETE')).status, 404);
  const partnerPage = await open(partner); await partnerPage.waitForSelector('.birthday-empty');
  checks.push({ name: 'Partner sees an empty private list and cannot edit/delete owner birthday', passed: true });
  await button(page, 'Delete Mum’s birthday'); await button(page, 'Remove birthday');
  await page.waitForSelector('.birthday-empty'); assert.equal((await request(owner)).data.length, 0);
  checks.push({ name: 'Confirmed UI delete removes persisted birthday', passed: true });
  // Two real saved rows for layout screenshots, including a long label that must wrap.
  for (const birthday of [{ label: 'Sister’s birthday', month: 10, day: 20 }, { label: 'A very dear friend’s special birthday', month: 12, day: 28 }]) {
    assert.equal((await request(owner, '/api/birthdays', 'POST', { ...birthday, timeZone: 'Africa/Casablanca' })).status, 201);
  }
  await page.reload(); await page.waitForSelector('.birthday-row');
  for (const width of [320, 390, 768]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    await page.waitForSelector('.birthday-row');
    checks.push({ name: `List at ${width}px`, passed: true, ...await noOverflow(page) });
    await page.screenshot({ path: output + `birthdays-${width}.png` });
  }
  await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 1 });
  await page.waitForSelector('.birthday-row');
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  checks.push({ name: 'List at 320px with 200% text', passed: true, ...await noOverflow(page) });
  await button(page, 'Add a birthday'); await page.waitForSelector('ion-modal.show-modal #birthday-label', { visible: true });
  assert.equal(await page.$eval('#birthday-label', i => i.getBoundingClientRect().right <= innerWidth), true);
  await page.select('#birthday-month', '2'); await page.select('#birthday-day', '29');
  assert.ok(await page.$eval('form', el => el.textContent.includes('February 28')));
  await page.evaluate(() => document.getElementById('birthday-month').scrollIntoView({ block: 'center' }));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
  checks.push({ name: 'Editor fits at 200% text; February 29 policy is visible', passed: true });
  await page.screenshot({ path: output + 'editor-320-large-text.png' });
  await button(page, 'Close birthday form');
  const home = await open(owner, '/home');
  const time = await home.evaluate(() => ({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone, clock: document.querySelector('.home-clock time').textContent, expected: new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) }));
  assert.equal(time.zone, 'Asia/Tokyo'); assert.equal(time.clock, time.expected);
  checks.push({ name: 'Home clock shows Moroccan GMT while the device uses Tokyo', passed: true, ...time });
  await home.screenshot({ path: output + 'home-gmt.png' });
  // Submit an actual scheduled note and verify the server's UTC instant.
  await home.goto(app + '/notes/compose'); await home.waitForSelector('.compose-body__textarea textarea');
  await home.type('.compose-body__textarea textarea', 'Morocco scheduling check');
  await button(home, 'Schedule');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await home.evaluate(tomorrow => {
    const chip = [...document.querySelectorAll('.chip-row button')].find(b => b.querySelector('.chip__day')?.textContent === String(Number(tomorrow.slice(8)))); chip.click();
  }, tomorrow);
  await home.waitForSelector('.schedule-hours button');
  await home.evaluate(() => {
    const target = [...document.querySelectorAll('.schedule-hours button')].find(b => /^(7:00 PM|19:00)$/.test(b.textContent.trim()));
    if (!target) throw new Error('7pm option missing'); target.click();
  });
  await home.waitForSelector('.schedule-summary');
  assert.ok(await home.$eval('.schedule-summary', el => el.textContent.includes('Morocco · GMT')));
  const scheduleLayout = await home.evaluate(() => [...document.querySelectorAll('.compose-body,.schedule-picker,.schedule-field,.mode-toggle')].map(el => ({
    name: el.className, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width,
  })));
  for (const element of scheduleLayout) assert.ok(element.right <= 390, `${element.name} must fit the phone`);
  checks.push({ name: 'Note date/hour picker fits the phone with horizontally scrolling date chips', passed: true });
  await home.$eval('.schedule-summary', el => el.scrollIntoView({ block: 'center' }));
  await home.screenshot({ path: output + 'notes-gmt.png' });
  await button(home, 'Schedule note'); await home.waitForFunction(() => location.pathname === '/notes');
  const notes = (await request(owner, '/api/notes')).data;
  const note = notes.find(n => n.content === 'Morocco scheduling check');
  assert.equal(new Date(note.scheduledFor).toISOString(), `${tomorrow}T19:00:00.000Z`);
  checks.push({ name: '7pm note selection posts exactly 19:00Z despite Tokyo device timezone', passed: true, scheduledFor: note.scheduledFor });
  await writeFile(output + 'checks.json', JSON.stringify({ backend: 'isolated H2 with synthetic accounts', checks }, null, 2) + '\n');
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  for (const page of await browser.pages()) {
    if (page.url().startsWith(app)) console.error('Failed page:', page.url());
  }
  throw error;
} finally { await browser.close(); }
