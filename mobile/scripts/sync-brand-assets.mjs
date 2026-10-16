import { cp, copyFile, mkdir } from 'node:fs/promises';

// Route B from INTEGRATION-IDE.md: merge the supplied native resources.
// Do not run capacitor-assets over these carefully padded adaptive/splash icons.
const pack = new URL('../../LifeOrganizer-Assets-v1/life-organizer-assets/', import.meta.url);
const resources = new URL('../android/app/src/main/res/', import.meta.url);
await cp(new URL('android-res/', pack), resources, {
  recursive: true,
  // Use the density-independent VectorDrawable at every density (minSdk 24).
  filter: (source) => !source.endsWith('/lo_notification.png'),
});

const uiAssets = {
  brand: ['mark-color.svg', 'mark-white.svg', 'logo-horizontal-color.svg', 'logo-stacked-color.svg', 'logo-stacked-white.svg'],
  chapters: ['notes-color.svg', 'memories-color.svg', 'gym-color.svg'],
  'empty-states': ['notes.svg', 'memories.svg', 'gym.svg'],
};
for (const [directory, files] of Object.entries(uiAssets)) {
  const destination = new URL(`../src/assets/${directory}/`, import.meta.url);
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    await copyFile(new URL(`${directory}/${file}`, pack), new URL(file, destination));
  }
}
await copyFile(new URL('licenses/WORDMARK-TYPEFACE-LICENSE.txt', pack), new URL('../src/assets/brand/WORDMARK-TYPEFACE-LICENSE.txt', import.meta.url));
for (const file of ['favicon.svg', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png']) {
  await copyFile(new URL(`web/${file}`, pack), new URL(`../public/${file}`, import.meta.url));
}
for (const [name, source] of [['icon.svg', 'mark-color.svg'], ['logo.svg', 'logo-horizontal-color.svg']]) {
  for (const destination of [`../../${name}`, `../assets/${name}`]) {
    await copyFile(new URL(`brand/${source}`, pack), new URL(destination, import.meta.url));
  }
}
await copyFile(new URL('brand/mark-color.svg', pack), new URL('../public/icon.svg', import.meta.url));
console.log('Synced Life Organizer v1 UI/web assets and merged Android resources (native route B).');
