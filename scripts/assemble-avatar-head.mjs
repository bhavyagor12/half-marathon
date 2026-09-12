// Fit the separately reconstructed head to the existing race kit. No face-image projection.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments, unpartition, prune, dedup, meshopt, textureCompress, getBounds, weld} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const body = await io.read('output/avatar/bhavya.glb');
const head = await io.read(process.argv[2] || 'output/avatar/head-v2/head-clean.glb');
console.log('Source head bounds:', getBounds(head.getRoot().getDefaultScene()));
console.log('Body bounds:', getBounds(body.getRoot().getDefaultScene()));
// Retexture normalizes the uploaded crop to height 2; restore its source coordinates.
const crop = await io.read('output/avatar/head-v2/head-geometry.glb');
const sourceBounds=getBounds(crop.getRoot().getDefaultScene());
const cleanBounds=getBounds(head.getRoot().getDefaultScene());
const scale=(sourceBounds.max[1]-sourceBounds.min[1])/(cleanBounds.max[1]-cleanBounds.min[1]);
for(const accessor of new Set(head.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>p.getAttribute('POSITION'))))){
 for(let i=0;i<accessor.getCount();i++)accessor.setElement(i,accessor.getElement(i,[]).map((v,k)=>(v-(cleanBounds.min[k]+cleanBounds.max[k])/2)*scale+(sourceBounds.min[k]+sourceBounds.max[k])/2));
}
for(const material of head.getRoot().listMaterials())material.setName('Bhavya head 4K');
await body.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:88}));
// Keep only the existing race kit/body below the neck.
async function trim(document, plane, keepAbove) {
  const boundary = new Map();
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const texture=primitive.getMaterial()?.getBaseColorTexture();
    const pixels=texture?await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true}):null;
    const colorAt=uv=>{if(!pixels||!uv)return [.5,.3,.2];const {data,info}=pixels;const offset=(Math.max(0,Math.min(info.height-1,Math.floor(uv[1]*info.height)))*info.width+Math.max(0,Math.min(info.width-1,Math.floor(uv[0]*info.width))))*4;return new THREE.Color(data[offset]/255,data[offset+1]/255,data[offset+2]/255).convertSRGBToLinear().toArray();};
    const semantics=primitive.listSemantics();
    const attributes=Object.fromEntries(semantics.map(name=>[name,primitive.getAttribute(name)]));
    const arrays=Object.fromEntries(semantics.map(name=>[name,[]]));
    const indices=primitive.getIndices().getArray();
    const inside=v=>keepAbove?v.POSITION[1]>=plane:v.POSITION[1]<=plane;
    const intersection=(a,b)=>{
      const t=(plane-a.POSITION[1])/(b.POSITION[1]-a.POSITION[1]);
      const v=Object.fromEntries(semantics.map(name=>[name,a[name].map((value,k)=>value+t*(b[name][k]-value))]));
      v.POSITION[1]=plane;
      boundary.set(v.POSITION.map(x=>x.toFixed(6)).join(','),{p:v.POSITION.slice(),color:colorAt(v.TEXCOORD_0)});
      return v;
    };
    for(let i=0;i<indices.length;i+=3){
      const polygon=[indices[i],indices[i+1],indices[i+2]].map(index=>Object.fromEntries(semantics.map(name=>[name,attributes[name].getElement(index,[])])));
      const clipped=[];
      for(let j=0;j<3;j++){const a=polygon[j],b=polygon[(j+1)%3];if(inside(a))clipped.push(a);if(inside(a)!==inside(b))clipped.push(intersection(a,b));}
      for(let j=1;j+1<clipped.length;j++)for(const v of [clipped[0],clipped[j],clipped[j+1]])for(const name of semantics)arrays[name].push(...v[name]);
    }
    for(const name of semantics)primitive.setAttribute(name,document.createAccessor().setType(attributes[name].getType()).setArray(new Float32Array(arrays[name])).setBuffer(document.getRoot().listBuffers()[0]));
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(Uint32Array.from({length:arrays.POSITION.length/3},(_,i)=>i)).setBuffer(document.getRoot().listBuffers()[0]));
  }
  return [...boundary.values()];
}
const bodyBoundary=await trim(body,.635,false);
const headBoundary=await trim(head,-.07,true);
// Match original skull top and neck; retain anatomical proportions from the new head.
const headGroup=head.createNode('Reconstructed head').setScale([.30,.30,.30]).setTranslation([0,.9500769972801208-.9483129978179932*.30,-.010]);
const headScene=head.getRoot().getDefaultScene();
for(const child of headScene.listChildren())headGroup.addChild(child);
headScene.addChild(headGroup);
const mapping=mergeDocuments(body,head);
const scene=body.getRoot().getDefaultScene();
scene.addChild(mapping.get(headGroup));
for(const other of body.getRoot().listScenes())if(other!==scene)other.dispose();
const buffer=body.getRoot().listBuffers()[0];
const frameMaterial=body.createMaterial('Clear crystal eyeglass frames').setBaseColorFactor([.73,.79,.82,.72]).setAlphaMode('BLEND').setMetallicFactor(.12).setRoughnessFactor(.20).setDoubleSided(true);
const lensMaterial=body.createMaterial('Transparent optical lenses').setBaseColorFactor([.80,.90,.95,.065]).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(.12).setDoubleSided(true);
const glasses=body.createNode('Clear-frame glasses');scene.addChild(glasses);
function addGeometry(name, geometry, material, parent=glasses) {
  const primitive=body.createPrimitive().setMaterial(material);
  for(const [threeName,semantic] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0'],['color','COLOR_0']]){
    const attr=geometry.getAttribute(threeName);if(!attr)continue;
    primitive.setAttribute(semantic,body.createAccessor().setType(attr.itemSize===3?'VEC3':'VEC2').setArray(new Float32Array(attr.array)).setBuffer(buffer));
  }
  if(geometry.index)primitive.setIndices(body.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer));
  parent.addChild(body.createNode(name).setMesh(body.createMesh(name).addPrimitive(primitive)));
  geometry.dispose();
}
function wire(name, points, radius=.0012, closed=false){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');addGeometry(name,new THREE.TubeGeometry(curve,Math.max(24,points.length*5),radius,8,closed),frameMaterial);}
const eyeY=.800,frontZ=.120;
for(const side of [-1,1]){
 const cx=side*.042,halfW=.034,halfH=.022;
 // Rounded rectangles reproduce the clear rounded-square frames in the supplied photos.
 const shape=new THREE.Shape();const r=.012,x=-halfW,y=-halfH,w=halfW*2,h=halfH*2;
 shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
 const points=shape.getPoints(8).slice(0,-1).map(p=>[p.x+cx,p.y+eyeY,frontZ-.11*Math.abs(p.x+cx)]);
 wire(`${side<0?'Right':'Left'} lens rim`,points,.0012,true);
 const lens=new THREE.ShapeGeometry(shape,16);const positions=lens.getAttribute('position');for(let i=0;i<positions.count;i++){const vx=positions.getX(i)+cx;positions.setXYZ(i,vx,positions.getY(i)+eyeY,frontZ-.11*Math.abs(vx));}lens.computeVertexNormals();addGeometry(`${side<0?'Right':'Left'} transparent lens`,lens,lensMaterial);
 wire(`${side<0?'Right':'Left'} temple`,[[side*.076,eyeY+.008,.110],[side*.086,eyeY+.006,.085],[side*.093,eyeY-.002,.015],[side*.09,eyeY-.014,-.045],[side*.087,eyeY-.034,-.068]],.0012);
}
wire('Nose bridge',[[-.009,eyeY+.009,.118],[0,eyeY+.017,.128],[.009,eyeY+.009,.118]],.0012);

// Bridge the exact clipped boundary loops rather than overlapping disconnected necks.
const headOffset=.9500769972801208-.9483129978179932*.30;
const upper=headBoundary.map(({p:[x,y,z],color})=>({p:[x*.30,y*.30+headOffset,z*.30-.010],color}));
function angularRing(points){
 const center=points.reduce((s,{p})=>[s[0]+p[0]/points.length,s[1]+p[2]/points.length],[0,0]);
 return points.map(({p,color})=>({p,color,a:(Math.atan2(p[2]-center[1],p[0]-center[0])+Math.PI*2)%(Math.PI*2)})).sort((a,b)=>a.a-b.a);
}
const bottomRing=angularRing(bodyBoundary),topRing=angularRing(upper);
const neckPositions=[...bottomRing,...topRing].flatMap(v=>v.p);const neckIndices=[];
let lowerIndex=0,upperIndex=0;
while(lowerIndex<bottomRing.length||upperIndex<topRing.length){
 const lowerNext=lowerIndex+1<bottomRing.length?bottomRing[lowerIndex+1].a:Math.PI*2;
 const upperNext=upperIndex+1<topRing.length?topRing[upperIndex+1].a:Math.PI*2;
 const l=lowerIndex%bottomRing.length,u=upperIndex%topRing.length+bottomRing.length;
 if(lowerIndex<bottomRing.length&&(upperIndex>=topRing.length||lowerNext<=upperNext)){
  neckIndices.push(l,u,(lowerIndex+1)%bottomRing.length);lowerIndex++;
 }else{neckIndices.push(l,u,(upperIndex+1)%topRing.length+bottomRing.length);upperIndex++;}
}
const neckGeometry=new THREE.BufferGeometry();neckGeometry.setAttribute('position',new THREE.Float32BufferAttribute(neckPositions,3));neckGeometry.setAttribute('color',new THREE.Float32BufferAttribute([...bottomRing,...topRing].flatMap(v=>v.color),3));neckGeometry.setIndex(neckIndices);neckGeometry.computeVertexNormals();
const tone=new THREE.Color(1,1,1);
const neckMaterial=body.createMaterial('Neck transition').setBaseColorFactor([tone.r,tone.g,tone.b,1]).setMetallicFactor(0).setRoughnessFactor(.85).setDoubleSided(true);
addGeometry('Connected neck transition',neckGeometry,neckMaterial,scene);

await body.transform(unpartition(),weld(),dedup(),prune());
await io.write('output/avatar/head-v2/bhavya-candidate.glb',body);
// Separate version for inspection; do not replace the website before texture review.
await body.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[4096,4096],quality:88}),meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write('output/avatar/head-v2/bhavya-candidate-web.glb',body);
console.log('Saved candidate full-body GLB with a separately reconstructed head and real clear-frame glasses.');
