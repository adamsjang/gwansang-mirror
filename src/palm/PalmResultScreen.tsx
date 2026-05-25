import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  PALM_ZONES,
  HAND_SHAPE_KAG_SLUG,
  KAG_BASE_URL,
  META_LINKS,
} from '../data/palm-zones'
import type { HandShapeResult } from '../lib/hand-shape'
import { track } from '../lib/analytics'

interface Props {
  handShape: HandShapeResult
  captureDataUrl: string
  landmarks: NormalizedLandmark[]
  onRetake: () => void
  onExit: () => void
}

/**
 * 라운드 3 골격 — 손 모양 분류 카드 + 8 손금선 placeholder 카드들 +
 * 메타 3 카드 + 재촬영/종료. 도식·자체 해석·정밀 측정·통합 잠금·공유 PNG는
 * 후속 라운드(4~6).
 */
export default function PalmResultScreen({
  handShape,
  captureDataUrl,
  landmarks,
  onRetake,
  onExit,
}: Props) {
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = overlayRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete) return
    const w = img.clientWidth
    const h = img.clientHeight
    if (w === 0 || h === 0) return
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    if (!hoverZone) return
    const zone = PALM_ZONES.find((z) => z.id === hoverZone)
    if (!zone) return
    const [aIdx, bIdx] = zone.anchorBetween
    const a = landmarks[aIdx]
    const b = landmarks[bIdx]
    if (!a || !b) return
    // 캡처 이미지가 mirror 되어 있어 x 좌표 반전 (1 - lm.x)
    const ax = (1 - a.x) * w
    const ay = a.y * h
    const bx = (1 - b.x) * w
    const by = b.y * h

    // 손금선 직선 (anchor 두 점 사이) — 가이드 도식
    ctx.strokeStyle = 'rgba(192, 57, 43, 0.85)'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()

    // anchor 점 강조 (양 끝)
    ctx.fillStyle = 'rgba(192, 57, 43, 0.95)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    for (const [px, py] of [
      [ax, ay],
      [bx, by],
    ]) {
      ctx.beginPath()
      ctx.arc(px, py, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }, [hoverZone, landmarks])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        3단계 · 결과 (β)
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-primary)] mb-2">
        손 측정 결과
      </h1>
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-6">
        촬영한 한 장에서 추출한 손 모양 분류와 손금선 안내입니다. 손금선의 형태·길이는
        직접 측정하지 않으며, 각 선의 자세한 해석은 운세 참고서 글로 안내됩니다.
      </p>

      {captureDataUrl && (
        <figure className="mb-8 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
          <div className="relative">
            <img
              ref={imgRef}
              src={captureDataUrl}
              alt="분석에 사용된 손 사진"
              onLoad={() => setHoverZone((z) => z)}
              className="w-full h-auto block"
            />
            <canvas
              ref={overlayRef}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
          <figcaption className="px-4 py-2 text-xs text-[var(--color-secondary)] bg-[var(--color-surface)]">
            노란 점 = 측정에 사용된 21 keypoint. 아래 손금선 카드에 마우스를 올리면
            (모바일은 카드를 누르면) 해당 선 위치가 빨간 직선으로 표시됩니다. 가이드
            도식이며 실제 손금 선 검출은 아닙니다.
          </figcaption>
        </figure>
      )}

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-accent)] mb-2 font-semibold">
          손 모양
        </p>
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-xl font-semibold text-[var(--color-primary)]">
            {handShape.shape.name}
          </h2>
          <span className="text-2xl text-[var(--color-accent)]">{handShape.shape.hanja}</span>
        </div>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
          {handShape.shape.description}
        </p>
        <p className="text-xs text-[var(--color-secondary)] mb-3 tabular-nums">
          손바닥 종횡비 {handShape.palmAspect.toFixed(2)} · 손가락 비율{' '}
          {handShape.fingerRatio.toFixed(2)}
        </p>
        <a
          href={`${KAG_BASE_URL}/${HAND_SHAPE_KAG_SLUG}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
        >
          손 모양 4분류 자세히 보기 →
        </a>
      </section>

      <section aria-label="여덟 손금선" className="grid sm:grid-cols-2 gap-3 mb-8">
        {[...PALM_ZONES]
          .sort((a, b) => a.order - b.order)
          .map((z) => {
            const isActive = hoverZone === z.id
            return (
              <article
                key={z.id}
                onMouseEnter={() => setHoverZone(z.id)}
                onMouseLeave={() => setHoverZone((cur) => (cur === z.id ? null : cur))}
                onTouchStart={() => setHoverZone(z.id)}
                className="rounded-xl border bg-[var(--color-surface)] p-5 transition-colors cursor-pointer"
                style={{
                  borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                }}
              >
                <h2 className="text-base font-semibold text-[var(--color-primary)] mb-2">
                  {z.name}
                </h2>
                <p className="text-sm text-[var(--color-primary)] leading-relaxed mb-3">
                  {z.meaning}
                </p>
                <a
                  href={`${KAG_BASE_URL}/${z.kagSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track('palm_kag_link_clicked', { zone: z.id })}
                  className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
                >
                  이 선 전통 해석 더 깊이 보기 →
                </a>
              </article>
            )
          })}
      </section>

      <section
        aria-label="손금 관점"
        className="grid sm:grid-cols-3 gap-3 mb-8 pt-6 border-t border-[var(--color-border)]"
      >
        {[META_LINKS.basics, META_LINKS.mounts, META_LINKS.change].map((mi) => (
          <a
            key={mi.slug}
            href={`${KAG_BASE_URL}/${mi.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-dashed border-[var(--color-border)] p-4 hover:border-[var(--color-accent)] transition-colors"
          >
            <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">{mi.name}</p>
            <p className="text-xs text-[var(--color-secondary)] leading-relaxed">{mi.blurb}</p>
          </a>
        ))}
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          다시 촬영
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-6 py-3 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        >
          종료
        </button>
      </div>

      <p className="mt-8 text-xs text-[var(--color-secondary)] leading-relaxed">
        손금은 단정의 잣대가 아니라 자기 이해의 한 관점입니다. 본 결과를 외모 평가나
        차별에 사용하지 마세요. 카메라 영상은 본 페이지 내에서만 처리되어 외부로
        전송되지 않았습니다.
      </p>
    </div>
  )
}
