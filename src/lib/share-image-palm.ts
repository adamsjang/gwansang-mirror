import type { HandShape } from '../data/palm-zones'
import { PALM_ZONES } from '../data/palm-zones'

const SHARE_W = 1080
const SHARE_H = 1350

interface BuildArgs {
  captureDataUrl: string
  handShape: HandShape
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/**
 * 손금 공유 카드 PNG 합성. 1080×1350 (4:5).
 * 의도적으로 비식별 토글은 없음 — 얼굴이 아니라 손이라 식별 위험이 낮음.
 * 단 disclaimer는 카드에 명시.
 */
export async function buildPalmShareImage(args: BuildArgs): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_W
  canvas.height = SHARE_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // 배경
  ctx.fillStyle = '#FAF8F5'
  ctx.fillRect(0, 0, SHARE_W, SHARE_H)

  // 상단 헤더
  ctx.fillStyle = '#8B6914'
  ctx.textAlign = 'center'
  ctx.font = 'bold 56px "Noto Serif KR", "Apple SD Gothic Neo", serif'
  ctx.fillText('手相鏡', SHARE_W / 2, 90)

  ctx.fillStyle = '#6B5744'
  ctx.font = '26px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('손금경 — 손 모양·손금선 위치 안내', SHARE_W / 2, 140)

  // 캡처 사진 (rounded)
  const img = await loadImage(args.captureDataUrl)
  const photoSize = 540
  const photoX = (SHARE_W - photoSize) / 2
  const photoY = 180
  const naturalRatio = img.height / img.width
  const photoH = photoSize * naturalRatio
  const r = 16

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(photoX + r, photoY)
  ctx.arcTo(photoX + photoSize, photoY, photoX + photoSize, photoY + photoH, r)
  ctx.arcTo(photoX + photoSize, photoY + photoH, photoX, photoY + photoH, r)
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY, r)
  ctx.arcTo(photoX, photoY, photoX + photoSize, photoY, r)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, photoX, photoY, photoSize, photoH)
  ctx.restore()

  let cursorY = photoY + photoH + 50

  // 손 모양 분류 (얼굴형 자리)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8B6914'
  ctx.font = '22px "Noto Sans KR", sans-serif'
  ctx.fillText('손 모양', SHARE_W / 2, cursorY)
  cursorY += 40
  ctx.fillStyle = '#2C1810'
  ctx.font = 'bold 36px "Noto Sans KR", sans-serif'
  ctx.fillText(`${args.handShape.name}  ${args.handShape.hanja}`, SHARE_W / 2, cursorY)
  cursorY += 44

  // 8 손금선 grid — 이름만 (측정값 없음)
  const cols = 2
  const colW = (SHARE_W - 140) / cols
  const colX0 = 70
  ctx.textAlign = 'left'
  ctx.font = '500 22px "Noto Sans KR", sans-serif'

  const lines = [...PALM_ZONES].sort((a, b) => a.order - b.order)
  const rows = Math.ceil(lines.length / cols)
  const rowH = 38

  // sectional header
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8B6914'
  ctx.font = '20px "Noto Sans KR", sans-serif'
  ctx.fillText('손금 8선 (위치 안내)', SHARE_W / 2, cursorY)
  cursorY += 28

  for (let i = 0; i < lines.length; i++) {
    const z = lines[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = colX0 + col * colW
    const y = cursorY + row * rowH

    ctx.fillStyle = 'rgba(192, 57, 43, 0.85)'
    ctx.beginPath()
    ctx.arc(x + 8, y - 6, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#2C1810'
    ctx.textAlign = 'left'
    ctx.font = '500 20px "Noto Sans KR", sans-serif'
    ctx.fillText(z.name, x + 22, y)
  }
  cursorY += rows * rowH

  // 푸터 — disclaimer + URL
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6B5744'
  ctx.font = '18px "Noto Sans KR", sans-serif'
  ctx.fillText('손금 선 형태는 직접 측정하지 않은 가이드 도식입니다', SHARE_W / 2, SHARE_H - 80)

  ctx.fillStyle = '#8B6914'
  ctx.font = 'bold 22px "Noto Sans KR", sans-serif'
  ctx.fillText('gwansang-mirror.pages.dev/palm', SHARE_W / 2, SHARE_H - 40)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
      0.92
    )
  })
}

export type { HandShape }
