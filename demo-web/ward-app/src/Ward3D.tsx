import { Suspense, useMemo, useEffect, useRef } from 'react'
import { liveAngles } from './liveAngles'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { suspend } from 'suspend-react'
import type { Angles } from './engine'
import { PACKED, RIG, RoomEnvironment, unpack } from './Scene3D'
import { Park } from './Park'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
RectAreaLightUniformsLib.init()

// 침대 세 대(101·102·103)의 각도를 따로 받는다
export type View='default'|'side'|'overview'|'window'
type Props = { beds: Angles[]; ringing: boolean; ringBeds?: boolean[]; view: View; tick?: number }
// Blender에서 관절째 복사한 침대는 관절 이름 끝에 번호가 붙어 있다(ward_ref.py의 dup_rig)
const SUFFIX = ['', '_102', '_103']
// 침대마다 부르는 이름(설계서 6장: 과일 12개 중 같은 병실에서 겹치지 않게). 3D 벽의 101·102·103 번호판은 모델 파일 안에 그려져 있어 그대로 남는다
export const BED_NAMES = ['사과', '포도', '딸기']
const BED_FRUIT = ['apple', 'grape', 'strawberry'] // Noto Emoji 3D(Apache 2.0) 그림, public/fruit/
const BED_PAPER = [['#fde3d9', '#d9533c'], ['#ebe1f7', '#7a52b3'], ['#ffe0e6', '#d63a5a']] // 색지, 테두리

const BASE = import.meta.env.BASE_URL
// 병상용 3인실(101·102·103). 만드는 법: blender/ward_ref.py를 WEB_GLB로 실행. 움직이는 침대는 맨 앞 101 한 대
const MODEL = `${BASE}models/ward_room.glb`
function useWardModel() {
  if (!PACKED) return useGLTF(MODEL)
  return suspend(async () => new GLTFLoader().parseAsync(await unpack(`${MODEL}.b64.txt`), ''), ['ward-glb'])
}
if (!PACKED) useGLTF.preload(MODEL)

const VIEWS: Record<View,{pos:[number,number,number];target:[number,number,number]}> = {
  default:{pos:[4.42,3.03,6.22],target:[-.26,1.06,1.27]},
  side:{pos:[0,1.4,6.2],target:[.2,.85,0]}, // 11/18 고른 각도: 101 옆에서 창 쪽으로
  window:{pos:[1.9,1.62,-.85],target:[.15,1.27,-6.4]},
  overview:{pos:[4.2,2.58,5.8],target:[-.36,.94,1.35]},
}
// Match the Mac comparison camera. Cut away nearby room fittings locally instead.
const cameraMin = new THREE.Vector3(-1.14, .48, -2.18)
const cameraMax = new THREE.Vector3(4.42, 3.03, 6.22)

const overheadFittings = /^(ceiling.light|curtain|track)/i
const entryFittings = /^(lever|door.jamb|lintel|kick.plate|vision.panel.trim|entry.ceiling.return)/i

function useNearCameraCutaway(group: THREE.Object3D, eligible: RegExp) {
  const fittings = useMemo(() => {
    const items: { mesh: THREE.Mesh; bounds: THREE.Box3 }[] = []
    group.updateWorldMatrix(true, true)
    group.traverse(mesh => {
      if (!(mesh instanceof THREE.Mesh)) return
      if (!eligible.test(mesh.name)) return
      items.push({ mesh, bounds: new THREE.Box3().setFromObject(mesh) })
    })
    return items
  }, [group, eligible])
  useFrame(({ camera }) => {
    for (const { mesh, bounds } of fittings) {
      mesh.visible = bounds.distanceToPoint(camera.position) > .32
    }
  })
}
function WardCamera({view,tick}:{view:View;tick?:number}){
  const ref=useRef<React.ComponentRef<typeof OrbitControls>>(null)
  useEffect(()=>{
    const orbit=ref.current
    if(!orbit)return
    ;(window as unknown as {__wardOrbit?:unknown}).__wardOrbit=orbit // 시점 맞출 때 시험 스크립트가 씀
    const preset=VIEWS[view]
    orbit.object.position.fromArray(preset.pos)
    orbit.target.fromArray(preset.target)
    orbit.update()
  },[view,tick])
  return <OrbitControls ref={ref} makeDefault enableDamping minDistance={.55} maxDistance={8.3}
    minPolarAngle={.32} maxPolarAngle={Math.PI*.49}
    onChange={e=>{
      if(!e)return
      e.target.object.position.clamp(cameraMin, cameraMax)
    }}/>
}
function Entry(){
  const scene=useGLTF(BASE+'entry.glb?v=footwall').scene
  useNearCameraCutaway(scene, entryFittings)
  return <><primitive object={scene}/><pointLight position={[3.05,2.6,1.9]} intensity={11} distance={5.5} color="#fff1d9" /></>
}
function MorningSky(){
  // 창밖 배경: Poly Haven Docklands 02(CC0) 실사 파노라마의 강 쪽 148도만 창 정면에 두고 나머지는 좌우 뒤집어 채움(가로등 3개 지움)
  // 하늘은 가정용과 같은 ClearDaySky(1.25배 밝게)로 갈아 끼움. 강 건너 건물은 그대로
  const sky = useTexture(BASE + 'CityParkSky.jpg')
  sky.colorSpace = THREE.SRGBColorSpace
  sky.mapping = THREE.EquirectangularReflectionMapping
  return <primitive attach="background" object={sky}/>
}
// 실내 조명: 천장 등 세 개(x=.35, y=3.13, z=4·2·0, 1.12 x .22m) 자리에 실제 면광원, 침대 머리 쪽에 약한 채움 빛
function RoomLights(){
  return <>{[4,2,0].map(z=><group key={z}>
    <rectAreaLight args={['#fff4e4',10,.22,1.12]} position={[.35,3.1,z]} rotation={[-Math.PI/2,0,0]}/>
    <pointLight position={[-.2,2.1,z]} color="#fff2df" intensity={1.5} distance={3} decay={2}/>
  </group>)}</>
}
function WindowSun(){
  const target=useMemo(()=>{const o=new THREE.Object3D();o.position.set(-.75,.42,3);return o},[])
  return <><primitive object={target}/><spotLight position={[1.4,3.10,-4.25]} target={target} color="#ffdc9e"
    intensity={320} distance={20} angle={.62} penumbra={.38} decay={2} castShadow
    shadow-mapSize={[2048,2048]} shadow-bias={-.00015} shadow-normalBias={.008}/></>
}

// 시트·베개: 가정용과 같은 면 직물 질감(이미 올라가 있는 tex3d) + 시트에는 침대 길이 방향 세로 주름
// 매트리스 질감 좌표는 u = 침대 길이, v = 폭(1 단위 ≈ 30cm)이라 v를 따라 주름을 그리면 길이 방향으로 길게 생긴다
function creaseMap() {
  const W = 64, H = 256, c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const v = y / H
    // 폭 한 칸(약 30cm)에 굵은 주름 하나 + 가는 주름 하나, 살짝 비대칭
    const h = 0.5 + 0.35 * Math.exp(-((v - 0.32) ** 2) / 0.004) - 0.25 * Math.exp(-((v - 0.36) ** 2) / 0.002) + 0.15 * Math.exp(-((v - 0.78) ** 2) / 0.003)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4, val = Math.max(0, Math.min(255, Math.round(h * 255)))
      img.data[k] = img.data[k + 1] = img.data[k + 2] = val; img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.flipY = false
  return t
}
const T3 = `${BASE}tex3d/`
function useFabric() {
  const tex = useTexture({ nor: `${T3}waffle_pique_cotton_nor.jpg`, rough: `${T3}waffle_pique_cotton_rough.jpg` })
  return useMemo(() => {
    const t = (src: THREE.Texture, r: number) => { const c = src.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(r, r); c.flipY = false; c.colorSpace = THREE.NoColorSpace; c.anisotropy = 8; c.needsUpdate = true; return c }
    const make = (name: string, color: string, r: number, crease: boolean) => {
      const m = new THREE.MeshPhysicalMaterial({ name, color, normalMap: t(tex.nor, r), normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: t(tex.rough, r), roughness: 1, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') })
      if (crease) {
        m.bumpMap = creaseMap(); m.bumpScale = 0.9
        // three는 normalMap과 bumpMap 중 하나만 쓴다 → 직물 노멀 위에 주름 높이를 더한다(가정용 Scene3D와 같은 방법)
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #if defined(USE_NORMALMAP_TANGENTSPACE) && defined(USE_BUMPMAP)
            normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
          #endif`)
        }
        m.customProgramCacheKey = () => 'ward-sheet-crease-v1'
      }
      return m
    }
    return { p_sheet: make('p_sheet', '#ebe6dc', 3, true), p_pillow: make('p_pillow', '#efebe4', 2, false) } as Record<string, THREE.Material>
  }, [tex])
}

function Ward({ beds }: { beds: Angles[] }) {
  const { scene } = useWardModel()
  const room=useGLTF(BASE+'clinical-ward.glb').scene
  useNearCameraCutaway(room, overheadFittings)
  const timber=useTexture(BASE+'modern_arm_chair_01_legs.jpg')
  useMemo(()=>room.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return
    o.castShadow=true;o.receiveShadow=true
    if(o.material.name==='modern_arm_chair_01_legs'){timber.colorSpace=THREE.SRGBColorSpace;timber.flipY=false;o.material.map=timber;o.material.color.set('#cbb594')}
    if(o.material.name==='modern_arm_chair_01_pillow'){o.material.color.set('#b4bdae');o.material.roughness=.83}
    if(o.material.name==='OpalGlass'){o.material.emissive.set('#fff1d2');o.material.emissiveIntensity=.75}
    if(o.name.startsWith('Ceiling_underside')){o.material=o.material.clone();o.material.side=THREE.FrontSide;o.material.emissive.set('#e5ddc6');o.material.emissiveIntensity=.28}
  }),[room,timber])
  const fabric = useFabric()
  const bones = useMemo(() => {
    const list = SUFFIX.flatMap((sfx, bed) => RIG.map(([name, part, k]) => {
      const b = scene.getObjectByName(name + sfx) as THREE.Bone
      if (!b.userData.rest) b.userData.rest = b.quaternion.clone()
      return { b, rest: b.userData.rest as THREE.Quaternion, part, k, bed }
    }))
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (!(m as THREE.SkinnedMesh).isSkinnedMesh && !m.name.startsWith('pillow')) {m.visible=false;return}
      const name = (m.material as THREE.Material).name
      if (fabric[name]) m.material = fabric[name]
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
    })
    return list
  }, [scene, fabric])
  const drives=useMemo(()=>{
    scene.updateMatrixWorld(true)
    const assembly=new THREE.Group()
    const bodyMat=new THREE.MeshStandardMaterial({color:'#677776',metalness:.52,roughness:.38})
    const rodMat=new THREE.MeshStandardMaterial({color:'#cad0d2',metalness:.82,roughness:.24})
    const up=new THREE.Vector3(0,1,0)
    const tip=new THREE.Vector3(),dir=new THREE.Vector3()
    const links=SUFFIX.flatMap((suffix,i)=>[[-.72,-.23,'head_6'],[.41,.04,'thigh_4']].map(([x,anchor,b])=>{
      const bone=scene.getObjectByName(b+suffix)!
      const z=4-2*i+.16
      const base=new THREE.Vector3(Number(anchor),.343,z)
      const local=bone.worldToLocal(new THREE.Vector3(Number(x),.53,z))
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.030,.030,1,20),bodyMat)
      const piston=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,1,20),rodMat)
      assembly.add(barrel,piston)
      return ()=>{
        tip.copy(local).applyMatrix4(bone.matrixWorld)
        const length=dir.subVectors(tip,base).length();dir.normalize()
        const shell=.30
        for(const [part,from,to] of [[barrel,0,shell],[piston,shell,length]] as const){
          part.position.copy(base).addScaledVector(dir,(from+to)/2)
          part.quaternion.setFromUnitVectors(up,dir)
          part.scale.y=Math.max(.001,to-from)
        }
      }
    }))
    return {assembly,links}
  },[scene])
  const axis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(() => {
    const live = liveAngles.map(f => f ? f() : null)
    for (const { b, rest, part, k, bed } of bones) b.quaternion.copy(rest).multiply(q.setFromAxisAngle(axis, THREE.MathUtils.degToRad((live[bed] ?? beds[bed])[part] * k)))
    scene.updateMatrixWorld(true)
    for(const update of drives.links)update()
  })
  return <><primitive object={drives.assembly}/><primitive object={room} /><primitive object={scene} /></>
}


// 침대 머리 위 초록 벽판(x=-1.26, 독서등 위 빈 자리)에 종이 이름표를 붙인다: 과일 그림 + 손글씨 이름 + 번호
// ring: 알람이 울리는 침대의 이름표를 노랗게 깜빡인다
function BedTags({ring=[]}:{ring?:boolean[]}){
  const mats=useRef<(THREE.MeshStandardMaterial|null)[]>([])
  useFrame(({clock})=>mats.current.forEach((m,i)=>{if(!m)return;const on=!!ring[i];m.emissive.set(on?'#ffb21e':'#000000');m.emissiveIntensity=on?.25+.25*Math.sin(clock.elapsedTime*7):0}))
  const tex=suspend(async()=>{
    // 나눔손글씨 펜 전체 글꼴(OFL). loading-pen.ttf는 로딩 문구 글자만 든 일부라 '딸' 등이 없음
    const pen=new FontFace('TagPen',`url(${BASE}tag-pen.ttf)`); await pen.load(); document.fonts.add(pen)
    const imgs=await Promise.all(BED_FRUIT.map(f=>new Promise<HTMLImageElement>((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=`${BASE}fruit/${f}.png`})))
    return imgs.map((img,i)=>{
      const c=document.createElement('canvas');c.width=768;c.height=512
      const g=c.getContext('2d')!
      g.fillStyle=BED_PAPER[i][0];g.fillRect(0,0,768,512)
      for(let k=0;k<2600;k++){g.fillStyle=`rgba(120,100,70,${Math.random()*.05})`;g.fillRect(Math.random()*768,Math.random()*512,2,2)}
      const edge=g.createLinearGradient(0,0,0,512);edge.addColorStop(0,'rgba(0,0,0,0)');edge.addColorStop(1,'rgba(90,70,40,.08)');g.fillStyle=edge;g.fillRect(0,0,768,512)
      g.strokeStyle=BED_PAPER[i][1];g.lineWidth=14;g.strokeRect(22,22,724,468)
      g.drawImage(img,40,86,340,340)
      g.fillStyle='#262522';g.textBaseline='alphabetic'
      g.font='250px TagPen';g.fillText(BED_NAMES[i],392,300,350)
      g.fillStyle=BED_PAPER[i][1];g.font='150px TagPen';g.fillText(`${101+i}호`,400,430)
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8
      return t
    })
  },['bed-tags-v4'])
  return <>{tex.map((t,i)=>{
    const z=4-2*i
    return <group key={i} position={[-1.252,2.665,z]} rotation={[0,Math.PI/2,0]}>
      <group>
        <mesh castShadow receiveShadow><planeGeometry args={[.75,.5]}/><meshStandardMaterial ref={m=>{mats.current[i]=m}} map={t} roughness={.92}/></mesh>
      </group>
    </group>
  })}</>
}

function WardReady() {
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current >= 2) return
    frames.current++
    if (frames.current === 2) {
      requestAnimationFrame(() => {
        const loading = document.getElementById('loading')
        if (loading) loading.hidden = true
        if (window.parent !== window) window.parent.postMessage('ward-rendered', location.origin)
      })
    }
  })
  return null
}

export function Ward3D({beds,ringing,ringBeds=[],view,tick}:Props) {
  return <>
    <Canvas shadows dpr={[1,1.5]} camera={{position:VIEWS.default.pos, fov:49, near:.04,far:1400}} gl={{antialias:true}}>
      <MorningSky/>
      <fog attach="fog" args={['#c2d9e6',240,910]}/>
      <hemisphereLight args={['#fff9f0','#cdbba0',.9]}/>
      <directionalLight position={[2.15,2.68,-7.25]} intensity={4.8} color="#ffe5b8" castShadow shadow-mapSize={[2048,2048]} shadow-normalBias={.008}>
        <orthographicCamera attach="shadow-camera" args={[-7,7,7,-7,.1,28]}/>
      </directionalLight>
      <Suspense fallback={null}><Ward beds={beds}/><Entry/><BedTags ring={ringBeds}/><WardReady/></Suspense>
      {/* 창밖: 강변 모델(Riverside) 대신 시티파크. 강·둑·다리는 걷어냄 */}
      <Suspense fallback={null}><Park/><RoomEnvironment intensity={.55}/></Suspense>
      <WindowSun/>
      <RoomLights/>
      <WardCamera view={view} tick={tick}/>
    </Canvas>
    {ringing && <div className="ring-overlay" aria-hidden="true"/>}
  </>
}

// Kept for the archived photo-mode screen.
export function WardPhoto({ringing}:{ringing:boolean}) {
  return <><img src={BASE+'ward_photo.jpg'} alt="병실 참고 사진"/>{ringing && <div className="ring-overlay"/>}</>
}
