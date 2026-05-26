/**
 * 사진 파일을 분석 가능한 ImageBitmap + dataURL로 정규화.
 *
 *  - EXIF orientation은 createImageBitmap({ imageOrientation: 'from-image' })로 자동
 *    바로잡음. (Safari 16+, Chrome 모두 OK)
 *  - 가로/세로 중 큰 쪽이 MAX_DIM 초과면 비율 유지 리사이즈
 *  - 결과는 mediapipe detect()에 직접 넘길 수 있는 HTMLCanvasElement와
 *    captureDataUrl(JPEG dataURL) 둘 다 반환
 */

const MAX_DIM = 1280

export interface NormalizedImage {
  canvas: HTMLCanvasElement
  dataUrl: string
  width: number
  height: number
}

export async function normalizeUploadedImage(file: File): Promise<NormalizedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일이 아닙니다. (JPEG/PNG/WebP 권장)')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (e) {
    // 일부 구형 브라우저는 imageOrientation 옵션 미지원 → 옵션 없이 재시도
    console.warn('createImageBitmap with imageOrientation failed, retrying:', e)
    bitmap = await createImageBitmap(file)
  }

  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * ratio)
  const h = Math.round(bitmap.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context 를 얻을 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  return { canvas, dataUrl, width: w, height: h }
}
