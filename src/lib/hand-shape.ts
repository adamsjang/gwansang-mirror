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
