/** Local real-API checks. Run with isolated H2 + backend/scripts/r2-test-server.py. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const imported = await import(process.env.LIFE_ORGANIZER_PUPPETEER_MODULE || 'puppeteer');
const puppeteer = imported.puppeteer ?? imported.default;
const app = process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5175';
const api = process.env.LIFE_ORGANIZER_API_URL || 'http://127.0.0.1:8087';
const storage = 'http://127.0.0.1:8091';
assert.ok(['127.0.0.1','localhost'].includes(new URL(api).hostname), 'Use an isolated local API; this test erases synthetic categories.');
const output = fileURLToPath(new URL('../../design-validation/temporary-memories/', import.meta.url));
const photo = fileURLToPath(new URL('../../LifeOrganizer-ModernWarm-Design/life-organizer-design/assets/sample-memory.jpg', import.meta.url));
await mkdir(output, { recursive: true });
const checks = [];
async function session(username) {
  const response = await fetch(api+'/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password:'local-memory-password'}) });
  assert.equal(response.status,200); return response.json();
}
const owner=await session('MemoryOwner'), partner=await session('MemoryPartner');
async function request(user,path,method='GET',body) {
  const response=await fetch(api+path,{method,headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const text=await response.text(); return {status:response.status,data:text?JSON.parse(text):null};
}
await fetch(storage+'/__test__/fail-delete',{method:'POST',body:JSON.stringify({enabled:false})});
for (const group of (await request(owner,'/api/memories/groups')).data) await request(owner,`/api/memories/groups/${group.id}`,'DELETE');
await request(owner,'/api/memories/cleanup','POST');
const browser=await puppeteer.launch({headless:true,executablePath:process.env.LIFE_ORGANIZER_CHROME||undefined,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
async function open(user) {
  const context=await browser.createBrowserContext(); await context.overridePermissions(app,['microphone']);
  const page=await context.newPage(); page.setDefaultTimeout(15000);
  page.on('request', r => { if(r.url().startsWith(api)) console.log(r.method(),new URL(r.url()).pathname); });
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(session => {
    localStorage.setItem('life-organizer.token',session.token);
    localStorage.setItem('life-organizer.user',JSON.stringify({userId:session.userId,role:session.role,name:session.name}));
  },user);
  await page.goto(app+'/memories'); await page.waitForSelector('.memory-retention-note'); return page;
}
async function button(page,label) {
  await page.waitForFunction(label => [...document.querySelectorAll('button,ion-button,ion-fab-button')].filter(b => b.getClientRects().length && !b.closest('.ion-page-hidden')).some(b => b.textContent.trim()===label||b.getAttribute('aria-label')===label),{},label);
  const handle=await page.evaluateHandle(label => [...document.querySelectorAll('button,ion-button,ion-fab-button')].filter(b => b.getClientRects().length && !b.closest('.ion-page-hidden')).find(b => b.textContent.trim()===label||b.getAttribute('aria-label')===label),label);
  await handle.asElement().evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  if (await handle.asElement().evaluate(el => el.tagName.startsWith('ION-'))) await handle.asElement().evaluate(el => el.click());
  else await handle.asElement().click();
  await handle.dispose();
}
async function noOverflow(page) {
  const result=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(result.overflow,false); return result;
}
async function choosePhoto(page) {
  const chooser=page.waitForFileChooser(); await button(page,'Choose from gallery'); await (await chooser).accept([photo]);
  await page.waitForSelector('.memory-preview');
}
try {
  const page=await open(owner);
  await page.waitForFunction(()=>document.body.innerText.includes('Create a category'));
  assert.ok(await page.$eval('.memory-retention-note',el=>el.textContent.includes('3 days')));
  await page.screenshot({path:output+'empty.png'});
  await button(page,'Create a category'); await page.waitForSelector('ion-modal.show-modal #memory-group-name',{visible:true});
  await page.type('#memory-group-name','A little birthday chapter'); await page.type('#memory-group-description','Here for a little while.');
  assert.ok(await page.$eval('.memory-group-form',el=>el.textContent.includes('72 hours')));
  await page.screenshot({path:output+'create-category.png'});
  await button(page,'Create category'); await page.waitForFunction(()=>location.pathname.includes('/memories/groups/')&&!document.querySelector('ion-modal.show-modal'));
  const group=(await request(owner,'/api/memories/groups')).data[0];
  assert.equal(Date.parse(group.expiresAt)-Date.parse(group.createdAt),72*3600*1000);
  checks.push({name:'Create a category with exactly 72-hour expiry and visible deletion notice',passed:true});
  await button(page,'Add a memory'); await page.waitForSelector('ion-modal.show-modal .composer-photo-actions'); await choosePhoto(page);
  const textarea=await page.waitForSelector('ion-textarea textarea'); await textarea.type('A moment, kept for three days.');
  // Verify a failed upload keeps the photo/caption so retry is possible.
  await page.setRequestInterception(true);
  const fail= r=>r.url().includes('/media')&&r.method()==='POST' ? r.respond({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':app},body:JSON.stringify({message:'Storage temporarily unavailable.'})}) : r.continue();
  page.on('request',fail);
  const failedUpload=page.waitForResponse(response=>response.url().includes('/media')&&response.status()===503);
  await button(page,'Save memory'); await failedUpload;
  await page.waitForFunction(()=>document.querySelector('ion-modal.show-modal .composer-actions ion-button')?.textContent.trim()==='Save memory' && !document.querySelector('ion-modal.show-modal .composer-actions ion-button')?.disabled);
  assert.equal(await page.$eval('ion-textarea textarea',el=>el.value),'A moment, kept for three days.'); assert.ok(await page.$('.memory-preview'));
  page.off('request',fail); await page.setRequestInterception(false);
  await button(page,'Save memory'); await page.waitForFunction(()=>!document.querySelector('ion-modal.show-modal')&&document.querySelector('.memory-card'));
  let memories=(await request(owner,'/api/memories')).data;
  assert.equal(memories.length,1); assert.ok(memories[0].photoUrl.startsWith(storage+'/memory-test/memories/'));
  assert.ok(memories[0].photoUrl.includes('X-Amz-Signature=')); assert.equal(memories[0].expiresAt,group.expiresAt);
  assert.equal((await fetch(memories[0].photoUrl)).status,200);
  checks.push({name:'Real authenticated multipart upload, R2 PUT/HEAD verification, signed image read, and failed-upload retry without losing draft',passed:true});
  await button(page,'Add a memory'); await page.waitForSelector('ion-modal.show-modal .composer-photo-actions'); await choosePhoto(page);
  await page.evaluate(()=>[...document.querySelectorAll('ion-segment-button')].find(el=>el.getAttribute('value')==='audio').click());
  await button(page,'Tap to record a voice note'); await page.waitForSelector('.audio-recorder__stop');
  await page.evaluate(()=>new Promise(r=>setTimeout(r,1100))); await page.click('.audio-recorder__stop');
  await page.waitForSelector('.audio-recorder__playback'); await button(page,'Save memory');
  await page.waitForFunction(()=>!document.querySelector('ion-modal.show-modal')&&document.querySelectorAll('.memory-card').length===2);
  memories=(await request(owner,'/api/memories')).data; const withAudio=memories.find(m=>m.audioUrl);
  assert.ok(withAudio); assert.equal((await fetch(withAudio.audioUrl)).status,200);
  const objects=(await (await fetch(storage+'/__test__/state')).json()).objects;
  assert.equal(Object.keys(objects).length,3); assert.ok(Object.values(objects).some(o=>o.type.startsWith('audio/')));
  checks.push({name:'Photo and synthetic browser voice recording both reach R2 and are linked to their category',passed:true});
  await page.screenshot({path:output+'timeline.png'});
  const recipient=await open(partner); await recipient.waitForSelector('.memory-collection');
  assert.equal(await recipient.$('button[aria-label="Create a category"]'),null);
  assert.equal((await request(partner,`/api/memories/groups/${group.id}`,'DELETE')).status,403);
  assert.equal((await request(partner,'/api/memories/cleanup','POST')).status,403);
  checks.push({name:'Recipient can browse the shared category but cannot delete or run cleanup',passed:true});
  await page.goto(app+'/memories'); await page.waitForSelector('.memory-collection');
  assert.ok(await page.$eval('.memory-collection__expiry',el=>el.textContent.includes('days left')));
  for (const width of [320,390,768]) {
    await page.setViewport({width,height:844,deviceScaleFactor:1}); await page.waitForSelector('.memory-collection');
    checks.push({name:`Category cards at ${width}px`,passed:true,...await noOverflow(page)}); await page.screenshot({path:output+`categories-${width}.png`});
  }
  await page.setViewport({width:320,height:844,deviceScaleFactor:1}); await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  checks.push({name:'Category cards at 320px with 200% text',passed:true,...await noOverflow(page)});
  // Shorten only the browser fixture's response deadline to exercise live expiry without waiting 3 days.
  const expiring=await open(owner); await expiring.setRequestInterception(true);
  const deadline=Date.now()+3500;
  expiring.on('request',async r=> {
    if(r.url().startsWith(api+'/api/memories/groups')&&r.method()==='GET') {
      const real=await request(owner,'/api/memories/groups');
      return r.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':app},body:JSON.stringify(real.data.map(g=>({...g,expiresAt:new Date(deadline).toISOString()})))});
    }
    return r.continue();
  });
  await expiring.reload(); await expiring.waitForSelector('.memory-collection');
  await expiring.waitForFunction(()=>!document.querySelector('.memory-collection'),{timeout:10000});
  checks.push({name:'An already-open category list removes expired cards at the deadline',passed:true});
  await page.evaluate(()=>document.documentElement.style.fontSize='100%'); await page.goto(app+`/memories/groups/${group.id}`); await page.waitForSelector('.memory-card');
  await button(page,'Delete category'); await page.waitForFunction(()=>document.querySelector('ion-modal.show-modal')?.textContent.includes('cannot be undone'));
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,400)));
  await page.screenshot({path:output+'delete-category.png'});
  // Turn storage deletion off: API visibility must still be removed, cleanup must retain retry state.
  await fetch(storage+'/__test__/fail-delete',{method:'POST',body:JSON.stringify({enabled:true})});
  const modalButton=await page.evaluateHandle(()=>[...document.querySelectorAll('ion-modal.show-modal button')].find(b=>b.textContent.trim()==='Delete category'));
  await modalButton.asElement().click(); await page.waitForFunction(()=>location.pathname==='/memories'&&!document.querySelector('ion-modal.show-modal'));
  assert.equal((await request(owner,'/api/memories/groups')).data.length,0);
  assert.equal((await request(owner,'/api/memories')).data.length,0);
  assert.equal((await request(owner,'/api/memories/cleanup','POST')).data.pendingCategories,1);
  assert.equal(Object.keys((await (await fetch(storage+'/__test__/state')).json()).objects).length,3);
  await fetch(storage+'/__test__/fail-delete',{method:'POST',body:JSON.stringify({enabled:false})});
  assert.equal((await request(owner,'/api/memories/cleanup','POST')).data.pendingCategories,0);
  assert.equal(Object.keys((await (await fetch(storage+'/__test__/state')).json()).objects).length,0);
  assert.equal((await fetch(memories[0].photoUrl)).status,404); assert.equal((await fetch(withAudio.audioUrl)).status,404);
  checks.push({name:'Confirmed deletion immediately hides records; failed storage cleanup stays queued; retry deletes every photo/audio object and DB row',passed:true});
  await writeFile(output+'checks.json',JSON.stringify({environment:'Synthetic accounts, isolated H2, real AWS SDK with local S3 test server',checks},null,2)+'\n');
  await rm(output+'failure-debug.png',{force:true});
  console.log(JSON.stringify(checks,null,2));
} catch(error) {
  for(const page of await browser.pages()) if(page.url().startsWith(app)) { console.error('Failed page',page.url(),await page.evaluate(()=>document.querySelector('ion-modal.show-modal')?.textContent.slice(-500)));  await page.screenshot({path:output+'failure-debug.png'}); }
  throw error;
} finally { await browser.close(); }
