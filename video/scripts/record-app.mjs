// Records the app shots used in the launch video, straight from a running copy of the site.
// Usage: node scripts/record-app.mjs [origin] [--portrait]
//   origin defaults to http://localhost:3001 (run `npm run build && npm start` in the site first).
// Writes public/app/<landscape|portrait>/{orbit.mp4, spots.mp4, hero.png, closeup.png}.
import {spawn, execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const origin = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'http://localhost:3001';
const portrait = process.argv.includes('--portrait');
const format = portrait ? 'portrait' : 'landscape';
// Output pixels are 1920×1080 or 1080×1920; the CSS viewport is scaled so the mobile layout is used for portrait.
const view = portrait ? {width: 432, height: 768, scale: 2.5, mobile: true} : {width: 1920, height: 1080, scale: 1, mobile: false};
const out = fileURLToPath(new URL(`../public/app/${format}/`, import.meta.url));
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
// OrbitControls rotates by pixels relative to canvas height, so scale drags with the viewport.
const px = n => n * view.height / 1080;

await mkdir(out, {recursive: true});
const profile = await mkdtemp(path.join(tmpdir(), 'launch-rec-'));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, ['--headless=new', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--window-size=1920,1920',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--ignore-gpu-blocklist', 'about:blank'], {stdio: 'ignore'});

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, {once: true}));
  let id = 0;
  const pending = new Map(), listeners = new Set();
  ws.addEventListener('message', ({data}) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const {resolve, reject} = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else listeners.forEach(fn => fn(msg));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); });
  const evaluate = async expression => (await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})).result.value;

  await send('Page.enable');
  const metrics = {width: view.width, height: view.height, deviceScaleFactor: view.scale, mobile: view.mobile};
  await send('Emulation.setDeviceMetricsOverride', metrics);

  let mouse = {x: view.width * .8, y: view.height * .8};
  const mouseEvent = (type, extra = {}) => send('Input.dispatchMouseEvent', {type, x: mouse.x, y: mouse.y, ...extra});
  async function moveTo(x, y, ms, pressed = false) {
    const from = {...mouse}, start = Date.now();
    for (;;) {
      const p = Math.min(1, (Date.now() - start) / ms), e = ease(p);
      mouse = {x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e};
      await mouseEvent('mouseMoved', pressed ? {button: 'left', buttons: 1} : {});
      if (p === 1) return;
      await sleep(16);
    }
  }
  const click = async () => { await mouseEvent('mousePressed', {button: 'left', buttons: 1, clickCount: 1}); await sleep(90); await mouseEvent('mouseReleased', {button: 'left', clickCount: 1}); };
  const center = selector => evaluate(`(() => { const el = ${selector}; if (!el) return null; const r = el.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()`);

  async function load(url = origin, hud = true) {
    await send('Page.navigate', {url});
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      const ready = await evaluate(hud
        ? `!!document.querySelector('canvas') && !document.querySelector('.scene-loading') && !document.querySelector('main picture') && [...document.querySelectorAll('button.primary')].some(b => /open spots|sponsors/.test(b.textContent))`
        : `!!document.querySelector('canvas')`).catch(() => false);
      if (ready) break;
      await sleep(250);
    }
    // A visible pointer makes the clicks readable on video; the page itself hides nothing.
    await evaluate(`(() => {
      const dot = document.createElement('div');
      dot.id = 'rec-cursor';
      dot.style.cssText = 'position:fixed;left:0;top:0;width:${portrait ? 26 : 22}px;height:${portrait ? 26 : 22}px;margin:-${portrait ? 13 : 11}px 0 0 -${portrait ? 13 : 11}px;border-radius:50%;background:rgba(39,53,46,.82);border:2px solid #fffaf0;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none;z-index:2147483647;transition:transform .12s ease-out;opacity:0';
      document.body.appendChild(dot);
      addEventListener('mousemove', e => { dot.style.opacity = 1; dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
      addEventListener('mousedown', () => { dot.style.transform = 'scale(.72)'; }, true);
      addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
    })()`);
    await sleep(hud ? 2600 : 6000); // HUD entrance animations settle; ?capture has no loading state to wait on
    mouse = {x: view.width * .8, y: view.height * .8};
  }

  async function record(name, seconds, script) {
    const frames = [];
    const onFrame = msg => {
      if (msg.method !== 'Page.screencastFrame') return;
      frames.push({ts: msg.params.metadata.timestamp, data: msg.params.data});
      send('Page.screencastFrameAck', {sessionId: msg.params.sessionId});
    };
    listeners.add(onFrame);
    const outW = Math.round(view.width * view.scale), outH = Math.round(view.height * view.scale);
    await send('Page.startScreencast', {format: 'jpeg', quality: 95, maxWidth: outW, maxHeight: outH});
    const start = Date.now();
    const at = async t => { const wait = start + t * 1000 - Date.now(); if (wait > 0) await sleep(wait); };
    await script(at);
    await at(seconds + .15);
    await send('Page.stopScreencast');
    listeners.delete(onFrame);

    const dir = await mkdtemp(path.join(tmpdir(), `frames-${name}-`));
    const lines = [];
    for (const [i, frame] of frames.entries()) {
      const file = path.join(dir, `${String(i).padStart(5, '0')}.jpg`);
      await writeFile(file, Buffer.from(frame.data, 'base64'));
      lines.push(`file '${file}'`, `duration ${((frames[i + 1]?.ts ?? frame.ts + 1 / 30) - frame.ts).toFixed(4)}`);
    }
    lines.push(`file '${path.join(dir, `${String(frames.length - 1).padStart(5, '0')}.jpg`)}'`);
    await writeFile(path.join(dir, 'list.txt'), lines.join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-t', String(seconds),
      '-vf', `fps=30,scale=${outW}:${outH}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
    await rm(dir, {recursive: true, force: true});
    const span = frames.at(-1).ts - frames[0].ts;
    console.log(`${format}/${name}.mp4: ${frames.length} frames, ${(frames.length / span).toFixed(0)} fps captured`);
  }

  const still = async name => {
    // Landscape stills are 2× so the video can punch in on stickers without going soft.
    if (!portrait) { await send('Emulation.setDeviceMetricsOverride', {...metrics, deviceScaleFactor: 2}); await sleep(1200); }
    const {data} = await send('Page.captureScreenshot', {format: 'png'});
    if (!portrait) { await send('Emulation.setDeviceMetricsOverride', metrics); await sleep(600); }
    await writeFile(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`${format}/${name}.png`);
  };

  // Shot 1: the runner at rest, then a slow three-quarter orbit.
  await load();
  await still('hero');
  await record('orbit', 4.5, async at => {
    await at(.4); await moveTo(view.width * .56, view.height * .55, 300);
    await mouseEvent('mousePressed', {button: 'left', buttons: 1, clickCount: 1});
    await moveTo(view.width * .56 - px(170), view.height * .55 + px(4), 2600, true);
    await mouseEvent('mouseReleased', {button: 'left', clickCount: 1});
    await moveTo(view.width * .9, view.height * .86, 900);
  });

  // Still: the bare scene without the HUD, for the end card.
  await load(`${origin}/?capture`, false);
  await still('scene');

  // Still: close-up of the front of the kit, for sticker punch-ins.
  await load();
  const zoom = await center(`[...document.querySelectorAll('.scene-rail button')].find(b => /zoom in/i.test((b.getAttribute('aria-label') || '') + b.textContent))`);
  if (zoom) { mouse = zoom; await click(); await evaluate(`document.getElementById('rec-cursor').style.opacity = 0`); await sleep(2200); }
  await still('closeup');

  // Shot 2: open the spots list, pick the $100 butt spot — confetti, camera swings to the back.
  await load();
  await record('spots', 6, async at => {
    await at(.3);
    const cta = await center(`[...document.querySelectorAll('button.primary')].find(b => /open spots|sponsors/.test(b.textContent))`);
    await moveTo(cta.x, cta.y, 600);
    await at(1.0); await click();
    await at(2.1);
    await evaluate(`document.querySelectorAll('.spot-list .spot')[8].scrollIntoView({block: 'center', behavior: 'smooth'})`);
    await at(2.7);
    const butt = await center(`document.querySelectorAll('.spot-list .spot')[8]`);
    await moveTo(butt.x, butt.y, 650);
    await at(3.7); await click();
  });

  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  await rm(profile, {recursive: true, force: true});
}
