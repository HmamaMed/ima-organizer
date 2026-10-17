/** Run with backend/scripts/WishesPreview.java and the loopback fake S3 server. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const imported = await import(process.env.LIFE_ORGANIZER_PUPPETEER_MODULE || 'puppeteer');
const puppeteer = imported.puppeteer ?? imported.default;
const api = process.env.LIFE_ORGANIZER_API_URL || 'http://127.0.0.1:8087';
const app = process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5175';
for (const url of [api, app]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
const storage = 'http://127.0.0.1:8091';
const output = fileURLToPath(new URL('../../design-validation/wishes/', import.meta.url));
await mkdir(output, { recursive: true });
const checks = [];
async function login(username) {
  const response = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'local-wishes-password' }) });
  assert.equal(response.status, 200); return response.json();
}
const recipient = await login('WishRecipient'), owner = await login('WishOwner');
async function request(user, path = '/api/wishes', method = 'GET', body) {
  const response = await fetch(api + path, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function r2() { return (await fetch(storage + '/__test__/state')).json(); }
async function failDelete(enabled) { await fetch(storage + '/__test__/fail-delete', { method: 'POST', body: JSON.stringify({ enabled }) }); }
assert.equal((await request(recipient)).data.length, 0, 'Restart the disposable preview before each run.');
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.LIFE_ORGANIZER_CHROME || undefined });
async function open(user, route = '/wishes') {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(session => {
    localStorage.setItem('life-organizer.token', session.token);
    localStorage.setItem('life-organizer.user', JSON.stringify({ userId: session.userId, role: session.role, name: session.name }));
  }, user);
  await page.goto(app + route); return page;
}
async function click(page, label) {
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => (b.textContent.trim() === text || b.getAttribute('aria-label') === text) && b.getBoundingClientRect().height > 0), {}, label);
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => (b.textContent.trim() === text || b.getAttribute('aria-label') === text) && b.getBoundingClientRect().height > 0), label);
  await handle.asElement().evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await handle.asElement().click(); await handle.dispose();
}
async function settled(page) {
  await page.waitForSelector('.wishes[aria-busy="false"]');
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
}
async function noModal(page) { await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal')); }
async function fill(page, selector, value) { await page.$eval(selector, (el, value) => { const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value); }
try {
  const page = await open(recipient, '/home');
  await page.waitForFunction(() => [...document.querySelectorAll('.mod-row')].some(button => button.textContent.includes('Mes envies')));
  await page.evaluate(() => [...document.querySelectorAll('.mod-row')].find(button => button.textContent.includes('Mes envies')).click());
  await settled(page); await page.waitForSelector('.wish-empty');
  await page.screenshot({ path: output + 'empty.png' });
  checks.push('Home chapter opens the French wishlist with a useful empty state.');
  await click(page, 'Ajouter une envie');
  await page.waitForSelector('ion-modal.show-modal #wish-title');
  await page.waitForFunction(() => document.activeElement?.id === 'wish-title');
  await fill(page, '#wish-title', 'Les petits bonheurs');
  await page.select('#wish-category', 'BOOK');
  await fill(page, '#wish-details', 'Une édition illustrée, à feuilleter les dimanches.\nLa couverture rose me plaît beaucoup.');
  await fill(page, '#wish-link', 'https://example.com/livre');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 500;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eee8df'; ctx.fillRect(0, 0, 800, 500);
    ctx.save(); ctx.translate(400, 250); ctx.rotate(-.12); ctx.shadowColor = '#452b3e44'; ctx.shadowBlur = 25; ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#d79eab'; ctx.fillRect(-135, -180, 270, 360); ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#b56d82'; ctx.fillRect(-135, -180, 16, 360); ctx.strokeStyle = '#f8f6f3'; ctx.lineWidth = 2; ctx.strokeRect(-100,-145,205,290);
    ctx.textAlign = 'center'; ctx.fillStyle = '#452b3e'; ctx.font = '34px Georgia'; ctx.fillText('Les petits', 0, -28); ctx.fillText('bonheurs', 0, 16);
    ctx.font = '17px sans-serif'; ctx.fillText('UNE ENVIE À GARDER', 0, 100); ctx.restore(); return canvas.toDataURL('image/png').split(',')[1];
  });
  const photoPath = '/tmp/life-wish-book.png'; await writeFile(photoPath, Buffer.from(png, 'base64'));
  await (await page.$('#wish-photo')).uploadFile(photoPath);
  await page.waitForSelector('.wish-photo-preview');
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
  await page.screenshot({ path: output + 'create.png' });
  let failSave = true, failRemoval = false;
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (failSave && req.method() === 'POST' && req.url() === api + '/api/wishes') {
      failSave = false; void req.respond({ status: 503, headers: { 'Access-Control-Allow-Origin': new URL(app).origin }, contentType: 'application/json', body: '{"message":"Échec temporaire. Réessayez."}' });
    } else if (failRemoval && req.method() === 'DELETE') {
      failRemoval = false; void req.respond({ status: 503, headers: { 'Access-Control-Allow-Origin': new URL(app).origin }, contentType: 'application/json', body: '{"message":"Échec temporaire."}' });
    } else void req.continue();
  });
  await click(page, 'Garder cette envie');
  await page.waitForFunction(() => document.querySelector('.wish-error')?.textContent.includes('Échec temporaire'));
  assert.equal((await request(recipient)).data.length, 0);
  const uploadedBeforeRetry = (await r2()).events.filter(e => e.method === 'PUT' && e.key.startsWith('wishes/')).length;
  await click(page, 'Garder cette envie'); await noModal(page); await settled(page);
  await page.waitForFunction(() => [...document.querySelectorAll('.wish-card__photo')].every(img => img.complete && img.naturalWidth > 0));
  assert.equal((await r2()).events.filter(e => e.method === 'PUT' && e.key.startsWith('wishes/')).length, uploadedBeforeRetry);
  let book = (await request(recipient)).data[0];
  assert.ok(book.photoUrl.includes('X-Amz-Signature='));
  assert.equal((await fetch(book.photoUrl.split('?')[0])).status, 403);
  assert.equal((await fetch(book.photoUrl)).status, 200);
  checks.push('Real backend/SDK image upload and private signed read work; failed save retries reuse the uploaded photo.');
  for (const idea of [
    { title: 'Une tasse pour les matins doux', category: 'OBJECT', details: 'En céramique, dans les tons crème.', link: null, photoId: null },
    { title: 'Un atelier de poterie à deux', category: 'EXPERIENCE', details: 'Pour essayer quelque chose de nouveau ensemble.', link: 'https://example.com/atelier', photoId: null },
  ]) assert.equal((await request(recipient, '/api/wishes', 'POST', idea)).status, 201);
  await page.reload(); await settled(page);
  assert.equal(await page.$$eval('.wish-card', cards => cards.length), 3);
  await click(page, 'Livres'); assert.equal(await page.$$eval('.wish-card', cards => cards.length), 1);
  await click(page, 'Modifier Les petits bonheurs');
  await page.waitForSelector('ion-modal.show-modal #wish-title');
  await page.waitForFunction(() => document.activeElement?.id === 'wish-title');
  await fill(page, '#wish-title', 'Les petits bonheurs — édition illustrée');
  await click(page, 'Enregistrer les modifications'); await noModal(page); await settled(page);
  book = (await request(recipient)).data.find(w => w.category === 'BOOK');
  assert.equal(book.photoId !== null, true);
  await click(page, 'Livres');
  await page.$eval('.wish-card', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction(() => ![...document.querySelectorAll('ion-toast')].some(toast => toast.isOpen));
  await page.screenshot({ path: output + 'recipient.png' });
  await click(page, 'Tout');
  for (const width of [320, 390, 768]) {
    await page.setViewport({ width, height: 960, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.$eval('.wishes', el => el.closest('ion-content').scrollToTop(0));
    assert.equal(await page.$eval('.lo-screen__inner', el => el.scrollWidth <= el.clientWidth + 1), true);
    await page.screenshot({ path: output + `list-${width}.png` });
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  assert.equal(await page.$eval('.lo-screen__inner', el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.screenshot({ path: output + 'large-text.png' });
  await page.reload(); await settled(page);
  checks.push('Category filters, text editing with photo retention, 320/390/768px layouts and 200% text pass.');
  const ownerPage = await open(owner); await settled(ownerPage);
  assert.equal(await ownerPage.$$eval('.wish-card', cards => cards.length), 3);
  assert.equal(await ownerPage.$$eval('.wish-card__actions', actions => actions.length), 0);
  await click(ownerPage, 'Livres');
  await ownerPage.$eval('.wish-card', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await ownerPage.screenshot({ path: output + 'owner.png' });
  assert.equal((await request(owner, '/api/wishes/' + book.id, 'DELETE')).status, 403);
  assert.equal((await request(owner, '/api/wishes', 'POST', { title: 'Forbidden', category: 'BOOK' })).status, 403);
  const link = await ownerPage.$eval('.wish-link', el => ({ href: el.href, rel: el.rel, target: el.target }));
  assert.equal(link.href, 'https://example.com/livre'); assert.equal(link.target, '_blank'); assert.match(link.rel, /noopener/);
  checks.push('Owner sees shared wishes and safe external links, with server-enforced read-only permissions.');
  await click(page, 'Supprimer ' + book.title); await page.waitForSelector('ion-modal.show-modal');
  await page.screenshot({ path: output + 'delete.png' });
  await click(page, 'Annuler'); await noModal(page);
  assert.equal((await request(recipient)).data.length, 3);
  await click(page, 'Supprimer ' + book.title); failRemoval = true;
  await click(page, 'Supprimer l’envie');
  await page.waitForFunction(() => document.querySelector('ion-modal.show-modal')?.textContent.includes('Impossible de supprimer'));
  assert.equal((await request(recipient)).data.length, 3);
  await failDelete(true); await click(page, 'Supprimer l’envie'); await noModal(page);
  assert.equal((await request(recipient)).data.length, 2);
  assert.equal((await fetch(book.photoUrl)).status, 200);
  await failDelete(false);
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await fetch(book.photoUrl)).status === 404) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal((await fetch(book.photoUrl)).status, 404);
  await page.reload(); await settled(page); assert.equal(await page.$$eval('.wish-card', cards => cards.length), 2);
  checks.push('Delete cancellation and failure recovery pass; detached R2 photo is erased by the retryable cleanup worker.');
  await writeFile(output + 'checks.json', JSON.stringify({ checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally { await failDelete(false); await browser.close(); }
