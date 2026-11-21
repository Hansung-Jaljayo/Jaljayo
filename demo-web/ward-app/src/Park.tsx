import { useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import trees from './park-trees.json'
import clumpList from './park-clumps.json'

// 병실 창밖 시티파크. 병원 앞부터 강 건너 건물(실사 배경) 앞까지를 공원으로 채운다
// 나무: Poly Haven CC0 스캔 나무를 블렌더에서 창 높이 각도(16도 내려다봄)로 렌더한 그림을 카메라를 향해 세운다
const BASE = import.meta.env.BASE_URL
const GROUND = -37.6 // 강변 모델의 잔디 높이(병실 창은 약 39m 위)
type Tree = { file: string; w: number; h: number; kind: 'tree' | 'shrub' }
const KINDS = trees as Tree[]

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 } }
type V2 = [number, number]
// 창가 시점이 바라보는 방향(-0.30, -0.95)을 따라 광장과 중심 길을 둔다
const PLAZA: V2 = [-58, -192]
const PLAZA_R = 34
const PATHS: { pts: V2[]; w: number }[] = [
  { pts: [[-700, -28], [-300, -30], [0, -26], [300, -30], [700, -28]], w: 7 },               // 병원 앞 산책로
  { pts: [[-8, -30], [-22, -80], [-40, -140], [PLAZA[0], PLAZA[1] + PLAZA_R]], w: 9 },      // 광장으로 가는 중심 길
  { pts: [[PLAZA[0], PLAZA[1] - PLAZA_R], [-90, -300], [-130, -430], [-180, -600], [-240, -820]], w: 9 },
  { pts: [[-700, -150], [-400, -170], [-200, -185], [PLAZA[0] - PLAZA_R, PLAZA[1]]], w: 6 },
  { pts: [[PLAZA[0] + PLAZA_R, PLAZA[1]], [80, -210], [240, -260], [420, -240], [700, -300]], w: 6 },
  { pts: [[-560, -40], [-470, -120], [-430, -260], [-470, -420], [-560, -560]], w: 5 },
  { pts: [[180, -30], [150, -110], [240, -260]], w: 5 },
  { pts: [[-130, -430], [-20, -480], [140, -470], [300, -520], [520, -500]], w: 5 },
  { pts: [[-130, -430], [-280, -470], [-470, -420]], w: 5 },
]
function sample(pts: V2[], step = 3) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
  const n = Math.max(2, Math.ceil(curve.getLength() / step))
  return curve.getSpacedPoints(n)
}
const PATH_POINTS = PATHS.map(p => ({ pts: sample(p.pts), w: p.w }))
function clearance(x: number, z: number) {
  let d = Math.hypot(x - PLAZA[0], z - PLAZA[1]) - PLAZA_R
  for (const p of PATH_POINTS) for (const q of p.pts) d = Math.min(d, Math.hypot(x - q.x, z - q.z) - p.w / 2)
  return d
}

// 위에서 본 공원 잔디: 깎은 결(줄무늬) + 넓은 색 얼룩 + 잔 얼룩
function lawnMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#567f37', roughness: .95 })
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLawn;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLawn = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLawn;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int k=0;k<4;k++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec2 p=vLawn.xz;
  float big=fbm(p*.012), mid=fbm(p*.07), fine=vn(p*1.7);
  float stripe=step(.5,fract((p.x*.97+p.y*.24)/9.))*.09;
  vec3 c=diffuseColor.rgb*(.66+.48*big+.22*mid+.12*fine+stripe);
  c=mix(c,c*vec3(1.08,1.04,.82),smoothstep(.55,.8,big)*.5);
  diffuseColor.rgb=c; }`)
  }
  return m
}

function ribbon(pts: THREE.Vector3[], w: number) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  let along = 0
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const t = new THREE.Vector3().subVectors(b, a).normalize()
    const n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(w / 2)
    if (i) along += p.distanceTo(pts[i - 1])
    pos.push(p.x + n.x, 0, p.z + n.z, p.x - n.x, 0, p.z - n.z)
    uv.push(0, along / w, 1, along / w)
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(.55, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// 창 바로 앞(병실에서 75m 안)은 나무를 두지 않아 창밖이 가리지 않게 한다
const NEAR = 75
// 창에서 광장까지 보이는 길목(폭 약 50m)도 비워 둔다
function inSightLine(x: number, z: number) {
  const [px, pz] = PLAZA, L = px * px + pz * pz, t = Math.max(0, Math.min(1, (x * px + z * pz) / L))
  return Math.hypot(x - px * t, z - pz * t) < 26 + 12 * t
}
type Placed = { x: number; z: number; s: number; kind: number }
function plant(): Placed[] {
  const r = rng(20251115), out: Placed[] = []
  const treeKinds = KINDS.map((k, i) => [k, i] as const).filter(([k]) => k.kind === 'tree').map(([, i]) => i)
  const shrubKinds = KINDS.map((k, i) => [k, i] as const).filter(([k]) => k.kind === 'shrub').map(([, i]) => i)
  const pick = (list: number[]) => list[Math.floor(r() * list.length)]
  const ok = (x: number, z: number, gap: number) => z < -8 && Math.hypot(x, z) > NEAR && !inSightLine(x, z) && clearance(x, z) > gap && out.every(o => Math.hypot(o.x - x, o.z - z) > 4.5)
  // 길 양옆 가로수
  for (const p of PATH_POINTS) {
    if (p.w < 7) continue
    for (let i = 0; i < p.pts.length; i += 4) {
      const a = p.pts[Math.max(0, i - 1)], b = p.pts[Math.min(p.pts.length - 1, i + 1)], q = p.pts[i]
      const t = new THREE.Vector3().subVectors(b, a).normalize()
      for (const side of [-1, 1]) {
        const x = q.x - t.z * side * (p.w / 2 + 4), z = q.z + t.x * side * (p.w / 2 + 4)
        if (ok(x, z, 2.5)) out.push({ x, z, s: 2.0 + r() * .3, kind: treeKinds[i / 4 % treeKinds.length | 0] })
      }
    }
  }
  // 잔디밭 사이 나무 무리
  for (let c = 0; c < 260; c++) {
    const cx = -820 + r() * 1500, cz = -40 - Math.pow(r(), .8) * 980
    if (Math.hypot(cx - PLAZA[0], cz - PLAZA[1]) < PLAZA_R + 30) continue
    const n = 4 + Math.floor(r() * 10), spread = 10 + r() * 22
    for (let k = 0; k < n; k++) {
      const x = cx + (r() - .5) * 2 * spread, z = cz + (r() - .5) * 2 * spread
      if (ok(x, z, 3)) out.push({ x, z, s: 1.7 + r() * 1.1, kind: pick(treeKinds) })
    }
  }
  // 먼 쪽 숲 띠(강 건너 건물 아래를 초록으로)
  for (let k = 0; k < 520; k++) {
    const x = -950 + r() * 1800, z = -780 - r() * 330
    if (ok(x, z, 2)) out.push({ x, z, s: 2.2 + r() * 1.0, kind: pick(treeKinds) })
  }
  // 길가 관목
  for (const p of PATH_POINTS) for (let i = 2; i < p.pts.length; i += 3) {
    if (r() < .45) continue
    const a = p.pts[i - 1], b = p.pts[Math.min(p.pts.length - 1, i + 1)], q = p.pts[i]
    const t = new THREE.Vector3().subVectors(b, a).normalize(), side = r() < .5 ? -1 : 1
    const x = q.x - t.z * side * (p.w / 2 + 1.6), z = q.z + t.x * side * (p.w / 2 + 1.6)
    if (z < -8 && Math.hypot(x, z) > NEAR && clearance(x, z) > 1) out.push({ x, z, s: 1.6 + r() * .8, kind: pick(shrubKinds) })
  }
  return out
}

export function Park() {
  const maps = useLoader(THREE.TextureLoader, KINDS.map(k => BASE + 'park/' + k.file))
  const paving = useLoader(THREE.TextureLoader, BASE + 'park/paving_diff.jpg?v=2')
  // 광장 꽃띠: 돌로 쌓은 높은 화단(40cm) 위에 꽃포기를 입체로 심는다. 꽃포기 그림은 블렌더에서 실제 꽃 모델
  // (Poly Haven CC0 가자니아·엠포디움·셀런딘) 100여 포기를 모아 창 높이 각도로 렌더한 것(빨강·노랑 각 6가지)
  const CLUMPS = clumpList as { file: string; w: number; h: number; color: string }[]
  const clumpMaps = useLoader(THREE.TextureLoader, CLUMPS.map(c => BASE + 'park/' + c.file + '?v=8'))
  const built = useMemo(() => {
    for (const t of maps) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4 }
    paving.colorSpace = THREE.SRGBColorSpace; paving.wrapS = paving.wrapT = THREE.RepeatWrapping; paving.anisotropy = 8
    const group = new THREE.Group()
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 1300).rotateX(-Math.PI / 2).translate(-100, GROUND, -652), lawnMaterial())
    ground.receiveShadow = true
    group.add(ground)
    const pave = new THREE.MeshStandardMaterial({ map: paving, color: '#fffaf0', roughness: .85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    for (const p of PATH_POINTS) {
      const m = new THREE.Mesh(ribbon(p.pts, p.w), pave); m.position.y = GROUND + .02; group.add(m)
    }
    const disc = (r0: number, r1: number, mat: THREE.Material, y: number) => {
      const g = new THREE.RingGeometry(r0, r1, 128, 4).rotateX(-Math.PI / 2)
      const p = g.attributes.position, uv = g.attributes.uv
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 5, p.getZ(i) / 5)
      const m = new THREE.Mesh(g, mat)
      m.position.set(PLAZA[0], GROUND + y, PLAZA[1]); group.add(m)
    }
    const plazaPave = pave.clone(); plazaPave.polygonOffset = false; plazaPave.map = paving.clone(); plazaPave.map.repeat.set(9, 9); plazaPave.map.needsUpdate = true
    disc(0, PLAZA_R, plazaPave, .12) // 길보다 10cm 높여 멀리서 길과 겹쳐 깨지지 않게
    const stone = new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: .75 })
    const soil = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 })
    const BED_H = .4
    const clumpPlaced: { x: number; z: number; s: number; kind: number; y: number }[] = []
    const rnd = rng(1115)
    for (const [r0, r1, color] of [[9, 13, 'red'], [19, 23, 'yellow']] as [number, number, string][]) {
      disc(r0, r1, soil, BED_H)
      for (const r of [r0, r1]) {
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, BED_H, 160, 1, true), stone)
        wall.material.side = THREE.DoubleSide; wall.position.set(PLAZA[0], GROUND + BED_H / 2, PLAZA[1]); group.add(wall)
        disc(r - .18, r + .18, stone, BED_H + .02)
      }
      const kinds = CLUMPS.map((c, i) => [c, i] as const).filter(([c]) => c.color === color).map(([, i]) => i)
      for (let rr = r0 + .7; rr < r1 - .5; rr += .85) {
        const n = Math.floor(2 * Math.PI * rr / .85)
        for (let k = 0; k < n; k++) {
          const a = (k + rnd() * .6) / n * Math.PI * 2, d = rr + (rnd() - .5) * .4
          clumpPlaced.push({ x: PLAZA[0] + Math.cos(a) * d, z: PLAZA[1] + Math.sin(a) * d, s: .75 + rnd() * .35, kind: kinds[Math.floor(rnd() * kinds.length)], y: GROUND + BED_H - .04 })
        }
      }
    }
    disc(26, 27.6, new THREE.MeshStandardMaterial({ color: '#3f6a2c', roughness: .9 }), .18)
    const pond = new THREE.Mesh(new THREE.CircleGeometry(6.5, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3b6d78', roughness: .12, metalness: .1 }))
    pond.position.set(PLAZA[0], GROUND + .18, PLAZA[1]); group.add(pond)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(6.6, .35, 12, 64).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: .7 }))
    rim.position.set(PLAZA[0], GROUND + .26, PLAZA[1]); group.add(rim)

    const placed = plant()
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0)
    const meshes = KINDS.map((k, i) => {
      const list = placed.filter(p => p.kind === i)
      const mesh = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ map: maps[i], alphaTest: .5, side: THREE.DoubleSide, color: new THREE.Color(1.32, 1.4, 1.18) }), Math.max(1, list.length))
      mesh.count = list.length; mesh.frustumCulled = false
      group.add(mesh)
      return { mesh, list: list.map(t => ({ ...t, y: GROUND })), k }
    })
    for (const t of clumpMaps) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4 }
    CLUMPS.forEach((c, i) => {
      const list = clumpPlaced.filter(p => p.kind === i)
      const mesh = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ map: clumpMaps[i], alphaTest: .4, side: THREE.DoubleSide, fog: false }), Math.max(1, list.length))
      mesh.count = list.length; mesh.frustumCulled = false; group.add(mesh)
      meshes.push({ mesh, list, k: { file: c.file, w: c.w, h: c.h, kind: 'shrub' } as Tree })
    })
    const shade = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), color: '#000', transparent: true, opacity: .34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), placed.length)
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    placed.forEach((t, i) => {
      const k = KINDS[t.kind], w = k.w * t.s
      mtx.compose(p.set(t.x, GROUND + .08, t.z - w * .35), q.identity(), s.set(w * 1.05, 1, w * .8)); shade.setMatrixAt(i, mtx)
    })
    group.add(shade)
    return { group, meshes }
  }, [maps, paving, clumpMaps])
  useFrame(({ camera }) => {
    const mtx = new THREE.Matrix4(), s = new THREE.Vector3(), p = new THREE.Vector3()
    for (const { mesh, list, k } of built.meshes) {
      list.forEach((t, i) => { mtx.compose(p.set(t.x, t.y, t.z), camera.quaternion, s.set(k.w * t.s, k.h * t.s, 1)); mesh.setMatrixAt(i, mtx) })
      mesh.instanceMatrix.needsUpdate = true
    }
  })
  return <primitive object={built.group} />
}
