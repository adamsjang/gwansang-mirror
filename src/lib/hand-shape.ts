import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { HAND_SHAPES, type HandShape } from '../data/palm-zones'

/**
 * MediaPipe Hand Landmarker 21 keypoint로 손 모양 4분류.
 *
 * 축 두 개:
 *  - palm aspect = 손바닥 길이(0↔9) / 손바닥 폭(5↔17). 1.0에 가까우면 사각형,
 *    크면 직사각형(긴 손바닥).
 *  - finger ratio = 중지 길이(9↔12) / 손바닥 길이(0↔9). 1보다 작으면 짧은 손가락.
 *
 * 분류 (서양 수상학 4 원소):
 *  - 사각형 + 짧음 → Earth(땅)
 *  - 사각형 + 김    → Air(공기)
 *  - 직사각 + 짧음 → Fire(불)
 *  - 직사각 + 김    → Water(물)
 */
function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

const PALM_ASPECT_BOUND = 1.15 // 이 미만이면 사각형, 이상이면 긴(직사각)
const FINGER_RATIO_BOUND = 0.95 // 이 미만이면 짧음, 이상이면 김

export interface HandShapeResult {
  shape: HandShape
  palmAspect: number // 손바닥 종횡비 (길이/폭)
  fingerRatio: number // 손가락 비율 (중지 길이/손바닥 길이)
}

/* ============================================================================
 * 정밀 측정 (β) — 손 분류 외 추가 측정값
 * ========================================================================== */

export interface HandAdvancedMeasurement {
  id: 'thumb_opening' | 'index_ring_ratio' | 'pinky_relative'
  name: string
  /** 정규화 값 또는 각도(degrees). 음수 가능. */
  ratio: number
  level: 'low' | 'mid' | 'high'
  levelLabel: string
}

interface AdvThreshold {
  low: number
  high: number
  labels: { low: string; mid: string; high: string }
  name: string
}

const THRESHOLDS: Record<HandAdvancedMeasurement['id'], AdvThreshold> = {
  thumb_opening: {
    low: 40,
    high: 60,
    labels: { low: '엄지가 좁은 편', mid: '평균', high: '엄지가 넓은 편' },
    name: '엄지 개방각',
  },
  index_ring_ratio: {
    low: 0.95,
    high: 1.0,
    labels: {
      low: '약지가 더 긴 편',
      mid: '비슷',
      high: '검지가 더 긴 편',
    },
    name: '검지/약지 비율',
  },
  pinky_relative: {
    low: 0.6,
    high: 0.7,
    labels: { low: '새끼가 짧은 편', mid: '평균', high: '새끼가 긴 편' },
    name: '새끼 길이',
  },
}

function classifyAdv(
  ratio: number,
  t: AdvThreshold
): 'low' | 'mid' | 'high' {
  if (ratio <= t.low) return 'low'
  if (ratio >= t.high) return 'high'
  return 'mid'
}

function makeAdv(
  id: HandAdvancedMeasurement['id'],
  ratio: number
): HandAdvancedMeasurement {
  const t = THRESHOLDS[id]
  const level = classifyAdv(ratio, t)
  return {
    id,
    name: t.name,
    ratio,
    level,
    levelLabel: t.labels[level],
  }
}

/**
 * 손 정밀 측정.
 *
 * 측정 정의:
 *  - thumb_opening: vec(2→4)와 vec(2→5)의 각도. 엄지 끝(4)이 IP(2) 기준
 *    검지 base(5)로부터 얼마나 벌어졌는지. degrees.
 *  - index_ring_ratio: 검지 길이(5↔8) / 약지 길이(13↔16). 1.0 미만이면
 *    약지가 더 김 (2D:4D 관점).
 *  - pinky_relative: 새끼 길이(17↔20) / 손바닥 길이(0↔9).
 */
export function computeHandAdvancedMeasurements(
  landmarks: NormalizedLandmark[]
): HandAdvancedMeasurement[] {
  const out: HandAdvancedMeasurement[] = []

  // thumb_opening (degrees)
  const thumbIP = landmarks[2]
  const thumbTip = landmarks[4]
  const indexBase = landmarks[5]
  if (thumbIP && thumbTip && indexBase) {
    const v1x = thumbTip.x - thumbIP.x
    const v1y = thumbTip.y - thumbIP.y
    const v2x = indexBase.x - thumbIP.x
    const v2y = indexBase.y - thumbIP.y
    const dot = v1x * v2x + v1y * v2y
    const m1 = Math.hypot(v1x, v1y)
    const m2 = Math.hypot(v2x, v2y)
    if (m1 > 0 && m2 > 0) {
      const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)))
      const degrees = (Math.acos(cos) * 180) / Math.PI
      out.push(makeAdv('thumb_opening', degrees))
    }
  }

  // index_ring_ratio (검지 길이 / 약지 길이)
  const indexTip = landmarks[8]
  const ringBase = landmarks[13]
  const ringTip = landmarks[16]
  if (indexBase && indexTip && ringBase && ringTip) {
    const indexLen = dist(indexBase, indexTip)
    const ringLen = dist(ringBase, ringTip)
    if (ringLen > 0) {
      out.push(makeAdv('index_ring_ratio', indexLen / ringLen))
    }
  }

  // pinky_relative (새끼 길이 / 손바닥 길이)
  const wrist = landmarks[0]
  const middleBase = landmarks[9]
  const pinkyBase = landmarks[17]
  const pinkyTip = landmarks[20]
  if (wrist && middleBase && pinkyBase && pinkyTip) {
    const pinkyLen = dist(pinkyBase, pinkyTip)
    const palmLen = dist(wrist, middleBase)
    if (palmLen > 0) {
      out.push(makeAdv('pinky_relative', pinkyLen / palmLen))
    }
  }

  return out
}

export function classifyHandShape(
  landmarks: NormalizedLandmark[]
): HandShapeResult | null {
  const wrist = landmarks[0]
  const indexBase = landmarks[5]
  const middleBase = landmarks[9]
  const middleTip = landmarks[12]
  const pinkyBase = landmarks[17]
  if (!wrist || !indexBase || !middleBase || !middleTip || !pinkyBase) return null

  const palmLength = dist(wrist, middleBase)
  const palmWidth = dist(indexBase, pinkyBase)
  const fingerLength = dist(middleBase, middleTip)
  if (palmLength === 0 || palmWidth === 0) return null

  const palmAspect = palmLength / palmWidth
  const fingerRatio = fingerLength / palmLength

  const isLongPalm = palmAspect >= PALM_ASPECT_BOUND
  const isLongFinger = fingerRatio >= FINGER_RATIO_BOUND

  let id: HandShape['id']
  if (isLongPalm && isLongFinger) id = 'water'
  else if (isLongPalm && !isLongFinger) id = 'fire'
  else if (!isLongPalm && isLongFinger) id = 'air'
  else id = 'earth'

  return {
    shape: HAND_SHAPES[id],
    palmAspect,
    fingerRatio,
  }
}
