import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (dataUrl: string) => void
  onCancel: () => void
}

/**
 * 결과 화면 안에서 호출되는 별도 카메라 modal.
 * 측면 얼굴 한 장만 캡처해서 dataUrl을 부모에 넘긴다.
 * MediaPipe 분석은 후속 라운드 — 일단 사진 자체가 결과 화면 귀 카드에 노출됨.
 */
export default function SideCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string>('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
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
        }
        setStarting(false)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!cancelled) {
          setError(`카메라 시작 실패: ${msg}`)
          setStarting(false)
        }
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function snap() {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) {
      setError('비디오가 준비되지 않았습니다. 잠시 후 다시 시도하세요.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 미러 상태로 캡처 (사용자가 본 거랑 일치)
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(v, 0, 0)
    ctx.restore()
    onCapture(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="귀 측면 촬영"
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-auto"
    >
      <div className="w-full max-w-2xl px-4 py-8">
        <div className="bg-[var(--color-base)] rounded-xl p-5 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
            귀 측면 촬영
          </p>
          <h2 className="text-xl font-semibold text-[var(--color-primary)] mb-2">
            얼굴을 옆으로 돌려 한쪽 귀가 보이게 해 주세요
          </h2>
          <p className="text-sm text-[var(--color-secondary)] mb-4 leading-relaxed">
            머리카락에 가려지지 않게 한쪽 귀(좌·우 무관)가 카메라에 정면으로 보이도록 잡습니다.
            촬영한 사진은 결과 화면 귀 카드에 표시되며 외부로 전송되지 않습니다.
          </p>

          {error && (
            <p role="alert" className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-black border border-[var(--color-border)]">
            <video
              ref={videoRef}
              playsInline
              webkit-playsinline=""
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={snap}
              disabled={starting}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {starting ? '카메라 준비 중…' : '측면 사진 저장'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
