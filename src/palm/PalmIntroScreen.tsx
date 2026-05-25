import { useState } from 'react'

interface Props {
  onStart: () => void
  isLoading: boolean
}

/**
 * 손금 도구 인트로. 관상의 IntroScreen과 같은 패턴 (PIPA 고지 + 동의 + 시작).
 * 추가로 "Phase 1 = 가이드 도구" 명시 — 손금 선 직접 측정은 미구현이라는 기대 관리.
 */
export default function PalmIntroScreen({ onStart, isLoading }: Props) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-[var(--color-accent)]">
        手相鏡 · 손금경
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--color-primary)] mb-4 leading-tight">
        카메라로 손의 형태를 살펴보세요
      </h1>
      <p className="text-[var(--color-secondary)] leading-relaxed mb-4">
        손바닥을 카메라에 보여주면 손 모양 분류(불·땅·공기·물)와 8 손금선의 일반적
        위치를 도식으로 안내합니다. 각 선의 자세한 해석은{' '}
        <a
          href="https://korean-astrology-guide.pages.dev/palmistry"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80"
        >
          운세 참고서 손금 카테고리
        </a>{' '}
        글로 안내됩니다.
      </p>

      <p className="text-sm text-[var(--color-secondary)] bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] border border-[var(--color-border)] rounded-lg p-3 leading-relaxed mb-6">
        <strong className="text-[var(--color-primary)]">참고:</strong>{' '}
        손금 선 자체의 형태(굵기·길이·갈라짐)는 정면 카메라로 직접 측정하지
        않습니다. 현재 도구는 손 모양 4분류와 손금선 위치 안내가 중심이며, 직접
        분석은 후속 R&D 트랙입니다.
      </p>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-6 text-left">
        <p className="text-sm font-semibold text-[var(--color-primary)] mb-3">
          개인정보 처리 고지
        </p>
        <dl className="text-sm text-[var(--color-secondary)] leading-relaxed space-y-1.5">
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">처리 목적</dt>
            <dd>손 모양 식별 후 관련 손금 글 안내</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">처리 항목</dt>
            <dd>카메라 영상 (브라우저 메모리 내)</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">처리 위치</dt>
            <dd>전적으로 사용자 브라우저. 외부 서버로 전송되지 않음</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">보관 기간</dt>
            <dd>카메라 종료 또는 페이지 이탈 시 즉시 폐기</dd>
          </div>
        </dl>
      </div>

      <label className="flex items-start gap-3 text-sm text-[var(--color-primary)] mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-[var(--color-accent)]"
        />
        <span>
          위 처리 고지를 확인하였으며 카메라 사용에 동의합니다. (브라우저 카메라
          권한 허용이 추가로 필요합니다.)
        </span>
      </label>

      <button
        type="button"
        onClick={onStart}
        disabled={!agreed || isLoading}
        className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        {isLoading ? '모델 불러오는 중…' : '카메라 켜고 시작'}
      </button>

      <p className="mt-8 text-xs text-[var(--color-secondary)] leading-relaxed">
        손금은 사람을 단정하는 잣대가 아니라 자기 이해의 한 관점입니다. 결과를
        외모 평가나 차별에 사용하지 마세요.
      </p>

      <p className="mt-6 text-xs text-[var(--color-secondary)]">
        관상 도구를 찾으세요?{' '}
        <a href="/" className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80">
          觀相鏡 · 관상경
        </a>
      </p>
    </div>
  )
}
