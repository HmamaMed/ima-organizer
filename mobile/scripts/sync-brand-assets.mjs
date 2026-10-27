import { copyFile, mkdir } from 'node:fs/promises';

// Canonical Entre Nous wordmarks, fonts, favicons and native icon resources are
// checked in. Synchronize the exported SVG copies from the app's brand directory.
const brand = new URL('../src/assets/brand/', import.meta.url);
await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
for (const [name, source] of [['icon.svg', 'mark-color.svg'], ['logo.svg', 'logo-horizontal-color.svg']]) {
  for (const destination of [`../../${name}`, `../assets/${name}`]) {
    await copyFile(new URL(source, brand), new URL(destination, import.meta.url));
  }
}
await copyFile(new URL('mark-color.svg', brand), new URL('../public/icon.svg', import.meta.url));
console.log('Synced Entre Nous logo and symbol exports.');
