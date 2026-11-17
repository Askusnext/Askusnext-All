'use client'

import dynamic from 'next/dynamic'

// The loan screens and routing run client-side (react-router-dom's BrowserRouter inside <App />).
const App = dynamic(() => import('@/App'), { ssr: false })

export default function Client() {
  return <App />
}
