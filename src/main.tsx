import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PalmApp from './palm/PalmApp'
import { initAnalytics } from './lib/analytics'

initAnalytics()

// 라우팅 — 단순 pathname 기반 (router lib 없이).
//   /palm → 손금 도구 (PalmApp)
//   그 외 → 관상 도구 (App)
const pathname = window.location.pathname

function pickRoot() {
  if (pathname === '/palm' || pathname.startsWith('/palm/')) return <PalmApp />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{pickRoot()}</StrictMode>,
)
