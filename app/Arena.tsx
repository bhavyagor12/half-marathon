'use client';
import {useEffect, useRef, useState} from 'react';
import type {Sponsor} from '@/lib/config';
import {buildRaceStart} from './RaceStart';
import {AVATAR_HEIGHT, AVATAR_GROUND, AVATAR_ANCHORS} from '@/lib/avatar.mjs';
import type {Mesh, Texture, Material, Object3D} from 'three';

type Props = {sponsors: Sponsor[]; selected: number; onSelect: (n: number) => void; view: 'front' | 'back'; accent: string};

export default function Arena(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    async function init() {
      try {
        const THREE = await import('three');
        const [{OrbitControls}, {GLTFLoader}, {DecalGeometry}] = await Promise.all([
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/geometries/DecalGeometry.js'),
        ]);
        const dispose = (root: Object3D) => {
          const textures = new Set<Texture>();
          const materials = new Set<Material>();
          root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              materials.add(material);
              for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
            }
          });
          textures.forEach(texture => texture.dispose());
          materials.forEach(material => material.dispose());
        };
        const gltf = await new GLTFLoader().loadAsync('/models/bhavya.glb');
        if (cancelled || !container.current) { dispose(gltf.scene); return; }
        const host = container.current;
        const scene = new THREE.Scene();
        scene.add(gltf.scene);
        cleanup = () => dispose(scene);
        scene.background = new THREE.Color('#100908');
        scene.fog = new THREE.FogExp2('#100908', .035);
        const camera = new THREE.PerspectiveCamera(35, host.clientWidth / Math.max(1, host.clientHeight), .1, 100);
        const distance = () => host.clientWidth < 640 ? 12.5 : 9.4;
        camera.position.set(0, 2.7, latest.current.view === 'back' ? -distance() : distance());
        const renderer = new THREE.WebGLRenderer({antialias: true});
        cleanup = () => { dispose(scene); renderer.dispose(); renderer.domElement.remove(); };
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
        renderer.domElement.setAttribute('aria-label', 'Interactive 3D model of Bhavya in his race kit. Drag to rotate, scroll to zoom, or choose View spots.');
        host.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 2.05, 0);
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.minDistance = 5;
        controls.maxDistance = 13;
        controls.minPolarAngle = .7;
        controls.maxPolarAngle = 1.8;
        scene.add(new THREE.HemisphereLight('#fff3df', '#8e947c', 2.5));
        const key = new THREE.DirectionalLight('#ffedcb', 3);
        key.position.set(-3, 7, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.normalBias = .015;
        scene.add(key);
        const rim = new THREE.PointLight('#ffd6a0', .5, 14);
        rim.position.set(2, 3, -2);
        scene.add(rim);
        const fill = new THREE.PointLight('#dce9ed', 2, 12);
        fill.position.set(-3, 3, -4);
        scene.add(fill);
        function mesh(geometry: import('three').BufferGeometry, material: Material, x: number, y: number, z: number, parent: Object3D = scene) {
          const result = new THREE.Mesh(geometry, material);
          result.position.set(x, y, z);
          result.castShadow = true;
          result.receiveShadow = true;
          parent.add(result);
          return result;
        }
        const runner = gltf.scene;
        scene.add(runner);
        const bounds = new THREE.Box3().setFromObject(runner);
        const size = bounds.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid model bounds');
        runner.scale.multiplyScalar(AVATAR_HEIGHT / size.y);
        bounds.setFromObject(runner);
        const center = bounds.getCenter(new THREE.Vector3());
        runner.position.add(new THREE.Vector3(-center.x, AVATAR_GROUND - bounds.min.y, -center.z));
        runner.updateMatrixWorld(true);
        const body: Mesh[] = [];
        runner.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            body.push(object);
          }
        });
        const disposeEnvironment = buildRaceStart(scene, THREE);
        // Feet-relative anchors calibrated to the generated race kit. Project onto
        // actual geometry so fabric folds carry the labels during a full orbit.
        const patches: Mesh[] = [];
        const slots: {canvas: HTMLCanvasElement; texture: Texture; generation: number}[] = [];
        const projector = new THREE.Raycaster();
        AVATAR_ANCHORS.forEach(([x, y, width, height, side], slot) => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 256;
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          slots.push({canvas, texture, generation: 0});
          projector.set(new THREE.Vector3(x, y + AVATAR_GROUND, side * 3), new THREE.Vector3(0, 0, -side));
          const hit = projector.intersectObjects(body, false)[0];
          if (!hit) throw new Error('Sponsor anchor misses avatar');
          const orientation = new THREE.Euler(0, side === 1 ? 0 : Math.PI, 0);
          const material = new THREE.MeshStandardMaterial({map: texture, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4});
          const geometry = new DecalGeometry(hit.object as Mesh, hit.point, orientation, new THREE.Vector3(width, height, .22));
          const patch = mesh(geometry, material, 0, 0, 0);
          patch.castShadow = false;
          patch.renderOrder = 1;
          patch.userData.slot = slot;
          patches.push(patch);
        });
        function updatePatches() {
          slots.forEach((slot, n) => {
            const ctx = slot.canvas.getContext('2d')!;
            const state = latest.current;
            const sponsor = state.sponsors.find(item => item.slot === n);
            const generation = ++slot.generation;
            ctx.fillStyle = n === state.selected ? state.accent : '#e5e5dd';
            ctx.fillRect(0, 0, 512, 256);
            ctx.strokeStyle = '#44483c';
            ctx.lineWidth = 5;
            ctx.setLineDash([15, 10]);
            ctx.strokeRect(8, 8, 496, 240);
            ctx.fillStyle = '#24241e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 50px Arial';
            ctx.fillText(sponsor ? sponsor.brand.slice(0, 15) : n === 0 ? 'YOUR LOGO' : `+ 0${n + 1}`, 256, 128);
            slot.texture.needsUpdate = true;
            if (sponsor?.logo) {
              const image = new Image();
              image.onload = () => {
                if (cancelled || generation !== slot.generation) return;
                ctx.fillStyle = '#fafaf6';
                ctx.fillRect(0, 0, 512, 256);
                const scale = Math.min(470 / image.width, 220 / image.height);
                ctx.drawImage(image, (512 - image.width * scale) / 2, (256 - image.height * scale) / 2, image.width * scale, image.height * scale);
                if (n === latest.current.selected) {
                  ctx.strokeStyle = latest.current.accent;
                  ctx.setLineDash([]);
                  ctx.lineWidth = 16;
                  ctx.strokeRect(8, 8, 496, 240);
                }
                slot.texture.needsUpdate = true;
              };
              image.src = sponsor.logo;
            }
          });
        }
        const raycaster = new THREE.Raycaster();
        let start = {x: 0, y: 0};
        const down = (event: PointerEvent) => { start = {x: event.clientX, y: event.clientY}; };
        const click = (event: PointerEvent) => {
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
          const rect = renderer.domElement.getBoundingClientRect();
          raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
          const hit = raycaster.intersectObjects(patches, false)[0];
          const occluder = raycaster.intersectObjects(body, false)[0];
          if (hit && (!occluder || hit.distance <= occluder.distance + .015)) latest.current.onSelect(hit.object.userData.slot);
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointerup', click);
        const resize = new ResizeObserver(() => {
          camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
          camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight);
        });
        resize.observe(host);
        let oldView = latest.current.view;
        let signature = '';
        let frame = 0;
        function animate() {
          frame = requestAnimationFrame(animate);
          if (document.hidden) return;
          const state = latest.current;
          const nextSignature = JSON.stringify([state.sponsors, state.selected, state.accent]);
          if (nextSignature !== signature) {
            signature = nextSignature;
            updatePatches();
          }
          if (oldView !== state.view) {
            oldView = state.view;
            camera.position.set(0, 2.7, state.view === 'back' ? -distance() : distance());
          }
          controls.update();
          renderer.render(scene, camera);
        }
        cleanup = () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          controls.dispose();
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointerup', click);
          dispose(scene);
          slots.forEach(slot => slot.texture.dispose());
          disposeEnvironment();
          renderer.dispose();
          renderer.domElement.remove();
        };
        animate();
        if (!cancelled) setStatus('ready');
      } catch {
        cleanup();
        cleanup = () => {};
        if (!cancelled) setStatus('failed');
      }
    }
    void init();
    return () => { cancelled = true; cleanup(); };
  }, [attempt]);
  return <div ref={container} className="arena" aria-busy={status === 'loading'}>
    {status === 'loading' && <div className="scene-fallback" role="status"><strong>21.1</strong><p>Loading Bhavya’s 3D race kit…</p></div>}
    {status === 'failed' && <div className="scene-fallback" role="status"><strong>21.1</strong><p>The 3D model couldn’t load.</p><button onClick={() => {setStatus('loading'); setAttempt(value => value + 1);}}>Retry 3D preview</button><button onClick={() => latest.current.onSelect(0)}>Explore the shirt spots ↗</button></div>}
  </div>;
}
