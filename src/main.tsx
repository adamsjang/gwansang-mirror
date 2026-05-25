import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PalmSpike from './spike/PalmSpike'
import { initAnalytics } from './lib/analytics'

initAnalytics()

// 임시 spike 라우팅: ?spike=palm 로 들어오면 Hand Landmarker spike만 노출.
// 검증 끝나면 이 분기와 PalmSpike 컴포넌트 제거.
const isPalmSpike =
  new URLSearchParams(window.location.search).get('spike') === 'palm'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPalmSpike ? <PalmSpike /> : <App />}</StrictMode>,
)
