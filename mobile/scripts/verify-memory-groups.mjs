/** Isolated memory-group browser checks. All API and storage calls use fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(
  process.env.LIFE_ORGANIZER_PLAYWRIGHT || 'playwright'
);
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'design-validation');
await mkdir(path.join(output, 'screenshots'), { recursive: true });
const appUrl =
  process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5173';
const photo = path.join(
  root,
  'LifeOrganizer-ModernWarm-Design/life-organizer-design/assets/sample-memory.jpg',
);
const birthdayId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const tripId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const newId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const now = new Date().toISOString();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LIFE_ORGANIZER_CHROME || undefined,
});
const checks = [];
async function fixture(role = 'OWNER', reducedMotion = 'reduce') {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion,
    timezoneId: 'Africa/Casablanca',
  });
  await context.addInitScript((role) => {
    localStorage.setItem('life-organizer.token', 'memory-groups-fixture-token');
    localStorage.setItem(
      'life-organizer.user',
      JSON.stringify({ userId: role.toLowerCase(), name: 'Fixture', role }),
    );
  }, role);
  const state = {
    groups: [
      {
        id: birthdayId,
        name: 'Birthday memories',
        description: 'Another candle, another year together.',
        createdAt: now,
      },
      { id: tripId, name: 'Our trips', description: null, createdAt: now },
    ],
    memories: [
      {
        id: 'legacy-new',
        memoryDate: '2026-09-01',
        caption: 'Our original story, second moment.',
        groupId: null,
      },
      {
        id: 'birthday-new',
        memoryDate: '2026-10-03',
        caption: 'Birthday cake and a wish.',
        groupId: birthdayId,
      },
      {
        id: 'trip',
        memoryDate: '2026-08-09',
        caption: 'A trip belongs only in our trips.',
        groupId: tripId,
      },
      {
        id: 'legacy-old',
        memoryDate: '2026-08-01',
        caption: 'Our original story, first moment.',
        groupId: null,
      },
      {
        id: 'birthday-old',
        memoryDate: '2025-10-03',
        caption: 'The first birthday we kept.',
        groupId: birthdayId,
      },
    ].map((m) => ({
      ...m,
      photoUrl: `${appUrl}/fixture-memory.jpg`,
      audioUrl: null,
      createdAt: now,
    })),
    failGroupCreate: false,
    failMemoryCreate: false,
    failGroupRead: false,
    uploads: 0,
  };
  const requests = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.pathname === '/fixture-memory.jpg' ||
      url.pathname.startsWith('/storage/v1/object/public/')
    ) {
      return route.fulfill({ path: photo, contentType: 'image/jpeg' });
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      state.uploads++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          Key: url.pathname.slice('/storage/v1/object/'.length),
        }),
      });
    }
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin !== appUrl) return route.abort();
      return route.continue();
    }
    const body = request.postDataJSON();
    requests.push({ path: url.pathname, method: request.method(), body });
    let data = [];
    let status = 200;
    if (url.pathname === '/api/memories/groups') {
      if (request.method() === 'GET') {
        status = state.failGroupRead ? 404 : 200;
        data = state.failGroupRead ? { message: 'Unavailable' } : state.groups;
      } else if (state.failGroupCreate) {
        status = 503;
        data = { message: 'Fixture create failure' };
      } else {
        status = 201;
        data = { id: newId, ...body, createdAt: now };
        state.groups.push(data);
      }
    } else if (url.pathname === '/api/memories') {
      if (request.method() === 'GET') data = state.memories;
      else if (state.failMemoryCreate) {
        status = 503;
        data = { message: 'Fixture save failure' };
      } else {
        status = 201;
        data = { id: 'created-memory', ...body, createdAt: now };
        state.memories.push(data);
      }
    } else if (url.pathname === '/api/gym/programmes/active') {
      status = 204;
      data = null;
    }
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: status === 204 ? '' : JSON.stringify(data),
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, state, requests, errors };
}
async function open(page, route) {
  await page.goto(appUrl + route);
  await page.locator('h1').first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector('.lo-feedback--loading'),
  );
  await page.evaluate(() => document.fonts.ready);
}
async function settle(page) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('ion-router-outlet > .ion-page')].filter(
        (e) => !e.classList.contains('ion-page-hidden'),
      ).length === 1,
  );
}
async function snap(page, name) {
  await page.waitForFunction(() => [...document.querySelectorAll('ion-modal.show-modal')].every((modal) => {
    const wrapper = modal.shadowRoot?.querySelector('.modal-wrapper');
    return !wrapper || parseFloat(getComputedStyle(wrapper).opacity) >= 0.999;
  }));
  // Capture the presented modal, after Ionic's finite Web Animations settle.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter((animation) =>
      animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity,
    ).map((animation) => animation.finished.catch(() => {})));
  });
  await page.screenshot({
    path: path.join(output, 'screenshots', name + '.png'),
  });
}
async function layout(page) {
  const result = await page.evaluate(() => {
    const active = [
      ...document.querySelectorAll('ion-router-outlet > .ion-page'),
    ]
      .filter((p) => !p.classList.contains('ion-page-hidden'))
      .at(-1);
    const scope = document.querySelector('ion-modal.show-modal') || active;
    const overflow = [
      ...scope.querySelectorAll(
        'h1, p, .memory-collection, .memory-collection__name, input, textarea, .memory-card',
      ),
    ]
      .map((e) => ({
        text: e.textContent.slice(0, 60),
        r: e.getBoundingClientRect(),
      }))
      .filter(({ r }) => r.width && (r.left < -2 || r.right > innerWidth + 2))
      .map(({ text }) => text);
    const small = [...scope.querySelectorAll('button')]
      .filter((e) => !e.disabled)
      .map((e) => ({
        text: e.getAttribute('aria-label') || e.textContent.trim(),
        r: e.getBoundingClientRect(),
      }))
      .filter(({ r }) => r.width && (r.width < 47.5 || r.height < 47.5))
      .map(({ text }) => text);
    return { overflow, small };
  });
  assert.deepEqual(result, { overflow: [], small: [] });
}
try {
  for (const role of process.env.LIFE_ORGANIZER_CHECK_MODE === 'interactions'
    ? []
    : ['OWNER', 'RECIPIENT']) {
    const f = await fixture(role);
    for (const width of [320, 360, 390, 430]) {
      await f.page.setViewportSize({ width, height: 844 });
      for (const route of [
        '/memories',
        '/memories/groups/ungrouped',
        `/memories/groups/${birthdayId}`,
        `/memories/groups/${tripId}`,
      ]) {
        await open(f.page, route);
        await layout(f.page);
        if (route.endsWith('ungrouped')) {
          const captions = await f.page
            .locator('.memory-card__caption')
            .allTextContents();
          assert.deepEqual(captions, [
            'Our original story, first moment.',
            'Our original story, second moment.',
          ]);
        } else if (route.endsWith(birthdayId)) {
          assert.deepEqual(
            await f.page.locator('.memory-card__caption').allTextContents(),
            ['The first birthday we kept.', 'Birthday cake and a wish.'],
          );
        }
        if (role === 'RECIPIENT') {
          assert.equal(
            await f.page
              .getByRole('button', { name: 'Create a group' })
              .count(),
            0,
          );
          assert.equal(
            await f.page.getByRole('button', { name: 'Add a memory' }).count(),
            0,
          );
        }
        if (
          width === 390 &&
          (route === '/memories' || route.endsWith(birthdayId))
        ) {
          await snap(
            f.page,
            role.toLowerCase() +
              (route === '/memories' ? '-memory-groups' : '-birthday-timeline'),
          );
        }
      }
    }
    await f.page.setViewportSize({ width: 320, height: 844 });
    for (const route of ['/memories', `/memories/groups/${birthdayId}`]) {
      await open(f.page, route);
      await f.page.evaluate(
        () => (document.documentElement.style.fontSize = '200%'),
      );
      await f.page.waitForFunction(
        () =>
          getComputedStyle(document.documentElement).fontSize === '32px' &&
          parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) >=
            56,
      );
      await layout(f.page);
      if (role === 'OWNER')
        await snap(
          f.page,
          route === '/memories' ? 'memory-groups-200' : 'birthday-timeline-200',
        );
    }
    assert.deepEqual(f.errors, []);
    console.log(`${role}: layout checks passed`);
    checks.push(
      `${role}: 320/360/390/430px and 200% text; group isolation; original chronology; correct authoring permissions.`,
    );
    await f.context.close();
  }
  const f = await fixture();
  await open(f.page, '/memories');
  await f.page
    .getByRole('button', { name: 'Open Our story', exact: true })
    .click();
  await f.page.waitForURL('**/memories/groups/ungrouped');
  await settle(f.page);
  assert.equal(await f.page.locator('.memory-card').count(), 2);
  await f.page.getByRole('button', { name: 'Back', exact: true }).click();
  await f.page.waitForURL('**/memories');
  await settle(f.page);
  await f.page
    .getByRole('button', { name: 'Create a group', exact: true })
    .click();
  await f.page
    .getByLabel('Group name', { exact: true })
    .fill('  Our everyday moments  ');
  await f.page
    .getByLabel('Description (optional)', { exact: true })
    .fill('  The little things, together.  ');
  await snap(f.page, 'memory-create-group');
  f.state.failGroupCreate = true;
  await f.page
    .getByRole('button', { name: 'Create group', exact: true })
    .click();
  await f.page.getByRole('alert').waitFor();
  assert.equal(
    await f.page.getByLabel('Group name', { exact: true }).inputValue(),
    '  Our everyday moments  ',
  );
  assert.equal(f.state.groups.length, 2);
  f.state.failGroupCreate = false;
  await f.page
    .getByRole('button', { name: 'Create group', exact: true })
    .click();
  await f.page.waitForURL(`**/memories/groups/${newId}`);
  await settle(f.page);
  await f.page.locator('ion-modal.show-modal').waitFor({ state: 'hidden' });
  await f.page
    .getByRole('heading', { name: 'Our everyday moments', exact: true })
    .waitFor();
  await f.page
    .getByText('A new chapter starts here.', { exact: true })
    .waitFor();
  await snap(f.page, 'memory-new-group-empty');
  const post = f.requests
    .filter((r) => r.method === 'POST' && r.path === '/api/memories/groups')
    .at(-1);
  assert.deepEqual(post.body, {
    name: 'Our everyday moments',
    description: 'The little things, together.',
  });
  assert.equal(await f.page.locator('ion-modal.show-modal').count(), 0);
  // Ionic's slotted icon retargets hit testing to the custom-element host.
  await f.page.locator('ion-fab-button[aria-label="Add a memory"]').click();
  const chooser = f.page.waitForEvent('filechooser');
  await f.page
    .getByRole('button', { name: 'Choose from gallery', exact: true })
    .click();
  await (await chooser).setFiles(photo);
  await f.page.locator('.memory-preview__img').waitFor();
  await f.page
    .getByLabel('Caption (optional)', { exact: true })
    .fill('A tiny moment worth keeping.');
  await snap(f.page, 'memory-add-to-group');
  f.state.failMemoryCreate = true;
  await f.page
    .getByRole('button', { name: 'Save memory', exact: true })
    .click();
  await f.page
    .getByText(
      'Could not save the memory. Check your connection and try again.',
      { exact: true },
    )
    .waitFor();
  await snap(f.page, 'memory-save-failure');
  assert.equal(
    await f.page
      .locator('ion-modal.show-modal ion-textarea textarea')
      .inputValue(),
    'A tiny moment worth keeping.',
  );
  f.state.failMemoryCreate = false;
  await f.page
    .getByRole('button', { name: 'Save memory', exact: true })
    .click();
  await f.page.locator('ion-modal.show-modal').waitFor({ state: 'hidden' });
  await f.page
    .locator('.memory-card__caption')
    .filter({ hasText: 'A tiny moment worth keeping.' })
    .waitFor();
  const saved = f.requests
    .filter((r) => r.method === 'POST' && r.path === '/api/memories')
    .at(-1).body;
  assert.equal(saved.groupId, newId);
  assert.equal(saved.caption, 'A tiny moment worth keeping.');
  assert.ok(
    saved.photoUrl.includes('/storage/v1/object/public/media/memories/'),
  );
  assert.equal(f.state.memories.filter((m) => m.groupId === newId).length, 1);
  assert.equal(f.state.memories.filter((m) => !m.groupId).length, 2);
  await f.page.getByRole('button', { name: 'Back', exact: true }).click();
  await settle(f.page);
  await f.page
    .getByRole('button', { name: 'Open Our everyday moments', exact: true })
    .waitFor();
  await open(f.page, '/memories');
  await f.page
    .getByRole('button', { name: 'Open Our everyday moments', exact: true })
    .click();
  await f.page
    .locator('.memory-card__caption')
    .filter({ hasText: 'A tiny moment worth keeping.' })
    .waitFor();
  assert.deepEqual(f.errors, []);
  checks.push(
    'Create group → empty timeline → gallery photo → failed save retains draft → successful save carries groupId → revisit saved collection. Group-creation errors retain details. Original memories untouched.',
  );
  await f.context.close();

  const unavailable = await fixture();
  unavailable.state.failGroupRead = true;
  await open(unavailable.page, '/memories');
  await unavailable.page
    .getByText('Could not load memory groups.', { exact: true })
    .waitFor();
  await unavailable.page
    .getByRole('button', { name: 'Open Our story', exact: true })
    .click();
  await unavailable.page.locator('.memory-card').first().waitFor();
  assert.equal(await unavailable.page.locator('.memory-card').count(), 2);
  checks.push(
    'Unavailable groups endpoint: original Our story timeline remains accessible.',
  );
  await unavailable.context.close();

  const empty = await fixture();
  empty.state.groups = [];
  empty.state.memories = [];
  await open(empty.page, '/memories');
  await empty.page.getByText('Our story starts here.', { exact: true }).waitFor();
  assert.equal(await empty.page.locator('.memory-collection').count(), 0);
  await open(empty.page, `/memories/groups/${birthdayId}`);
  await empty.page.getByText('This group could not be found.', { exact: true }).waitFor();
  assert.equal(await empty.page.getByRole('button', { name: 'Add a memory' }).count(), 0);
  checks.push('No groups/memories: clear first-group state. Unknown group: no misplaced-memory authoring.');
  await empty.context.close();

  const animation = await fixture('OWNER', 'no-preference');
  await open(animation.page, `/memories/groups/${birthdayId}`);
  const first = animation.page.locator('.memory-card--left').first();
  await first.waitFor();
  await animation.page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.memory-card--left')).opacity ===
      '1',
  );
  await animation.page.waitForFunction(() =>
    ['.memory-card--left .memory-card__caption', '.memory-card--left .memory-card__date'].every(
      (selector) => getComputedStyle(document.querySelector(selector)).opacity === '1',
    ),
  );
  const styles = await first.evaluate((e) => ({
    transform: getComputedStyle(e).transform,
    transition: getComputedStyle(e).transitionDuration,
  }));
  assert.notEqual(styles.transform, 'none');
  assert.ok(styles.transition.includes('0.7s'));
  const right = animation.page.locator('.memory-card--right').first();
  await right.scrollIntoViewIfNeeded();
  await animation.page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.memory-card--right'))
        .opacity === '1',
  );
  const rotations = await animation.page
    .locator('.memory-card')
    .evaluateAll((els) =>
      els.map((e) => new DOMMatrix(getComputedStyle(e).transform).b),
    );
  assert.ok(
    rotations[0] < 0 && rotations[1] > 0,
    'Cards must retain alternating rotations',
  );
  await snap(animation.page, 'memory-snake-effects');
  await animation.page
    .getByRole('button', { name: 'View photo full-screen' })
    .last()
    .click();
  await animation.page.locator('.lightbox__img').waitFor();
  assert.equal(
    await animation.page
      .locator('.lightbox__img')
      .evaluate((e) => getComputedStyle(e).animationName),
    'memory-lightbox-zoom',
  );
  await animation.page
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await animation.page
    .locator('ion-modal.show-modal')
    .waitFor({ state: 'hidden' });
  checks.push(
    'Normal motion: original staggered scroll reveal, alternating left/right rotation, photo scale transition and lightbox zoom. Reduced motion remains fully visible.',
  );
  await animation.context.close();
  if (process.env.LIFE_ORGANIZER_CHECK_MODE !== 'interactions') {
    await writeFile(
      path.join(output, 'memory-groups-checks.json'),
      JSON.stringify({ status: 'passed', checks }, null, 2) + '\n',
    );
  }
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} finally {
  await browser.close();
}
