import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import IntroScreen from './components/IntroScreen'
import CameraScreen from './components/CameraScreen'
import ResultScreen from './components/ResultScreen'
import { classifyFaceShape } from './lib/face-shape'
import { ZONES, FACE_SHAPES, type FaceShape } from './data/physiognomy-zones'

type AppState =
  | { kind: 'intro' }
  | { kind: 'camera' }
  | { kind: 'result'; faceShape: FaceShape }

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'intro' })
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 컴포넌트 마운트 해제 시 리소스 정리
  useEffect(() => {
    return () => {
      stopStream()
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  async function ensureLandmarker() {
    if (landmarkerRef.current) return landmarkerRef.current
    setIsModelLoading(true)
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      const lm = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
      })
      landmarkerRef.current = lm
      return lm
    } finally {
      setIsModelLoading(false)
    }
  }

  async function startCameraStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    })
    streamRef.current = stream
    return stream
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  async function handleStart() {
    setErrorMsg('')
    try {
      await ensureLandmarker()
      const stream = await startCameraStream()
      setState({ kind: 'camera' })
      // video 엘리먼트는 다음 렌더에서 마운트되므로 약간 지연
      requestAnimationFrame(() => {
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMsg(`초기화 실패: ${message}`)
      setState({ kind: 'intro' })
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
    // ZONES에 등록된 landmark만 강조
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

  async function handleAnalyze() {
    if (!videoRef.current || !landmarkerRef.current) return
    setIsAnalyzing(true)
    setErrorMsg('')
    try {
      const result = landmarkerRef.current.detect(videoRef.current)
      const landmarks = result.faceLandmarks[0]
      if (!landmarks || landmarks.length === 0) {
        setErrorMsg(
          '얼굴을 인식하지 못했습니다. 정면에서 얼굴이 화면 중앙에 들어오도록 다시 시도하세요.'
        )
        return
      }
      drawOverlay(landmarks)
      const shape = classifyFaceShape(landmarks)
      stopStream()
      setState({ kind: 'result', faceShape: shape })
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
      const stream = await startCameraStream()
      setState({ kind: 'camera' })
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMsg(`카메라 시작 실패: ${message}`)
      setState({ kind: 'intro' })
    }
  }

  function handleExit() {
    stopStream()
    setState({ kind: 'intro' })
  }

  if (state.kind === 'intro') {
    return (
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
    )
  }

  if (state.kind === 'camera') {
    return (
      <CameraScreen
        videoRef={videoRef}
        canvasRef={canvasRef}
        onAnalyze={handleAnalyze}
        onCancel={handleCancel}
        isAnalyzing={isAnalyzing}
        errorMsg={errorMsg}
      />
    )
  }

  return (
    <ResultScreen
      faceShape={state.faceShape ?? FACE_SHAPES.oval}
      onRetake={handleRetake}
      onExit={handleExit}
    />
  )
}
