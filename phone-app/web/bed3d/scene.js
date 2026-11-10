// 앱 홈 사진 칸의 3D 침대. GoodNight/unreal-web-suite/preview-1102/scene.js의 방·침대·조명을 그대로 쓰고,
// 조작판·둘러보기를 빼고 시점을 "침대 옆"에 고정해 침대 쪽으로 확대했다.
// 앱이 window.setBed(머리, 다리)로 지금 각도를 보내면 그 각도로 침대 모양만 바꾼다(움직임 시간·곡선은 앱이 정한다).
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const q = new URLSearchParams(location.search);
const canvas = document.querySelector('canvas');
const scene = new T.Scene(); scene.background = new T.Color('#d8ded9');
const renderer = new T.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92; renderer.outputColorSpace = T.SRGBColorSpace;

// 시점: 시안의 "침대 옆"과 같은 자리·방향. 화각만 좁혀 침대를 크게 본다(FOV, 주소의 fov=로 바꿔 볼 수 있다)
const EYE = [-0.9757, 2.85, -0.669], LOOK = [2.6, 0.8, 1.2];
const FOV = Number(q.get('fov')) || 40;
const camera = new T.PerspectiveCamera(FOV, innerWidth / innerHeight, .04, 100);
// 시점을 침대 쪽 한 점(LOOK)을 축으로 옆으로 돌린다(도, 주소의 turn=으로 바꿔 볼 수 있다)
const TURN = Number(q.get('turn') ?? -40);
{
  const look = new T.Vector3(...LOOK), eye = new T.Vector3(...EYE).sub(look);
  eye.applyAxisAngle(new T.Vector3(0, 1, 0), T.MathUtils.degToRad(TURN));
  camera.position.copy(look).add(eye); camera.lookAt(look);
}

const pmrem = new T.PMREMGenerator(renderer), roomEnv = new RoomEnvironment(renderer);
scene.environment = pmrem.fromScene(roomEnv, .04).texture; roomEnv.dispose(); pmrem.dispose();
const tl = new T.TextureLoader();
async function tex(name, rx = 1, ry = rx, data = false) {
  const t = await tl.loadAsync('assets/' + name);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = data ? T.NoColorSpace : T.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}

const current = {head: T.MathUtils.clamp(Number(q.get('head')) || 0, 0, 60), leg: T.MathUtils.clamp(Number(q.get('leg')) || 0, 0, 40)};
let ueMoving = [], ueNames = [], dirty = true;

// 침대 모양: 머리 10도·다리 10도 간격으로 언리얼에서 만든 모양 중 가까운 네 개를 섞는다.
// 섞기는 그래픽 칩(모양 섞기 텍스처) 대신 여기서 정점 값을 직접 계산한다: 갤럭시 웹 화면에서는
// 정점이 많은 덩어리(매트리스·몸판)의 그래픽 칩 섞기가 먹지 않아 틀만 움직였다
function updateBed() {
  const h0 = Math.min(50, Math.floor(current.head / 10) * 10), l0 = Math.min(30, Math.floor(current.leg / 10) * 10);
  const h1 = h0 + 10, l1 = l0 + 10, fh = (current.head - h0) / 10, fl = (current.leg - l0) / 10;
  const mix = [];
  for (const [h, l, w] of [[h0, l0, (1 - fh) * (1 - fl)], [h1, l0, fh * (1 - fl)], [h0, l1, (1 - fh) * fl], [h1, l1, fh * fl]]) {
    const i = ueNames.indexOf(`h${String(h).padStart(2, '0')}_l${String(l).padStart(2, '0')}`);
    if (i >= 0 && w > 1e-4) mix.push([i, w]);
  }
  for (const o of ueMoving) {
    const b = o.userData.blend;
    for (const [attr, base, targets] of [[o.geometry.attributes.position, b.pos, b.posM], [o.geometry.attributes.normal, b.nor, b.norM]]) {
      if (!attr || !targets) continue;
      const out = attr.array;
      out.set(base);
      for (const [i, w] of mix) {
        const t = targets[i];
        if (b.rel) for (let j = 0; j < out.length; j++) out[j] += w * t[j];
        else for (let j = 0; j < out.length; j++) out[j] += w * (t[j] - base[j]);
      }
      attr.needsUpdate = true;
    }
  }
}

// 앱이 부른다. 움직임은 여기서 직접 그린다(앱이 매 장면 각도를 보내면 안드로이드에서 끊긴다)
const clampA = (h, l) => [T.MathUtils.clamp(Number(h) || 0, 0, 60), T.MathUtils.clamp(Number(l) || 0, 0, 40)];
let move = null, hold = null, moving = false;
// 그 각도로 바로(멈춤·연결 끊김·처음)
window.setBed = (head, leg) => {
  const [h, l] = clampA(head, leg); move = hold = null;
  if (h === current.head && l === current.leg && !moving) return;
  current.head = h; current.leg = l; dirty = true;
};
// 그 각도까지 ms 동안 앱과 같은 곡선(이차 ease-in-out)으로
window.moveBed = (head, leg, ms) => {
  const [h, l] = clampA(head, leg); hold = null;
  move = {from: {...current}, to: {head: h, leg: l}, t0: performance.now(), dur: Math.max(1, Number(ms) || 1)};
};
// ±를 누르는 동안: 그 부분을 1초에 15도씩
window.holdBed = (part, dir) => { move = null; hold = {part: part === 'head' ? 'head' : 'leg', dir: dir < 0 ? -1 : 1, last: performance.now()}; };

async function build() {
  const [gltf, rows, names] = await Promise.all([
    new GLTFLoader().loadAsync('assets/suite.glb'),
    fetch('assets/materials.json').then((r) => r.json()),
    fetch('assets/morph-names.json').then((r) => r.json()),
  ]);
  ueNames = names;
  const materialMap = new Map();
  const normals = {'p_boucle.jpg': ['wool_boucle_nor.jpg', 8, 8, .24], 'p_knit.jpg': ['jersey_melange_nor.jpg', 12, 12, .18], 'p_top.jpg': ['waffle_pique_cotton_nor.jpg', 12, 16, .23], 'p_pillow.jpg': ['waffle_pique_cotton_nor.jpg', 10, 10, .12]};
  for (const r of rows) {
    const m = r.map === 'view.jpg' ? new T.MeshBasicMaterial({side: T.DoubleSide}) : new T.MeshStandardMaterial({roughness: r.roughness ?? .85, metalness: r.metalness ?? 0, envMapIntensity: .45});
    m.color.setRGB(...r.color);
    if (r.map) { m.map = await tex(r.map, ...(r.repeat || [1, 1])); m.map.flipY = false; }
    if (normals[r.map]) { const [n, x, y, k] = normals[r.map]; m.normalMap = await tex(n, x, y, true); m.normalMap.flipY = false; m.normalScale.set(k, k); }
    if (r.map?.includes('leaves')) { m.alphaMap = await tex('potted_plant_02_leaves_a.jpg', 1, 1, true); m.alphaTest = .45; m.side = T.DoubleSide; }
    materialMap.set(r.name, m);
  }
  for (const name of ['modern_arm_chair_01_legs', 'potted_plant_02_pot', 'potted_plant_02_leaves']) {
    const m = new T.MeshStandardMaterial({color: 0xffffff, roughness: .75}); m.map = await tex(name + '.jpg'); m.map.flipY = false;
    if (name.includes('leaves')) { m.alphaMap = await tex(name + '_a.jpg', 1, 1, true); m.alphaMap.flipY = false; m.alphaTest = .45; m.side = T.DoubleSide; }
    materialMap.set(name, m);
  }
  const tea = await new GLTFLoader().loadAsync('assets/tea-table.glb');
  tea.scene.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); scene.add(tea.scene);
  // 꽉 찬 받침 대신 언리얼에서 내보낸 속이 빈 틀
  gltf.scene.traverse((o) => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; if (ms.some((m) => ['MacMat_049', 'MacMat_085', 'MacMat_086', 'MacMat_087'].includes(m.name))) o.visible = false; });
  const frame = await new GLTFLoader().loadAsync('assets/hollow-frame.glb');
  frame.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; const convert = (m) => materialMap.get(m.name) || m; o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material); });
  scene.add(frame.scene);
  const moving = [];
  gltf.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; o.frustumCulled = false; const convert = (m) => materialMap.get(m.name) || m; o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material); if (o.morphTargetInfluences) moving.push(o); });
  for (const old of moving) {
    const g = old.geometry.clone(); g.scale(1, 1, -1);
    for (const attrs of Object.values(g.morphAttributes)) for (const attr of attrs) for (let i = 0; i < attr.count; i++) attr.setZ(i, -attr.getZ(i));
    const idx = g.index; if (idx) for (let i = 0; i < idx.count; i += 3) { const v = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, v); }
    g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight');
    // 모양 섞기 자료를 떼어 두고(위 updateBed가 직접 섞는다) 그래픽 칩 섞기는 끈다
    const blend = {
      rel: g.morphTargetsRelative,
      pos: g.attributes.position.array.slice(), posM: g.morphAttributes.position?.map((a) => a.array.slice()),
      nor: g.attributes.normal?.array.slice(), norM: g.morphAttributes.normal?.map((a) => a.array.slice()),
    };
    g.morphAttributes = {};
    g.attributes.position.setUsage(T.DynamicDrawUsage); g.attributes.normal?.setUsage(T.DynamicDrawUsage);
    const mesh = new T.Mesh(g, old.material); mesh.userData.blend = blend; mesh.name = old.name; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; old.removeFromParent(); scene.add(mesh); ueMoving.push(mesh);
  }
  scene.add(gltf.scene);
  const hemi = new T.HemisphereLight('#dce6ec', '#a99578', .65); scene.add(hemi);
  const sun = new T.DirectionalLight('#ffecd0', 2.6); sun.position.set(-6, 4, 7); sun.target.position.set(1, 0, 0); sun.castShadow = true;
  // 폰이라 그림자 지도를 4096에서 2048로 줄인다
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 22}); sun.shadow.normalBias = .025; sun.shadow.bias = -.00015; scene.add(sun, sun.target);
  for (const z of [-.25, 2.65]) { const l = new T.PointLight('#ffdb9f', 2.4, 2.5, 2); l.position.set(3, 1, z); scene.add(l); }
  const fill = new T.DirectionalLight('#e3ecf0', 1.1); fill.position.set(-4, 2, -1); scene.add(fill);
  updateBed(); renderer.shadowMap.needsUpdate = true; dirty = true;
  window.bed3d = {ueMoving, current};
  canvas.classList.add('ready');
  window.ReactNativeWebView?.postMessage('ready');
}

const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const ao = new SSAOPass(scene, camera, innerWidth, innerHeight, 8); ao.kernelRadius = .12; ao.minDistance = .002; ao.maxDistance = .22; composer.addPass(ao);
composer.addPass(new OutputPass()); composer.addPass(new SMAAPass(innerWidth, innerHeight));
if (q.has('lite')) ao.enabled = false;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); dirty = true; });

// 시점이 고정이라 침대가 바뀔 때만 다시 그린다(가만히 있을 때는 그리지 않아 배터리를 아낀다).
// 움직이는 동안은 구석 어둡게 하기(SSAO)를 끄고, 멈추면 켜서 한 번 제대로 그린다
renderer.setAnimationLoop(() => {
  const t = performance.now();
  if (move) {
    const k = Math.min(1, (t - move.t0) / move.dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    current.head = move.from.head + (move.to.head - move.from.head) * e; current.leg = move.from.leg + (move.to.leg - move.from.leg) * e;
    if (k >= 1) move = null;
    dirty = true;
  } else if (hold) {
    const lim = hold.part === 'head' ? 60 : 40;
    current[hold.part] = T.MathUtils.clamp(current[hold.part] + hold.dir * 15 * (t - hold.last) / 1000, 0, lim); hold.last = t;
    if (current[hold.part] <= 0 || current[hold.part] >= lim) hold = null;
    dirty = true;
  }
  const busy = !!(move || hold);
  if (!dirty || !ueMoving.length) return;
  if (!q.has('lite')) ao.enabled = !busy;
  moving = busy;
  dirty = false; updateBed(); renderer.shadowMap.needsUpdate = true; composer.render();
  if (window.bed3d) window.bed3d.frames = (window.bed3d.frames || 0) + 1;
});
build().catch((e) => { console.error(e); window.ReactNativeWebView?.postMessage('error:' + e.message); });
