import { type RefObject } from 'react'

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  onAnalyze: () => void
  onCancel: () => void
  isAnalyzing: boolean
  errorMsg?: string
  visible: boolean
}

export default function CameraScreen({
  videoRef,
  canvasRef,
  onAnalyze,
  onCancel,
  isAnalyzing,
  errorMsg,
  visible,
}: Props) {
  // visible=false일 때는 화면 밖으로 보내되 video element는 항상 마운트 유지.
  // iOS Safari는 user gesture 시점에 video element가 DOM에 있어야 play()를 허용.
  const offscreenStyle = visible
    ? undefined
    : ({ position: 'absolute', left: -99999, top: 0, opacity: 0, pointerEvents: 'none' } as const)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" style={offscreenStyle} aria-hidden={!visible}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        2단계 · 촬영
      </p>
      <h1 className="text-2xl font-semibold text-[var(--color-primary)] mb-2">
        얼굴을 화면 중앙에 정면으로 두세요
      </h1>
      <p className="text-sm text-[var(--color-secondary)] mb-6 leading-relaxed">
        조명이 고른 곳에서, 머리카락·안경에 가려지지 않는 정면이 가장 정확합니다.
        준비되면 “분석”을 누르세요. 분석은 한 장의 스냅샷만 사용합니다.
      </p>

      {errorMsg && (
        <p
          role="alert"
          className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {errorMsg}
        </p>
      )}

      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
        <video
          ref={videoRef}
          playsInline
          webkit-playsinline=""
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {isAnalyzing ? '분석 중…' : '분석'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        >
          카메라 끄기
        </button>
      </div>
    </div>
  )
}
