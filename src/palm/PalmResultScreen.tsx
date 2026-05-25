import {
  PALM_ZONES,
  HAND_SHAPE_KAG_SLUG,
  KAG_BASE_URL,
  META_LINKS,
} from '../data/palm-zones'
import type { HandShapeResult } from '../lib/hand-shape'

interface Props {
  handShape: HandShapeResult
  captureDataUrl: string
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
  onRetake,
  onExit,
}: Props) {
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
          <img src={captureDataUrl} alt="분석에 사용된 손 사진" className="w-full h-auto block" />
          <figcaption className="px-4 py-2 text-xs text-[var(--color-secondary)] bg-[var(--color-surface)]">
            노란 점 = 측정에 사용된 21 keypoint (브라우저 내 처리, 저장되지 않음)
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
          .map((z) => (
            <article
              key={z.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
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
                className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
              >
                이 선 전통 해석 더 깊이 보기 →
              </a>
            </article>
          ))}
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
