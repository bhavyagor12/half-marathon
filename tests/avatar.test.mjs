import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import sharp from 'sharp';
import {AVATAR_HEIGHT, AVATAR_GROUND, AVATAR_ANCHORS} from '../lib/avatar.mjs';

const buffer = await readFile(new URL('../public/models/bhavya.glb', import.meta.url));
const jsonLength = buffer.readUInt32LE(12);
const document = JSON.parse(buffer.subarray(20, 20 + jsonLength));
const loader = new GLTFLoader();
// Node has no image decoder; load real geometry and inspect textures with sharp.
loader.register(() => ({name: 'NODE_GEOMETRY_ONLY', loadTexture: () => Promise.resolve(null)}));
const {scene} = await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
const bounds = new THREE.Box3().setFromObject(scene);
scene.scale.multiplyScalar(AVATAR_HEIGHT / bounds.getSize(new THREE.Vector3()).y);
bounds.setFromObject(scene);
const center = bounds.getCenter(new THREE.Vector3());
scene.position.add(new THREE.Vector3(-center.x, AVATAR_GROUND - bounds.min.y, -center.z));
scene.updateMatrixWorld(true);
const image = document.images[document.textures[document.materials[0].pbrMetallicRoughness.baseColorTexture.index].source];
const view = document.bufferViews[image.bufferView];
const {data, info} = await sharp(buffer.subarray(28 + jsonLength + view.byteOffset, 28 + jsonLength + view.byteOffset + view.byteLength)).raw().toBuffer({resolveWithObject: true});

test('avatar is a textured volumetric GLB with embedded 4K color, within the web size budget', () => {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  assert.ok(buffer.length < 12_000_000);
  assert.equal(info.width, 4096);
  assert.ok(document.meshes[0].primitives[0].attributes.NORMAL !== undefined);
  assert.ok(document.meshes[0].primitives[0].attributes.TEXCOORD_0 !== undefined);
  assert.ok(new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).z > .4);
  assert.ok(document.images.every(image => image.bufferView !== undefined && !image.uri));
});

test('all nine sponsor decals hit the correct garment and contain surface geometry', () => {
  assert.equal(AVATAR_ANCHORS.length, 9);
  const ray = new THREE.Raycaster();
  AVATAR_ANCHORS.forEach(([x, y, width, height, side], index) => {
    ray.set(new THREE.Vector3(x, y + AVATAR_GROUND, side * 3), new THREE.Vector3(0, 0, -side));
    const hit = ray.intersectObject(scene, true)[0];
    assert.ok(hit, `slot ${index} must hit the model`);
    const pixel = (Math.floor(hit.uv.y * info.height) * info.width + Math.floor(hit.uv.x * info.width)) * info.channels;
    const rgb = [...data.subarray(pixel, pixel + 3)];
    if (index < 8) assert.ok(Math.min(...rgb) > 210, `slot ${index} must hit white shirt, got ${rgb}`);
    else assert.ok(Math.max(...rgb) < 90, 'premium back slot must hit dark shorts');
    const geometry = new DecalGeometry(hit.object, hit.point, new THREE.Euler(0, side === 1 ? 0 : Math.PI, 0), new THREE.Vector3(width, height, .22));
    assert.ok(geometry.getAttribute('position').count > 3, `slot ${index} must have decal triangles`);
    if (side === -1) {
      ray.set(new THREE.Vector3(x, y + AVATAR_GROUND, 3), new THREE.Vector3(0, 0, -1));
      const front = ray.intersectObject(scene, true)[0];
      assert.ok(front.point.distanceTo(hit.point) > .015, 'body must occlude rear decals from front');
    }
    geometry.dispose();
  });
});
