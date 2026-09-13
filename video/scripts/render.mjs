// Renders the launch video from whatever is in public/.
// Usage: node scripts/render.mjs [--landscape | --portrait] [--audio-start=SECONDS]
// Writes out/launch-16x9.mp4 and out/launch-9x16.mp4, plus -silent copies for in-app music.
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {daysToRace, resolveAssets} from '../src/assets.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const pub = path.join(root, 'public');
const list = dir => existsSync(path.join(pub, dir))
  ? readdirSync(path.join(pub, dir), {recursive: true}).map(name => `${dir}/${String(name).split(path.sep).join('/')}`)
  : [];
const names = ['footage', 'audio', 'app'].flatMap(list);

// Line the first guitar hit up with frame 0 unless told otherwise.
const override = process.argv.find(arg => arg.startsWith('--audio-start='));
let audioStart = override ? Number(override.split('=')[1]) : 0;
const probe = resolveAssets(names, 0);
if (probe.audio && !override) {
  const {stderr} = spawnSync('ffmpeg', ['-hide_banner', '-t', '30', '-i', path.join(pub, probe.audio), '-af', 'silencedetect=noise=-35dB:d=0.1', '-f', 'null', '-'], {encoding: 'utf8'});
  const start = stderr.match(/silence_start: (-?[\d.]+)/), end = stderr.match(/silence_end: ([\d.]+)/);
  if (start && Number(start[1]) <= .05 && end) audioStart = Number(end[1]);
}

const props = resolveAssets(names, daysToRace(), audioStart);
const missing = [
  ...(props.footage ? [] : ['footage/outwork.mp4']),
  ...(props.audio ? [] : ['audio']),
  ...(props.closeup ? [] : ['app/landscape/closeup.png']),
  ...(props.scene ? [] : ['app/landscape/scene.png']),
];
if (missing.length) console.warn(`Rendering with placeholders for: ${missing.join(', ')}`);
console.log(`Audio starts at ${audioStart.toFixed(2)}s; ${props.daysToRace} days to race day.`);

const out = path.join(root, 'out');
mkdirSync(out, {recursive: true});
const propsFile = path.join(out, 'props.json');
writeFileSync(propsFile, JSON.stringify(props, null, 2));

const formats = [['LaunchLandscape', 'launch-16x9', '--landscape'], ['LaunchPortrait', 'launch-9x16', '--portrait']]
  .filter(([, , flag]) => !process.argv.includes(flag === '--landscape' ? '--portrait' : '--landscape'));
const env = {...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`};
for (const [id, name] of formats) {
  const file = path.join(out, `${name}.mp4`);
  execFileSync(path.join(root, 'node_modules/.bin/remotion'), ['render', 'src/index.ts', id, file, `--props=${propsFile}`, '--codec=h264', '--crf=17', '--concurrency=4'], {cwd: root, stdio: 'inherit', env});
  if (props.audio) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-c:v', 'copy', '-an', path.join(out, `${name}-silent.mp4`)]);
  console.log(`Wrote ${path.relative(root, file)}`);
}
