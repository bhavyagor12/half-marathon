// Local operator tool. Never import into the application or expose MESHY_API_KEY.
// node --env-file=.env.local scripts/generate-avatar.mjs submit|status|download
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory = new URL('../output/avatar/head-v2/', import.meta.url);
const stateFile = new URL('meshy-task.json', directory);
const endpoint = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const key = process.env.MESHY_API_KEY?.trim();
if (!key) throw new Error('MESHY_API_KEY is required in .env.local');
const command = process.argv[2];
async function api(url, body) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    ...(body ? {body: JSON.stringify(body)} : {}),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Meshy HTTP ${response.status}; request not automatically retried.`);
  return response.json();
}
await mkdir(directory, {recursive: true});
let saved;
try { saved = JSON.parse(await readFile(stateFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (command === 'submit') {
  if (saved) throw new Error('A task record already exists. Use status/download; do not create duplicate paid tasks.');
  const inputs = await Promise.all(['input-0.png', 'input-1.png'].map(name => readFile(new URL(name, directory))));
  const parameters = {
    ai_model: 'meshy-7', ultra_mode: true,
    should_texture: true, enable_pbr: true, texture_resolution: '4k',
    should_remesh: true, target_polycount: 100000, topology: 'triangle',
    save_pre_remeshed_model: true, image_enhancement: false,
    target_formats: ['glb'], multi_view_thumbnails: true, remove_lighting: true,
    texture_prompt: 'Faithfully preserve this exact man from the supplied photographs: natural warm medium skin, dark brown eyes, thick dark eyebrows, black swept hair, subtle moustache and jaw stubble. Retouch acne pimples and red blemishes only, leaving clear even natural skin with fine pores. Preserve facial shape, eye spacing, nose, lip shape and jaw proportions exactly; no generic handsome-face substitution, no skin whitening, no waxy smoothing. Plain neutral lighting with no baked red background or shadows. Preserve identity.',
  };
  // Persist intent first: an uncertain POST must be reconciled, never blindly repeated.
  saved = {status: 'SUBMITTING', inputSha256: inputs.map(input => createHash('sha256').update(input).digest('hex')), parameters};
  await writeFile(stateFile, JSON.stringify(saved, null, 2) + '\n', {flag: 'wx'});
  const response = await api(endpoint, {...parameters, image_urls: inputs.map(input => `data:image/png;base64,${input.toString('base64')}`)});
  if (!response.result || !/^[a-zA-Z0-9-]+$/.test(response.result)) throw new Error('Missing task id; reconcile submission before retrying.');
  saved.id = response.result;
  saved.status = 'PENDING';
  await writeFile(stateFile, JSON.stringify(saved, null, 2) + '\n');
  console.log('Meshy generation submitted:', saved.id);
} else if (command === 'status' || command === 'download') {
  if (!saved?.id || !/^[a-zA-Z0-9-]+$/.test(saved.id)) throw new Error('No confirmed task id.');
  const task = await api(`${endpoint}/${saved.id}`);
  saved = {...saved, status: task.status, progress: task.progress, consumedCredits: task.consumed_credits};
  await writeFile(stateFile, JSON.stringify(saved, null, 2) + '\n');
  console.log(JSON.stringify({status: task.status, progress: task.progress, consumedCredits: task.consumed_credits}));
  if (command === 'download') {
    if (task.status !== 'SUCCEEDED') throw new Error('Model is not ready to download.');
    async function download(url, filename, glb = false) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error('Expected HTTPS asset URL.');
      // Do not forward the API credential to the asset storage host.
      const response = await fetch(parsed, {signal: AbortSignal.timeout(120_000)});
      if (!response.ok) throw new Error(`Asset download HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (glb && (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length)) throw new Error('Invalid GLB output.');
      await writeFile(new URL(filename, directory), bytes);
      console.log(`Saved ${filename} (${bytes.length} bytes)`);
    }
    await download(task.model_urls.glb, 'bhavya.glb', true);
    if (task.model_urls.pre_remeshed_glb) await download(task.model_urls.pre_remeshed_glb, 'bhavya-high-detail.glb', true);
    for (const view of ['front', 'right', 'back', 'left']) {
      const url = task.thumbnail_urls?.[view] || (view === 'front' ? task.thumbnail_url : undefined);
      if (url) await download(url, `preview-${view}.png`);
    }
  }
} else throw new Error('Usage: generate-avatar.mjs submit|status|download');
