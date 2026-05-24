import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/**
 * 부위별 측정 결과.
 * - ratio: 얼굴 폭 또는 길이에 대한 비율 (0~1)
 * - level: 평균 대비 분류
 * - label: 사용자에게 보여줄 표현 (예: "코 길이 / 얼굴 길이")
 * - description: 분류를 사람 말로 (예: "평균보다 긴 편")
 */
export interface ZoneMeasurement {
  zoneId: string
  ratio: number
  ratioLabel: string
  level: 'low' | 'mid' | 'high'
  description: string
}

/**
 * 분류 임계값과 의미 라벨.
 * 한국인 평균 비율을 기준으로 한 대략적인 분포 기준 — 학술 정확도가 아니라
 * "상대적으로 평균보다 어디에 있는지" 가벼운 참고용.
 */
interface Threshold {
  low: number // 이 값 미만이면 'low'
  high: number // 이 값 초과면 'high'
  labels: { low: string; mid: string; high: string }
  ratioLabel: string
}

const THRESHOLDS: Record<string, Threshold> = {
  forehead: {
    low: 0.25,
    high: 0.35,
    labels: { low: '평균보다 좁은 편', mid: '평균', high: '평균보다 넓은 편' },
    ratioLabel: '이마 높이 / 얼굴 높이',
  },
  eyebrow: {
    low: 0.08,
    high: 0.13,
    labels: { low: '눈썹 사이가 가까운 편', mid: '평균', high: '눈썹 사이가 먼 편' },
    ratioLabel: '두 눈썹 사이 / 얼굴 폭',
  },
  eyes: {
    low: 0.17,
    high: 0.23,
    labels: { low: '평균보다 작은 편', mid: '평균', high: '평균보다 큰 편' },
    ratioLabel: '한쪽 눈 너비 / 얼굴 폭',
  },
  nose: {
    low: 0.28,
    high: 0.38,
    labels: { low: '평균보다 짧은 편', mid: '평균', high: '평균보다 긴 편' },
    ratioLabel: '코 길이 / 얼굴 높이',
  },
  cheekbone: {
    low: 0.86,
    high: 0.95,
    labels: { low: '평균보다 좁은 편', mid: '평균', high: '평균보다 넓은 편' },
    ratioLabel: '광대 폭 / 얼굴 폭',
  },
  philtrum: {
    low: 0.05,
    high: 0.09,
    labels: { low: '평균보다 짧은 편', mid: '평균', high: '평균보다 긴 편' },
    ratioLabel: '인중 길이 / 얼굴 높이',
  },
  mouth: {
    low: 0.45,
    high: 0.55,
    labels: { low: '평균보다 좁은 편', mid: '평균', high: '평균보다 넓은 편' },
    ratioLabel: '입 폭 / 얼굴 폭',
  },
  jaw: {
    low: 0.2,
    high: 0.3,
    labels: { low: '평균보다 짧은 편', mid: '평균', high: '평균보다 긴 편' },
    ratioLabel: '턱 길이 / 얼굴 높이',
  },
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function classify(ratio: number, t: Threshold): 'low' | 'mid' | 'high' {
  if (ratio < t.low) return 'low'
  if (ratio > t.high) return 'high'
  return 'mid'
}

function make(zoneId: string, ratio: number): ZoneMeasurement {
  const t = THRESHOLDS[zoneId]
  const level = classify(ratio, t)
  return {
    zoneId,
    ratio,
    ratioLabel: t.ratioLabel,
    level,
    description: t.labels[level],
  }
}

/**
 * MediaPipe Face Landmarker 468 mesh에서 부위별 비율 측정.
 *
 * 주요 reference 점:
 *  - 이마 정점: 10
 *  - 턱끝: 152
 *  - 얼굴 좌측/우측 가장 바깥: 234 / 454
 *  - 양 눈썹 안쪽 끝: 107 / 336
 *  - 눈 (왼쪽 corners): 33, 133  /  (오른쪽): 263, 362
 *  - 광대 (왼쪽): 234 (사용) — face contour 좌측 가장 바깥점 근사
 *  - 코끝: 1
 *  - 윗입술 중심 상단: 0  /  아랫입술 중심 하단: 17
 *  - 입 양 끝: 61 / 291
 */
export function computeMeasurements(landmarks: NormalizedLandmark[]): ZoneMeasurement[] {
  const top = landmarks[10]
  const chin = landmarks[152]
  const left = landmarks[234]
  const right = landmarks[454]
  if (!top || !chin || !left || !right) return []

  const faceHeight = dist(top, chin)
  const faceWidth = dist(left, right)
  if (faceHeight === 0 || faceWidth === 0) return []

  const out: ZoneMeasurement[] = []

  // 이마 — 정점(10) ~ 양 눈썹 안쪽 평균(107/336)
  const browInnerL = landmarks[107]
  const browInnerR = landmarks[336]
  if (browInnerL && browInnerR) {
    const browCenter: NormalizedLandmark = {
      x: (browInnerL.x + browInnerR.x) / 2,
      y: (browInnerL.y + browInnerR.y) / 2,
      z: 0,
      visibility: 1,
    }
    out.push(make('forehead', dist(top, browCenter) / faceHeight))

    // 두 눈썹 사이 거리
    out.push(make('eyebrow', dist(browInnerL, browInnerR) / faceWidth))
  }

  // 눈 — 왼쪽 눈 너비 (33-133) 평균이 얼굴 폭에 비례
  const eyeLOut = landmarks[33]
  const eyeLIn = landmarks[133]
  const eyeROut = landmarks[263]
  const eyeRIn = landmarks[362]
  if (eyeLOut && eyeLIn && eyeROut && eyeRIn) {
    const widthL = dist(eyeLOut, eyeLIn)
    const widthR = dist(eyeROut, eyeRIn)
    out.push(make('eyes', ((widthL + widthR) / 2) / faceWidth))
  }

  // 코 — 눈썹 중심 ~ 코끝(1)
  const noseTip = landmarks[1]
  if (browInnerL && browInnerR && noseTip) {
    const browCenter: NormalizedLandmark = {
      x: (browInnerL.x + browInnerR.x) / 2,
      y: (browInnerL.y + browInnerR.y) / 2,
      z: 0,
      visibility: 1,
    }
    out.push(make('nose', dist(browCenter, noseTip) / faceHeight))
  }

  // 광대 — 얼굴 폭 그 자체를 광대 폭으로 사용 (정면 기준)
  out.push(make('cheekbone', faceWidth / faceWidth)) // = 1.0; 대신 50/280 추정
  // 실제로는 광대 가장 안쪽 점(50/280) 사용이 정확하지만 여기선 235/455 같은
  // contour 좌우 점을 광대 근사로 사용. mid 분류가 의미가 떨어지므로 별도 처리:
  const cheekL = landmarks[234]
  const cheekR = landmarks[454]
  // 광대만의 분류는 face contour 폭이라 항상 1 → 대신 50/280 사이 거리 사용
  const cheekInnerL = landmarks[50]
  const cheekInnerR = landmarks[280]
  if (cheekInnerL && cheekInnerR && cheekL && cheekR) {
    const innerW = dist(cheekInnerL, cheekInnerR)
    out.pop() // 위의 dummy 광대 측정 제거
    out.push(make('cheekbone', innerW / faceWidth))
  }

  // 인중 — 코끝(1) ~ 윗입술 중심(0)
  const lipTop = landmarks[0]
  if (noseTip && lipTop) {
    out.push(make('philtrum', dist(noseTip, lipTop) / faceHeight))
  }

  // 입 폭 — 양 입 끝 61 ~ 291
  const lipL = landmarks[61]
  const lipR = landmarks[291]
  if (lipL && lipR) {
    out.push(make('mouth', dist(lipL, lipR) / faceWidth))
  }

  // 턱 — 아랫입술 하단(17) ~ 턱끝(152)
  const lipBottom = landmarks[17]
  if (lipBottom && chin) {
    out.push(make('jaw', dist(lipBottom, chin) / faceHeight))
  }

  return out
}
