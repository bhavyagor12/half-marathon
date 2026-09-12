// Renders the favicon SVG into the PNG app icons and a multi-size favicon.ico (PNG-in-ICO).
// node scripts/generate-icons.mjs
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const file = name => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const svg = await readFile(file('favicon.svg'));
const png = size => sharp(svg, {density: 1200}).resize(size, size).png().toBuffer();

for (const size of [192, 512]) await writeFile(file(`icon-${size}.png`), await png(size));

// ICO: a 6-byte header, one 16-byte directory entry per image, then the PNG payloads.
const sizes = [16, 32, 48], images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((image, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(sizes[i], 0); entry.writeUInt8(sizes[i], 1); entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8); entry.writeUInt32LE(offset, 12); offset += image.length;
  return entry;
});
await writeFile(file('favicon.ico'), Buffer.concat([header, ...entries, ...images]));
console.log('Wrote icon-192.png, icon-512.png and favicon.ico');
