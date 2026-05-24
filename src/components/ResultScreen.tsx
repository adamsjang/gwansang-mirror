import {
  ZONES,
  FACE_SHAPE_KAG_SLUG,
  KAG_BASE_URL,
  META_LINKS,
  type FaceShape,
} from '../data/physiognomy-zones'
import type { ZoneMeasurement } from '../lib/measurements'

interface Props {
  faceShape: FaceShape
  measurements: ZoneMeasurement[]
  captureDataUrl: string
  onRetake: () => void
  onExit: () => void
}

function levelDotColor(level: 'low' | 'mid' | 'high') {
  // KAG 컬러 팔레트를 따라 차분한 톤
  if (level === 'mid') return '#6B5744'
  return '#8B6914'
}

export default function ResultScreen({
  faceShape,
  measurements,
  captureDataUrl,
  onRetake,
  onExit,
}: Props) {
  const measureByZone = new Map(measurements.map((m) => [m.zoneId, m]))

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        3단계 · 결과
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-primary)] mb-2">
        부위 측정 결과
      </h1>
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-6">
        촬영한 한 장에서 추출한 비율 측정값과 분류입니다. 학술적 정확도가 아니라
        대략적 분포 기준의 상대적 위치이므로, 참고용으로 보시고 결과를 외모
        평가나 단정에 사용하지 마세요.
      </p>

      {captureDataUrl && (
        <figure className="mb-8 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
          <img
            src={captureDataUrl}
            alt="분석에 사용된 사진 — 부위 강조 점 표시"
            className="w-full h-auto block"
          />
          <figcaption className="px-4 py-2 text-xs text-[var(--color-secondary)] bg-[var(--color-surface)]">
            노란 점 = 측정에 사용된 얼굴 부위 좌표 (브라우저 내 처리, 저장되지 않음)
          </figcaption>
        </figure>
      )}

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-accent)] mb-2 font-semibold">
          얼굴형
        </p>
        <h2 className="text-xl font-semibold text-[var(--color-primary)] mb-1">
          {faceShape.name}
        </h2>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
          {faceShape.description}
        </p>
        <a
          href={`${KAG_BASE_URL}/${FACE_SHAPE_KAG_SLUG}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          얼굴형 관상 자세히 보기 →
        </a>
      </section>

      <section aria-label="아홉 부위" className="grid sm:grid-cols-2 gap-3 mb-8">
        {[...ZONES]
          .sort((a, b) => a.order - b.order)
          .map((z) => {
            const m = measureByZone.get(z.id)
            return (
              <article
                key={z.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <h2 className="text-base font-semibold text-[var(--color-primary)] mb-2">
                  {z.name}
                </h2>

                {m ? (
                  <div className="mb-3 border-l-2 pl-3" style={{ borderColor: levelDotColor(m.level) }}>
                    <p className="text-xs text-[var(--color-secondary)] mb-0.5">
                      {m.ratioLabel}
                    </p>
                    <p className="text-sm text-[var(--color-primary)]">
                      <span className="font-semibold tabular-nums">{(m.ratio * 100).toFixed(1)}%</span>
                      <span className="mx-2 text-[var(--color-secondary)]">·</span>
                      <span style={{ color: levelDotColor(m.level), fontWeight: 600 }}>
                        {m.description}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-[var(--color-secondary)] italic">
                    정면 카메라로는 형태 측정이 어려운 부위입니다.
                  </p>
                )}

                <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
                  {z.meaning}
                </p>
                <a
                  href={`${KAG_BASE_URL}/${z.kagSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                >
                  {z.name} 관상 자세히 →
                </a>
              </article>
            )
          })}
      </section>

      <section
        aria-label="관상 관점"
        className="grid sm:grid-cols-2 gap-3 mb-8 pt-6 border-t border-[var(--color-border)]"
      >
        {[META_LINKS.whatIs, META_LINKS.selfUnderstanding].map((mi) => (
          <a
            key={mi.slug}
            href={`${KAG_BASE_URL}/${mi.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-dashed border-[var(--color-border)] p-4 hover:border-[var(--color-accent)] transition-colors"
          >
            <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">
              {mi.name}
            </p>
            <p className="text-xs text-[var(--color-secondary)] leading-relaxed">
              {mi.blurb}
            </p>
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
        측정값은 한국인 평균 분포를 기준으로 한 대략 비교일 뿐, 학술적 정확도가
        아닙니다. 관상은 단정의 잣대가 아니라 자기 이해의 한 관점입니다. 본 결과를
        외모 평가나 차별에 사용하지 마세요. 카메라 영상은 본 페이지 내에서만
        처리되어 외부로 전송되지 않았습니다.
      </p>
    </div>
  )
}
