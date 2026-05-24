import type { ZoneMeasurement, AdvancedMeasurement } from './measurements'
import type { FaceShape } from '../data/physiognomy-zones'

const SHARE_W = 1080
const SHARE_H = 1350 // 4:5 (인스타그램 친화)

const ZONE_KOREAN: Record<string, string> = {
  forehead: '이마',
  eyebrow: '눈썹 간격',
  eyes: '눈',
  cheekbone: '광대',
  nose: '코',
  philtrum: '인중',
  mouth: '입',
  jaw: '턱',
}

const ADV_KOREAN: Record<string, string> = {
  eye_tilt: '눈꼬리',
  mouth_corner: '입꼬리',
  eyebrow_arch: '눈썹 아치',
}

interface BuildArgs {
  captureDataUrl: string
  faceShape: FaceShape
  measurements: ZoneMeasurement[]
  advanced: AdvancedMeasurement[]
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
 * 공유 카드 PNG 합성.
 * 의도적으로 통합 해석 텍스트는 절대 포함하지 않음 — 그건 paid 가치 영역.
 * 카드에는 캡처 사진 + 얼굴형 + 부위별 분류 라벨만 노출.
 */
export async function buildShareImage(args: BuildArgs): Promise<Blob> {
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
  ctx.fillText('觀相鏡', SHARE_W / 2, 90)

  ctx.fillStyle = '#6B5744'
  ctx.font = '28px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('관상경 — 내 얼굴 부위 측정', SHARE_W / 2, 140)

  // 캡처 사진
  const img = await loadImage(args.captureDataUrl)
  const photoSize = 540
  const naturalRatio = img.height / img.width
  const photoW = photoSize
  const photoH = photoSize * naturalRatio
  const photoX = (SHARE_W - photoW) / 2
  const photoY = 180

  ctx.save()
  // 부드러운 액자 — 모서리 라운드
  const r = 16
  ctx.beginPath()
  ctx.moveTo(photoX + r, photoY)
  ctx.arcTo(photoX + photoW, photoY, photoX + photoW, photoY + photoH, r)
  ctx.arcTo(photoX + photoW, photoY + photoH, photoX, photoY + photoH, r)
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY, r)
  ctx.arcTo(photoX, photoY, photoX + photoW, photoY, r)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, photoX, photoY, photoW, photoH)
  ctx.restore()

  // 얼굴형 라벨
  let cursorY = photoY + photoH + 50
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8B6914'
  ctx.font = '22px "Noto Sans KR", sans-serif'
  ctx.fillText('얼굴형', SHARE_W / 2, cursorY)
  cursorY += 36
  ctx.fillStyle = '#2C1810'
  ctx.font = 'bold 36px "Noto Sans KR", sans-serif'
  ctx.fillText(args.faceShape.name, SHARE_W / 2, cursorY)
  cursorY += 50

  // 측정 라인들 — 부위 + 분류 라벨만 (수치 X로 압축, 단정 톤 회피)
  ctx.textAlign = 'left'
  ctx.font = '22px "Noto Sans KR", sans-serif'
  const lineHeight = 36
  const leftCol = 70
  const rightCol = SHARE_W - 70

  const lines: { label: string; desc: string }[] = []
  for (const m of args.measurements) {
    const k = ZONE_KOREAN[m.zoneId]
    if (k) lines.push({ label: k, desc: m.description })
  }
  for (const a of args.advanced) {
    const k = ADV_KOREAN[a.id]
    if (k) lines.push({ label: k, desc: a.levelLabel })
  }

  // 위에서부터 끼워 넣을 수 있는 줄 수 계산
  const maxLines = Math.floor((SHARE_H - cursorY - 120) / lineHeight)
  const used = lines.slice(0, maxLines)
  for (const ln of used) {
    ctx.fillStyle = '#6B5744'
    ctx.textAlign = 'left'
    ctx.fillText(ln.label, leftCol, cursorY)
    ctx.fillStyle = '#2C1810'
    ctx.textAlign = 'right'
    ctx.fillText(ln.desc, rightCol, cursorY)
    cursorY += lineHeight
  }

  // 푸터 — 출처
  ctx.fillStyle = '#8B6914'
  ctx.textAlign = 'center'
  ctx.font = 'bold 22px "Noto Sans KR", sans-serif'
  ctx.fillText('gwansang-mirror.pages.dev', SHARE_W / 2, SHARE_H - 48)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
      0.92
    )
  })
}

/**
 * 모바일 OS는 navigator.share로 SNS/메시지 직접 공유.
 * 데스크탑/미지원 환경은 PNG 다운로드 폴백.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' })

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }
  const canFiles = typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
  if (canFiles && typeof nav.share === 'function') {
    try {
      await nav.share({
        files: [file],
        title: '관상경 결과',
        text: '내 얼굴 부위 측정 결과 — 觀相鏡',
      })
      return 'shared'
    } catch (e) {
      // AbortError → 사용자가 취소. 그 외 → 다운로드로 폴백
      if (e instanceof DOMException && e.name === 'AbortError') {
        return 'cancelled'
      }
      // 알 수 없는 에러는 fallthrough
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
