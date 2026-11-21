import { useEffect, useRef, useState } from 'react'
import type { Angles } from './engine'

// Blender에서 각도 조합마다 미리 렌더링한 방 사진(blender/render_photo.py, 30mm)을 지금 각도에 맞춰 섞어 보여 준다
// 머리와 다리 모두 1.25도마다 한 장(1617장). 사이 각도는 가까운 네 장을 섞는다
const STEP = 1.25
const HEADS = Array.from({ length: 49 }, (_, i) => i * STEP)
const LEGS = Array.from({ length: 33 }, (_, i) => i * STEP)
const TOTAL = HEADS.length * LEGS.length
// 파일 이름은 0.1도 단위(반올림은 올림 쪽): h013_l150 = 머리 1.25도, 다리 15도
const tenth = (d: number) => String(Math.round(d * 10)).padStart(3, '0')
const key = (h: number, l: number) => `h${tenth(h)}_l${tenth(l)}`
const src = (k: string) => `${import.meta.env.BASE_URL}frames_webp/${k}.webp`
// 풀어 둔 사진은 이만큼만 들고 있는다(다 풀면 메모리가 수 GB가 된다)
const KEEP = 24
// 먼저 받을 5도 간격 117장(원본 크기 그대로, 한 파일, 줄마다 "h050_l100 base64").
// 나머지가 오기 전에 움직이면 가장 가까운 이 사진 한 장으로 보여 준다(5도끼리 섞으면 판이 여러 겹으로 보인다)
const CSTEP = 5
const COARSE = `${import.meta.env.BASE_URL}frames_coarse.txt`
const toBlob = (b64: string) => {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j)
  return new Blob([buf], { type: 'image/webp' })
}

// 받아 둔 사진은 화면(이 컴포넌트) 밖에 들고 있는다. 3D 탭에 갔다 와도 다시 받지 않는다
const store = {
  blobs: new Map<string, Blob>(),      // 내려받은 사진 파일 전부
  bitmaps: new Map<string, ImageBitmap>(),  // 그중 화면에 쓰려고 풀어 둔 것(KEEP장까지)
  decoding: new Set<string>(),
  headNow: 0,  // 다음에 받을 묶음을 고를 때 쓰는 지금 머리 각도
  started: false,
  subs: new Set<() => void>(),
}
const notify = () => store.subs.forEach((f) => f())

// 처음 한 번만 받는다. 5도 간격 117장부터, 그다음 나머지를 동시에 6개씩
function startLoading() {
  if (store.started) return
  store.started = true
  const blobs = store.blobs
  // 아티팩트용(VITE_PACKED=1): 파일 수 제한 때문에 머리 각도마다 한 파일로 묶어 둔 것을 받는다(줄마다 "l150 base64")
  const startPacks = () => {
    // 5도 → 2.5도 → 1.25도 단계로, 같은 단계에서는 지금 머리 각도에 가까운 묶음부터 받는다
    const left = new Set(HEADS)
    const level = (h: number) => (h % 5 === 0 ? 0 : h % 2.5 === 0 ? 1 : 2)
    const nextPack = (): Promise<void> => {
      if (!left.size) return Promise.resolve()
      const h = [...left].sort((a, b) => level(a) - level(b) || Math.abs(a - store.headNow) - Math.abs(b - store.headNow))[0]
      left.delete(h)
      const hk = tenth(h)
      return fetch(`${import.meta.env.BASE_URL}frames_webp_pack/h${hk}.txt`)
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((t) => {
          for (const line of t.split('\n')) if (line) blobs.set(`h${hk}_${line.slice(0, 4)}`, toBlob(line.slice(5)))
          notify()
        })
        .catch(() => {})
        .then(nextPack)
    }
    for (let n = 0; n < 6; n++) nextPack()
  }
  const order = HEADS.flatMap((h) => LEGS.map((l) => [h, l] as const)).sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
  let i = 0
  const next = (): Promise<void> => {
    if (i >= order.length) return Promise.resolve()
    const k = key(...order[i++])
    return fetch(src(k))
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { blobs.set(k, b); notify() })
      .catch(() => {})
      .then(next)
  }
  const startFiles = () => { for (let n = 0; n < 6; n++) next() }
  fetch(COARSE)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((t) => {
      for (const line of t.split('\n')) if (line) blobs.set(line.slice(0, 9), toBlob(line.slice(10)))
      notify()
    })
    .catch(() => {})
    .then(import.meta.env.VITE_PACKED === '1' ? startPacks : startFiles)
}

// 사진 하나를 풀어 달라고 한다. 다 풀리면 다시 그린다
function want(k: string) {
  const { bitmaps, decoding } = store
  const bmp = bitmaps.get(k)
  if (bmp) { bitmaps.delete(k); bitmaps.set(k, bmp); return bmp }  // 최근에 쓴 것으로 옮긴다
  const blob = store.blobs.get(k)
  if (blob && !decoding.has(k)) {
    decoding.add(k)
    createImageBitmap(blob).then((b) => {
      decoding.delete(k)
      bitmaps.set(k, b)
      while (bitmaps.size > KEEP) {
        const [oldK, old] = bitmaps.entries().next().value as [string, ImageBitmap]
        bitmaps.delete(oldK); old.close()
      }
      notify()
    }).catch(() => decoding.delete(k))
  }
  return undefined
}

type Props = { angles: Angles; ringing: boolean }

export function PhotoBed({ angles, ringing }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scratch = useRef<HTMLCanvasElement | null>(null)
  const blobs = useRef(store.blobs)
  const [tick, setTick] = useState(0)
  store.headNow = angles.head
  useEffect(() => {
    const f = () => setTick((n) => n + 1)
    store.subs.add(f)
    startLoading()
    return () => { store.subs.delete(f) }
  }, [])
  const loaded = store.blobs.size

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const head = Math.max(0, Math.min(60, angles.head))
    const leg = Math.max(0, Math.min(40, angles.leg))
    // 받아 둔 사진으로 섞을 수 있는 가장 촘촘한 간격(1.25도, 안 되면 2.5도)을 고른다
    const grid = (g: number) => {
      const h0 = Math.min(60 - g, Math.floor(head / g) * g), l0 = Math.min(40 - g, Math.floor(leg / g) * g)
      const th = (head - h0) / g, tl = (leg - l0) / g
      const need = [[h0, l0], [h0 + g, l0], [h0, l0 + g], [h0 + g, l0 + g]].filter(([h, l]) => (h > h0 ? th > 0.001 : true) && (l > l0 ? tl > 0.001 : true))
      return { h0, l0, g, th, tl, ok: need.every(([h, l]) => blobs.current.has(key(h, l))), need }
    }
    const use = [grid(STEP), grid(STEP * 2)].find((x) => x.ok)
    if (!use) {
      // 5도 간격 사진만 있을 때는 섞지 않고 가장 가까운 한 장(5도끼리 섞으면 판이 여러 겹으로 보인다)
      const im = want(key(Math.round(head / CSTEP) * CSTEP, Math.round(leg / CSTEP) * CSTEP))
      if (im) {
        if (c.width !== im.width) { c.width = im.width; c.height = im.height }
        ctx.drawImage(im, 0, 0, c.width, c.height)
      }
      return  // 아직 안 풀렸으면 이전 그림을 그대로 둔다
    }
    const { h0, l0, g, th, tl } = use
    const imgs = new Map(use.need.map(([h, l]) => [key(h, l), want(key(h, l))]))
    if ([...imgs.values()].some((x) => !x)) return  // 푸는 중이면 이전 그림을 그대로 둔다(다 풀리면 다시 그린다)
    const get = (h: number, l: number) => imgs.get(key(h, l))
    const first = get(h0, l0)!
    if (c.width !== first.width) { c.width = first.width; c.height = first.height }
    if (!scratch.current) scratch.current = document.createElement('canvas')
    const s = scratch.current
    if (s.width !== c.width) { s.width = c.width; s.height = c.height }
    const o = s.getContext('2d')!
    // 머리 방향으로 두 장을 섞어 한 줄을 만든다
    const row = (target: CanvasRenderingContext2D, l: number) => {
      const a = get(h0, l), b = th > 0.001 ? get(h0 + g, l) : undefined
      target.globalAlpha = 1
      if (a) target.drawImage(a, 0, 0, c.width, c.height)
      if (b) { target.globalAlpha = th; target.drawImage(b, 0, 0, c.width, c.height) }
      target.globalAlpha = 1
    }
    // 아래 줄은 화면에 바로, 위 줄은 보조 캔버스에 그린 뒤 다리 비율만큼 겹친다
    row(ctx, l0)
    if (tl > 0.001) {
      row(o, l0 + g)
      ctx.globalAlpha = tl
      ctx.drawImage(s, 0, 0)
      ctx.globalAlpha = 1
    }
  }, [angles.head, angles.leg, tick])

  return (
    <div className="photo-bed">
      <canvas ref={canvas} aria-label={`침대 사진. 머리 ${Math.round(angles.head)}도, 다리 ${Math.round(angles.leg)}도`} role="img" />
      {ringing && <div className="ring-overlay" aria-hidden="true" />}
      {loaded < TOTAL && <span className="loading-note">사진 {loaded}/{TOTAL}장 불러옴</span>}
    </div>
  )
}
