// Repack embedded textures only; preserve all geometry, UVs and material data.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const input = await readFile(new URL('../output/avatar/bhavya.glb', import.meta.url));
const jsonLength = input.readUInt32LE(12);
const document = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
const binaryStart = 28 + jsonLength;
const images = new Map(document.images.map((image, index) => [image.bufferView, index]));
const chunks = [];
let offset = 0;
for (let index = 0; index < document.bufferViews.length; index++) {
  const view = document.bufferViews[index];
  let data = input.subarray(binaryStart + (view.byteOffset || 0), binaryStart + (view.byteOffset || 0) + view.byteLength);
  if (images.has(index)) {
    // Keep the 4K face/color texture; retain normal-map chroma precision.
    const imageIndex = images.get(index);
    data = await sharp(data).resize({width: imageIndex === 0 ? 4096 : 2048, withoutEnlargement: true}).jpeg({quality: imageIndex === 0 ? 90 : 88, chromaSubsampling: '4:4:4'}).toBuffer();
  }
  view.byteOffset = offset;
  view.byteLength = data.length;
  chunks.push(data);
  const padding = (4 - data.length % 4) % 4;
  if (padding) chunks.push(Buffer.alloc(padding));
  offset += data.length + padding;
}
const binary = Buffer.concat(chunks);
document.buffers[0].byteLength = binary.length;
const rawJson = Buffer.from(JSON.stringify(document));
const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 0x20)]);
const header = Buffer.alloc(20);
header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
const destination = new URL('../public/models/', import.meta.url);
await mkdir(destination, {recursive: true});
const result = Buffer.concat([header, json, binHeader, binary]);
await writeFile(new URL('bhavya.glb', destination), result);
console.log(`GLB optimized: ${input.length} -> ${result.length} bytes; geometry unchanged.`);
