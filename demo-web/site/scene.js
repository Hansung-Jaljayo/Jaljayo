import {initConsole} from './console/controller.js?v=bartarget';
import {initBoardLink} from './board-link.js?v=2';
import {initPressure} from './pressure.js?v=1';
import {Water} from 'three/addons/objects/Water.js';
let riverWater,parkTick=null;
import {addPark} from './park.js?v=28';
import * as T from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const q=new URLSearchParams(location.search); if(q.has('clean'))document.body.classList.add('clean');
const scene=new T.Scene(); scene.background=new T.Color('#d8ded9');
const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=0.92;renderer.outputColorSpace=T.SRGBColorSpace;
const camera=new T.PerspectiveCamera(51,innerWidth/innerHeight,.04,3200);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.5;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.53;
const views={river:[[0,1.55,3.85],[.35,1.32,10.8]],bedfront:[[.67431,1.43684,-2.19943],[2.1093,.9312,2.56346]],bedside:[[2.45,.95,-1.9],[1.55,.8,3]],entry:[[1.75,1.52,-3.72],[-3.5,.95,1.8]],window:[[-3.1,1.45,-3.6],[3.5,.9,1.8]]};
function view(name){const v=views[name]||views.bedside;camera.position.set(...v[0]);controls.target.set(...v[1]);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view(b.dataset.view);history.replaceState(null,'','#'+b.dataset.view)});view(location.hash.slice(1)||'bedfront');
const pmrem=new T.PMREMGenerator(renderer),roomEnv=new RoomEnvironment(renderer);scene.environment=pmrem.fromScene(roomEnv,.04).texture;roomEnv.dispose();pmrem.dispose();
const tl=new T.TextureLoader();const texCache=new Map();
const textureDownloads=new Map();
async function tex(name,rx=1,ry=rx,data=false){
 const url=(window.ASSETS&&window.ASSETS[name])||'assets/'+name;
 if(!textureDownloads.has(url))textureDownloads.set(url,tl.loadAsync(url));
 const t=(await textureDownloads.get(url)).clone();t.needsUpdate=true;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=data?T.NoColorSpace:T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
const mat=(c,r=.7,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m,envMapIntensity:.55});
const plaster=mat('#e2ddcf',.95), oak=mat('#a58c69',.55),dark=mat('#282c29',.45,.65),brass=mat('#ad9270',.34,.7), stone=mat('#c8c0ae',.45), white=mat('#f0eadc',.85);
function mesh(g,m,p=[0,0,0],parent=scene){const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,m,p,r=0,parent=scene){return mesh(r?new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/2,h/2,d/2)):new T.BoxGeometry(w,h,d),m,p,parent)}
function cylinder(r1,r2,h,m,p,parent=scene,n=48){return mesh(new T.CylinderGeometry(r1,r2,h,n),m,p,parent)}
function line(a,b,r,m,parent=scene){const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=cylinder(r,r,av.distanceTo(bv),m,av.clone().add(bv).multiplyScalar(.5).toArray(),parent,12);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return o;}
const emit=new T.MeshBasicMaterial({color:'#ffe2aa'});

async function originalBuild(){
 const [wood,wall,rug,curtain,boucle,knit,top,pillow,normal,knorm,bnorm,walnut,sky]=await Promise.all([tex('M_Floor.jpg',3,4),tex('M_Wall.jpg',2,2),tex('M_Rug.jpg',3,3),tex('M_Curtain.jpg',2,4),tex('p_boucle.jpg',4,4),tex('p_knit.jpg',5,8),tex('p_top.jpg',6,9),tex('p_pillow.jpg',3,3),tex('waffle_pique_cotton_nor.jpg',12,16,true),tex('jersey_melange_nor.jpg',12,12,true),tex('wool_boucle_nor.jpg',8,8,true),tex('M_Walnut.jpg',1,2),tex('view.jpg')]);
 const floorMat=mat('#d5c4a9',.38);floorMat.map=wood;floorMat.bumpMap=wood;floorMat.bumpScale=.002;
 box(7,.12,8,floorMat,[0,-.06,0]);
 // Real floorboard gaps, staggered ends; subtle, not black outlines.

 plaster.map=wall;plaster.bumpMap=wall;plaster.bumpScale=.004;
 box(.15,3,8,plaster,[3.57,1.5,0]);box(7,3,.15,plaster,[0,1.5,-4.07]);
 const ceiling=box(7,.12,8,mat('#dedbd0',1),[0,3.06,0]);
 // Recessed oak wall with linen panels; no wardrobe.
 const woodPanel=mat('#c6b59b',.58);woodPanel.map=wood.clone();woodPanel.map.repeat.set(.6,1.5);woodPanel.map.needsUpdate=true;
 box(.06,2.85,3.5,woodPanel,[3.45,1.5,1.2]);
 const linen=mat('#bdb6a5',.97);linen.map=boucle;linen.normalMap=bnorm;linen.normalScale=new T.Vector2(.16,.16);
 // Wall cushions removed at the user's request; retain the recessed oak wall.
 box(.035,.016,3.55,emit,[3.36,1.79,1.2]);
 for(let z=-3.6;z<-.8;z+=.12)box(.055,2.72,.045,woodPanel,[3.44,1.48,z],.01);
 // Thin architectural window mullions.
 const windowFrame=mat('#333b38',.4,.5);
 for(let z=-4;z<=4;z+=2)box(.07,3,.055,windowFrame,[-3.49,1.5,z]);
 for(let x=-3.5;x<=3.51;x+=1.75)box(.055,3,.07,windowFrame,[x,1.5,3.98]);
 for(let h of [.06,2.84]){box(.09,.065,8,windowFrame,[-3.49,h,0]);box(7,.065,.09,windowFrame,[0,h,3.98]);}
 // Exterior image is distant and softly lit; does not add arbitrary light to the bed.
 sky.wrapS=sky.wrapT=T.ClampToEdgeWrapping;sky.repeat.set(1,1);
 const bgmat=new T.MeshBasicMaterial({map:sky,color:new T.Color(2.5,2.7,2.8),side:T.DoubleSide});
 const bg=mesh(new T.PlaneGeometry(30,10),bgmat,[-9,3.8,0]);bg.rotation.y=Math.PI/2;bg.castShadow=false;
 const bg2=mesh(new T.PlaneGeometry(30,10),bgmat,[0,3.8,10]);bg2.castShadow=false;
 // Curtains with folds rather than flat sheets.
 const cmat=mat('#d5cdbb',1);cmat.map=curtain;cmat.side=T.DoubleSide;
 function drape(z0,width,x){let g=new T.PlaneGeometry(width,2.76,100,20),a=g.attributes.position;for(let i=0;i<a.count;i++){const u=a.getX(i),y=a.getY(i);a.setZ(i,Math.sin(u*34)*.055+Math.sin(u*68)*.013+(1-y/2.76)*.012)}g.computeVertexNormals();let o=mesh(g,cmat,[x,1.46,z0]);o.rotation.y=Math.PI/2;}
 drape(-3.5,.86,-3.30);drape(3.37,1.05,-3.30);
 // Bed rug, woven edge and softened corners.
 const rmat=mat('#d5cbbb',1);rmat.map=rug;rmat.bumpMap=rug;rmat.bumpScale=.005;
 box(3.25,.021,3.25,rmat,[1.70,.017,1.2],.01);
 // Bed built anew; same 6/4/2 cumulative articulation idea, continuous surface.
 const bed=new T.Group();bed.position.set(2.18,0,1.2);bed.rotation.y=-Math.PI/2;scene.add(bed);
 const upholstery=mat('#b8afa0',.95);upholstery.map=boucle;upholstery.normalMap=bnorm;upholstery.normalScale=new T.Vector2(.18,.18);
 box(1.96,.23,2.22,upholstery,[0,.255,0],.065,bed);
 box(1.78,.065,2.0,dark,[0,.14,0],.02,bed);
 for(const x of [-.76,.76])for(const z of [-.84,.84])cylinder(.025,.034,.17,dark,[x,.085,z],bed);
 box(2.03,.92,.13,upholstery,[0,.66,-1.14],.065,bed);
 const bodyMat=mat('#dbd9d6',.94);bodyMat.map=knit;bodyMat.normalMap=knorm;bodyMat.normalScale=new T.Vector2(.13,.13);
 const topMat=mat('#f1ece2',.96);topMat.map=top;topMat.normalMap=normal;topMat.normalScale=new T.Vector2(.16,.16);
 const seamMat=mat('#d6cec0',.9);
 makeBend(1.81,.19,2.07,.465,bodyMat,.045,bed);
 makeBend(1.80,.055,2.06,.578,topMat,.025,bed);
 makeBend(1.78,.028,2.04,.355,dark,.01,bed);
 // Continuous slim piping, both edges follow the same deformation.
 for(const y of [.382,.561]){
  const w=.905,l=1.035,rr=.055;
  const shape=new T.Shape();shape.moveTo(w,l-rr);shape.absarc(w-rr,l-rr,rr,0,Math.PI/2,false);shape.lineTo(-w+rr,l);shape.absarc(-w+rr,l-rr,rr,Math.PI/2,Math.PI,false);shape.lineTo(-w,-l+rr);shape.absarc(-w+rr,-l+rr,rr,Math.PI,Math.PI*1.5,false);shape.lineTo(w-rr,-l);shape.absarc(w-rr,-l+rr,rr,Math.PI*1.5,Math.PI*2,false);shape.lineTo(w,l-rr);
  const path=shape.getSpacedPoints(400).map(p=>new T.Vector3(p.x,y,p.y));
  const g=new T.TubeGeometry(new T.CatmullRomCurve3(path,true,'centripetal'),600,.0025,5,true);addDeform(mesh(g,seamMat,[0,0,0],bed));
 }
 // Pillows are soft closed surfaces with a pinched perimeter, not rigid boxes.
 const pillowMat=mat('#f3efe7',.99);pillowMat.map=pillow;pillowMat.normalMap=normal;pillowMat.normalScale=new T.Vector2(.12,.12);
 for(const x of [-.445,.445]){const group=new T.Group();bed.add(group);const geo=new T.BoxGeometry(.74,.10,.48,50,12,40),p=geo.attributes.position;for(let i=0;i<p.count;i++){let v=new T.Vector3(p.getX(i),p.getY(i),p.getZ(i));let c=new T.Vector3(T.MathUtils.clamp(v.x,-.33,.33),T.MathUtils.clamp(v.y,-.012,.012),T.MathUtils.clamp(v.z,-.20,.20));let n=v.clone().sub(c).normalize();v.copy(c).addScaledVector(n,.038);const puff=.032+.060*Math.pow(Math.max(0,1-(v.x/.37)**2),.7)*Math.pow(Math.max(0,1-(v.z/.24)**2),.7);v.y=v.y/.05*puff;v.y+=.0015*Math.sin(v.x*75)*Math.cos(v.z*46);p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();mesh(geo,pillowMat,[0,.075,0],group);pillows.push({group,x,z:-.72});}
 // Articulated support rails and quiet mechanical struts.
 for(let x of [-.68,.68]){for(let z of [-.7,.66]){const o=line([x,.28,z*.3],[x,.36,z],.016,dark,bed);struts.push({o,x,z});}}
 const retainer=new T.Group();bed.add(retainer);line([-.28,0,0],[-.28,.12,0],.009,dark,retainer);line([-.28,.12,0],[.28,.12,0],.009,dark,retainer);line([.28,.12,0],[.28,0,0],.009,dark,retainer);feet.push(retainer);
 // Floating bedside consoles and pendants.
 for(const z of [-.22,2.62]){
  box(.56,.18,.66,woodPanel,[3.05,.50,z],.025);box(.57,.025,.67,stone,[3.05,.602,z],.012);
  box(.016,.005,.14,brass,[2.76,.51,z]);
  cylinder(.012,.012,1.9,brass,[3.05,2.0,z]);cylinder(.15,.20,.20,mat('#e1d9c4',.8),[3.05,1.13,z]);cylinder(.16,.16,.012,emit,[3.05,1.027,z]);
  const light=new T.PointLight('#ffdb9f',2.4,2.5,2);light.position.set(3.0,1.0,z);scene.add(light);
 }
 // A book and water glass, deliberately restrained.
 box(.22,.027,.15,mat('#697967'),[3.04,.63,-.27],.003);box(.20,.019,.14,white,[3.02,.651,-.26],.002);
 cylinder(.043,.038,.12,new T.MeshPhysicalMaterial({color:'#d5e5df',roughness:.08,metalness:0,transparent:true,opacity:.34}),[2.99,.68,2.68]);
 // Lounge area at the window.
 const chairMat=mat('#c1baaa',.93);chairMat.map=boucle;chairMat.normalMap=bnorm;chairMat.normalScale=new T.Vector2(.15,.15);
 const chair=new T.Group();chair.position.set(-2.18,0,2.6);chair.rotation.y=.45;scene.add(chair);
 await furniture('modern_arm_chair_01',chair,chairMat);
 cylinder(.37,.37,.045,stone,[-1.12,.46,2.9]);cylinder(.12,.18,.43,woodPanel,[-1.12,.22,2.9]);
 cylinder(.07,.055,.10,white,[-1.12,.53,2.9]);
 // Large plant, curved leaves with actual volume and real shadows.
 const plantGroup=new T.Group();plantGroup.position.set(-2.9,0,1.2);plantGroup.scale.setScalar(1.65);scene.add(plantGroup);await furniture('potted_plant_02',plantGroup);
 // Perimeter warm cove and recessed lamps.
 box(.014,.022,7.6,emit,[3.34,2.87,0]);box(6.7,.022,.014,emit,[0,2.87,-3.83]);
 for(let x of [-1.8,1.7])for(let z of [-2.7,1.8]){cylinder(.055,.055,.015,dark,[x,2.99,z]);cylinder(.045,.045,.015,emit,[x,2.978,z]);}
 const hemi=new T.HemisphereLight('#dce6ec','#a99578',.65);scene.add(hemi);
 const sun=new T.DirectionalLight('#ffe1ad',3.65);sun.position.set(-3,4.8,8);sun.target.position.set(1,0,0);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:22});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun,sun.target);
 const fill=new T.DirectionalLight('#e0edff',.85);fill.position.set(-4,2,-1);scene.add(fill);
 requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector('#loading').hidden=true;performance.mark('scene-visible');}));updateBed();
}
async function furniture(name,parent,fabric){const loader=new GLTFLoader();let gltf;if(window.MODELS&&window.MODELS[name]){const bytes=Uint8Array.from(atob(window.MODELS[name]),c=>c.charCodeAt(0));gltf=await loader.parseAsync(bytes.buffer,'');}else gltf=await loader.loadAsync('assets/'+name+'.glb');const jobs=[];gltf.scene.traverse(o=>{if(!o.isMesh)return;const n=o.material.name;o.castShadow=o.receiveShadow=true;if(n.includes('pillow')&&fabric)o.material=fabric;else{jobs.push((async()=>{let m=mat('#ffffff',.8);m.map=await tex(n+'.jpg');if(n.includes('leaves')){m.alphaMap=await tex(n+'_a.jpg',1,1,true);m.alphaTest=.45;m.side=T.DoubleSide;m.roughness=.75;}o.material=m;})());}});await Promise.all(jobs);parent.add(gltf.scene);}
function plant(x,y,z){const p=new T.Group();p.position.set(x,y,z);scene.add(p);cylinder(.19,.14,.37,mat('#a79c85',.98),[0,.185,0],p);cylinder(.16,.16,.01,mat('#3b3629'),[0,.37,0],p);const green=mat('#63734f',.7);green.side=T.DoubleSide;for(let i=0;i<13;i++){let a=i*2.4,h=.8+(i%5)*.21,r=.24+(i%3)*.11;const end=[Math.cos(a)*r,h,Math.sin(a)*r];line([0,.35,0],end,.006,mat('#6b6743'),p);let g=new T.SphereGeometry(1,16,10);g.scale(.09,.29,.018);const o=mesh(g,green,end,p);o.rotation.set(Math.sin(a)*.5,a,-Math.cos(a)*.6);}}
const deforms=[],pillows=[],struts=[],feet=[];
const target={head:T.MathUtils.clamp(Number(q.get('head'))||0,0,60),leg:T.MathUtils.clamp(Number(q.get('leg'))||0,0,40)};const current={...target};
function addDeform(o,cloth=false){deforms.push({o,cloth,rest:o.geometry.attributes.position.array.slice()});}
function makeBend(w,h,d,y,m,r,parent){let g=new T.BoxGeometry(w,h,d,16,6,80),pp=g.attributes.position;for(let i=0;i<pp.count;i++){let v=new T.Vector3(pp.getX(i),pp.getY(i),pp.getZ(i));let c=new T.Vector3(T.MathUtils.clamp(v.x,-w/2+r,w/2-r),T.MathUtils.clamp(v.y,-h/2+r,h/2-r),T.MathUtils.clamp(v.z,-d/2+r,d/2-r));let n=v.clone().sub(c).normalize();v.copy(c).addScaledVector(n,r);pp.setXYZ(i,v.x,v.y+y,v.z);}g.computeVertexNormals();let o=mesh(g,m,[0,0,0],parent);addDeform(o,y>.4);return o;}
// Smoothly distribute rotation over six head, four thigh and two calf sections.
// Arc-length integration keeps mattress length constant instead of stretching a box.
// Source rig proportions: six head joints, four thigh joints, two calf joints.
// Scale 2.00 m reference length to the existing 2.07 m design; preserve all exterior dimensions.
const rigScale=2.07/2,seg=.06*rigScale;
const hj=Array.from({length:6},(_,i)=>(.03-i*.06)*rigScale);
const tj=Array.from({length:4},(_,i)=>(.047+i*.06)*rigScale);
const kj=[.55,.61].map(v=>v*rigScale);
let transforms=[];
const smooth=(a,b,v)=>{const t=T.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
function chain(prev,p,a){const c=Math.cos(prev.a),s=Math.sin(prev.a),ca=Math.cos(a),sa=Math.sin(a);const dz=p*(1-ca),dy=-p*sa;return {a:prev.a+a,z:prev.z+c*dz-s*dy,y:prev.y+s*dz+c*dy};}
function recurve(){transforms=[{a:0,z:0,y:0}];let m=transforms[0];for(const p of hj){m=chain(m,p,-T.MathUtils.degToRad(current.head)/6);transforms.push(m)}m=transforms[0];for(const p of tj){m=chain(m,p,T.MathUtils.degToRad(current.leg)/4);transforms.push(m)}for(const p of kj){m=chain(m,p,-T.MathUtils.degToRad(current.leg)*.85/2);transforms.push(m)}}
function computeWeights(z){const h=hj.map(p=>smooth(0,seg,p-z)).concat(0),c=kj.map(p=>smooth(0,seg,z-p)).concat(0),t=tj.map(p=>smooth(0,seg,z-p)).concat(c[0]);return [Math.max(0,1-h[0]-t[0]),...h.slice(0,6).map((v,i)=>v-h[i+1]),...t.slice(0,4).map((v,i)=>v-t[i+1]),...c.slice(0,2).map((v,i)=>v-c[i+1])];}
const weightCache=new Map();
function weights(z){let w=weightCache.get(z);if(!w){w=computeWeights(z);weightCache.set(z,w)}return w}
function deform(z,offset=0){let zz=0,yy=0,ss=0,cc=0;const w=weights(z);for(let i=0;i<w.length;i++){const m=transforms[i],c=Math.cos(m.a),s=Math.sin(m.a);zz+=w[i]*(m.z+c*z-s*offset);yy+=w[i]*(m.y+s*z+c*offset);ss+=w[i]*s;cc+=w[i]*c}return {z:zz,y:yy,a:Math.atan2(ss,cc)}}
function at(z){return deform(z)}
let ueMoving=[],ueNames=[];
function updateBed(){
 const h0=Math.floor(current.head/10)*10,l0=Math.floor(current.leg/10)*10,h1=Math.min(60,h0+10),l1=Math.min(40,l0+10),fh=(current.head-h0)/10,fl=(current.leg-l0)/10;
 for(const o of ueMoving){o.morphTargetInfluences.fill(0);for(const [h,l,w] of [[h0,l0,(1-fh)*(1-fl)],[h1,l0,fh*(1-fl)],[h0,l1,(1-fh)*fl],[h1,l1,fh*fl]]){const n=`h${String(h).padStart(2,'0')}_l${String(l).padStart(2,'0')}`,i=ueNames.indexOf(n);if(i>=0)o.morphTargetInfluences[i]+=w;}}
 document.getElementById('hv').textContent=Math.round(target.head)+'°';document.getElementById('lv').textContent=Math.round(target.leg)+'°';
}
let terraceTick=()=>{};
async function addTerrace(room) {
 const trim=mat('#a7957d',.44,.48);
 room.traverse(o=>{
  if(!o.isMesh)return;
  const slot=Number(o.material.name?.match(/^MacMat_(\d+)$/)?.[1]);
  if(slot>=30 && slot<=43 || slot===46 || slot===47)o.visible=false;
 });
 // The room has two glazed elevations meeting at (-3.5, 4).
 for(const z of [-4,0,4])box(.042,3,.032,trim,[-3.49,1.5,z]);
 const clearGlass=new T.MeshPhysicalMaterial({color:'#dee9e5',transparent:true,opacity:.047,roughness:.08,depthWrite:false});
 function sash(x,width,z){
  const group=new T.Group();group.position.set(x,0,z);scene.add(group);
  for(const end of [-1,1])box(.046,2.94,.044,trim,[end*(width-.046)/2,1.5,0],.004,group);
  for(const y of [.052,2.948])box(width,.044,.044,trim,[0,y,0],.004,group);
  const pane=box(width-.092,2.85,.012,clearGlass,[0,1.5,0],0,group);
  pane.castShadow=false;return group;
 }
 sash(-2.33,2.34,4.015);sash(2.33,2.34,4.015);
 const door=sash(0,2.37,3.948);
 for(const z of [3.948,4.015])for(const y of [.018,2.985])box(7,.024,.036,trim,[0,y,z]);
 for(const y of [.035,2.96])box(.04,.032,8,trim,[-3.49,y,0]);
 const ray=new T.Raycaster(),canvas=renderer.domElement;
 let start=null,open=false;
 canvas.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{
  if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;
  const rect=canvas.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);
  const hit=ray.intersectObjects(scene.children,true).find(h=>h.object.visible&&h.object.isMesh);
  if(hit?.object.parent===door)open=!open;
 });
 terraceTick=dt=>{
  const x=T.MathUtils.damp(door.position.x,open?-2.26:0,6,dt);
  if(Math.abs(x-door.position.x)>.00001){door.position.x=x;renderer.shadowMap.needsUpdate=true;}
 };
 const teak=mat('#ba9874',.78);
 teak.map=await tex('M_Walnut.jpg',3,1);
 const joint=mat('#514739',.92);
 box(8.8,.14,1.8,joint,[-.9,-.12,4.9]);
 box(1.8,.14,8,joint,[-4.4,-.12,0]);
 for(let i=0;i<12;i++){
  box(8.8,.035,.146,teak,[-.9,-.04,4.075+i*.15]);
  box(.146,.035,8,teak,[-3.575-i*.15,-.04,0]);
 }
 const glass=new T.MeshPhysicalMaterial({color:'#d2e1da',transparent:true,opacity:.07,roughness:.08,metalness:.08,depthWrite:false});
 const edge=mat('#85aaa4',.24,.18), rail=mat('#a79983',.32,.63);
 function balustrade(x,z,length,alongX){
  const run=new T.Group();scene.add(run);run.position.set(x,0,z);
  if(!alongX)run.rotation.y=-Math.PI/2;
  const count=Math.ceil(length/1.65), span=length/count;
  box(length,.09,.09,rail,[length/2,.025,0],.008,run);
  box(length,.055,.065,rail,[length/2,1.14,0],.014,run);
  for(let i=0;i<count;i++){
   const pane=box(span-.018,1.05,.016,glass,[(i+.5)*span,.59,0],0,run);
   pane.castShadow=false;
   box(.008,1.05,.017,edge,[i*span+.009,.59,0],0,run);
  }

 }
 balustrade(-5.28,5.78,8.78,true);balustrade(-5.28,-4,9.78,false);
 balustrade(3.5,4,1.78,false);balustrade(-5.28,-4,1.78,true);
 // A small seating area off the fixed pane leaves the sliding doorway clear.
 const setting=await terraceReady;
 setting.scene.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 // 베란다 의자 두 개는 밖이 아니라 가운데 탁자를 보게 돌린다
 for(const [name,a] of [['modern_arm_chair_01',Math.PI/2],['modern_arm_chair_01.001',-Math.PI/2]]){const c=setting.scene.getObjectByName(name.replace('.',''))||setting.scene.getObjectByName(name);if(c)c.rotation.y+=a;}
 scene.add(setting.scene);
 const linen=mat('#eee7da',.98);
 linen.map=await tex('M_Curtain.jpg',1,2);linen.side=T.DoubleSide;
 function panel(x,z,rotation,side){
  const geo=new T.PlaneGeometry(1,1,120,48),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
   const u=pos.getX(i)+.5,v=pos.getY(i)+.5,drop=1-v;
   const phase=2*Math.PI*(4.4*u+.14*Math.sin(7*u)+drop*(.12+.16*Math.sin(8*u+rotation)));
   const width=.54+.17*drop+.045*Math.sin(drop*3.7);
   const depth=(.044+.022*drop)*Math.cos(phase)+.024*Math.sin(phase*2+.4)+.018*drop*Math.sin(11*u);
   pos.setXYZ(i,side*(u*width+.018*drop*Math.sin(phase)),.042+2.90*v+drop**4*(.019*Math.sin(phase)+.013*Math.sin(u*13)),depth);
  }
  geo.computeVertexNormals();mesh(geo,linen,[x,0,z]).rotation.y=rotation;
 }
 box(7,.035,.045,trim,[0,2.96,3.81]);box(.045,.035,8,trim,[-3.31,2.96,0]);
 panel(3.47,3.81,0,-1);panel(-3.33,3.81,0,1);
 panel(-3.31,-3.97,Math.PI/2,-1);panel(-3.31,3.78,Math.PI/2,1);
}

let terraceReady;
async function build(){
 const rowsReady=fetch('assets/materials.json').then(r=>r.json());
 const materialsReady=rowsReady.then(rows=>Promise.all([...new Set([
  ...rows.map(r=>r.map).filter(Boolean),
  'wool_boucle_nor.jpg','jersey_melange_nor.jpg','waffle_pique_cotton_nor.jpg',
  'modern_arm_chair_01_legs.jpg','potted_plant_02_pot.jpg','potted_plant_02_leaves.jpg',
  'potted_plant_02_leaves_a.jpg','M_Walnut.jpg','M_Curtain.jpg','M_Floor.jpg'
 ])].map(name=>{const url=(window.ASSETS&&window.ASSETS[name])||'assets/'+name;
  if(!textureDownloads.has(url))textureDownloads.set(url,tl.loadAsync(url));return textureDownloads.get(url);})));
 materialsReady.catch(console.error);
 terraceReady=new GLTFLoader().loadAsync('assets/TerraceBistro.glb');
 terraceReady.catch(console.error);

 const parkReady=addPark(scene);
 const teaReady=new GLTFLoader().loadAsync('assets/tea-table.glb');
 const frameReady=new GLTFLoader().loadAsync('assets/hollow-frame.glb');
 const quiltReady=new GLTFLoader().loadAsync('assets/quilt-surface.glb?v=rounded-rim');
 const skyReady=new T.TextureLoader().loadAsync('assets/ClearDaySky.jpg');
 Promise.all([parkReady,teaReady,frameReady,quiltReady,skyReady]).catch(console.error);
 const [gltf,rows,names]=await Promise.all([new GLTFLoader().loadAsync('assets/suite.glb?v=fold2'),rowsReady,fetch('assets/morph-names.json').then(r=>r.json())]);
 ueNames=names;
 const materialMap=new Map();
 const normals={'p_boucle.jpg':['wool_boucle_nor.jpg',8,8,.24],'p_knit.jpg':['jersey_melange_nor.jpg',12,12,.18],'p_top.jpg':['waffle_pique_cotton_nor.jpg',12,16,.23],'p_pillow.jpg':['waffle_pique_cotton_nor.jpg',10,10,.12]};
 await Promise.all(rows.map(async r=>{const m=r.map==='view.jpg'?new T.MeshBasicMaterial({side:T.DoubleSide}):new T.MeshStandardMaterial({roughness:r.roughness??.85,metalness:r.metalness??0,envMapIntensity:.45});m.color.setRGB(...r.color);if(r.map){m.map=await tex(r.map,...(r.repeat||[1,1]));m.map.flipY=false;}if(normals[r.map]){const [n,x,y,k]=normals[r.map];m.normalMap=await tex(n,x,y,true);m.normalMap.flipY=false;m.normalScale.set(k,k);}if(r.map?.includes('leaves')){m.alphaMap=await tex('potted_plant_02_leaves_a.jpg',1,1,true);m.alphaTest=.45;m.side=T.DoubleSide;}materialMap.set(r.name,m);}));
 // Keep the timber grain and cast shadows, with a fully diffuse finish.
 const panel=materialMap.get('MacMat_004');
 materialMap.set('MacMat_004',new T.MeshLambertMaterial({color:panel.color,map:panel.map}));
 for(const name of ['modern_arm_chair_01_legs','potted_plant_02_pot','potted_plant_02_leaves']){
  const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.75});m.map=await tex(name+'.jpg');m.map.flipY=false;
  if(name.includes('leaves')){m.alphaMap=await tex(name+'_a.jpg',1,1,true);m.alphaMap.flipY=false;m.alphaTest=.45;m.side=T.DoubleSide;}
  materialMap.set(name,m);
 }
 const tea=await teaReady;
 tea.scene.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(tea.scene);
 await addTerrace(gltf.scene);
 const moving=[];
 // Replace the solid plinth with the hollow chassis exported from Unreal.
 gltf.scene.traverse(o=>{if(!o.isMesh)return;const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.some(m=>['MacMat_049','MacMat_085','MacMat_086','MacMat_087','MacMat_088','MacMat_089','MacMat_090'].includes(m.name)))o.visible=false;});
 const frame=await frameReady;
 // Rebuild the chassis rails with a radiused section and satin graphite coating.
 const graphite=mat('#474b49',.67,.16);
 frame.scene.traverse(o=>{
  if(o.isMesh && o.material.name==='MacMat_058')o.visible=false;
 });
 for(const z of [.422,1.978])box(2.02,.060,.042,graphite,[2.18,.235,z],.009);
 for(const x of [1.982,2.390])box(.046,.056,1.54,graphite,[x,.237,1.2],.010);
 frame.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;const convert=m=>materialMap.get(m.name)||m;o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});
 scene.add(frame.scene);
 // Conceal the original bright strips behind architectural light fittings.
 const stripMaterials=[materialMap.get('MacMat_005'),materialMap.get('MacMat_091')];
 gltf.scene.traverse(o=>{if(o.isMesh && stripMaterials.includes(o.material))o.visible=false;});
 const champagne=mat('#8b7457',.53,.28);
 const covePaint=mat('#d8cebc',.89);
 // A ceiling pocket with a raised room-facing lip hides the upward diffuser.
 box(.18,.036,7.6,covePaint,[3.398,2.900,0],.004);
 box(.019,.062,7.6,covePaint,[3.316,2.917,0],.004);
 box(.037,.005,7.48,emit,[3.403,2.920,0],.002);
 // A short wall-mounted hood above the headboard, with a recessed underside.
 box(.044,.073,1.48,champagne,[3.396,1.755,1.2],.008);
 box(.106,.032,1.52,champagne,[3.364,1.782,1.2],.008);
 box(.014,.047,1.52,champagne,[3.316,1.775,1.2],.005);
 box(.033,.006,1.43,emit,[3.344,1.763,1.2],.002);
 for(const z of [.81,1.59]){
  const wash=new T.SpotLight('#ffe0a5',1.8,1.15,1.17,.95,2);
  wash.position.set(3.347,1.756,z);
  wash.target.position.set(3.422,1.47,z);
  scene.add(wash,wash.target);
 }
 for(const z of [-2.7,-.9,.9,2.7]){
  const uplight=new T.PointLight('#ffe5bd',.38,1.25,2);
  uplight.position.set(3.41,2.947,z);
  scene.add(uplight);
 }
 // Clevis brackets on the two crossmembers capture the fixed ends of the lift arms.
 const bracket=materialMap.get('MacMat_058');
 for(const x of [1.982,2.390])for(const z of [.52,1.88]){
  box(.038,.014,.065,bracket,[x,.265,z],.003);
  for(const side of [-1,1]){
   box(.038,.037,.008,bracket,[x,.282,z+side*.021],.003);
  }
  const axle=cylinder(.009,.009,.057,bracket,[x,.280,z]);
  axle.rotation.x=Math.PI/2;
 }

 gltf.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;const convert=m=>materialMap.get(m.name)||m;o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);if(o.morphTargetInfluences)moving.push(o);});
 for(const old of moving){
  // Exported vertices already contain the full bed placement. The single root
  // skin is redundant; retain the 34 morphs and apply only the known Z reflection.
  const g=old.geometry.clone();g.scale(1,1,-1);
  for(const attrs of Object.values(g.morphAttributes))for(const attr of attrs)for(let i=0;i<attr.count;i++)attr.setZ(i,-attr.getZ(i));
  if(old.material===materialMap.get('MacMat_057')){old.removeFromParent();continue;}
  const idx=g.index;if(idx)for(let i=0;i<idx.count;i+=3){const v=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,v);}
  g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');
  const mesh=new T.Mesh(g,old.material);mesh.name=old.name;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;old.removeFromParent();scene.add(mesh);ueMoving.push(mesh);
 }
 const quilt=await quiltReady;
 quilt.scene.scale.z=-1;
 quilt.scene.traverse(o=>{if(o.isMesh){o.material=materialMap.get('MacMat_057');o.castShadow=o.receiveShadow=true;ueMoving.push(o);}});
 scene.add(quilt.scene);
 scene.add(gltf.scene);
 // Distant scenery stays on the horizon as the camera moves around the suite.
 // 창밖: 가정용 하늘 + 도심 고층 빌딩 사진 + 그 앞 3D 시티파크
 const skyPhoto=await skyReady;
 skyPhoto.colorSpace=T.SRGBColorSpace;
 skyPhoto.mapping=T.EquirectangularReflectionMapping;
 scene.background=skyPhoto;
 scene.backgroundIntensity=1.25;
 scene.fog=new T.Fog('#bcd0d6',450,2800);
 parkTick=await parkReady;
 gltf.scene.traverse(o=>{
  if(o.isMesh && (o.material===materialMap.get('MacMat_044') || o.material===materialMap.get('MacMat_045')))o.visible=false;
 });


 const hemi=new T.HemisphereLight('#e0efff','#c1a789',.91);scene.add(hemi);
 const sun=new T.DirectionalLight('#ffe7bf',4.7);sun.position.set(-3,4.8,8);sun.target.position.set(1,0,0);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:22});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
 for(const z of [-.25,2.65]){const l=new T.PointLight('#ffe1ac',3.65,3.2,2);l.position.set(3,1,z);scene.add(l);}
 const fill=new T.DirectionalLight('#e0edff',.85);fill.position.set(-4,2,-1);scene.add(fill);
 if(q.has('noshadows')) renderer.shadowMap.enabled=false;
 // Replace the six baked drawer, stone cap and handle primitives.
 const oldCabinets=new Set(['070','071','072','076','077','078'].map(id=>materialMap.get('MacMat_'+id)));
 gltf.scene.traverse(o=>{if(o.isMesh && oldCabinets.has(o.material))o.visible=false;});
 const oak=mat('#dfc3a0',.74);
 oak.map=await tex('M_Floor.jpg',1,1);
 const recess=mat('#55463a',.89);
 for(const z of [-.22,2.62]){
  const x=3.05;
  // Recessed toe kick supports a pair of flush, bookmatched drawer fronts.
  box(.43,.055,.53,recess,[x,.0275,z],.009);
  box(.52,.553,.64,oak,[x,.3315,z],.024);
  box(.018,.499,.603,recess,[2.787,.33,z],.008);
  for(const [bottom,height] of [[.084,.265],[.362,.214]]){
   box(.028,height,.602,oak,[2.773,bottom+height/2,z],.007);
  }
  box(.53,.019,.65,oak,[x,.605,z],.009);
 }
 updateBed();renderer.shadowMap.needsUpdate=true;window.uePreview={scene,camera,controls,current,target,ueMoving,ueNames};requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector('#loading').hidden=true;performance.mark('scene-visible');}));
}
document.querySelector('#pillows').onclick=e=>{let v=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',v);pillows.forEach(p=>p.group.visible=v)};
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
composer.addPass(new OutputPass());composer.addPass(new SMAAPass(innerWidth,innerHeight));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});
const remote=initConsole({current,target});const boardLink=initBoardLink({current,target});initPressure({remote,link:boardLink});
// 침대 속도는 초당 6도, 0.25초에 걸쳐 빨라지고 느려진다
function motionProfile(d){const speed=6,ramp=.25,a=speed/ramp;if(d<=speed*ramp){const th=Math.sqrt(d/a);return {total:2*th,at:t=>t<th?.5*a*t*t:d-.5*a*(2*th-t)**2}}const total=d/speed+ramp;return {total,at:t=>t<ramp?.5*a*t*t:t<total-ramp?.5*speed*ramp+speed*(t-ramp):d-.5*a*(total-t)**2}}
let last=performance.now(),journey=null;
let drawnHead=NaN,drawnLeg=NaN;
renderer.setAnimationLoop(t=>{
 if(parkTick)parkTick(camera);
 const dt=Math.min((t-last)/1000,.05);last=t;
 remote.tick(dt);terraceTick(dt);
 if(!journey||journey.to.head!==target.head||journey.to.leg!==target.leg){const distance=Math.max(Math.abs(target.head-current.head),Math.abs(target.leg-current.leg));journey={from:{...current},to:{...target},start:t,distance,profile:motionProfile(distance)}}
 if(remote.jogging()){Object.assign(current,target);journey=null;}else if(journey.distance){const sec=Math.min(journey.profile.total,(t-journey.start)/1000),k=sec>=journey.profile.total?1:journey.profile.at(sec)/journey.distance;for(const part of ['head','leg'])current[part]=journey.from[part]+(journey.to[part]-journey.from[part])*k;}
 if(ueMoving.length&&(current.head!==drawnHead||current.leg!==drawnLeg)){updateBed();drawnHead=current.head;drawnLeg=current.leg;renderer.shadowMap.needsUpdate=true;}controls.update();camera.position.x=T.MathUtils.clamp(camera.position.x,-3.38,3.35);camera.position.z=T.MathUtils.clamp(camera.position.z,-3.88,3.88);camera.position.y=T.MathUtils.clamp(camera.position.y,.25,2.85);composer.render();
});
build().catch(e=>{document.querySelector('#error').textContent=e.message;console.error(e)});
