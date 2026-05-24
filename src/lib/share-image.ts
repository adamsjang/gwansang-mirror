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
  /** false면 캡처 사진 자리에 placeholder 도식만 그림 (얼굴 비식별화) */
  includePhoto: boolean
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

  // 사진 영역 — 사용자 토글로 원본 vs 비식별 도식 선택
  const photoSize = 540
  const photoX = (SHARE_W - photoSize) / 2
  const photoY = 180
  const r = 16
  let photoH: number

  if (args.includePhoto) {
    // 원본 사진 (사용자가 의식적으로 토글 ON)
    const img = await loadImage(args.captureDataUrl)
    const naturalRatio = img.height / img.width
    photoH = photoSize * naturalRatio
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
  } else {
    // 비식별 도식 — 얼굴형 외곽선 + 라벨 점 + 가운데 한자
    const placeholderH = 640
    photoH = placeholderH

    // 1) 부드러운 그라데이션 배경 카드
    ctx.save()
    const grad = ctx.createLinearGradient(photoX, photoY, photoX, photoY + placeholderH)
    grad.addColorStop(0, 'rgba(139, 105, 20, 0.08)')
    grad.addColorStop(1, 'rgba(232, 221, 212, 0.5)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(photoX + r, photoY)
    ctx.arcTo(photoX + photoSize, photoY, photoX + photoSize, photoY + placeholderH, r)
    ctx.arcTo(photoX + photoSize, photoY + placeholderH, photoX, photoY + placeholderH, r)
    ctx.arcTo(photoX, photoY + placeholderH, photoX, photoY, r)
    ctx.arcTo(photoX, photoY, photoX + photoSize, photoY, r)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    const centerX = SHARE_W / 2
    const centerY = photoY + placeholderH / 2

    // 2) 가운데 큰 얼굴형 한자 (워터마크 톤)
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const faceHanja: Record<string, string> = {
      round: '圓',
      oval: '卵',
      long: '長',
      square: '方',
    }
    ctx.fillStyle = 'rgba(139, 105, 20, 0.10)'
    ctx.font = 'bold 320px "Noto Serif KR", serif'
    ctx.fillText(faceHanja[args.faceShape.id] ?? '卵', centerX, centerY + 10)
    ctx.restore()

    // 3) 얼굴형 외곽선 — 광대→턱이 자연스럽게 좁아지는 인간 얼굴 곡선 (Bezier)
    // 얼굴형별 width 파라미터로 차이를 표현 (topWidth: 이마, cheekWidth: 광대,
    // jawWidth: 턱 옆, chinWidth: 턱 중앙).
    const faceParams: Record<
      string,
      { topW: number; cheekW: number; jawW: number; chinW: number; height: number }
    > = {
      round: { topW: 150, cheekW: 200, jawW: 160, chinW: 70, height: 420 },
      oval: { topW: 130, cheekW: 180, jawW: 130, chinW: 50, height: 460 },
      long: { topW: 110, cheekW: 160, jawW: 110, chinW: 45, height: 500 },
      square: { topW: 170, cheekW: 195, jawW: 180, chinW: 90, height: 420 },
    }
    const fp = faceParams[args.faceShape.id] ?? faceParams.oval

    const yTop = centerY - fp.height / 2 + 20 // 이마 위
    const yBottom = centerY + fp.height / 2 // 턱끝
    const yCheek = centerY + 10 // 광대 높이 (가장 넓음)
    const yJawCorner = centerY + fp.height / 2 - 90 // 턱 모서리

    ctx.save()
    ctx.strokeStyle = '#8B6914'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX, yTop)
    // 오른쪽: 이마 → 광대
    ctx.bezierCurveTo(
      centerX + fp.topW * 1.05, yTop + 10,
      centerX + fp.cheekW, yCheek - 90,
      centerX + fp.cheekW, yCheek
    )
    // 광대 → 턱 모서리
    ctx.bezierCurveTo(
      centerX + fp.cheekW, yJawCorner - 30,
      centerX + fp.jawW, yJawCorner + 10,
      centerX + fp.chinW, yBottom - 20
    )
    // 턱 중앙 (둥근 마감)
    ctx.quadraticCurveTo(centerX, yBottom + 8, centerX - fp.chinW, yBottom - 20)
    // 왼쪽 (대칭): 턱 모서리 → 광대
    ctx.bezierCurveTo(
      centerX - fp.jawW, yJawCorner + 10,
      centerX - fp.cheekW, yJawCorner - 30,
      centerX - fp.cheekW, yCheek
    )
    // 광대 → 이마
    ctx.bezierCurveTo(
      centerX - fp.cheekW, yCheek - 90,
      centerX - fp.topW * 1.05, yTop + 10,
      centerX, yTop
    )
    ctx.closePath()
    ctx.stroke()
    ctx.restore()

    // 4) 얼굴 선화 — 눈썹·눈·코·입·인중 (line art, 비식별)
    ctx.save()
    ctx.strokeStyle = '#8B6914'
    ctx.fillStyle = '#8B6914'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // 눈썹 (좌/우) — 두꺼운 stroke, 살짝 아치
    ctx.lineWidth = 4
    const browY = centerY - 95
    ctx.beginPath()
    ctx.moveTo(centerX - 98, browY + 8)
    ctx.quadraticCurveTo(centerX - 60, browY - 12, centerX - 22, browY + 8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(centerX + 22, browY + 8)
    ctx.quadraticCurveTo(centerX + 60, browY - 12, centerX + 98, browY + 8)
    ctx.stroke()

    // 눈 (좌/우) — 약간 가로로 더 긴 타원 + 차분한 동공
    ctx.lineWidth = 3
    const eyeY = centerY - 50
    ctx.beginPath()
    ctx.ellipse(centerX - 62, eyeY, 32, 9, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(centerX + 62, eyeY, 32, 9, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(centerX - 62, eyeY, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + 62, eyeY, 3, 0, Math.PI * 2)
    ctx.fill()

    // 코 — 부드러운 콧날 + 좌우 콧방울 작은 호
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(centerX, centerY - 12)
    ctx.bezierCurveTo(
      centerX - 1, centerY + 18,
      centerX - 5, centerY + 44,
      centerX, centerY + 50
    )
    ctx.stroke()
    // 콧방울 좌/우
    ctx.beginPath()
    ctx.arc(centerX - 7, centerY + 50, 6, Math.PI * 0.0, Math.PI * 0.9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(centerX + 7, centerY + 50, 6, Math.PI * 0.1, Math.PI * 1.0)
    ctx.stroke()

    // 인중 — 코밑에서 입까지 좁고 부드러운 세로선
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(centerX, centerY + 72)
    ctx.lineTo(centerX, centerY + 96)
    ctx.stroke()

    // 입 — 잔잔한 미소 (곡률 살짝 줄임)
    ctx.lineWidth = 3
    const mouthY = centerY + 108
    ctx.beginPath()
    ctx.moveTo(centerX - 42, mouthY)
    ctx.quadraticCurveTo(centerX, mouthY + 10, centerX + 42, mouthY)
    ctx.stroke()

    // 광대 — 좌우에 짧은 하이라이트 호 (살짝 길고 옅게)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = 'rgba(139, 105, 20, 0.65)'
    const cheekY = centerY + 12
    ctx.beginPath()
    ctx.arc(centerX - 128, cheekY, 14, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(centerX + 128, cheekY, 14, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    ctx.restore()

    // 5) 부위명 라벨 — 얼굴 외곽 바깥쪽에 배치 (외곽선/feature와 겹치지 않게)
    type LabelPoint = { x: number; y: number; label: string; align: 'left' | 'right' | 'center' }
    const labelPoints: LabelPoint[] = [
      { x: centerX, y: yTop - 24, label: '이마', align: 'center' },
      { x: centerX - fp.cheekW - 15, y: browY, label: '눈썹', align: 'right' },
      { x: centerX - fp.cheekW - 15, y: eyeY, label: '눈', align: 'right' },
      { x: centerX - fp.cheekW - 15, y: cheekY, label: '광대', align: 'right' },
      { x: centerX + fp.cheekW + 15, y: centerY + 12, label: '코', align: 'left' },
      { x: centerX + fp.cheekW + 15, y: centerY + 80, label: '인중', align: 'left' },
      { x: centerX + fp.cheekW + 15, y: mouthY + 6, label: '입', align: 'left' },
      { x: centerX, y: yBottom + 28, label: '턱', align: 'center' },
    ]

    ctx.font = '500 20px "Noto Sans KR", sans-serif'
    ctx.fillStyle = '#2C1810'
    ctx.textBaseline = 'middle'
    for (const p of labelPoints) {
      if (!p.label) continue
      if (p.align === 'right') {
        ctx.textAlign = 'right'
        ctx.fillText(p.label, p.x, p.y)
      } else if (p.align === 'left') {
        ctx.textAlign = 'left'
        ctx.fillText(p.label, p.x, p.y)
      } else {
        ctx.textAlign = 'center'
        ctx.fillText(p.label, p.x, p.y)
      }
    }

    // 5) 비식별 표시 라벨 (카드 하단)
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#6B5744'
    ctx.font = '20px "Noto Sans KR", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('얼굴 사진은 공유에 포함되지 않습니다', centerX, photoY + placeholderH - 24)
  }

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
  ctx.font = '20px "Noto Sans KR", sans-serif'
  const lineHeight = 30
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
