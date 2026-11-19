import { useEffect, useState } from 'react';
import { fetchAuthOptions } from './session';

/**
 * True when the server can deliver sign-in codes on WhatsApp. Stays false in demo mode (no API) and on any
 * error, so the "Send code on WhatsApp" button only ever appears when it can work.
 */
export function useWhatsAppAvailable(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_API_BASE_URL) return;
    let alive = true;
    fetchAuthOptions().then((o) => alive && setOn(Boolean(o.whatsapp))).catch(() => alive && setOn(false));
    return () => { alive = false; };
  }, []);
  return on;
}
