/** Browser regression checks with isolated API fixtures. Never writes to the real backend.
 * Run with Playwright available, or set LIFE_ORGANIZER_PLAYWRIGHT to its index.mjs.
 * Start Vite first. No production preview accounts or fixture code are added to the app.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = await import(
  process.env.LIFE_ORGANIZER_PLAYWRIGHT || 'playwright'
);
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'design-validation');
await mkdir(path.join(output, 'screenshots'), { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LIFE_ORGANIZER_CHROME || undefined,
});
const appUrl =
  process.env.LIFE_ORGANIZER_PREVIEW_URL || 'http://127.0.0.1:5173';
const results = [];
const screenshot = async (page, name) => {
  await page
    .locator('ion-content')
    .first()
    .evaluate(async (el) => {
      await el.scrollToTop(0);
    });
  await page.screenshot({
    path: path.join(output, 'screenshots', `${name}.png`),
  });
};
const localDay = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);
tomorrow.setHours(9, 0, 0, 0);
const exercises = [
  {
    id: 'exercise-1',
    name: 'Bodyweight squats',
    instructions:
      'Move slowly. Keep your feet comfortable and your knees in line with your toes.',
    muscleGroup: 'LEGS',
    imageUrl: null,
    videoUrl: null,
  },
  {
    id: 'exercise-2',
    name: 'Walking lunges with a deliberately long movement name that must remain readable',
    instructions: 'Take one steady step at a time.',
    muscleGroup: 'LEGS',
    imageUrl: null,
    videoUrl: 'https://example.com/demo',
  },
];
const programme = {
  id: 'programme-1',
  name: 'A little stronger, a little steadier',
  description: 'A gentle routine, at your own pace.',
  active: true,
  days: [
    {
      id: 'day-1',
      label: 'Day 1 · Legs & Core',
      coachNote: 'One movement at a time.',
      exercises: exercises.map((exercise, i) => ({
        id: `prescription-${i + 1}`,
        exercise,
        sets: 3,
        reps: i ? '10 per leg' : '15',
        restSeconds: 60,
        note: i ? 'Slow and steady.' : null,
      })),
    },
    {
      id: 'day-2',
      label: 'Day 2 · An empty session',
      coachNote: null,
      exercises: [],
    },
  ],
};
const notes = [
  {
    id: 'note-scheduled',
    content: 'SCHEDULED CONTENT SHOULD NEVER BE A HOME PREVIEW',
    status: 'SCHEDULED',
    scheduledFor: tomorrow.toISOString(),
    sentAt: null,
    createdAt: now.toISOString(),
    audioUrl: null,
  },
  {
    id: 'note-1',
    content: 'Take your time today. I’m always on your side.',
    status: 'SENT',
    scheduledFor: null,
    sentAt: now.toISOString(),
    createdAt: now.toISOString(),
    audioUrl: null,
  },
  {
    id: 'note-2',
    content: 'A long note with room to breathe.\n'.repeat(120).slice(0, 4000),
    status: 'SENT',
    scheduledFor: null,
    sentAt: new Date(now.getTime() - 86400000).toISOString(),
    createdAt: now.toISOString(),
    audioUrl: null,
  },
];

async function createContext(role, scenario = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Africa/Casablanca',
    reducedMotion: 'reduce',
  });
  const userId = role === 'OWNER' ? 'owner' : 'recipient';
  await context.addInitScript(
    ({ role, userId }) => {
      localStorage.setItem('life-organizer.token', 'browser-fixture-token');
      localStorage.setItem(
        'life-organizer.user',
        JSON.stringify({
          userId,
          role,
          name: role === 'OWNER' ? 'Alex' : 'Love',
        }),
      );
    },
    { role, userId },
  );
  const requests = [];
  const state = {
    ...scenario,
    logs: [
      {
        id: 'partner-log',
        userId: userId === 'owner' ? 'recipient' : 'owner',
        programmeDayId: 'day-1',
        completedAt: now.toISOString(),
      },
      {
        id: 'legacy',
        userId: null,
        programmeDayId: 'day-1',
        completedAt: now.toISOString(),
      },
    ],
    ticks: [
      {
        id: 'partner-tick',
        userId: userId === 'owner' ? 'recipient' : 'owner',
        dayExerciseId: 'prescription-1',
        tickDate: localDay(now),
        completedAt: now.toISOString(),
      },
    ],
  };
  await context.route('**/fixture-photo.jpg', (route) =>
    route.fulfill({
      path: path.join(
        root,
        'LifeOrganizer-ModernWarm-Design/life-organizer-design/assets/sample-memory.jpg',
      ),
      contentType: 'image/jpeg',
    }),
  );
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const body = request.postDataJSON();
      requests.push({ method: request.method(), path: url.pathname, body });
      let data;
      let status = 200;
      if (state.failRead && request.method() === 'GET') {
        status = 503;
        data = { message: 'Fixture read failure' };
      } else if (state.failWrite && request.method() !== 'GET') {
        status = 503;
        data = { message: 'Fixture write failure' };
      } else if (request.method() === 'GET') {
        if (url.pathname === '/api/notes')
          data = state.empty
            ? []
            : role === 'OWNER'
              ? notes
              : notes.filter((n) => n.status === 'SENT');
        else if (url.pathname === '/api/memories/groups') data = [];
        else if (url.pathname === '/api/memories')
          data = state.empty
            ? []
            : [
                {
                  id: 'memory-1',
                  photoUrl: `${appUrl}/fixture-photo.jpg`,
                  caption: 'Anywhere feels like home with you.',
                  audioUrl: null,
                  memoryDate: '2026-09-20',
                  createdAt: now.toISOString(),
                },
                {
                  id: 'memory-2',
                  photoUrl: `${appUrl}/missing-photo.jpg`,
                  caption: 'An older memory with a missing photo.',
                  audioUrl: `${appUrl}/missing-audio.webm`,
                  memoryDate: '2026-08-02',
                  createdAt: now.toISOString(),
                },
              ];
        else if (url.pathname === '/api/gym/programmes/active') {
          data = state.empty ? null : programme;
          if (state.empty) status = 204;
        } else if (url.pathname === '/api/gym/programmes')
          data = state.empty ? [] : [programme];
        else if (url.pathname === '/api/gym/exercises')
          data = state.empty ? [] : exercises;
        else if (url.pathname === '/api/gym/log') data = state.logs;
        else if (url.pathname === '/api/gym/ticks') data = state.ticks;
      } else if (url.pathname === '/api/gym/log') {
        if (state.failLog) {
          status = 503;
          data = { message: 'Fixture completion failure' };
        } else {
          data = {
            id: 'my-log',
            userId,
            programmeDayId: body.programmeDayId,
            completedAt: now.toISOString(),
          };
          state.logs.push(data);
        }
      } else if (url.pathname === '/api/gym/ticks') {
        data = {
          ...body,
          id: 'my-tick',
          userId,
          completedAt: now.toISOString(),
        };
        if (body.done) state.ticks.push(data);
        else {
          state.ticks = state.ticks.filter(
            (t) =>
              t.userId !== userId || t.dayExerciseId !== body.dayExerciseId,
          );
          status = 204;
        }
      } else if (url.pathname.startsWith('/api/gym/days/'))
        data = programme.days[0];
      else if (url.pathname === '/api/notes')
        data = { ...notes[1], ...body, id: 'created-note' };
      else if (
        request.method() === 'DELETE' &&
        state.exerciseInUse &&
        url.pathname.startsWith('/api/gym/exercises/')
      ) {
        status = 409;
        data = { message: 'Exercise is still used in a programme.' };
      } else if (request.method() === 'DELETE') status = 204;
      else if (url.pathname.startsWith('/api/gym/exercises'))
        data = { ...exercises[0], ...body };
      else if (url.pathname === '/api/gym/programmes')
        data = { ...programme, ...body };
      else data = {};
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: status === 204 ? '' : JSON.stringify(data ?? {}),
      });
    },
  );
  return { context, requests, state };
}

async function open(page, route) {
  await page.goto(`${appUrl}${route}`);
  await page
    .locator('ion-tabs')
    .waitFor()
    .catch(async (error) => {
      console.error(
        'Open failed',
        route,
        page.url(),
        await page.locator('body').innerText(),
      );
      await screenshot(page, 'failure');
      throw error;
    });
  await page.locator('h1').first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector('.lo-feedback--loading'),
  );
  await page.evaluate(() => document.fonts.ready);
}

async function auditLayout(page) {
  return page.evaluate(() => {
    const active = [
      ...document.querySelectorAll('ion-router-outlet > .ion-page'),
    ]
      .filter((el) => !el.classList.contains('ion-page-hidden'))
      .at(-1);
    const scope = active ?? document.body;
    const clipped = [];
    for (const el of scope.querySelectorAll(
      'h1, h2, p, .ex-row__name, .edit-ex__name, .lib-card__name, .lo-button',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -1 || r.right > innerWidth + 1))
        clipped.push({
          text: el.textContent.slice(0, 70),
          left: r.left,
          right: r.right,
        });
    }
    const smallTargets = [...scope.querySelectorAll('button')]
      .filter((el) => !el.disabled && el.getBoundingClientRect().width > 0)
      .map((el) => ({
        text: el.getAttribute('aria-label') || el.textContent.trim(),
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }))
      .filter((r) => r.width < 47.5 || r.height < 47.5);
    return { clipped, smallTargets };
  });
}

try {
  for (const role of process.env.LIFE_ORGANIZER_CHECK_MODE === 'interactions'
    ? []
    : ['RECIPIENT', 'OWNER']) {
    const { context } = await createContext(role);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error('Browser error:', error.message);
    });
    const routes = [
      '/home',
      '/notes',
      '/memories',
      '/memories/groups/ungrouped',
      '/gym',
      '/gym/day/day-1',
      '/gym/day/day-2',
      '/gym/progress',
      '/profile',
      '/more',
      '/memories/countdown',
    ];
    if (role === 'OWNER')
      routes.push(
        '/notes/compose',
        '/gym/exercises',
        '/gym/programmes',
        '/gym/programmes/programme-1',
      );
    for (const width of process.env.LIFE_ORGANIZER_CHECK_WIDTHS === 'skip'
      ? []
      : [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of routes) {
        await open(page, route);
        const audit = await auditLayout(page);
        assert.deepEqual(
          audit.clipped,
          [],
          `${role} ${route} ${width}: horizontal overflow`,
        );
        assert.deepEqual(
          audit.smallTargets,
          [],
          `${role} ${route} ${width}: small targets`,
        );
        if (width === 390)
          await screenshot(
            page,
            `${role.toLowerCase()}-${route.slice(1).replaceAll('/', '-')}`,
          );
        if (route === '/home')
          assert.equal(
            await page.getByText(notes[0].content).count(),
            0,
            'Scheduled home leak',
          );
        if (route === '/gym/day/day-1')
          assert.equal(
            await page
              .getByRole('button', { name: /Mark .* not done/ })
              .count(),
            0,
            'Partner ticks leaked',
          );
        if (role === 'RECIPIENT')
          assert.equal(
            await page
              .getByRole('button', {
                name: /Write a note|New exercise|New programme|Add a memory/,
              })
              .count(),
            0,
            'Recipient authoring control',
          );
      }
      console.log(`Layout ${role} ${width}px: ${routes.length} routes passed`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of routes) {
      await open(page, route);
      await page.evaluate(async () => {
        document.documentElement.style.fontSize = '200%';
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      const headingSize = ['/home', '/profile', '/memories/countdown'].includes(
        route,
      )
        ? '64px'
        : '56px';
      await page.waitForFunction(
        (expected) =>
          getComputedStyle(document.documentElement).fontSize === '32px' &&
          getComputedStyle(document.querySelector('h1')).fontSize === expected,
        headingSize,
      );
      const audit = await auditLayout(page);
      assert.deepEqual(
        audit.clipped,
        [],
        `${role} ${route}: 200% text overflow`,
      );
      if (route === '/gym/programmes/programme-1' || route === '/home')
        await screenshot(
          page,
          `${role.toLowerCase()}-${route.slice(1).replaceAll('/', '-')}-text-200`,
        );
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    results.push(
      `${role}: all routes at 320/360/390/430px and 200% text, 48px targets, role gates, scheduled preview filtering, per-user ticks`,
    );
    await context.close();
  }
  // Authoring payload and unsaved-change checks.
  {
    const { context, requests, state } = await createContext('OWNER');
    const page = await context.newPage();
    await open(page, '/notes/compose');
    await page
      .getByRole('textbox', { name: 'Your note' })
      .fill('A'.repeat(4000));
    assert.equal(
      await page
        .getByRole('textbox', { name: 'Your note' })
        .getAttribute('maxlength'),
      '4000',
    );
    assert.match(await page.locator('#note-count').innerText(), /4,000/);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Leave without saving?' })
      .waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.match(page.url(), /notes\/compose$/);
    state.failWrite = true;
    await page.getByRole('button', { name: 'Send note', exact: true }).click();
    await page.getByText('Fixture write failure').waitFor();
    assert.equal(
      (await page.getByRole('textbox', { name: 'Your note' }).inputValue())
        .length,
      4000,
    );
    state.failWrite = false;
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    assert.equal(await page.locator('.chip-row .chip').count(), 21);
    await page.locator('.chip-row .chip').nth(1).click();
    const taken = page.locator('.schedule-hours button:disabled');
    assert.equal(await taken.count(), 1, 'Occupied hour should be disabled');
    await page.locator('.schedule-hours button:not(:disabled)').first().click();
    await page
      .getByRole('button', { name: 'Schedule note', exact: true })
      .click();
    await page.waitForURL('**/notes');
    const noteRequest = requests
      .filter((r) => r.method === 'POST' && r.path === '/api/notes')
      .at(-1);
    assert.equal(noteRequest.body.content.length, 4000);
    assert.ok(Date.parse(noteRequest.body.scheduledFor) > Date.now());
    assert.equal(new Date(noteRequest.body.scheduledFor).getUTCMinutes(), 0);
    await open(page, '/gym/programmes/programme-1');
    await page
      .getByRole('button', { name: 'Edit prescription for Bodyweight squats' })
      .click();
    await page.getByRole('spinbutton', { name: 'Sets', exact: true }).fill('4');
    await page
      .getByRole('textbox', { name: 'Reps or duration' })
      .fill('30 sec');
    await page
      .getByRole('spinbutton', { name: 'Rest in seconds (optional)' })
      .fill('90');
    await page
      .getByRole('textbox', { name: 'Coaching note (optional)', exact: true })
      .last()
      .fill('Keep it steady.');
    const beforeApply = requests.length;
    await page.getByRole('button', { name: 'Apply to session' }).click();
    await page.locator('ion-modal.show-modal').waitFor({ state: 'hidden' });
    assert.equal(requests.length, beforeApply, 'Apply must not persist');
    await page.getByRole('button', { name: 'Save session' }).click();
    await page.waitForFunction(
      () => !document.querySelector('.edit-day__save'),
    );
    const payload = requests.findLast(
      (r) => r.path.endsWith('/exercises') && r.method === 'PUT',
    );
    assert.deepEqual(payload.body.exercises[0], {
      exerciseId: 'exercise-1',
      sets: 4,
      reps: '30 sec',
      restSeconds: 90,
      note: 'Keep it steady.',
    });
    assert.equal(payload.body.exercises[1].reps, '10 per leg');
    assert.equal(payload.body.exercises[1].restSeconds, 60);
    results.push(
      'Composer: 4,000 limit, unsaved navigation, failed write retains text, 21 days, occupied hours, future whole-hour UTC payload. Programme: Apply stays local; Save preserves textual reps/rest/note and ordered list.',
    );
    await context.close();
  }
  // Failed checks roll back; failed completion keeps saved checks and offers retry.
  {
    const { context, requests, state } = await createContext('RECIPIENT', {
      failWrite: true,
      failLog: true,
    });
    const page = await context.newPage();
    await open(page, '/gym/day/day-1');
    await page
      .getByRole('button', { name: 'Mark Bodyweight squats done', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Mark Bodyweight squats done', exact: true })
      .waitFor();
    state.failWrite = false;
    await page
      .getByRole('button', { name: 'Mark Bodyweight squats done', exact: true })
      .click();
    await page
      .getByRole('button', { name: /Mark Walking lunges .* done$/ })
      .click();
    await page
      .getByText('Your checks are saved. The session could not be logged.')
      .waitFor();
    assert.equal(
      await page.locator('.ex-row__tick[aria-pressed=true]').count(),
      2,
    );
    assert.equal(await page.getByText('Session saved for today.').count(), 0);
    state.failLog = false;
    await page.getByRole('button', { name: 'Save completed session' }).click();
    await page.getByText('Session saved for today.').waitFor();
    const logCount = requests.filter(
      (r) => r.path === '/api/gym/log' && r.method === 'POST',
    ).length;
    await page
      .getByRole('button', {
        name: 'Mark Bodyweight squats not done',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Mark Bodyweight squats done', exact: true })
      .click();
    assert.equal(
      requests.filter((r) => r.path === '/api/gym/log' && r.method === 'POST')
        .length,
      logCount,
    );
    await screenshot(page, 'recipient-session-confirmed');
    results.push(
      'Session: optimistic rollback, partner log excluded, failed completion keeps saved checks, explicit retry, successful log required, untick/retick does not relog in this UI.',
    );
    await context.close();
  }
  for (const scenario of [{ empty: true }, { failRead: true }]) {
    const { context } = await createContext('OWNER', scenario);
    const page = await context.newPage();
    for (const route of [
      '/home',
      '/notes',
      '/memories',
      '/memories/groups/ungrouped',
      '/gym',
      '/gym/exercises',
      '/gym/programmes',
      '/gym/progress',
    ]) {
      await open(page, route);
      if (scenario.failRead && !['/home'].includes(route))
        assert.ok(
          await page.getByRole('button', { name: 'Try again' }).count(),
        );
    }
    results.push(
      `${scenario.empty ? 'Empty data' : 'Failed reads'}: 7 reading routes remain usable`,
    );
    await context.close();
  }
  // Sheets, refresh failures, read-only details, missing media, and owner route gates.
  {
    const { context, state, requests } = await createContext('OWNER');
    const page = await context.newPage();
    await open(page, '/gym/exercises');
    await page
      .getByRole('button', { name: 'Edit Bodyweight squats', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: 'Exercise name', exact: true })
      .fill('Bodyweight squats, edited');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('ion-modal.show-modal').waitFor({ state: 'hidden' });
    assert.ok(
      requests.some(
        (r) =>
          r.method === 'PUT' &&
          r.path === '/api/gym/exercises/exercise-1' &&
          r.body.name === 'Bodyweight squats, edited',
      ),
    );
    state.exerciseInUse = true;
    await page
      .getByRole('button', { name: 'Delete Bodyweight squats', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Delete exercise', exact: true })
      .click();
    await page.getByText('Exercise is still used in a programme.').waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    state.exerciseInUse = false;
    await page
      .getByRole('button', { name: 'Delete Bodyweight squats', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Delete exercise', exact: true })
      .click();
    await page.locator('ion-modal.show-modal').waitFor({ state: 'hidden' });
    await open(page, '/gym/day/day-1');
    const tickWrites = requests.filter(
      (r) => r.path === '/api/gym/ticks' && r.method === 'POST',
    ).length;
    await page
      .getByRole('button', { name: 'How to do Bodyweight squats', exact: true })
      .click();
    await page
      .getByRole('heading', { name: 'Bodyweight squats', exact: true })
      .waitFor();
    assert.equal(
      requests.filter((r) => r.path === '/api/gym/ticks' && r.method === 'POST')
        .length,
      tickWrites,
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await open(page, '/memories/groups/ungrouped');
    await page
      .getByRole('button', { name: 'View photo full-screen' })
      .last()
      .click();
    await page.locator('.lightbox__img').waitFor();
    await screenshot(page, 'memory-lightbox');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Play voice note' }).click();
    await page
      .getByText('Could not play this voice note. Tap to try again.')
      .waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Pause voice note' }).count(),
      0,
    );
    await open(page, '/notes');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForURL('**/home');
    state.failRead = true;
    await page
      .getByRole('button', { name: /Notes Words to keep close/ })
      .click();
    await page.getByText('Could not refresh notes.').waitFor();
    assert.ok(
      await page.getByText(notes[1].content, { exact: true }).count(),
      'Refresh failure removed saved content',
    );
    await screenshot(page, 'notes-refresh-failure');
    results.push(
      'Sheets: edit-save and delete close, referenced exercise error retained, info does not tick, Ionic memory lightbox, failed voice playback honest, refresh failure retains content.',
    );
    await context.close();
    const recipient = await createContext('RECIPIENT');
    const recipientPage = await recipient.context.newPage();
    for (const route of [
      '/notes/compose',
      '/gym/exercises',
      '/gym/programmes',
      '/gym/programmes/programme-1',
    ]) {
      await open(recipientPage, route);
      assert.match(new URL(recipientPage.url()).pathname, /^\/(gym|notes)$/);
    }
    results.push('Recipient cannot enter owner authoring routes directly.');
    await recipient.context.close();
  }
  // Login does not need seeded account credentials.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(appUrl);
    await page.getByRole('heading', { name: 'Your little corner.' }).waitFor();
    await screenshot(page, 'login');
    await page
      .getByRole('textbox', { name: 'Username', exact: true })
      .fill('fixture');
    await page
      .getByRole('textbox', { name: 'Password', exact: true })
      .fill('fixture-only');
    await page.getByRole('button', { name: 'Show password' }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('input[autocomplete="current-password"]')
          ?.type === 'text',
    );
    assert.equal(
      await page
        .getByRole('textbox', { name: 'Password', exact: true })
        .getAttribute('type'),
      'text',
    );
    await page.getByRole('button', { name: 'Forgot your password?', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Forgot your password?' })
      .waitFor();
    await page.getByRole('button', { name: 'Okay', exact: true }).click();
    results.push(
      'Login: labelled fields, password reveal, Ionic password-help modal',
    );
    await context.close();
  }
  await writeFile(
    path.join(
      output,
      process.env.LIFE_ORGANIZER_CHECK_MODE === 'interactions'
        ? 'interaction-checks.json'
        : process.env.LIFE_ORGANIZER_CHECK_WIDTHS === 'skip'
          ? 'text-scaling-checks.json'
          : 'browser-checks.json',
    ),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        evidence:
          'Local Vite app, browser-only API fixtures; no live server/device verification',
        checks: results,
      },
      null,
      2,
    ),
  );
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
