import { useEffect, useRef, useState } from 'react'
import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import PalmIntroScreen from './PalmIntroScreen'
import PalmCameraScreen from './PalmCameraScreen'
import PalmResultScreen from './PalmResultScreen'
import {
  classifyHandShape,
  computeHandAdvancedMeasurements,
  type HandShapeResult,
  type HandAdvancedMeasurement,
} from '../lib/hand-shape'
import { track } from '../lib/analytics'

type AppState =
  | { kind: 'intro' }
  | { kind: 'camera' }
  | {
      kind: 'result'
      handShape: HandShapeResult
      advanced: HandAdvancedMeasurement[]
      captureDataUrl: string
      landmarks: NormalizedLandmark[]
    }

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

async function attachStreamAndPlay(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
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

export default function PalmApp() {
  const [state, setState] = useState<AppState>({ kind: 'intro' })
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // 페이지 진입 시 모델 백그라운드 로드 — 사용자가 PIPA 고지 읽는 시간 활용
    ensureLandmarker().catch(() => {
      /* 첫 실패는 무시, handleStart에서 재시도 */
    })
    return () => {
      stopStream()
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ensureLandmarker(): Promise<HandLandmarker> {
    if (landmarkerRef.current) return landmarkerRef.current
    setIsModelLoading(true)
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      let lm: HandLandmarker
      try {
        lm = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          numHands: 1,
        })
      } catch (gpuErr) {
        console.warn('HandLandmarker GPU delegate 실패, CPU로 폴백:', gpuErr)
        lm = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numHands: 1,
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
    track('palm_camera_start_attempt')
    try {
      await ensureLandmarker()
      await startCameraAndPlay()
      setState({ kind: 'camera' })
      track('palm_camera_started')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMsg(`초기화 실패: ${message}`)
      stopStream()
      setState({ kind: 'intro' })
      track('palm_camera_start_failed', { message: message.slice(0, 200) })
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
    ctx.fillStyle = 'rgba(139, 105, 20, 0.85)'
    for (const lm of landmarks) {
      ctx.beginPath()
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function captureSnapshot(video: HTMLVideoElement, landmarks: NormalizedLandmark[]): string {
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.save()
    ctx.translate(c.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, c.width, c.height)
    ctx.restore()

    ctx.fillStyle = 'rgba(139, 105, 20, 0.9)'
    for (const lm of landmarks) {
      const px = (1 - lm.x) * c.width
      const py = lm.y * c.height
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    return c.toDataURL('image/jpeg', 0.85)
  }

  async function handleAnalyze() {
    const v = videoRef.current
    if (!v || !landmarkerRef.current) return
    if (v.videoWidth === 0 || v.videoHeight === 0 || v.readyState < 2) {
      setErrorMsg('비디오가 아직 준비되지 않았습니다. 1~2초 후 다시 시도하세요.')
      return
    }
    setIsAnalyzing(true)
    setErrorMsg('')
    try {
      const result = landmarkerRef.current.detect(v)
      const landmarks = result.landmarks[0]
      if (!landmarks || landmarks.length === 0) {
        setErrorMsg(
          '손을 인식하지 못했습니다. 손바닥이 카메라를 향하게 하고 다섯 손가락이 모두 화면에 들어오도록 다시 시도하세요.'
        )
        return
      }
      drawOverlay(landmarks)
      const shape = classifyHandShape(landmarks)
      if (!shape) {
        setErrorMsg('손 형태 분석에 실패했습니다. 다시 시도하세요.')
        return
      }
      const advanced = computeHandAdvancedMeasurements(landmarks)
      const captureDataUrl = captureSnapshot(v, landmarks)
      stopStream()
      track('palm_analysis_completed', {
        hand_shape: shape.shape.id,
        palm_aspect: shape.palmAspect.toFixed(2),
        finger_ratio: shape.fingerRatio.toFixed(2),
        advanced_count: advanced.length,
      })
      setState({
        kind: 'result',
        handShape: shape,
        advanced,
        captureDataUrl,
        landmarks,
      })
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
      <PalmCameraScreen
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
          <PalmIntroScreen onStart={handleStart} isLoading={isModelLoading} />
        </>
      )}

      {state.kind === 'result' && (
        <PalmResultScreen
          handShape={state.handShape}
          advanced={state.advanced}
          captureDataUrl={state.captureDataUrl}
          landmarks={state.landmarks}
          onRetake={handleRetake}
          onExit={handleExit}
        />
      )}
    </>
  )
}
