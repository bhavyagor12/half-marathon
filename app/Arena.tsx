'use client';
import {useEffect, useRef, useState} from 'react';
import {SPOTS, nextPrice, type Sponsor} from '@/lib/config';
import {AVATAR_HEIGHT, AVATAR_GROUND, AVATAR_ANCHORS} from '@/lib/avatar.mjs';
import {buildRaceStart} from './RaceStart';
import type {Mesh, Texture, Material, Object3D} from 'three';

type Props = {
  sponsors: Sponsor[]; selected: number; onSelect: (n: number) => void;
  view: 'front' | 'back'; onViewChange: (view: 'front' | 'back') => void;
  portrait: boolean; showSpots: boolean; panelOpen: boolean; onShoeSelect: () => void;
};
export default function Arena(props: Props) {
  const container = useRef<HTMLDivElement>(null), shoeLink = useRef<HTMLButtonElement>(null);
  const latest = useRef(props);
  useEffect(() => {latest.current = props;}, [props]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [progress, setProgress] = useState(0), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, cleanup = () => {};
    const abort = new AbortController();
    async function init() {
      try {
        const THREE = await import('three');
        const [{OrbitControls}, {GLTFLoader}, {DecalGeometry}, {MeshoptDecoder}] = await Promise.all([
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/geometries/DecalGeometry.js'),
          import('three/examples/jsm/libs/meshopt_decoder.module.js'),
        ]);
        const dispose = (root: Object3D) => {
          const textures = new Set<Texture>(), materials = new Set<Material>();
          root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              materials.add(material);
              for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
            }
          });
          textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose());
        };
        // Fetch explicitly so download progress and cancellation work before GLB decoding.
        const response = await fetch('/models/bhavya.glb', {signal: abort.signal});
        if (!response.ok) throw new Error('Avatar download failed');
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = []; let bytes = 0;
        const total = Number(response.headers.get('content-length')) || 1710896;
        if (reader) {
          while (true) {
            const {done, value} = await reader.read(); if (done) break;
            chunks.push(value); bytes += value.length;
            if (!cancelled) setProgress(Math.min(95, Math.round(bytes / total * 95)));
          }
        } else {const data = new Uint8Array(await response.arrayBuffer()); chunks.push(data); bytes = data.length;}
        const data = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) {data.set(chunk, offset); offset += chunk.length;}
        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data.buffer, '/models/');
        if (cancelled || !container.current) {dispose(gltf.scene); return;}
        const host = container.current;
        const scene = new THREE.Scene(); scene.add(gltf.scene);
        cleanup = () => dispose(scene);
        const camera = new THREE.PerspectiveCamera(35, host.clientWidth / Math.max(1, host.clientHeight), .1, 100);
        const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
        cleanup = () => {dispose(scene); renderer.dispose(); renderer.domElement.remove();};
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
        renderer.domElement.setAttribute('aria-label', 'Bhavya’s 3D race kit. Drag to rotate; use the Front, Back and Close-up buttons for keyboard controls.');
        host.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .12;
        controls.rotateSpeed = .65; controls.zoomSpeed = .8;
        controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
        // Rotation is horizontal; wheel/pinch only changes distance, never the tilt.
        controls.minPolarAngle = controls.maxPolarAngle = Math.PI / 2;
        controls.minDistance = 2.5; controls.maxDistance = 11;
        const distance = () => latest.current.portrait ? Math.max(3.5, 1.8 / camera.aspect) : Math.max(6.5, 4.5 / camera.aspect);
        const frameView = (side = latest.current.view) => {
          controls.target.set(0, latest.current.portrait ? 2.04 : 1.50, 0);
          camera.position.set(0, controls.target.y, (side === 'back' ? -1 : 1) * distance());
          controls.update();
        };
        frameView();
        scene.add(new THREE.HemisphereLight('#ffffff', '#838d80', 2));
        const key = new THREE.DirectionalLight('#fff3e4', 2.3); key.position.set(-3, 7, 5);
        key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .025;
        scene.add(key);
        const faceLight = new THREE.DirectionalLight('#ffffff', 2.1);
        scene.add(faceLight, faceLight.target);
        const runner = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(runner);
        const height = bounds.getSize(new THREE.Vector3()).y;
        if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid model bounds');
        runner.scale.multiplyScalar(AVATAR_HEIGHT / height); bounds.setFromObject(runner);
        const center = bounds.getCenter(new THREE.Vector3());
        runner.position.add(new THREE.Vector3(-center.x, AVATAR_GROUND - bounds.min.y, -center.z));
        runner.updateMatrixWorld(true);
        const body: Mesh[] = [];
        runner.traverse(object => {if (object instanceof THREE.Mesh) {object.castShadow = true; object.receiveShadow = false; body.push(object);}});
        const environment = new THREE.Scene(); scene.add(environment);
        const disposeEnvironment = buildRaceStart(environment, THREE);
        scene.background = environment.background; scene.fog = environment.fog;
        const patches: Mesh[] = [], slots: {canvas: HTMLCanvasElement; texture: Texture; generation: number}[] = [];
        const projector = new THREE.Raycaster();
        AVATAR_ANCHORS.forEach(([x, y, width, height, side], slot) => {
          const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
          slots.push({canvas, texture, generation: 0});
          projector.set(new THREE.Vector3(x, y + AVATAR_GROUND, side * 3), new THREE.Vector3(0, 0, -side));
          const hit = projector.intersectObjects(body, false)[0];
          if (!hit) throw new Error('Sponsor anchor misses avatar');
          const geometry = new DecalGeometry(hit.object as Mesh, hit.point, new THREE.Euler(0, side === 1 ? 0 : Math.PI, 0), new THREE.Vector3(width, height, .14));
          const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8});
          const patch = new THREE.Mesh(geometry, material); patch.renderOrder = 1; patch.userData.slot = slot;
          scene.add(patch); patches.push(patch);
        });
        function updatePatches() {
          slots.forEach((slot, n) => {
            const ctx = slot.canvas.getContext('2d')!, state = latest.current;
            const sponsor = state.sponsors.find(item => item.slot === n), generation = ++slot.generation;
            ctx.clearRect(0, 0, 512, 256);
            ctx.fillStyle = n === state.selected ? '#203d30' : '#a8371e'; ctx.fillRect(0, 0, 512, 256);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 16;
            ctx.setLineDash([28, 18]); ctx.strokeRect(12, 12, 488, 232);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 135px Arial';
            ctx.fillText(`${String(n + 1).padStart(2, '0')}`, 256, 128);
            slot.texture.needsUpdate = true;
            if (sponsor?.logo) {
              const image = new Image();
              image.onload = () => {
                if (cancelled || generation !== slot.generation) return;
                ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, 512, 256);
                const scale = Math.min(470 / image.width, 220 / image.height);
                ctx.drawImage(image, (512 - image.width * scale) / 2, (256 - image.height * scale) / 2, image.width * scale, image.height * scale);
                ctx.strokeStyle = '#ad371c'; ctx.lineWidth = n === latest.current.selected ? 18 : 6;
                ctx.setLineDash([]); ctx.strokeRect(10, 10, 492, 236); slot.texture.needsUpdate = true;
              }; image.src = sponsor.logo;
            }
          });
        }
        const raycaster = new THREE.Raycaster(); let start = {x:0, y:0}, moved = false;
        const down = (event: PointerEvent) => {start = {x:event.clientX, y:event.clientY}; moved = false;};
        const move = (event: PointerEvent) => {if (Math.hypot(event.clientX-start.x, event.clientY-start.y)>6) moved = true;};
        const click = (event: PointerEvent) => {
          if (moved) return;
          const rect = renderer.domElement.getBoundingClientRect();
          raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1), camera);
          const visible = patches.filter((patch, n) => patch.visible && AVATAR_ANCHORS[n][4] * camera.position.z > .15);
          const hit = raycaster.intersectObjects(visible, false)[0], occluder = raycaster.intersectObjects(body, false)[0];
          if (hit && (!occluder || hit.distance <= occluder.distance + .006)) latest.current.onSelect(hit.object.userData.slot);
        };
        let oldView = latest.current.view, oldPortrait = latest.current.portrait;
        const end = () => {oldView = camera.position.z >= 0 ? 'front' : 'back'; latest.current.onViewChange(oldView);};
        controls.addEventListener('end', end);
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', click);
        const resize = new ResizeObserver(() => {
          camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight); frameView();
        }); resize.observe(host);
        let signature = '', frame = 0;
        function animate() {
          frame = requestAnimationFrame(animate); if (document.hidden) return;
          const state = latest.current;
          const nextSignature = JSON.stringify([state.sponsors, state.selected]);
          if (signature !== nextSignature) {signature = nextSignature; updatePatches();}
          if (oldView !== state.view || oldPortrait !== state.portrait) {
            oldView = state.view; oldPortrait = state.portrait; frameView();
          }
          patches.forEach((patch,n) => {patch.visible = state.showSpots || n === state.selected || !!state.sponsors.find(s=>s.slot===n);});
          controls.update();
          environment.rotation.y = Math.atan2(camera.position.x, camera.position.z);
          faceLight.position.copy(camera.position).add(new THREE.Vector3(0, 1, 0)); faceLight.target.position.set(0, 2.4, 0);
          renderer.render(scene, camera);
          if (shoeLink.current) {
            const feet = new THREE.Vector3(0, AVATAR_GROUND, 0).project(camera);
            const x = (feet.x + 1) / 2 * host.clientWidth, y = (1 - feet.y) / 2 * host.clientHeight + 8;
            const visible = feet.z < 1 && y > 0 && y + 44 < host.clientHeight && x > 60 && x < host.clientWidth - 60;
            shoeLink.current.hidden = !visible;
            shoeLink.current.style.left = `${x}px`; shoeLink.current.style.top = `${y}px`;
          }
        }
        cleanup = () => {
          cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
          renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', click);
          dispose(scene); slots.forEach(slot => slot.texture.dispose()); disposeEnvironment();
          renderer.dispose(); renderer.domElement.remove();
        };
        animate(); if (!cancelled) {setProgress(100); setStatus('ready');}
      } catch (error) {
        cleanup(); cleanup = () => {};
        if (!cancelled) {console.error('Race scene could not load', error); setStatus('failed');}
      }
    }
    void init(); return () => {cancelled = true; abort.abort(); cleanup();};
  }, [attempt]);
  return <div ref={container} className="arena" aria-busy={status === 'loading'} data-state={status}>
    {status !== 'ready' && <>
      {/* The poster is server-rendered and works even before JavaScript arrives. */}
      <img className="scene-poster" src="/scene-poster.webp" alt="Bhavya at a Bengaluru half-marathon start line" fetchPriority="high"/>
      <div className="scene-loading" role="status">
        {status === 'loading' ? <><span>{progress >= 95 ? 'Preparing your 3D view…' : 'Loading the race kit…'} {progress}%</span><progress aria-label="3D model loading" max="100" value={progress}/><button onClick={() => latest.current.onSelect(0)}>Browse spots while it loads →</button></> : <><p>Explore the spots while the 3D view is unavailable.</p><button onClick={() => {setStatus('loading'); setProgress(0); setAttempt(n => n + 1);}}>Retry 3D</button><button onClick={() => latest.current.onSelect(0)}>View spots →</button></>}
      </div>
    </>}
    {status === 'ready' && <button ref={shoeLink} hidden className="shoe-marker" onClick={() => latest.current.onShoeSelect()} aria-label="Sponsor my shoes">Sponsor my shoes →</button>}
    <span className="sr-only">{SPOTS[props.selected]}, ${nextPrice(props.selected, props.sponsors.find(s => s.slot === props.selected)?.amount) / 100} USD.</span>
  </div>;
}
