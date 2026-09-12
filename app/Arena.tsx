'use client';
import {useEffect, useRef, useState} from 'react';
import {SPOTS, nextPrice, type Sponsor} from '@/lib/config';
import {AVATAR_HEIGHT, AVATAR_GROUND, AVATAR_ANCHORS} from '@/lib/avatar.mjs';
import {buildRaceStart} from './RaceStart';
import type {Mesh, Texture, Material, Object3D} from 'three';

type Props = {
  sponsors: Sponsor[]; selected: number; onSelect: (n: number, point?: {x: number; y: number}) => void; onBrowse: () => void;
  view: 'front' | 'back'; onViewChange: (view: 'front' | 'back') => void;
  closeUp: boolean; showSpots: boolean; panelOpen: boolean; frameKey: number; capture: boolean;
};
// Open stickers use a warm tint so they read against both the white tee and skin; hover deepens it.
const ACCENT = '#a8371e', CREAM = '#fffaf0', OPEN = '#ffe0d3', HOVER = '#ffc4ae';
const spotNumber = (n: number) => String(n + 1).padStart(2, '0');
export default function Arena(props: Props) {
  const container = useRef<HTMLDivElement>(null), frameBox = useRef<HTMLDivElement>(null), hoverCard = useRef<HTMLDivElement>(null);
  const latest = useRef(props), sync = useRef<(() => void) | null>(null);
  // Every prop change redraws immediately instead of waiting for an animation frame.
  useEffect(() => {latest.current = props; sync.current?.();});
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [progress, setProgress] = useState(0), [attempt, setAttempt] = useState(0), [posterGone, setPosterGone] = useState(false);
  useEffect(() => {
    if (status !== 'ready') return;
    const timer = setTimeout(() => setPosterGone(true), 600);
    return () => clearTimeout(timer);
  }, [status]);
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
        const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
        const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
        cleanup = () => {dispose(scene); renderer.dispose(); renderer.domElement.remove();};
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
        renderer.domElement.setAttribute('aria-label', 'Bhavya’s 3D race kit. Drag to rotate; use the Front, Back and zoom buttons for keyboard controls.');
        host.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .12;
        controls.rotateSpeed = .65; controls.zoomSpeed = .8;
        controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
        // Rotation is horizontal; wheel/pinch only changes distance, never the tilt.
        controls.minPolarAngle = controls.maxPolarAngle = Math.PI / 2;
        controls.minDistance = 2.5; controls.maxDistance = 11;
        // The canvas covers the viewport; the runner is framed inside .scene-frame, the clear area between HUD layers.
        let viewWidth = 0, viewHeight = 0, frameSignature = '';
        const layout = () => {
          const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
          const origin = host.getBoundingClientRect(), box = frameBox.current?.getBoundingClientRect();
          const left = box ? box.left - origin.left : 0, top = box ? box.top - origin.top : 0;
          const fw = Math.max(1, box?.width || w), fh = Math.max(1, box?.height || h);
          const next = [w, h, left, top, fw, fh].map(Math.round).join();
          if (next === frameSignature) return false;
          frameSignature = next;
          if (w !== viewWidth || h !== viewHeight) {viewWidth = w; viewHeight = h; renderer.setSize(w, h);}
          camera.aspect = fw / fh; camera.setViewOffset(fw, fh, -left, -top, w, h); camera.updateProjectionMatrix();
          return true;
        };
        const frameView = () => {
          const {closeUp, view} = latest.current;
          const y = closeUp ? 2.08 : 1.86, distance = closeUp ? Math.max(3.3, 1.7 / camera.aspect) : Math.max(5.6, 3.7 / camera.aspect);
          // Flush leftover drag momentum so the camera cannot keep drifting after a reframe.
          controls.enableDamping = false; controls.update();
          controls.target.set(0, y, 0);
          camera.position.set(0, y, (view === 'back' ? -1 : 1) * distance);
          controls.update(); controls.enableDamping = true;
        };
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
          // Match the texture to the decal's proportions so numbers are never stretched.
          const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
          slots.push({canvas, texture, generation: 0});
          projector.set(new THREE.Vector3(x, y + AVATAR_GROUND, side * 3), new THREE.Vector3(0, 0, -side));
          const hit = projector.intersectObjects(body, false)[0];
          if (!hit) throw new Error('Sponsor anchor misses avatar');
          const geometry = new DecalGeometry(hit.object as Mesh, hit.point, new THREE.Euler(0, side === 1 ? 0 : Math.PI, 0), new THREE.Vector3(width, height, .14));
          const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8});
          const patch = new THREE.Mesh(geometry, material); patch.renderOrder = 1; patch.userData.slot = slot;
          scene.add(patch); patches.push(patch);
        });
        let lastFrame = 0, hovered = -1;
        const draw = () => {
          const state = latest.current;
          patches.forEach((patch, n) => {patch.visible = state.showSpots || state.sponsors.some(s => s.slot === n) || (state.panelOpen && n === state.selected);});
          environment.rotation.y = Math.atan2(camera.position.x, camera.position.z);
          faceLight.position.copy(camera.position).add(new THREE.Vector3(0, 1, 0)); faceLight.target.position.set(0, 2.4, 0);
          renderer.render(scene, camera);
        };
        // Animation frames pause in hidden or occluded tabs; draw directly whenever none has run recently.
        const requestDraw = () => {if (performance.now() - lastFrame > 100) draw();};
        function updatePatches() {
          slots.forEach((slot, n) => {
            const {canvas} = slot, ctx = canvas.getContext('2d')!, state = latest.current, w = canvas.width, h = canvas.height;
            const sponsor = state.sponsors.find(item => item.slot === n), generation = ++slot.generation, chosen = n === state.selected, hot = n === hovered;
            const radius = Math.min(w, h) * .18;
            const outline = (inset: number) => {ctx.beginPath(); ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, radius);};
            // Open spots read as blank stickers: solid cream with an accent rim. Hover warms the fill; the chosen spot fills with the accent.
            ctx.clearRect(0, 0, w, h); outline(8);
            ctx.fillStyle = chosen ? ACCENT : hot ? HOVER : OPEN; ctx.fill();
            ctx.lineWidth = hot && !chosen ? 30 : 22; ctx.strokeStyle = chosen ? CREAM : ACCENT; ctx.stroke();
            ctx.fillStyle = chosen ? CREAM : ACCENT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `bold ${Math.round(Math.min(h * .5, w * .42, 150))}px Arial`; ctx.fillText(spotNumber(n), w / 2, h / 2 + 4);
            slot.texture.needsUpdate = true;
            if (sponsor?.logo) {
              const image = new Image();
              image.onload = () => {
                if (cancelled || generation !== slot.generation) return;
                ctx.clearRect(0, 0, w, h); outline(8); ctx.fillStyle = CREAM; ctx.fill();
                const scale = Math.min((w - 64) / image.width, (h - 64) / image.height);
                ctx.drawImage(image, (w - image.width * scale) / 2, (h - image.height * scale) / 2, image.width * scale, image.height * scale);
                outline(8); ctx.strokeStyle = ACCENT; ctx.lineWidth = chosen || hot ? 22 : 8; ctx.stroke();
                slot.texture.needsUpdate = true; requestDraw();
              }; image.src = sponsor.logo;
            }
          });
        }
        let patchSignature = '', viewSignature = '';
        const update = () => {
          const state = latest.current;
          const nextPatches = JSON.stringify([state.sponsors, state.selected, hovered]);
          if (nextPatches !== patchSignature) {patchSignature = nextPatches; updatePatches();}
          // frameKey changes on every Front/Back/zoom press, so pressing the current side still resets a dragged view.
          const nextView = [state.view, state.closeUp, state.frameKey].join();
          if (layout() || nextView !== viewSignature) {viewSignature = nextView; frameView();}
          draw();
        };
        const raycaster = new THREE.Raycaster(); let start = {x:0, y:0}, moved = false;
        const pick = (clientX: number, clientY: number) => {
          const rect = renderer.domElement.getBoundingClientRect();
          raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1, -(clientY-rect.top)/rect.height*2+1), camera);
          const visible = patches.filter((patch, n) => patch.visible && AVATAR_ANCHORS[n][4] * camera.position.z > .15);
          const hit = raycaster.intersectObjects(visible, false)[0];
          if (!hit) return -1;
          const occluder = raycaster.intersectObjects(body, false)[0];
          return !occluder || hit.distance <= occluder.distance + .006 ? hit.object.userData.slot as number : -1;
        };
        let pointer = {x: 0, y: 0}, hoverQueued = false;
        const showHover = (next: number) => {
          if (next !== hovered) {hovered = next; renderer.domElement.style.cursor = next >= 0 ? 'pointer' : ''; update();}
          const card = hoverCard.current;
          if (!card) return;
          if (next < 0) {card.classList.remove('is-visible'); return;}
          const sponsor = latest.current.sponsors.find(s => s.slot === next), origin = host.getBoundingClientRect();
          card.querySelector('b')!.textContent = `${spotNumber(next)} · ${SPOTS[next]}`;
          card.querySelector('small')!.textContent = sponsor ? `${sponsor.brand} · take over $${nextPrice(next, sponsor.amount) / 100}` : `Open · $${nextPrice(next) / 100}`;
          card.style.left = `${pointer.x - origin.left}px`; card.style.top = `${pointer.y - origin.top}px`;
          card.classList.add('is-visible');
        };
        const down = (event: PointerEvent) => {start = {x:event.clientX, y:event.clientY}; moved = false;};
        const move = (event: PointerEvent) => {
          if (Math.hypot(event.clientX-start.x, event.clientY-start.y)>6) moved = true;
          if (event.pointerType !== 'mouse' || event.buttons) {if (hovered >= 0) showHover(-1); return;}
          pointer = {x: event.clientX, y: event.clientY};
          // Body raycasts are costly, so hover picking is throttled rather than run on every pointer event.
          if (hoverQueued) return; hoverQueued = true;
          setTimeout(() => {hoverQueued = false; showHover(pick(pointer.x, pointer.y));}, 40);
        };
        const leave = () => showHover(-1);
        const click = (event: PointerEvent) => {
          if (moved) return;
          const slot = pick(event.clientX, event.clientY);
          if (slot >= 0) latest.current.onSelect(slot, {x: event.clientX, y: event.clientY});
        };
        const end = () => {
          const state = latest.current, side = camera.position.z >= 0 ? 'front' : 'back';
          // A drag only updates the Front/Back switch; it must not snap the camera back.
          viewSignature = [side, state.closeUp, state.frameKey].join();
          if (side !== state.view) state.onViewChange(side);
        };
        controls.addEventListener('end', end); controls.addEventListener('change', requestDraw);
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerleave', leave);
        renderer.domElement.addEventListener('pointerup', click);
        const resize = new ResizeObserver(update); resize.observe(host);
        document.addEventListener('visibilitychange', update);
        let frame = 0;
        const animate = () => {frame = requestAnimationFrame(animate); lastFrame = performance.now(); controls.update(); draw();};
        cleanup = () => {
          sync.current = null; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
          document.removeEventListener('visibilitychange', update);
          renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerleave', leave); renderer.domElement.removeEventListener('pointerup', click);
          dispose(scene); slots.forEach(slot => slot.texture.dispose()); disposeEnvironment();
          renderer.dispose(); renderer.domElement.remove();
        };
        // Draw the first frame synchronously so the poster never gives way to an empty canvas.
        update(); sync.current = update; animate();
        if (!cancelled) {setProgress(100); setStatus('ready');}
      } catch (error) {
        cleanup(); cleanup = () => {};
        if (!cancelled) {console.error('Race scene could not load', error); setStatus('failed');}
      }
    }
    void init(); return () => {cancelled = true; abort.abort(); cleanup();};
  }, [attempt]);
  const loadingLabel = progress >= 95 ? 'Preparing your 3D view…' : 'Loading the race kit…';
  return <div ref={container} className="arena" aria-busy={status === 'loading'} data-state={status}>
    <div ref={frameBox} className="scene-frame" aria-hidden="true"/>
    {!props.capture && !posterGone && <picture>
      <source media="(max-width: 700px)" srcSet="/scene-poster-mobile.webp"/>
      {/* The poster is server-rendered, works before JavaScript arrives, and fades out after the first 3D frame. */}
      <img className="scene-poster" src="/scene-poster.webp" alt="Bhavya at a Bengaluru half-marathon start line" fetchPriority="high"/>
    </picture>}
    {status !== 'ready' && !props.capture && <div className="scene-loading" role="status">
      {status === 'loading' ? <><span className="t-shimmer" data-text={`${loadingLabel} ${progress}%`}>{loadingLabel} {progress}%</span><progress aria-label="3D model loading" max="100" value={progress}/><button onClick={() => latest.current.onBrowse()}>Browse spots while it loads →</button></> : <><p>Explore the spots while the 3D view is unavailable.</p><button onClick={() => {setStatus('loading'); setProgress(0); setAttempt(n => n + 1);}}>Retry 3D</button><button onClick={() => latest.current.onBrowse()}>View spots →</button></>}
    </div>}
    <div ref={hoverCard} className="spot-hover" aria-hidden="true"><b/><small/></div>
    {props.selected >= 0 && <span className="sr-only">{SPOTS[props.selected]}, ${nextPrice(props.selected, props.sponsors.find(s => s.slot === props.selected)?.amount) / 100} USD.</span>}
  </div>;
}
