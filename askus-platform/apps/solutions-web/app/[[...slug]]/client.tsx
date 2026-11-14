'use client';

import dynamic from 'next/dynamic';

// The existing React app (pages, components, routing) is preserved as-is and
// mounted client-side via react-router-dom's BrowserRouter inside <App />.
const App = dynamic(() => import('@/App'), { ssr: false });

export default function Client() {
  return <App />;
}
