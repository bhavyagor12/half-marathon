// Regenerates the loading posters and the 1200×630 share image from the live 3D scene,
// so the poster always matches the first rendered frame.
// Run `npm run dev`, then: node scripts/capture-scene.mjs [http://localhost:3001]
import {execFile} from 'node:child_process';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const origin = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'http://localhost:3001';
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// fileURLToPath decodes spaces in the project path ("half marathon"); URL.pathname would not.
const output = name => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

// Warm the dev server so on-demand transforms and the model download don't eat the capture budget.
for (const asset of ['/?capture', '/models/bhavya.glb']) await (await fetch(origin + asset)).arrayBuffer();

async function capture(width, height, scale) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    // A throwaway profile keeps the capture isolated from any running Chrome session.
    const profile = await mkdtemp(path.join(tmpdir(), 'scene-capture-'));
    const file = path.join(profile, 'scene.png');
    try {
      await run(chrome, [
        '--headless=new', `--user-data-dir=${profile}`, '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
        `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`, '--virtual-time-budget=90000', `--screenshot=${file}`,
        `${origin}/?capture`,
      ], {timeout: 300_000});
      const image = await readFile(file);
      // A flat image means the screenshot fired before the scene rendered; never overwrite good assets with it.
      const {channels} = await sharp(image).stats();
      if (channels.some(channel => channel.stdev > 12)) return image;
      console.warn(`Capture ${width}×${height} was blank (attempt ${attempt}); retrying.`);
    } finally {
      await rm(profile, {recursive: true, force: true});
    }
  }
  throw new Error(`The ${width}×${height} scene never rendered; assets were left unchanged.`);
}

// --share-only rebuilds just the share card from the existing desktop poster (e.g. after a copy change).
const shareOnly = process.argv.includes('--share-only');
let desktop;
if (shareOnly) desktop = await readFile(output('scene-poster.webp'));
else {
  desktop = await capture(1512, 862, 1);
  // Chrome will not lay out a window narrower than 500px, so capture a phone-shaped 500px viewport and scale down.
  const mobile = await capture(500, 1082, 2);
  await sharp(desktop).webp({quality: 74}).toFile(output('scene-poster.webp'));
  await sharp(mobile).resize({width: 780}).webp({quality: 70}).toFile(output('scene-poster-mobile.webp'));
}

// Share card: scene on the right, copy on a paper panel on the left. The offer is plain text, not a fake button.
const scene = await sharp(desktop).resize({height: 630}).toBuffer();
const copy = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0.55" stop-color="#f7f2e8"/><stop offset="1" stop-color="#f7f2e8" stop-opacity="0"/></linearGradient></defs>
  <rect width="620" height="630" fill="url(#fade)"/>
  <g font-family="Helvetica, Arial, sans-serif" fill="#27352e">
    <text x="64" y="170" font-size="22" font-weight="700" letter-spacing="1.5">BHAVYA GOR · 21.1 KM</text>
    <text x="60" y="262" font-size="72" font-weight="700" letter-spacing="-2">Sponsor my</text>
    <text x="60" y="340" font-size="72" font-weight="700" letter-spacing="-2">slow run.</text>
    <text x="64" y="398" font-size="28" fill="#505c52">Slow runner. Long exposure.</text>
    <text x="64" y="470" font-size="24">Bengaluru · 20 December 2026</text>
    <text x="64" y="512" font-size="24" font-weight="700" fill="#a8371e">Your logo on my race kit · from $50 USD</text>
  </g>
</svg>`);
await sharp({create: {width: 1200, height: 630, channels: 3, background: '#f7f2e8'}})
  .composite([{input: scene, left: 300, top: 0}, {input: copy, left: 0, top: 0}])
  .jpeg({quality: 84, mozjpeg: true})
  .toFile(output('share.jpg'));
console.log(shareOnly ? 'Wrote share.jpg' : 'Wrote scene-poster.webp, scene-poster-mobile.webp and share.jpg');
