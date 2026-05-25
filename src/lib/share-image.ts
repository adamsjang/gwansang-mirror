import type { ZoneMeasurement, AdvancedMeasurement } from './measurements'
import type { FaceShape } from '../data/physiognomy-zones'

const SHARE_W = 1080
const SHARE_H = 1350 // 4:5 (인스타그램 친화)

/**
 * 도식(얼굴 사진 미포함 모드)에서 각 zone의 빨강 anchor dot이 찍히는 위치를
 * 1080×1350 캔버스 좌표 기준으로 % 변환한 값.
 *
 * ResultScreen이 도식 PNG 위에 absolute span을 띄울 때 사용한다. 도식 placeholderH
 * 또는 dot 좌표가 바뀌면 이 값도 같이 손봐야 한다.
 *
 * - ear는 도식에 점이 없으므로 키에 없음 (도식 강조 skip).
 * - jaw는 얼굴형마다 yBottom이 약간 다른데 (height 430~510), 평균값(53.5%)로 둠.
 *   사람 눈에 식별 가능한 수준 안의 오차.
 */
export const SCHEMATIC_DOT_PCT: Record<string, { left: string; top: string }> = {
  forehead: { left: '50%', top: '26.7%' },
  eyebrow: { left: '44.4%', top: '29.7%' },
  eyes: { left: '44.3%', top: '33.3%' },
  cheekbone: { left: '38.1%', top: '37.9%' },
  nose: { left: '50%', top: '38.4%' },
  philtrum: { left: '50%', top: '43.3%' },
  mouth: { left: '50%', top: '45.3%' },
  jaw: { left: '50%', top: '53.5%' },
}

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

    // 3) 얼굴형 외곽선 — 사람 두상 형태
    //    정수리는 평평, 관자놀이는 거의 수직, 광대가 가장 넓고, 턱 모서리에서
    //    명확한 변곡점, 턱끝은 부드럽게 마감.
    //    얼굴형별로 head/temple/cheek/jaw/chin 폭과 height를 다르게 잡는다.
    const faceParams: Record<
      string,
      {
        headW: number   // 정수리 폭
        templeW: number // 관자놀이 폭
        cheekW: number  // 광대 폭 (최대)
        jawW: number    // 턱 모서리 폭
        chinW: number   // 턱끝 폭 (중심에서)
        height: number  // 정수리 ~ 턱끝
      }
    > = {
      round: { headW: 150, templeW: 175, cheekW: 200, jawW: 170, chinW: 90, height: 440 },
      oval: { headW: 130, templeW: 160, cheekW: 185, jawW: 135, chinW: 60, height: 470 },
      long: { headW: 115, templeW: 140, cheekW: 165, jawW: 115, chinW: 55, height: 510 },
      square: { headW: 175, templeW: 195, cheekW: 200, jawW: 190, chinW: 110, height: 430 },
    }
    const fp = faceParams[args.faceShape.id] ?? faceParams.oval

    const yTop = centerY - fp.height / 2 // 정수리
    const yTemple = centerY - fp.height * 0.32 // 관자놀이
    const yCheek = centerY + 10 // 광대 (가장 넓음)
    const yJawCorner = centerY + fp.height * 0.27 // 턱 모서리
    const yBottom = centerY + fp.height / 2 // 턱끝

    ctx.save()
    ctx.strokeStyle = '#8B6914'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX, yTop)
    // 오른쪽: 정수리 평평 → 관자놀이
    ctx.bezierCurveTo(
      centerX + fp.headW * 0.6, yTop,
      centerX + fp.templeW, yTop + 20,
      centerX + fp.templeW, yTemple
    )
    // 관자놀이 → 광대 (살짝 부풀면서 내려옴)
    ctx.bezierCurveTo(
      centerX + fp.templeW, yTemple + 40,
      centerX + fp.cheekW, yCheek - 20,
      centerX + fp.cheekW, yCheek
    )
    // 광대 → 턱 모서리 (수직에 가까운 직선 느낌 + square는 더 곧게)
    ctx.bezierCurveTo(
      centerX + fp.cheekW, yCheek + 50,
      centerX + fp.jawW * 1.02, yJawCorner - 10,
      centerX + fp.jawW, yJawCorner + 10
    )
    // 턱 모서리 → 턱끝 (사선)
    ctx.bezierCurveTo(
      centerX + fp.jawW * 0.85, yJawCorner + 60,
      centerX + fp.chinW * 1.4, yBottom - 20,
      centerX + fp.chinW, yBottom - 5
    )
    // 턱끝 (부드러운 마감)
    ctx.quadraticCurveTo(centerX, yBottom + 10, centerX - fp.chinW, yBottom - 5)
    // 왼쪽 (대칭): 턱끝 → 턱 모서리
    ctx.bezierCurveTo(
      centerX - fp.chinW * 1.4, yBottom - 20,
      centerX - fp.jawW * 0.85, yJawCorner + 60,
      centerX - fp.jawW, yJawCorner + 10
    )
    // 턱 모서리 → 광대
    ctx.bezierCurveTo(
      centerX - fp.jawW * 1.02, yJawCorner - 10,
      centerX - fp.cheekW, yCheek + 50,
      centerX - fp.cheekW, yCheek
    )
    // 광대 → 관자놀이
    ctx.bezierCurveTo(
      centerX - fp.cheekW, yCheek - 20,
      centerX - fp.templeW, yTemple + 40,
      centerX - fp.templeW, yTemple
    )
    // 관자놀이 → 정수리
    ctx.bezierCurveTo(
      centerX - fp.templeW, yTop + 20,
      centerX - fp.headW * 0.6, yTop,
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

    // 5) 부위명 라벨 + 점 + 리더 라인
    //    feature 자체는 시각 anchor 역할, 점은 라벨이 어디를 가리키는지 확정.
    type LabelPoint = {
      label: string
      align: 'left' | 'right' | 'center'
      labelX: number
      labelY: number
      dotX: number // 얼굴 위 부위 점 위치 (feature와 일치)
      dotY: number
    }
    const ledLeft = centerX - fp.cheekW - 15
    const ledRight = centerX + fp.cheekW + 15
    const labelPoints: LabelPoint[] = [
      // 이마: feature 위 (정수리와 눈썹 사이)
      { label: '이마', align: 'center', labelX: centerX, labelY: yTop - 24, dotX: centerX, dotY: centerY - 140 },
      // 눈썹: 왼 눈썹 가운데 anchor
      { label: '눈썹', align: 'right', labelX: ledLeft, labelY: browY, dotX: centerX - 60, dotY: browY - 4 },
      // 눈: 왼 눈 중심
      { label: '눈', align: 'right', labelX: ledLeft, labelY: eyeY, dotX: centerX - 62, dotY: eyeY },
      // 광대: 왼 광대 호 위치
      { label: '광대', align: 'right', labelX: ledLeft, labelY: cheekY, dotX: centerX - 128, dotY: cheekY },
      // 코: 콧날 중간
      { label: '코', align: 'left', labelX: ledRight, labelY: centerY + 12, dotX: centerX, dotY: centerY + 18 },
      // 인중: 코밑 ~ 입 사이
      { label: '인중', align: 'left', labelX: ledRight, labelY: centerY + 82, dotX: centerX, dotY: centerY + 84 },
      // 입: 입 중심
      { label: '입', align: 'left', labelX: ledRight, labelY: mouthY + 6, dotX: centerX, dotY: mouthY + 4 },
      // 턱: 턱끝 약간 위
      { label: '턱', align: 'center', labelX: centerX, labelY: yBottom + 28, dotX: centerX, dotY: yBottom - 10 },
    ]

    // 점 — 얼굴 위 anchor
    ctx.save()
    ctx.fillStyle = 'rgba(192, 57, 43, 0.9)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    for (const p of labelPoints) {
      ctx.beginPath()
      ctx.arc(p.dotX, p.dotY, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()

    // 리더 라인 (점 → 라벨) — 측면 라벨에만 (위/아래는 라벨이 점 바로 위·아래라 불필요)
    ctx.save()
    ctx.strokeStyle = 'rgba(139, 105, 20, 0.45)'
    ctx.lineWidth = 1.5
    for (const p of labelPoints) {
      if (p.align === 'center') continue
      ctx.beginPath()
      ctx.moveTo(p.dotX, p.dotY)
      ctx.lineTo(p.labelX + (p.align === 'right' ? 8 : -8), p.labelY)
      ctx.stroke()
    }
    ctx.restore()

    // 라벨 텍스트
    ctx.font = '500 20px "Noto Sans KR", sans-serif'
    ctx.fillStyle = '#2C1810'
    ctx.textBaseline = 'middle'
    for (const p of labelPoints) {
      if (p.align === 'right') {
        ctx.textAlign = 'right'
        ctx.fillText(p.label, p.labelX, p.labelY)
      } else if (p.align === 'left') {
        ctx.textAlign = 'left'
        ctx.fillText(p.label, p.labelX, p.labelY)
      } else {
        ctx.textAlign = 'center'
        ctx.fillText(p.label, p.labelX, p.labelY)
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
  ctx.font = '18px "Noto Sans KR", sans-serif'
  const lineHeight = 26
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
