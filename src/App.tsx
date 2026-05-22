import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import './App.css'

type Status = 'idle' | 'loading-model' | 'ready' | 'camera-on' | 'error'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [landmarkCount, setLandmarkCount] = useState<number | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      setStatus('loading-model')
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numFaces: 1,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    }

    loadModel()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  async function startCamera() {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStatus('camera-on')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  function stopCamera() {
    const v = videoRef.current
    if (v?.srcObject instanceof MediaStream) {
      v.srcObject.getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
    setStatus('ready')
  }

  function detect() {
    if (!videoRef.current || !landmarkerRef.current) return
    const result = landmarkerRef.current.detect(videoRef.current)
    const count = result.faceLandmarks[0]?.length ?? 0
    setLandmarkCount(count)
    // 시각화: 캔버스에 점 찍기
    const canvas = canvasRef.current
    const video = videoRef.current
    if (canvas && video) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx && result.faceLandmarks[0]) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#00ff88'
        for (const lm of result.faceLandmarks[0]) {
          ctx.beginPath()
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 1, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
    console.log('landmark count:', count, result)
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto' }}>
      <h1>관상경 (觀相鏡) — spike</h1>
      <p style={{ color: '#666' }}>
        MediaPipe Face Landmarker · Vite · CF Pages 호환성 확인용 spike
      </p>

      <p>
        <strong>모델 상태:</strong> {status}
        {errorMsg && (
          <span style={{ color: '#c0392b', marginLeft: 8 }}>— {errorMsg}</span>
        )}
        {landmarkCount !== null && (
          <span style={{ marginLeft: 8 }}>· landmarks: {landmarkCount}</span>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={startCamera}
          disabled={status !== 'ready'}
        >
          카메라 켜기
        </button>
        <button
          type="button"
          onClick={detect}
          disabled={status !== 'camera-on'}
        >
          분석 (단일 스냅샷)
        </button>
        <button
          type="button"
          onClick={stopCamera}
          disabled={status !== 'camera-on'}
        >
          카메라 끄기
        </button>
      </div>

      <div style={{ position: 'relative', width: 640, maxWidth: '100%' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%',
            background: '#000',
            transform: 'scaleX(-1)',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            transform: 'scaleX(-1)',
          }}
        />
      </div>
    </div>
  )
}
