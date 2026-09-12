import type * as Three from 'three';

/** An illustrative Bengaluru race start; the organizer has not announced the venue. */
export function buildRaceStart(scene: Three.Scene, THREE: typeof Three) {
  scene.background = new THREE.Color('#e9e7db');
  scene.fog = new THREE.Fog('#e9e7db', 28, 95);
  const textures: Three.Texture[] = [];
  const road = new THREE.MeshStandardMaterial({color: '#666560', roughness: 1});
  const red = new THREE.MeshStandardMaterial({color: '#ce4935', roughness: .8});
  const white = new THREE.MeshStandardMaterial({color: '#f5f0e4', roughness: .85});
  const metal = new THREE.MeshStandardMaterial({color: '#aaa99f', roughness: .45, metalness: .6});
  const green = new THREE.MeshStandardMaterial({color: '#788065', roughness: 1});
  const dark = new THREE.MeshStandardMaterial({color: '#333c35', roughness: 1});
  function add(geometry: Three.BufferGeometry, material: Three.Material, x: number, y: number, z: number, parent: Three.Object3D = scene) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function bar(a: number[], b: number[], radius = .025, parent: Three.Object3D = scene) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const object = add(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), metal, ...start.add(end).multiplyScalar(.5).toArray() as [number, number, number], parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  }
  function sign(width: number, height: number, background: string, lines: {text: string; y: number; size: number; color?: string}[]) {
    const logicalHeight = 1536 * height / width;
    const scale = Math.min(1, 2048 / logicalHeight);
    const canvas = document.createElement('canvas'); canvas.width = Math.round(1536 * scale); canvas.height = Math.round(logicalHeight * scale);
    const ctx = canvas.getContext('2d')!; ctx.scale(scale, scale); ctx.fillStyle = background; ctx.fillRect(0, 0, 1536, logicalHeight);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const line of lines) {ctx.fillStyle = line.color ?? '#fffaf0'; ctx.font = `700 ${line.size}px Arial`; ctx.fillText(line.text, 768, logicalHeight * line.y);}
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; textures.push(map);
    return new THREE.MeshStandardMaterial({map, roughness: .95, side: THREE.DoubleSide});
  }
  // Broad asphalt avenue with a clear center corral, flanked by Bengaluru-like greenery.
  const ground = add(new THREE.PlaneGeometry(150, 150), green, 0, .18, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const avenue = add(new THREE.PlaneGeometry(7, 130), road, 0, .20, -30); avenue.rotation.x = -Math.PI / 2; avenue.castShadow = false;
  for (const side of [-1, 1]) {
    const edge = add(new THREE.PlaneGeometry(.055, 110), white, side * 3.18, .206, -27); edge.rotation.x = -Math.PI / 2; edge.castShadow = false;
    add(new THREE.BoxGeometry(.3, .2, 110), white, side * 3.65, .25, -27);
  }
  const stripeGeometry = new THREE.PlaneGeometry(.085, 1.1);
  for (let n = 0; n < 15; n++) {const stripe = add(stripeGeometry, white, 0, .208, -8 - n * 3); stripe.rotation.x = -Math.PI / 2; stripe.castShadow = false;}
  // Printed timing mat beneath the runner, instead of a glowing pedestal.
  const mat = add(new THREE.BoxGeometry(5.0, .014, .75), dark, 0, .215, .80);
  mat.castShadow = false;
  const startPrint = sign(5, .65, '#f5f0e4', [{text: 'S T A R T', y: .5, size: 112, color: '#303b35'}]);
  const line = add(new THREE.PlaneGeometry(5, .65), startPrint, 0, .224, 1.55); line.rotation.x = -Math.PI / 2; line.castShadow = false;
  for (let i = 0; i < 20; i++) for (let row = 0; row < 2; row++) {
    const check = add(new THREE.PlaneGeometry(.25, .18), (i + row) % 2 ? white : dark, -2.375 + i * .25, .225, .39 + row * .18);
    check.rotation.x = -Math.PI / 2; check.castShadow = false;
  }
  // Familiar event truss, readable from both sides while orbiting the runner.
  const archZ = -17, archHeight = 7.6;
  for (const side of [-1, 1]) {
    const x = side * 4.4;
    add(new THREE.BoxGeometry(.72, .15, 1.1), dark, x, .27, archZ);
    for (const dx of [-.18, .18]) for (const dz of [-.18, .18]) bar([x + dx, .35, archZ + dz], [x + dx, archHeight, archZ + dz], .035);
    for (let y = .5; y < archHeight - .4; y += .55) {
      bar([x - .18, y, archZ + .18], [x + .18, y + .5, archZ + .18], .018);
      bar([x + .18, y, archZ - .18], [x - .18, y + .5, archZ - .18], .018);
    }
    add(new THREE.BoxGeometry(.55, 2.1, .48), red, x, 1.55, archZ + .04);
    const upright = add(new THREE.PlaneGeometry(.40, 1.85), sign(.40, 1.85, '#ce4935', [{text:'2',y:.25,size:700},{text:'1',y:.49,size:700},{text:'K',y:.73,size:650}]), x, 1.56, archZ + .289);
    upright.castShadow = false;
  }
  add(new THREE.BoxGeometry(9.5, .88, .42), red, 0, archHeight, archZ);
  const event = sign(9.4, .83, '#ce4935', [{text:'BENGALURU HALF · 21.1K',y:.34,size:60},{text:'20 DECEMBER 2026   /   START',y:.76,size:54}]);
  for (const side of [-1, 1]) {
    const banner = add(new THREE.PlaneGeometry(9.4, .83), event, 0, archHeight, archZ + side * .216);
    if (side === -1) banner.rotation.y = Math.PI;
    banner.castShadow = false;
  }
  // Crowd barriers and printed cloth create depth without distracting from the sponsor kit.
  const cloth = sign(2.15, .58, '#f5f0e4', [{text:'21.1 KM',y:.35,size:155,color:'#ce4935'},{text:'EVERY STEP COUNTS',y:.75,size:58,color:'#435045'}]);
  for (const side of [-1, 1]) for (let n = 0; n < 4; n++) {
    const x = side * 2.48, z = 1.5 - n * 3.5;
    for (const offset of [-1.12, 1.12]) {bar([x,.23,z+offset],[x,1.02,z+offset]);bar([x-.20,.23,z+offset],[x+.20,.23,z+offset]);}
    bar([x,1.02,z-1.12],[x,1.02,z+1.12]);
    const banner = add(new THREE.PlaneGeometry(2.15, .58), cloth, x - side * .02, .68, z); banner.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    banner.castShadow = false;
  }
  // Course cones and flags, clear even at the small mobile camera scale.
  for (const side of [-1, 1]) {
    for (let n = 0; n < 2; n++) {
      const x = side * 2.12, z = 2.8 - n * 3.2;
      add(new THREE.BoxGeometry(.24,.045,.24), dark, x,.24,z);
      add(new THREE.ConeGeometry(.10,.37,12),red,x,.44,z);
      add(new THREE.CylinderGeometry(.047,.065,.07,12),white,x,.45,z);
    }
    for (let n = 0; n < 1; n++) {
      const x = side * (3.9 + n*.15), z = -8 - n*7;
      bar([x,.2,z],[x,3.8,z],.026);
      const flag = add(new THREE.PlaneGeometry(.8,2.4), sign(.8,2.4,'#ce4935',[{text:'2',y:.25,size:650},{text:'1',y:.48,size:650},{text:'K',y:.74,size:580}]),x+side*.42,2.45,z); flag.rotation.y=side*.2;
    }
  }
  // Instanced avenue trees keep the environment inexpensive on phones.
  const treeCount=16;
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.19,3.7,7),new THREE.MeshStandardMaterial({color:'#7e7261',roughness:1}),treeCount);
  const crowns=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshStandardMaterial({color:'#7c8a67',roughness:1}),treeCount*2);
  const transform=new THREE.Object3D();
  for(let n=0;n<treeCount;n++){
    const side=n%2?1:-1, index=Math.floor(n/2), x=side*(9+Math.sin(n*2.4)*.7),z=-18-index*7.0;
    transform.position.set(x,2,z);transform.scale.set(1,1,1);transform.rotation.set(0,0,0);transform.updateMatrix();trunks.setMatrixAt(n,transform.matrix);
    for(let layer=0;layer<2;layer++){transform.position.set(x+Math.sin(n)*.5,4.5+layer*.8,z);transform.scale.set(2.2+Math.sin(n)*.4,1.8,2.3);transform.rotation.set(n*.3,n,.2);transform.updateMatrix();crowns.setMatrixAt(n*2+layer,transform.matrix);}
  }
  trunks.castShadow=true;crowns.castShadow=true;trunks.receiveShadow=true;crowns.receiveShadow=true;scene.add(trunks,crowns);
  // Distant city silhouettes suggest the city without inventing the race venue.
  const buildings=new THREE.MeshStandardMaterial({color:'#c4c2b4',roughness:1});
  for(let n=0;n<6;n++){const side=n%2?1:-1;add(new THREE.BoxGeometry(3,5+n%4*2,3),buildings,side*(10+n%3*4),2.5+n%4,-28-Math.floor(n/2)*5);}
  return () => textures.forEach(texture => texture.dispose());
}
