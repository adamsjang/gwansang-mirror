import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import IntroScreen from './components/IntroScreen'
import CameraScreen from './components/CameraScreen'
import ResultScreen from './components/ResultScreen'
import { classifyFaceShape } from './lib/face-shape'
import { computeMeasurements, type ZoneMeasurement } from './lib/measurements'
import { ZONES, FACE_SHAPES, type FaceShape } from './data/physiognomy-zones'
import { track } from './lib/analytics'

type AppState =
  | { kind: 'intro' }
  | { kind: 'camera' }
  | {
      kind: 'result'
      faceShape: FaceShape
      measurements: ZoneMeasurement[]
      captureDataUrl: string
    }

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** video.srcObject가 설정된 직후 metadata 로드까지 안전하게 기다리고 재생. */
async function attachStreamAndPlay(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream
  if (video.readyState < 1) {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error('video element error during metadata load'))
      }
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded)
        video.removeEventListener('error', onError)
      }
      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('error', onError)
    })
  }
  await video.play()
}

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'intro' })
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 페이지 진입 시 모델 백그라운드 로드 — 사용자가 PIPA 고지 읽는 시간을 활용
  useEffect(() => {
    ensureLandmarker().catch(() => {
      /* 첫 실패는 무시, handleStart에서 다시 시도 */
    })
    return () => {
      stopStream()
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ensureLandmarker(): Promise<FaceLandmarker> {
    if (landmarkerRef.current) return landmarkerRef.current
    setIsModelLoading(true)
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      // GPU delegate가 iOS Safari 등 일부 환경에서 거부되면 CPU로 폴백
      let lm: FaceLandmarker
      try {
        lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
        })
      } catch (gpuErr) {
        console.warn('FaceLandmarker GPU delegate 실패, CPU로 폴백:', gpuErr)
        lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
        })
      }
      landmarkerRef.current = lm
      return lm
    } finally {
      setIsModelLoading(false)
    }
  }

  async function startCameraAndPlay() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    })
    streamRef.current = stream
    if (videoRef.current) {
      await attachStreamAndPlay(videoRef.current, stream)
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  async function handleStart() {
    setErrorMsg('')
    track('camera_start_attempt')
    try {
      await ensureLandmarker()
      await startCameraAndPlay()
      setState({ kind: 'camera' })
      track('camera_started')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMsg(`초기화 실패: ${message}`)
      stopStream()
      setState({ kind: 'intro' })
      track('camera_start_failed', { message: message.slice(0, 200) })
    }
  }

  function drawOverlay(landmarks: NormalizedLandmark[]) {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const zonePoints = new Set<number>()
    for (const z of ZONES) for (const i of z.landmarkIndices) zonePoints.add(i)
    ctx.fillStyle = 'rgba(139, 105, 20, 0.85)'
    for (const i of zonePoints) {
      const lm = landmarks[i]
      if (!lm) continue
      ctx.beginPath()
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  /** video frame을 좌우 반전 + 부위 landmark 표시로 한 장 캡처. */
  function captureSnapshot(video: HTMLVideoElement, landmarks: NormalizedLandmark[]): string {
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.save()
    // 사용자가 본 미러 뷰와 일치시키기 위해 좌우 반전
    ctx.translate(c.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, c.width, c.height)
    ctx.restore()

    // 부위 강조 점 — 사용자가 결과 카드와 시각적으로 매칭할 수 있도록
    ctx.fillStyle = 'rgba(139, 105, 20, 0.9)'
    const zonePoints = new Set<number>()
    for (const z of ZONES) for (const i of z.landmarkIndices) zonePoints.add(i)
    for (const i of zonePoints) {
      const lm = landmarks[i]
      if (!lm) continue
      // landmark는 정규화 좌표 (0~1). 미러된 캔버스 좌표계는 우→좌이므로
      // 표시할 x를 (1 - lm.x)로 변환
      const px = (1 - lm.x) * c.width
      const py = lm.y * c.height
      ctx.beginPath()
      ctx.arc(px, py, 3.5, 0, 2 * Math.PI)
      ctx.fill()
    }

    return c.toDataURL('image/jpeg', 0.85)
  }

  async function handleAnalyze() {
    const v = videoRef.current
    if (!v || !landmarkerRef.current) return

    // metadata 안 도달했거나 0×0이면 detect가 ROI 에러 — 사전 가드
    if (v.videoWidth === 0 || v.videoHeight === 0 || v.readyState < 2) {
      setErrorMsg('비디오가 아직 준비되지 않았습니다. 1~2초 후 다시 시도하세요.')
      return
    }

    setIsAnalyzing(true)
    setErrorMsg('')
    try {
      const result = landmarkerRef.current.detect(v)
      const landmarks = result.faceLandmarks[0]
      if (!landmarks || landmarks.length === 0) {
        setErrorMsg(
          '얼굴을 인식하지 못했습니다. 정면에서 얼굴이 화면 중앙에 들어오도록 다시 시도하세요.'
        )
        return
      }
      drawOverlay(landmarks)
      const shape = classifyFaceShape(landmarks)
      const measurements = computeMeasurements(landmarks)
      const captureDataUrl = captureSnapshot(v, landmarks)
      stopStream()
      track('analysis_completed', {
        face_shape: shape.id,
        measurement_count: measurements.length,
      })
      setState({ kind: 'result', faceShape: shape, measurements, captureDataUrl })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMsg(`분석 실패: ${message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleCancel() {
    stopStream()
    setState({ kind: 'intro' })
  }

  async function handleRetake() {
    setErrorMsg('')
    try {
      await startCameraAndPlay()
      setState({ kind: 'camera' })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMsg(`카메라 시작 실패: ${message}`)
      stopStream()
      setState({ kind: 'intro' })
    }
  }

  function handleExit() {
    stopStream()
    setState({ kind: 'intro' })
  }

  return (
    <>
      {/* CameraScreen은 항상 마운트 — iOS Safari가 user gesture 시점에 video element를 DOM에서 찾아야 play()를 허용 */}
      <CameraScreen
        videoRef={videoRef}
        canvasRef={canvasRef}
        onAnalyze={handleAnalyze}
        onCancel={handleCancel}
        isAnalyzing={isAnalyzing}
        errorMsg={errorMsg && state.kind === 'camera' ? errorMsg : undefined}
        visible={state.kind === 'camera'}
      />

      {state.kind === 'intro' && (
        <>
          {errorMsg && (
            <p
              role="alert"
              className="max-w-2xl mx-auto mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {errorMsg}
            </p>
          )}
          <IntroScreen onStart={handleStart} isLoading={isModelLoading} />
        </>
      )}

      {state.kind === 'result' && (
        <ResultScreen
          faceShape={state.faceShape ?? FACE_SHAPES.oval}
          measurements={state.measurements}
          captureDataUrl={state.captureDataUrl}
          onRetake={handleRetake}
          onExit={handleExit}
        />
      )}
    </>
  )
}
