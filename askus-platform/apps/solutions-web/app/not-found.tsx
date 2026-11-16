import Client from './[[...slug]]/client';

// Static export only prerenders "/", so a refresh on /home (or any deep link) lands
// here. The react-router app inside <Client /> resolves the real route client-side.
export default function NotFound() {
  return <Client />;
}
