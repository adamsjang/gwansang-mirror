import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FACE_SHAPES, type FaceShape } from '../data/physiognomy-zones'

/**
 * MediaPipe Face Landmarker가 반환하는 468 mesh에서 정면 얼굴의
 * 폭/길이 비율로 얼굴형을 단순 분류.
 *
 * 정면이 아닌 회전된 얼굴에서는 결과가 부정확함 (MVP는 정면 기준).
 *
 * landmark 인덱스 기준:
 *  - 10: 이마 정점 (위)
 *  - 152: 턱끝 (아래)
 *  - 234: 얼굴 좌측 끝
 *  - 454: 얼굴 우측 끝
 */
export function classifyFaceShape(landmarks: NormalizedLandmark[]): FaceShape {
  const top = landmarks[10]
  const bottom = landmarks[152]
  const left = landmarks[234]
  const right = landmarks[454]

  if (!top || !bottom || !left || !right) {
    return FACE_SHAPES.oval
  }

  const height = Math.hypot(top.x - bottom.x, top.y - bottom.y)
  const width = Math.hypot(left.x - right.x, left.y - right.y)
  if (width === 0) return FACE_SHAPES.oval

  const ratio = height / width
  if (ratio < 1.05) return FACE_SHAPES.round
  if (ratio > 1.3) return FACE_SHAPES.long
  return FACE_SHAPES.oval
}
