#!/usr/bin/env node
// Real UI capture; no persisted authentication or application fixture injection.
import { readFile, mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));
if (positional.length !== 2 || [...flags].some(flag => !['--allow-remote', '--force'].includes(flag))) {
  console.error('Usage: node capture.mjs PLAN.json OUTPUT_DIR [--allow-remote] [--force]');
  process.exit(1);
}
const [planPath, outputArgument] = positional;
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const base = new URL(plan.baseUrl);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
  throw new Error('Use an HTTP(S) base URL without embedded credentials.');
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) && !flags.has('--allow-remote')) {
  throw new Error('Remote capture needs --allow-remote and an authorized synthetic test environment.');
}
const viewport = plan.viewport ?? { width: 360, height: 640 };
const scale = plan.deviceScaleFactor ?? 3;
if (![viewport.width, viewport.height, scale].every(value => Number.isFinite(value) && value > 0)) {
  throw new Error('Viewport and scale must be positive numbers.');
}
if (!Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error('Provide capture scenes.');
const out = path.resolve(outputArgument);
await mkdir(out, { recursive: true });
const names = new Set();
for (const scene of plan.scenes) {
  if (!/^[a-zA-Z0-9_-]+$/.test(scene.name) || names.has(scene.name)) throw new Error('Scene names must be unique safe filenames.');
  names.add(scene.name);
  if (!flags.has('--force')) {
    try { await access(path.join(out, `${scene.name}.png`)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    throw new Error(`Refusing to replace ${scene.name}.png without --force.`);
  }
}
const moduleName = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(path.resolve(moduleName)).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined });
try {
  const context = await browser.newContext({
    viewport, deviceScaleFactor: scale, locale: plan.locale ?? 'en-US',
    timezoneId: plan.timezoneId ?? 'UTC', colorScheme: plan.colorScheme ?? 'light',
    reducedMotion: 'reduce', serviceWorkers: 'block',
    ...(plan.record ? { recordVideo: { dir: path.join(out, 'video'), size: viewport } } : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  async function steps(items = []) {
    for (const step of items) {
      if (step.action === 'goto') {
        const url = new URL(step.path, base);
        if (url.origin !== base.origin) throw new Error('Capture navigation must stay on the configured app origin.');
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      } else if (step.action === 'click') await page.locator(step.selector).click();
      else if (step.action === 'fill') {
        const value = step.env ? process.env[step.env] : step.value;
        if (typeof value !== 'string') throw new Error('Missing fill value/environment variable.');
        await page.locator(step.selector).fill(value);
      } else if (step.action === 'select') await page.locator(step.selector).selectOption(step.value);
      else if (step.action === 'press') await page.locator(step.selector).press(step.key);
      else if (step.action === 'waitFor') await page.locator(step.selector).waitFor({ state: 'visible' });
      else throw new Error(`Unsupported action: ${step.action}`);
    }
  }
  await steps(plan.setup);
  const scenes = [];
  for (const scene of plan.scenes) {
    await steps(scene.steps);
    if (scene.ready) await page.locator(scene.ready).waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${scene.name}.png`), fullPage: false, animations: 'disabled', omitBackground: false });
    scenes.push({ file: `${scene.name}.png`, alt: scene.alt ?? '', platform: 'browser',
      width: viewport.width * scale, height: viewport.height * scale });
  }
  await context.close(); // Flush optional WebM recording.
  await writeFile(path.join(out, 'capture-manifest.json'), JSON.stringify({
    capturedAt: new Date().toISOString(), platform: 'browser', locale: plan.locale ?? 'en-US',
    viewport, deviceScaleFactor: scale, recorded: !!plan.record, scenes,
    nativeVerification: 'Not performed by this browser capture script.',
  }, null, 2) + '\n');
  console.log(`Captured ${scenes.length} real browser screens in ${out}`);
} finally {
  await browser.close();
}
