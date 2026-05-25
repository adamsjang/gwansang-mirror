import { useState } from 'react'
import PalmIntroScreen from './PalmIntroScreen'

/**
 * 손금 도구 앱 — /palm 라우트에서 노출.
 * 라운드 2는 IntroScreen + 시작 버튼 클릭 시 placeholder만. 카메라·분석·결과는
 * 후속 라운드(3~5).
 */
export default function PalmApp() {
  const [started, setStarted] = useState(false)

  if (started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-[var(--color-accent)]">
          준비 중
        </p>
        <h1 className="text-2xl font-semibold text-[var(--color-primary)] mb-3">
          카메라·분석 흐름은 다음 라운드에서 추가됩니다
        </h1>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-8">
          현재는 인트로·동의 흐름만 라이브입니다. 손 모양 분류와 손금선 위치 안내는
          순차 추가 중이며 오늘 라운드는 진입점·라우팅까지입니다.
        </p>
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        >
          인트로로 돌아가기
        </button>
        <p className="mt-8 text-xs text-[var(--color-secondary)]">
          <a href="/" className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80">
            觀相鏡 관상경으로 이동
          </a>
        </p>
      </div>
    )
  }

  return <PalmIntroScreen onStart={() => setStarted(true)} isLoading={false} />
}
