/** Disposable local fixture: backend/scripts/SharedNotebooksPreview.java. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const imported = await import(process.env.LIFE_ORGANIZER_PUPPETEER_MODULE || 'puppeteer');
const puppeteer = imported.puppeteer ?? imported.default;
const api = process.env.LIFE_ORGANIZER_API_URL || 'http://127.0.0.1:8087';
const app = process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5175';
for (const address of [api,app]) assert.ok(['localhost','127.0.0.1'].includes(new URL(address).hostname));
const output = fileURLToPath(new URL('../../design-validation/shared-notebooks/', import.meta.url));
await mkdir(output, { recursive: true });
const checks = [];
async function login(username) {
  const response = await fetch(api + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'local-notebooks-password' }) });
  assert.equal(response.status,200); return response.json();
}
const owner = await login('NotebookOwner'), recipient = await login('NotebookRecipient');
async function request(user, path, method = 'GET', body) {
  const response = await fetch(api + path, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
for (const path of ['/api/watchlist','/api/recipes']) assert.equal((await request(owner,path)).data.length,0,'Restart the disposable backend fixture before each run.');
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.LIFE_ORGANIZER_CHROME || undefined });
let debugPage;
async function open(user, path = '/home') {
  const context = await browser.createBrowserContext(); const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(session => {
    localStorage.setItem('life-organizer.token',session.token);
    localStorage.setItem('life-organizer.user',JSON.stringify({ userId: session.userId, role: session.role, name: session.name }));
  },user);
  await page.goto(app + path); return page;
}
async function frames(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function click(page, label) {
  await page.waitForFunction(label => [...document.querySelectorAll('button')].some(el => (el.textContent.trim() === label || el.getAttribute('aria-label') === label) && el.getBoundingClientRect().height > 0),{},label);
  const handle = await page.evaluateHandle(label => [...document.querySelectorAll('button')].find(el => (el.textContent.trim() === label || el.getAttribute('aria-label') === label) && el.getBoundingClientRect().height > 0),label);
  await handle.asElement().evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await frames(page);
  await handle.asElement().click(); await handle.dispose(); await frames(page);
}
async function fill(page, selector, value) {
  await page.$eval(selector,(el,value) => {
    Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(el,value);
    el.dispatchEvent(new Event('input',{ bubbles: true }));
  },value); await frames(page);
}
async function settled(page, module) {
  await page.waitForSelector(`.${module}[aria-busy="false"]`);
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
}
async function editor(page, inputId) { await page.waitForFunction(id => document.activeElement?.id === id,{},inputId); }
async function noModal(page) { await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal')); }
async function capture(page, name, selector) {
  if (selector) await page.$eval(selector,el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await frames(page);
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
  await page.waitForFunction(() => ![...document.querySelectorAll('ion-toast')].some(toast => toast.isOpen));
  await page.screenshot({ path: output + name + '.png' });
}
async function chapter(page,title) {
  await page.waitForFunction(title => [...document.querySelectorAll('.mod-row')].some(el => el.textContent.includes(title)),{},title);
  await page.evaluate(title => [...document.querySelectorAll('.mod-row')].find(el => el.textContent.includes(title)).click(),title); await frames(page);
}
async function layouts(page,module) {
  for (const width of [320,390,768]) {
    await page.setViewport({ width, height: 960, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.$eval(`.${module}`,el => el.closest('ion-content').scrollToTop(0)); await frames(page);
    assert.equal(await page.$eval('.lo-screen__inner',el => el.scrollWidth <= el.clientWidth + 1),true);
    await capture(page,`${module}-${width}`);
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  assert.equal(await page.$eval('.lo-screen__inner',el => el.scrollWidth <= el.clientWidth + 1),true);
  await capture(page,`${module}-large-text`); await page.reload(); await settled(page,module);
}
try {
  const page = await open(owner); debugPage = page;
  await chapter(page,'On regarde quoi ?'); await settled(page,'watchlist');
  await capture(page,'watch-empty');
  await click(page,'Ajouter un film ou une série'); await editor(page,'watch-title');
  await fill(page,'#watch-title','Notre série du dimanche'); await page.select('#watch-kind','SERIES');
  await fill(page,'#watch-notes','Conseillée par une amie. On garde le dimanche soir pour la découvrir.');
  await capture(page,'watch-create');
  let failSave = true, failDelete = false;
  await page.setRequestInterception(true);
  page.on('request',req => {
    if ((failSave && req.method() === 'POST' && req.url() === api + '/api/watchlist') || (failDelete && req.method() === 'DELETE')) {
      failSave = false; failDelete = false; void req.respond({ status: 503, headers: { 'Access-Control-Allow-Origin': new URL(app).origin }, contentType: 'application/json', body: '{"message":"Échec temporaire. Réessayez."}' });
    } else void req.continue();
  });
  await click(page,'Ajouter à notre sélection');
  await page.waitForFunction(() => document.querySelector('ion-modal.show-modal .notebook-error')?.textContent.includes('Échec temporaire'));
  assert.equal((await request(owner,'/api/watchlist')).data.length,0);
  await click(page,'Ajouter à notre sélection'); await noModal(page); await settled(page,'watchlist');
  const series = (await request(owner,'/api/watchlist')).data[0];
  let changed = page.waitForResponse(response => response.url().endsWith('/status') && response.request().method() === 'PATCH' && response.ok());
  await page.select(`select[aria-label="Statut de ${series.title}"]`,'IN_PROGRESS'); await changed;
  const otherPage = await open(recipient,'/watchlist'); await settled(otherPage,'watchlist');
  assert.equal(await otherPage.$eval('.notebook-status',el => el.value),'IN_PROGRESS');
  assert.equal((await request(recipient,'/api/watchlist','POST',{ title: 'Un film pour ce soir',kind: 'FILM',status: 'TO_WATCH',notes: null })).status,201);
  await page.reload(); await settled(page,'watchlist'); await page.select('select[aria-label="Filtrer par format"]','SERIES'); await frames(page);
  assert.equal(await page.$$eval('.watch-card',items => items.length),1);
  await click(page,'En cours'); assert.equal(await page.$$eval('.watch-card',items => items.length),1);
  changed = page.waitForResponse(response => response.url().endsWith('/status') && response.ok());
  await page.select(`select[aria-label="Statut de ${series.title}"]`,'WATCHED'); await changed;
  await click(page,'Vu'); await click(page,'Donner mon avis'); await editor(page,'watch-review-comment');
  await click(page,'4 étoiles'); await fill(page,'#watch-review-comment','De beaux personnages. Le genre de série dont on reparle après.');
  await capture(page,'watch-review'); await click(page,'Garder mon avis'); await noModal(page);
  await otherPage.reload(); await settled(otherPage,'watchlist'); await click(otherPage,'Donner mon avis'); await editor(otherPage,'watch-review-comment');
  await click(otherPage,'5 étoiles'); await fill(otherPage,'#watch-review-comment','Un vrai coup de cœur. On regarde la suite ensemble !'); await click(otherPage,'Garder mon avis'); await noModal(otherPage);
  await page.reload(); await settled(page,'watchlist'); await click(page,'Vu');
  assert.equal(await page.$$eval('.watch-opinion',items => items.length),2);
  await capture(page,'watch-two-reviews','.watch-card');
  await click(page,'Modifier mon avis'); await editor(page,'watch-review-comment'); await click(page,'3 étoiles'); await click(page,'Garder mon avis'); await noModal(page);
  let opinions = (await request(owner,'/api/watchlist')).data.find(item => item.id === series.id).reviews;
  assert.equal(opinions.find(item => item.userId === owner.userId).rating,3); assert.equal(opinions.find(item => item.userId === recipient.userId).rating,5);
  await click(page,'Modifier mon avis'); await editor(page,'watch-review-comment'); await click(page,'Retirer mon avis'); await noModal(page);
  opinions = (await request(owner,'/api/watchlist')).data.find(item => item.id === series.id).reviews;
  assert.equal(opinions.length,1); assert.equal(opinions[0].userId,recipient.userId);
  checks.push('Watchlist: Home navigation, failed-save retry, shared titles, film/series and status filters, independent reviews and own-review removal.');
  await click(page,'Tout'); await layouts(page,'watchlist');
  await click(page,'Supprimer ' + series.title); await click(page,'Annuler'); await noModal(page);
  assert.equal((await request(owner,'/api/watchlist')).data.length,2);
  await click(page,'Supprimer ' + series.title); failDelete = true; await click(page,'Supprimer');
  await page.waitForFunction(() => document.querySelector('ion-modal.show-modal')?.textContent.includes('La suppression a échoué'));
  assert.equal((await request(owner,'/api/watchlist')).data.length,2);
  await click(page,'Supprimer'); await noModal(page); await page.reload(); await settled(page,'watchlist');
  assert.equal((await request(recipient,'/api/watchlist')).data.length,1);
  checks.push('Watchlist deletion supports cancellation/retry and persists for both accounts; layouts pass at 320/390/768px and 200% text.');

  await otherPage.goto(app + '/home'); await chapter(otherPage,'Nos recettes'); await settled(otherPage,'recipes'); debugPage = otherPage;
  await capture(otherPage,'recipes-empty');
  await click(otherPage,'Ajouter une recette'); await editor(otherPage,'recipe-title');
  await fill(otherPage,'#recipe-title','Notre salade des beaux jours'); await fill(otherPage,'#recipe-minutes','15');
  await fill(otherPage,'.recipe-ingredient-name','Tomates'); await fill(otherPage,'.recipe-ingredient-amount','250 g');
  await click(otherPage,'Ajouter un ingrédient');
  await fill(otherPage,'.recipe-ingredient-editor:nth-of-type(2) .recipe-ingredient-name','À retirer');
  await click(otherPage,'Ajouter un ingrédient');
  let ingredientInputs = await otherPage.$$('.recipe-ingredient-name');
  await ingredientInputs[2].evaluate(el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Basilic'); el.dispatchEvent(new Event('input',{ bubbles:true })); });
  await click(otherPage,'Retirer l’ingrédient 2');
  await click(otherPage,'Ajouter un ingrédient');
  ingredientInputs = await otherPage.$$('.recipe-ingredient-name');
  await ingredientInputs[2].evaluate(el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Mozzarella'); el.dispatchEvent(new Event('input',{ bubbles:true })); });
  const amounts = await otherPage.$$('.recipe-ingredient-amount');
  await amounts[2].evaluate(el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'125 g'); el.dispatchEvent(new Event('input',{ bubbles:true })); });
  await fill(otherPage,'.recipe-step-text','Laver et couper les tomates.'); await click(otherPage,'Ajouter une étape');
  const stepInputs = await otherPage.$$('.recipe-step-text');
  await stepInputs[1].evaluate(el => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Ajouter la mozzarella et le basilic, puis assaisonner.'); el.dispatchEvent(new Event('input',{ bubbles:true })); });
  await fill(otherPage,'#recipe-tips','Un filet d’huile d’olive et une pincée de fleur de sel au dernier moment.');
  await capture(otherPage,'recipes-create'); await click(otherPage,'Garder cette recette'); await noModal(otherPage); await settled(otherPage,'recipes');
  const recipe = (await request(owner,'/api/recipes')).data[0];
  assert.deepEqual(recipe.ingredients.map(item => item.name),['Tomates','Basilic','Mozzarella']); assert.equal(recipe.steps.length,2);
  await otherPage.goto(app + '/recipes'); await settled(otherPage,'recipes'); await click(otherPage,'Voir la recette');
  await otherPage.waitForSelector('.recipe-detail__body'); await capture(otherPage,'recipes-detail','.recipe-ingredients');
  assert.equal(await otherPage.$$eval('.recipe-ingredients li',items => items.length),3);
  assert.equal(await otherPage.$$eval('.recipe-steps li',items => items.length),2);
  assert.match(await otherPage.$eval('.recipe-tips',el => el.textContent),/fleur de sel/);
  await click(otherPage,'Fermer la recette'); await noModal(otherPage);
  changed = otherPage.waitForResponse(response => response.url().endsWith('/status') && response.ok());
  await click(otherPage,'Mettre en favori : ' + recipe.title); await changed;
  await click(otherPage,'Nos favoris'); assert.equal(await otherPage.$$eval('.recipe-card',items => items.length),1);
  await fill(otherPage,'input[type="search"]','basilic'); assert.equal(await otherPage.$$eval('.recipe-card',items => items.length),1);
  await fill(otherPage,'input[type="search"]','inexistant'); await otherPage.waitForFunction(() => !document.querySelector('.recipe-card'));
  await fill(otherPage,'input[type="search"]','');
  await page.goto(app + '/recipes'); await settled(page,'recipes'); await click(page,'Modifier ' + recipe.title); await editor(page,'recipe-title');
  await fill(page,'#recipe-servings','4'); await fill(page,'#recipe-tips','On double les quantités quand on reçoit.'); await click(page,'Enregistrer les modifications'); await noModal(page);
  await otherPage.reload(); await settled(otherPage,'recipes');
  assert.match(await otherPage.$eval('.recipe-meta',el => el.textContent),/4 personnes/);
  assert.equal((await request(recipient,'/api/recipes')).data[0].ingredients.length,3);
  await capture(otherPage,'recipes-card','.recipe-card'); await layouts(otherPage,'recipes');
  checks.push('Recipes: recipient creates ordered ingredient/quantity rows and steps, detail shows tips, favorites/search work, owner edits are shared and retain ingredients.');
  await click(otherPage,'Supprimer ' + recipe.title); await click(otherPage,'Annuler'); await noModal(otherPage);
  assert.equal((await request(owner,'/api/recipes')).data.length,1);
  await click(otherPage,'Supprimer ' + recipe.title); await capture(otherPage,'recipes-delete'); await click(otherPage,'Supprimer'); await noModal(otherPage);
  await otherPage.reload(); await settled(otherPage,'recipes'); await otherPage.waitForSelector('.notebook-empty');
  assert.equal((await request(owner,'/api/recipes')).data.length,0);
  checks.push('Recipe deletion persists across accounts; 320/390/768px and 200% text layouts fit without horizontal overflow.');
  await writeFile(output + 'checks.json',JSON.stringify({ checks },null,2)); console.log(JSON.stringify({ passed:checks.length,checks },null,2));
} catch (cause) {
  if (debugPage) { await debugPage.screenshot({ path: '/tmp/shared-notebooks-failure.png' }); console.error(await debugPage.evaluate(() => ({ path:location.pathname,error:document.querySelector('.notebook-error')?.textContent }))); }
  throw cause;
} finally { await browser.close(); }
