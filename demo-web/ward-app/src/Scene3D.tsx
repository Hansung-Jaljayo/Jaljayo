import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { suspend } from 'suspend-react'
import type { Angles } from './engine'

export type View = 'default' | 'side' | 'overview'
// tick: 시점 버튼을 누를 때마다 1씩 늘어난다(같은 버튼을 다시 눌러도 그 시점으로 돌아오게)
type Props = { angles: Angles; ringing: boolean; view: View; tick?: number }

const BASE = import.meta.env.BASE_URL
// 사진 화면과 같은 Blender 장면(침대와 방)을 그대로 내보낸 파일. 만드는 법: blender/render_photo.py의 WEB_GLB
const MODEL = `${BASE}models/zinus_room.glb`
const HDRI = `${BASE}hdri/room.hdr`
// 공유용 페이지(VITE_PACKED=1로 빌드)는 .glb·.hdr 파일을 올릴 수 없어서, 같은 내용을 base64 글자 파일(.b64.txt)로 받아 직접 푼다
export const PACKED = import.meta.env.VITE_PACKED === '1'
export async function unpack(url: string) {
  const bin = atob((await (await fetch(url)).text()).trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}
function useRoomModel() {
  if (!PACKED) return useGLTF(MODEL)
  return suspend(async () => new GLTFLoader().parseAsync(await unpack(`${MODEL}.b64.txt`), ''), ['room-glb'])
}
export function RoomEnvironment({ intensity = ENV }: { intensity?: number }) {
  const ENV = intensity
  if (!PACKED) return <Environment files={HDRI} environmentIntensity={ENV} />
  const map = suspend(async () => {
    const d = new HDRLoader().parse(await unpack(`${HDRI}.b64.txt`))
    const t = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type)
    t.colorSpace = THREE.LinearSRGBColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter
    t.generateMipmaps = false; t.flipY = true; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true
    return t
  }, ['room-hdr'])
  return <Environment map={map} environmentIntensity={ENV} />
}
// 색감은 사진 화면에 맞춘다: 방 전체 빛 세기, 벽 색(render_photo.py가 사진 찍을 때 쓰는 색)
const ENV = 0.5
const WALL = '#f5ece1'  // 화면에 벽이 #ded6cc(사진 화면에서 뽑은 색)로 나오게 맞춘 값
const WALL_GLOW = 0.35  // 벽에 튕겨 들어오는 빛 대신
// 시점마다 카메라 위치와 바라보는 곳(Blender 좌표 x, y, z → 여기 x, z, -y)
const VIEWS: Record<View, { pos: [number, number, number]; target: [number, number, number] }> = {
  default: { pos: [4.09, 4.32, 5.0], target: [-0.25, 0.52, 0.05] },  // 고른 시점: 약 30도 높이·거리 7.6에서 방(러그·창·협탁)까지 다 보이게(사진 화면 구도와는 다름)
  side: { pos: [0.15, 1.0, 6.4], target: [0.0, 0.6, 0.0] },
  overview: { pos: [4.6, 3.4, 5.0], target: [-0.2, 0.4, 0.0] },
}

// 재질 이름별 사진 질감. 값은 render_photo.py의 pbr()과 같다(색은 make_web_textures.py에서 미리 입힘)
const FABRIC: Record<string, { diff: string; folder: string; repeat: number; bump: number }> = {
  p_boucle: { diff: 'p_boucle', folder: 'wool_boucle', repeat: 14, bump: 0.9 },
  p_pipe: { diff: 'p_pipe', folder: 'wool_boucle', repeat: 20, bump: 0.6 },
  p_knit: { diff: 'p_knit', folder: 'jersey_melange', repeat: 10, bump: 0.5 },
  p_top: { diff: 'p_top', folder: 'waffle_pique_cotton', repeat: 8, bump: 0.2 },
  p_pillow: { diff: 'p_pillow', folder: 'waffle_pique_cotton', repeat: 5, bump: 0.1 },
  p_cush: { diff: 'p_cush', folder: 'rough_linen', repeat: 4, bump: 0.3 },
  p_deck: { diff: 'p_deck', folder: 'jersey_melange', repeat: 6, bump: 0.2 },
  p_rug: { diff: 'p_rug', folder: 'waffle_pique_cotton', repeat: 3, bump: 0.6 },
  p_box: { diff: 'p_box', folder: 'rough_linen', repeat: 4, bump: 0.3 },
}
const FOLDERS = ['wool_boucle', 'jersey_melange', 'waffle_pique_cotton', 'rough_linen']
const TEX: Record<string, string> = { floor_diff: `${BASE}tex3d/floor_diff.jpg`, floor_nor: `${BASE}tex3d/laminate_floor_02_nor.jpg`, floor_rough: `${BASE}tex3d/laminate_floor_02_rough.jpg` }
for (const k of Object.keys(FABRIC)) TEX[`${k}_diff`] = `${BASE}tex3d/${k}_diff.jpg`
for (const f of FOLDERS) for (const s of ['nor', 'rough', 'disp']) TEX[`${f}_${s}`] = `${BASE}tex3d/${f}_${s}.jpg`

function useMaterials() {
  const tex = useTexture(TEX)
  return useMemo(() => {
    // 같은 그림을 재질마다 다른 반복 횟수로 쓰므로 재질마다 복사본을 만든다
    const t = (name: string, repeat: number, color = false) => {
      const c = tex[name].clone()
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(repeat, repeat)
      c.flipY = false
      c.anisotropy = 8
      c.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
      c.needsUpdate = true
      return c
    }
    const out: Record<string, THREE.Material> = {}
    for (const [name, f] of Object.entries(FABRIC)) {
      const material = new THREE.MeshPhysicalMaterial({
        name,
        map: t(`${f.diff}_diff`, f.repeat, true),
        normalMap: t(`${f.folder}_nor`, f.repeat),
        roughnessMap: t(`${f.folder}_rough`, f.repeat),
        bumpMap: t(`${f.folder}_disp`, f.repeat),
        // Blender uses millimetre-scale fabric relief, not scene-scale displacement.
        bumpScale: f.bump * 0.002,
        normalScale: new THREE.Vector2(name === 'p_top' || name === 'p_pillow' ? 0.6 : 0.55, name === 'p_top' || name === 'p_pillow' ? 0.6 : 0.55),
        roughness: 1,
        sheen: 0.25,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#ffffff'),
      })
      // Three's stock shader chooses normalMap OR bumpMap. Blender combines both.
      // Apply subtle height relief after the tangent-space fabric normal.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          #if defined(USE_NORMALMAP_TANGENTSPACE) && defined(USE_BUMPMAP)
            normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
          #endif`,
        )
      }
      material.customProgramCacheKey = () => 'fabric-normal-plus-height-v1'
      out[name] = material
    }
    out.floor = new THREE.MeshStandardMaterial({ name: 'floor', map: t('floor_diff', 1, true), normalMap: t('floor_nor', 1), roughnessMap: t('floor_rough', 1), roughness: 1 })
    return out
  }, [tex])
}

// 뼈마다 어느 각도를 얼마나 나눠 갖는지. blender/make_zinus.py의 pose()와 같은 규칙
// 매트리스(와 붙어 있는 받침판)는 경첩 둘레의 작은 관절 여러 개가 각도를 나눠 둥글게 휜다
export const RIG: [string, 'head' | 'leg', number][] = [
  ...[1, 2, 3, 4, 5, 6].map((i) => [`head_${i}`, 'head', -1 / 6] as [string, 'head', number]),
  ...[1, 2, 3, 4].map((i) => [`thigh_${i}`, 'leg', 1 / 4] as [string, 'leg', number]),
  ['calf_1', 'leg', -0.85 / 2], ['calf_2', 'leg', -0.85 / 2],
]

// Blender에서 만든 침대와 방
function BedRoom({ angles }: { angles: Angles }) {
  const { scene } = useRoomModel()
  const mats = useMaterials()
  const bones = useMemo(() => {
    const list = RIG.map(([name, part, k]) => {
      const b = scene.getObjectByName(name) as THREE.Bone
      // 평평한 상태는 처음 한 번만 저장한다. 모델은 메모리에 남아 있어서, 화면이 다시 켜질 때 지금 자세를 평평한 상태로 다시 읽으면 각도가 겹쳐 두 배로 꺾인다
      if (!b.userData.rest) b.userData.rest = b.quaternion.clone()
      return { b, rest: b.userData.rest as THREE.Quaternion, part, k }
    })
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const name = (m.material as THREE.Material).name
      if (mats[name]) m.material = mats[name]
      // 창밖 하늘은 빛을 막지 않게 한다
      m.castShadow = name !== 'sky'
      m.receiveShadow = name !== 'sky'
      m.frustumCulled = false
      if (name === 'wall' || name === 'wall_far') {
        const w = m.material as THREE.MeshStandardMaterial
        w.shadowSide = THREE.DoubleSide
        w.color.set(WALL)
        w.emissive.set(WALL)
        w.emissiveIntensity = WALL_GLOW
      }
    })
    return list
  }, [scene, mats])

  const axis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(() => {
    // 뼈의 로컬 Z축이 침대 폭 방향이라 그 축으로 돌린다
    for (const { b, rest, part, k } of bones) b.quaternion.copy(rest).multiply(q.setFromAxisAngle(axis, THREE.MathUtils.degToRad(angles[part] * k)))
  })
  return <primitive object={scene} />
}

// 창으로 들어오는 빛: 창 크기의 면 조명과 창살 그림자를 만드는 햇빛
function WindowLight() {
  const area = useRef<THREE.RectAreaLight>(null)
  // 창문 자리에 창과 같은 크기로 두고 방 안쪽을 똑바로 본다(기울이면 벽 일부만 판 앞쪽에 걸려 삼각형으로 밝아진다)
  useEffect(() => { area.current?.lookAt(0.8, 1.45, 0) }, [])
  return (
    <>
      <rectAreaLight ref={area} position={[0.8, 1.45, -2.55]} width={1.2} height={1.3} intensity={5} color="#fff7f0" />
      <LampLight />
      {/* 방 안쪽(카메라 쪽)에서 창 벽을 은은하게 비추는 보조광. 창 벽은 빛이 뒤에서 들어와 그대로 두면 회색으로 가라앉는다 */}
      <directionalLight position={[1.5, 2.2, 6]} intensity={0.25} color="#fff8f2" />
      <directionalLight position={[-1.8, 4.5, -6.6]} intensity={2.8} color="#fff0e2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.006} shadow-radius={4}>
        <orthographicCamera attach="shadow-camera" args={[-3.5, 3.5, 3.5, -3.5, 0.5, 16]} />
      </directionalLight>
    </>
  )
}

// 선반 위 스탠드: 갓 안에 숨은 전구가 아래로만 비춘다(Blender 좌표 x, y, z → 여기 x, z, -y)
function LampLight() {
  const spot = useRef<THREE.SpotLight>(null)
  useEffect(() => {
    const s = spot.current
    if (!s) return
    s.target.position.set(-1.235, 0, 1.35)
    s.target.updateMatrixWorld()
  }, [])
  return <spotLight ref={spot} position={[-1.235, 0.79, 1.35]} angle={1.25} penumbra={0.8} intensity={0.65} distance={2} decay={2} color="#ffd59c" />
}

// 시점 버튼을 누르면 카메라를 부드럽게 옮긴다. 마우스로 돌리면 그 자리에 둔다
export function CameraRig({ view, tick = 0, views = VIEWS }: { view: View; tick?: number; views?: typeof VIEWS }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null }
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null)
  useEffect(() => {
    const v = views[view]
    goal.current = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target), t: 0 }
  }, [view, tick])
  useFrame((_, dt) => {
    const g = goal.current
    if (!g || !controls) return
    g.t = Math.min(1, g.t + dt / 0.9)
    const k = 1 - Math.pow(1 - g.t, 3)
    camera.position.lerp(g.pos, k)
    controls.target.lerp(g.target, k)
    controls.update()
    if (g.t >= 1) goal.current = null
  })
  return null
}

RectAreaLightUniformsLib.init()

export function Scene3D({ angles, ringing, view, tick }: Props) {
  return (
    <>
      <Canvas style={{ position: 'absolute', inset: 0 }} resize={{ scroll: false, debounce: 0 }} shadows dpr={[1, 1.25]} camera={{ position: VIEWS.default.pos, fov: 24, near: 0.1, far: 60 }} gl={{ antialias: false, toneMapping: THREE.NoToneMapping }}>
        <color attach="background" args={['#e9e1d6']} />
        <Suspense fallback={null}>
          <RoomEnvironment />
          <BedRoom angles={angles} />
        </Suspense>
        <WindowLight />
        {/* 방이 벽 두 면뿐이라 카메라는 벽 안쪽에서만 돌게 한다 */}
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan={false} zoomSpeed={0.4} zoomToCursor minDistance={2.4} maxDistance={10}
          minPolarAngle={0.25} maxPolarAngle={1.45} minAzimuthAngle={-0.1} maxAzimuthAngle={1.75} target={VIEWS.default.target} />
        <CameraRig view={view} tick={tick} />
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.18} distanceFalloff={0.8} intensity={2} quality="high" />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      </Canvas>
      {ringing && <div className="ring-overlay" aria-hidden="true" />}
    </>
  )
}
