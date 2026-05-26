import { useRef, useState } from 'react'

interface Props {
  /** "관상" 또는 "손" */
  subjectKor: string
  /** 안내 한 줄 (예: "얼굴이 정면으로 잘 보이는 사진") */
  guideline: string
  /** 분석 트리거 — 부모가 file을 받아 분석 흐름으로 */
  onAnalyze: (file: File) => Promise<void>
  onCancel: () => void
  isAnalyzing: boolean
  errorMsg?: string
}

/**
 * 사진 업로드 인입점. 파일 선택 → 미리보기 → 분석 클릭. 분석 로직은 부모에.
 */
export default function UploadScreen({
  subjectKor,
  guideline,
  onAnalyze,
  onCancel,
  isAnalyzing,
  errorMsg,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  async function handleAnalyzeClick() {
    if (!file || isAnalyzing) return
    await onAnalyze(file)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        2단계 · 사진 업로드
      </p>
      <h1 className="text-2xl font-semibold text-[var(--color-primary)] mb-2">
        {subjectKor} 사진을 선택해 주세요
      </h1>
      <p className="text-sm text-[var(--color-secondary)] mb-6 leading-relaxed">
        {guideline} 권장 형식 JPEG/PNG/WebP. iPhone HEIC는 변환 후 업로드하세요.
        업로드한 사진은 외부로 전송되지 않으며 분석 직후 메모리에서 폐기됩니다.
      </p>

      {errorMsg && (
        <p
          role="alert"
          className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {errorMsg}
        </p>
      )}

      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handlePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full px-5 py-8 rounded-lg border-2 border-dashed border-[var(--color-accent)] text-sm font-semibold text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] transition-colors"
        >
          {file ? `다른 사진 선택 (현재: ${file.name})` : '사진 파일 선택'}
        </button>

        {previewUrl && (
          <figure className="mt-4 rounded-lg overflow-hidden border border-[var(--color-border)] bg-black">
            <img src={previewUrl} alt="업로드한 사진 미리보기" className="w-full h-auto block" />
          </figure>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleAnalyzeClick}
          disabled={!file || isAnalyzing}
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
          취소
        </button>
      </div>
    </div>
  )
}
