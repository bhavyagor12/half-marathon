// Reproducible web asset: preserve geometry, compress buffers, resize embedded textures.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, prune, meshopt, textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const input = new URL('../output/avatar/bhavya.glb', import.meta.url);
const output = new URL('../public/models/bhavya.glb', import.meta.url);
const document = await io.read(fileURLToPath(input));
await document.transform(dedup(), prune(), textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:74}), meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(fileURLToPath(output), document);
console.log(`Compressed avatar: ${(await stat(output)).size} bytes`);
