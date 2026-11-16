import Client from './client';

// Static export emits only index.html; other paths fall back to it via public/_redirects.
export function generateStaticParams() {
  return [{ slug: [] }];
}

export default function CatchAllPage() {
  return <Client />;
}
