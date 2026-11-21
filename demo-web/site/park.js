// 가정용 창밖 시티파크. 병상용과 같은 나무 그림(Poly Haven CC0 스캔 나무를 블렌더에서 렌더)을 쓰되 배치는 다르게:
// 집 앞 가로수 길, 정원(화단 격자와 분수), 큰 잔디밭과 그 둘레 산책 고리, 멀리 가로지르는 가로수 대로
import * as T from 'three';

const GROUND = -34; // 방 바닥에서 땅까지(약 34m 아래, 11층 높이)
const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const V = (x, z) => new T.Vector3(x, 0, z);

// 기본 시점(침대 정면)이 바라보는 방향은 (0.29, 0.96). 그쪽에 잔디밭, 오른쪽 앞에 정원
const LAWN = { x: -48, z: 74, rx: 24, rz: 13 };
const GARDEN = { x: 22, z: 82, w: 40, d: 22 };
function ellipse(cx, cz, rx, rz, n = 80) { const p = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); } return p; }
const PATHS = [
  { pts: [[-900, 17], [-300, 17], [0, 17], [300, 17], [900, 17]], w: 8, avenue: true },          // 집 앞 가로수 길
  { pts: [[-17, -900], [-17, -300], [-17, 17]], w: 8, avenue: true },                             // 옆 가로수 길
  { pts: [[-4, 21], [8, 90], [16, LAWN.z - LAWN.rz - 3]], w: 6 },                               // 잔디밭으로 들어가는 길
  { pts: ellipse(LAWN.x, LAWN.z, LAWN.rx + 4, LAWN.rz + 4), w: 5, closed: true },                 // 잔디밭 둘레
  { pts: [[GARDEN.x, 21], [GARDEN.x, GARDEN.z - 13]], w: 5 },
  { pts: [[GARDEN.x + 13, GARDEN.z], [190, 120], [260, 200], [300, 300], [270, 380]], w: 5 },
  { pts: [[LAWN.x - LAWN.rx - 4, LAWN.z], [-160, 250], [-260, 210], [-380, 120], [-420, 17]], w: 5 },
  { pts: [[LAWN.x, LAWN.z + LAWN.rz + 4], [0, 345]], w: 5 },
  { pts: [[-300, 17], [-330, 80], [-300, 150], [-260, 210]], w: 4 },
  { pts: [[-17, -200], [-120, -180], [-260, -120], [-420, -40], [-560, 17]], w: 5 },
];
function sample(pts, closed, step = 3) {
  const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => V(x, z)), !!closed, 'centripetal');
  return curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / step)));
}
const PATH_POINTS = PATHS.map(p => ({ ...p, pts: sample(p.pts, p.closed) }));
const CITY_MID = Math.atan2(.29, .96) - .44; // 도시 사진 가운데 방향
const inBuilding = (x, z) => x > -9 && z < 9;
const inLawn = (x, z, pad = 0) => ((x - LAWN.x) / (LAWN.rx + pad)) ** 2 + ((z - LAWN.z) / (LAWN.rz + pad)) ** 2 < 1;
const inGarden = (x, z, pad = 0) => Math.hypot(x - GARDEN.x, z - GARDEN.z) < 14 + pad;
function clearance(x, z) {
  let d = 1e9;
  for (const p of PATH_POINTS) for (const q of p.pts) d = Math.min(d, Math.hypot(x - q.x, z - q.z) - p.w / 2);
  return d;
}

function onLawnShader(m, body) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vW;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int k=0;k<4;k++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + body);
  };
  m.customProgramCacheKey = () => body;
  return m;
}
// 잔디: 넓은 얼룩 + 잔 얼룩, 큰 잔디밭 안쪽만 깎은 줄무늬(병상용은 전체 사선 줄무늬)
function lawnMaterial() {
  return onLawnShader(new T.MeshStandardMaterial({ color: '#3c6a24', roughness: 1, envMapIntensity: .25 }), `{ vec2 p=vW.xz;
  float big=fbm(p*.011), mid=fbm(p*.06), fine=vn(p*1.6);
  vec2 e=(p-vec2(${LAWN.x}.,${LAWN.z}.))/vec2(${LAWN.rx}.,${LAWN.rz}.);
  float inLawn=1.-smoothstep(.96,1.,dot(e,e));
  float stripe=step(.5,fract(p.x/7.))*.11*inLawn;
  vec3 c=diffuseColor.rgb*(.6+.5*big+.24*mid+.14*fine+stripe);
  c=mix(c,c*vec3(1.1,1.05,.8),smoothstep(.56,.82,big)*.45*(1.-inLawn));
  c=mix(vec3(dot(c,vec3(.3,.59,.11))),c,.85)*.85;
  diffuseColor.rgb=c; }`);
}
function flowerMaterial(a, b, base = [.2, .33, .13]) {
  const ca = new T.Color(a).toArray().join(','), cb = new T.Color(b).toArray().join(',');
  return onLawnShader(new T.MeshStandardMaterial({ color: '#ffffff', roughness: .9, envMapIntensity: .3 }), `{ vec2 g=floor(vW.xz*3.2); float r=hsh(g);
  vec3 flower=mix(vec3(${ca}),vec3(${cb}),step(.68,r));
  diffuseColor.rgb=mix(vec3(${base.join(',')}),flower,step(.22,r)); }`);
}
function ribbon(pts, w) {
  const pos = [], uv = [], idx = []; let along = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new T.Vector3().subVectors(b, a).normalize(), n = new T.Vector3(-t.z, 0, t.x).multiplyScalar(w / 2);
    if (i) along += p.distanceTo(pts[i - 1]);
    pos.push(p.x + n.x, 0, p.z + n.z, p.x - n.x, 0, p.z - n.z); uv.push(0, along / w, 1, along / w);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(.55, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
}

function plant(kinds) {
  const r = rng(20261115), out = [];
  const trees = kinds.map((k, i) => [k, i]).filter(([k]) => k.kind === 'tree').map(([, i]) => i);
  const shrubs = kinds.map((k, i) => [k, i]).filter(([k]) => k.kind === 'shrub').map(([, i]) => i);
  const jac = kinds.map((k, i) => [k, i]).filter(([k]) => k.file.startsWith('jacaranda')).map(([, i]) => i);
  const pick = l => l[Math.floor(r() * l.length)];
  const free = (x, z) => !inBuilding(x, z) && Math.hypot(x, z) > 14 && !inGarden(x, z, 3);
  const ok = (x, z, gap, spacing = 4.5) => free(x, z) && Math.hypot(x, z) > 85 && !inLawn(x, z, 4) && clearance(x, z) > gap && out.every(o => Math.hypot(o.x - x, o.z - z) > spacing);
  // 가로수: 대로·집 앞 길 양옆에 한 종류씩 고르게
  PATH_POINTS.forEach((p, pi) => {
    if (!p.avenue) return;
    const step = 4;
    for (let i = 0; i < p.pts.length; i += step) {
      const a = p.pts[Math.max(0, i - 1)], b = p.pts[Math.min(p.pts.length - 1, i + 1)], q = p.pts[i];
      const t = new T.Vector3().subVectors(b, a).normalize();
      for (const side of [-1, 1]) {
        const x = q.x - t.z * side * (p.w / 2 + 3.5), z = q.z + t.x * side * (p.w / 2 + 3.5);
        if (r() < .3) continue;
        const j = (r() - .5) * 3;
        if (ok(x + j, z + j, 2, 7)) out.push({ x: x + j, z: z + j, s: 1.5 + r() * 1.0, kind: pick(trees) });
      }
    }
  });
  // 잔디밭 안: 큰 나무 몇 그루만(넓게 비워 둠)
  for (const [x, z] of [[-40, 225], [70, 240]]) out.push({ x, z, s: 1.7, kind: pick(trees) });
  // 잔디밭 둘레 보라꽃 나무(자카란다)
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + r() * .1;
    if (Math.sin(a) < -.1 || Math.sin(a) > .5 || Math.abs(Math.cos(a)) < .75) continue; // 창 쪽 반원과 먼 쪽은 비워 잔디밭과 시가지가 보이게
    const x = LAWN.x + Math.cos(a) * (LAWN.rx + 12), z = LAWN.z + Math.sin(a) * (LAWN.rz + 12);
    if (ok(x, z, 2.5, 5)) out.push({ x, z, s: 1.8 + r() * .4, kind: pick(jac) });
  }
  // 정원 둘레 낮은 관목(입구 네 곳은 비움)
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2; if (Math.abs(Math.sin(2 * a)) < .18) continue;
    out.push({ x: GARDEN.x + Math.cos(a) * 14.2, z: GARDEN.z + Math.sin(a) * 14.2, s: .9 + r() * .3, kind: shrubs[i % shrubs.length] });
  }
  // 그 밖 잔디 사이 나무 무리
  for (let c = 0; c < 70; c++) {
    const cx = -820 + r() * 1500, cz = -600 + r() * 1400;
    if (Math.hypot(cx, cz) > 800 || (cx > -20 && cz < 20)) continue;
    // 창 정면(0.29, 0.96) 앞 450m 안은 잔디밭이 보이도록 대부분 비운다
    const off = Math.abs(Math.atan2(cx, cz) - CITY_MID);
    if (off < .92 && Math.hypot(cx, cz) < 800) continue;
    const n = 3 + Math.floor(r() * 9), spread = 8 + r() * 20;
    for (let k = 0; k < n; k++) {
      const x = cx + (r() - .5) * 2 * spread, z = cz + (r() - .5) * 2 * spread;
      if (ok(x, z, 3)) out.push({ x, z, s: 1.7 + r() * 1.1, kind: pick(trees) });
    }
  }
  // 먼 숲 띠: 실사 배경의 시가지 밑동을 초록으로 덮는다
  for (let k = 0; k < 700; k++) {
    const ang = -Math.PI * .75 + r() * Math.PI * 1.2, d = 860 + r() * 200;
    const x = -Math.sin(ang) * d, z = Math.cos(ang) * d;
    if (Math.abs(Math.atan2(x, z) - Math.atan2(.29, .96)) < 1.0) continue;
    if (ok(x, z, 2, 7)) out.push({ x, z, s: 3.2 + r() * 1.6, kind: pick(trees) });
  }
  // 시가지 사진 밑동을 가리는 나무 줄(사진 바로 앞 850~980m)
  for (let k = 0; k < 900; k++) {
    const ang = CITY_MID + (r() - .5) * 1.8, d = 108 + r() * 8;
    const x = Math.sin(ang) * d, z = Math.cos(ang) * d;
    if (ok(x, z, 1, 3 + r() * 3)) out.push({ x, z, s: .9 + r() * .6, kind: pick(r() < .6 ? shrubs : trees) });
  }
  // 사진 양옆 숲(빈 들판이 지평선까지 보이지 않게)
  for (let k = 0; k < 900; k++) {
    const side = r() < .5 ? -1 : 1, ang = CITY_MID + side * (.92 + r() * 1.0), d = 90 + r() * 250;
    const x = Math.sin(ang) * d, z = Math.cos(ang) * d;
    if (ok(x, z, 2, 5 + r() * 4)) out.push({ x, z, s: 1.8 + r() * 1.4, kind: pick(trees) });
  }
  // 길가 관목
  for (const p of PATH_POINTS) for (let i = 2; i < p.pts.length; i += 3) {
    if (r() < .5) continue;
    const a = p.pts[i - 1], b = p.pts[Math.min(p.pts.length - 1, i + 1)], q = p.pts[i];
    const t = new T.Vector3().subVectors(b, a).normalize(), side = r() < .5 ? -1 : 1;
    const x = q.x - t.z * side * (p.w / 2 + 1.5), z = q.z + t.x * side * (p.w / 2 + 1.5);
    if (free(x, z) && !inLawn(x, z, 1) && clearance(x, z) > 1) out.push({ x, z, s: 1.5 + r() * .7, kind: pick(shrubs) });
  }
  return out;
}

export async function addPark(scene, base = 'assets/park/') {
  const tl = new T.TextureLoader();
  const flowersReady=Promise.all(['warm','violet','mixed'].map(n=>tl.loadAsync(base+'bed_'+n+'.jpg?v=2')));
  const cityReady=tl.loadAsync(base+'city-prague.webp?v=2');
  Promise.all([flowersReady,cityReady]).catch(console.error);
  const kinds = await fetch(base + 'trees.json').then(r => r.json());
  const [maps, paving] = await Promise.all([Promise.all(kinds.map(k => tl.loadAsync(base + k.file))), tl.loadAsync(base + 'paving_diff.jpg?v=2')]);
  for (const t of maps) { t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; }
  paving.colorSpace = T.SRGBColorSpace; paving.wrapS = paving.wrapT = T.RepeatWrapping; paving.anisotropy = 8;
  const group = new T.Group(); scene.add(group);
  const ground = new T.Mesh(new T.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2).translate(-300, GROUND, 900), lawnMaterial());
  ground.receiveShadow = true; group.add(ground);
  const pave = new T.MeshStandardMaterial({ map: paving, color: '#e9e2d4', roughness: .9, envMapIntensity: .35, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const p of PATH_POINTS) { const m = new T.Mesh(ribbon(p.pts, p.w), pave); m.position.y = GROUND + .02; group.add(m); }
  // 건물 바로 밑 포장 마당
  const yard = new T.Mesh(new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), pave); yard.position.set(-5, GROUND + .02, -5); group.add(yard);

  // 정원: 둥근 포장 마당, 분수를 둘러싼 부채꼴 화단 4개. 꽃은 블렌더에서 실제 꽃 모델(Poly Haven CC0
  // 가자니아·우르시니아·엠포디움·레이폴드티아·빈카)을 촘촘히 심어 위에서 렌더한 그림을 깐다(5m마다 반복, 이음매는 거울 반복)
  const GR = 11.5;
  const gpave = pave.clone(); gpave.polygonOffset = false; gpave.map = paving.clone(); gpave.map.repeat.set(6, 6); gpave.map.needsUpdate = true;
  const gyard = new T.Mesh(new T.CircleGeometry(GR + 1.5, 96).rotateX(-Math.PI / 2), gpave);
  gyard.position.set(GARDEN.x, GROUND + .04, GARDEN.z); group.add(gyard);
  const bedTex = await flowersReady;
  const bedMat = bedTex.map(t => { t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.MirroredRepeatWrapping; t.anisotropy = 8;
    return new T.MeshStandardMaterial({ map: t, roughness: .95, envMapIntensity: .3 }); });
  const stone = new T.MeshStandardMaterial({ color: '#ece5d6', roughness: .7, envMapIntensity: .4 });
  const worldUV = g => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 5, p.getZ(i) / 5); return g; };
  const gap = .16;
  [0, 1, 2, 3].forEach(q => {
    const t0 = q * Math.PI / 2 + gap / 2, len = Math.PI / 2 - gap;
    const bed = new T.Mesh(worldUV(new T.RingGeometry(4.2, GR - .6, 64, 6, t0, len).rotateX(-Math.PI / 2)), bedMat[q % 3]);
    bed.position.set(GARDEN.x, GROUND + .2, GARDEN.z); group.add(bed);
    for (const r of [4.05, GR - .45]) { // 화단 테두리 돌
      const rim = new T.Mesh(new T.TorusGeometry(r, .07, 6, 48, len).rotateX(Math.PI / 2).rotateY(-t0), stone);
      rim.position.set(GARDEN.x, GROUND + .22, GARDEN.z); group.add(rim);
    }
  });
  const basin = new T.Mesh(new T.CylinderGeometry(2.8, 3.0, .6, 48), stone); basin.position.set(GARDEN.x, GROUND + .3, GARDEN.z); group.add(basin);
  const water = new T.Mesh(new T.CircleGeometry(2.5, 48).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: '#4f8fa0', roughness: .08, metalness: .1 }));
  water.position.set(GARDEN.x, GROUND + .56, GARDEN.z); group.add(water);
  const spout = new T.Mesh(new T.CylinderGeometry(.35, .55, 1.6, 24), stone); spout.position.set(GARDEN.x, GROUND + .8, GARDEN.z); group.add(spout);

  // 잔디밭 가장자리 흰 정자
  const white = new T.MeshStandardMaterial({ color: '#f6f2ea', roughness: .6 });
  const roofM = new T.MeshStandardMaterial({ color: '#7d8c86', roughness: .55, metalness: .2 });
  const gz = new T.Group(); gz.position.set(LAWN.x + LAWN.rx - 18, GROUND, LAWN.z - 8); group.add(gz);
  const floor = new T.Mesh(new T.CylinderGeometry(6, 6.3, .6, 8), white); floor.position.y = .3; gz.add(floor);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, c = new T.Mesh(new T.CylinderGeometry(.22, .22, 3.6, 12), white); c.position.set(Math.cos(a) * 5.2, 2.4, Math.sin(a) * 5.2); gz.add(c); }
  const eave = new T.Mesh(new T.CylinderGeometry(6.2, 6.2, .5, 8), white); eave.position.y = 4.4; gz.add(eave);
  const roof = new T.Mesh(new T.ConeGeometry(6.6, 3, 8), roofM); roof.position.y = 6.1; gz.add(roof);

  // 시가지: 프라하 페트르진 언덕에서 본 구시가지 사진(성 비투스 대성당, 붉은 지붕, 하늘은 지워 둠)을 120m 밖 원통 벽에 붙인다
  // 사진 속 지평선(위에서 39.5%)을 눈높이에 맞추면 사진 아래쪽 숲이 공원 끝과 이어진다
  const sky = await cityReady;
  sky.colorSpace = T.SRGBColorSpace; sky.anisotropy = 8; sky.wrapS = T.RepeatWrapping; sky.repeat.x = -1; sky.offset.x = 1;
  const R = 120, span = 100 * Math.PI / 180, height = R * span * sky.image.height / sky.image.width, mid = CITY_MID; // 대성당이 정면 가까이 오게
  const wall = new T.Mesh(new T.CylinderGeometry(R, R, height, 96, 1, true, mid - span / 2, span),
    new T.MeshBasicMaterial({ map: sky, transparent: true, side: T.DoubleSide, depthWrite: false, toneMapped: false, fog: false }));
  wall.position.y = 1.7 + height * .395 - height / 2; wall.renderOrder = -1; group.add(wall);

  const placed = plant(kinds);
  const quad = new T.PlaneGeometry(1, 1).translate(0, .5, 0);
  const meshes = kinds.map((k, i) => {
    const list = placed.filter(p => p.kind === i);
    const mesh = new T.InstancedMesh(quad, new T.MeshBasicMaterial({ map: maps[i], alphaTest: .5, side: T.DoubleSide, color: new T.Color(1.16, 1.16, 1.1) }), Math.max(1, list.length));
    mesh.count = list.length; mesh.frustumCulled = false; group.add(mesh);
    return { mesh, list, k };
  });
  const shade = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ map: shadowTexture(), color: '#000', transparent: true, opacity: .32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), placed.length);
  const mtx = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
  // 해는 창 쪽(+z, -x)에서 들어오므로 그림자는 집 쪽으로 눕는다
  placed.forEach((t, i) => { const w = kinds[t.kind].w * t.s; mtx.compose(p.set(t.x + w * .25, GROUND + .08, t.z - w * .35), q.identity(), s.set(w * 1.05, 1, w * .8)); shade.setMatrixAt(i, mtx); });
  group.add(shade);
  return camera => {
    for (const { mesh, list, k } of meshes) {
      list.forEach((t, i) => { mtx.compose(p.set(t.x, GROUND, t.z), camera.quaternion, s.set(k.w * t.s, k.h * t.s, 1)); mesh.setMatrixAt(i, mtx); });
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}
