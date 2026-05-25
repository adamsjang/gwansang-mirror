import { useEffect, useRef, useState } from 'react'
import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'

type Status = 'idle' | 'loading-model' | 'ready' | 'camera-on' | 'analyzing' | 'error'

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/**
 * 임시 spike: ?spike=palm 라우트에서만 노출.
 * MediaPipe Hand Landmarker가 폰에서 동작하는지 검증.
 * - 21 keypoint 잡히면 본 Phase 1 진행
 * - 잘 안 잡히면 Plan 변경
 *
 * 본 도구 흐름과 무관 — 분리된 페이지.
 */
export default function PalmSpike() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [handedness, setHandedness] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setStatus('loading-model')
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
          console.warn('GPU delegate failed, falling back to CPU:', gpuErr)
          lm = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'IMAGE',
            numHands: 1,
          })
        }
        if (cancelled) {
          lm.close()
          return
        }
        landmarkerRef.current = lm
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  async function startCamera() {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        if (v.readyState < 1) {
          await new Promise<void>((res, rej) => {
            const ok = () => {
              cleanup()
              res()
            }
            const ng = () => {
              cleanup()
              rej(new Error('video error'))
            }
            const cleanup = () => {
              v.removeEventListener('loadedmetadata', ok)
              v.removeEventListener('error', ng)
            }
            v.addEventListener('loadedmetadata', ok)
            v.addEventListener('error', ng)
          })
        }
        await v.play()
        setStatus('camera-on')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('ready')
  }

  function detect() {
    const v = videoRef.current
    const c = canvasRef.current
    const lm = landmarkerRef.current
    if (!v || !c || !lm) return
    if (v.videoWidth === 0 || v.readyState < 2) {
      setErrorMsg('비디오가 준비되지 않았습니다. 잠시 후 다시.')
      return
    }
    setStatus('analyzing')
    setErrorMsg('')
    try {
      const result = lm.detect(v)
      const hand = result.landmarks[0]
      const handedLabel = result.handednesses[0]?.[0]?.categoryName ?? '(미분류)'
      setHandedness(handedLabel)
      const n = hand?.length ?? 0
      setCount(n)
      c.width = v.videoWidth
      c.height = v.videoHeight
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, c.width, c.height)
      if (n > 0 && hand) {
        // 21 keypoint 점 + connection line (간단)
        ctx.fillStyle = 'rgba(192, 57, 43, 0.9)'
        for (const p of hand as NormalizedLandmark[]) {
          ctx.beginPath()
          ctx.arc(p.x * c.width, p.y * c.height, 6, 0, Math.PI * 2)
          ctx.fill()
        }
        // 연결선 — MediaPipe 표준 connection 일부 (손가락)
        ctx.strokeStyle = 'rgba(139, 105, 20, 0.85)'
        ctx.lineWidth = 3
        const conn = [
          [0, 1], [1, 2], [2, 3], [3, 4],            // thumb
          [0, 5], [5, 6], [6, 7], [7, 8],            // index
          [5, 9], [9, 10], [10, 11], [11, 12],       // middle
          [9, 13], [13, 14], [14, 15], [15, 16],     // ring
          [13, 17], [17, 18], [18, 19], [19, 20],    // pinky
          [0, 17],                                   // palm
        ]
        for (const [a, b] of conn) {
          const pa = hand[a] as NormalizedLandmark
          const pb = hand[b] as NormalizedLandmark
          if (!pa || !pb) continue
          ctx.beginPath()
          ctx.moveTo(pa.x * c.width, pa.y * c.height)
          ctx.lineTo(pb.x * c.width, pb.y * c.height)
          ctx.stroke()
        }
      }
      console.log('hand landmarks:', n, 'handedness:', handedLabel, result)
      setStatus('camera-on')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStatus('camera-on')
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto' }}>
      <h1>Hand Landmarker spike</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        손을 카메라에 정면(손바닥)으로 들이댄 뒤 분석을 누르세요. 21 keypoint가
        잡히면 OK. 본 도구 흐름과 무관한 임시 페이지입니다.
      </p>

      <p style={{ fontSize: 14 }}>
        <strong>모델:</strong> {status}
        {errorMsg && (
          <span style={{ color: '#c0392b', marginLeft: 8 }}>— {errorMsg}</span>
        )}
        {count !== null && (
          <span style={{ marginLeft: 8 }}>
            · keypoints: {count} · 손: {handedness}
          </span>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button type="button" onClick={startCamera} disabled={status !== 'ready'}>
          카메라 켜기
        </button>
        <button type="button" onClick={detect} disabled={status !== 'camera-on'}>
          분석
        </button>
        <button type="button" onClick={stopCamera} disabled={status !== 'camera-on'}>
          카메라 끄기
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 720, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          playsInline
          // @ts-expect-error legacy iOS attribute
          webkit-playsinline=""
          muted
          style={{ width: '100%', height: 'auto', display: 'block', transform: 'scaleX(-1)' }}
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

      <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
        주: 카메라 영상은 페이지 내에서만 처리되며 외부로 전송되지 않습니다.
        검증 끝나면 이 페이지는 코드에서 제거됩니다.
      </p>
    </div>
  )
}
