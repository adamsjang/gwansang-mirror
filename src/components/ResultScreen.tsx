import {
  ZONES,
  FACE_SHAPE_KAG_SLUG,
  KAG_BASE_URL,
  META_LINKS,
  type FaceShape,
} from '../data/physiognomy-zones'

interface Props {
  faceShape: FaceShape
  onRetake: () => void
  onExit: () => void
}

export default function ResultScreen({ faceShape, onRetake, onExit }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        3단계 · 결과
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-primary)] mb-2">
        여덟 부위와 얼굴형이 인식되었습니다
      </h1>
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-8">
        각 부위는 전통 관상에서 다음과 같이 해석합니다. 자세한 의미는 카드 하단의
        링크에서 운세 참고서 글로 확인하세요. 본 도구가 자체 점술을 제공하지 않습니다.
      </p>

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

      <section aria-label="여덟 부위" className="grid sm:grid-cols-2 gap-3 mb-8">
        {[...ZONES]
          .sort((a, b) => a.order - b.order)
          .map((z) => (
            <article
              key={z.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h2 className="text-base font-semibold text-[var(--color-primary)] mb-2">
                {z.name}
              </h2>
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
          ))}
      </section>

      <section
        aria-label="관상 관점"
        className="grid sm:grid-cols-2 gap-3 mb-8 pt-6 border-t border-[var(--color-border)]"
      >
        {[META_LINKS.whatIs, META_LINKS.selfUnderstanding].map((m) => (
          <a
            key={m.slug}
            href={`${KAG_BASE_URL}/${m.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-dashed border-[var(--color-border)] p-4 hover:border-[var(--color-accent)] transition-colors"
          >
            <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">
              {m.name}
            </p>
            <p className="text-xs text-[var(--color-secondary)] leading-relaxed">
              {m.blurb}
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
        관상은 단정의 잣대가 아니라 자기 이해의 한 관점입니다. 본 결과를 외모
        평가나 차별에 사용하지 마세요. 카메라 영상은 본 페이지 내에서만 처리되어
        외부로 전송되지 않았습니다.
      </p>
    </div>
  )
}
