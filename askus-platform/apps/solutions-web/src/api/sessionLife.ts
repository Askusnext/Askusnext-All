// A sign-in lasts 12 hours. The refresh token enforces that on the server; this mirrors it on
// the client so an old session is dropped on load instead of waiting for the first failed call.
export const SESSION_MS = 12 * 60 * 60 * 1000;

const AREAS = [
  { access: 'tms_token', others: ['tms_refresh', 'tms_user'] },
  { access: 'askus_customer_token', others: ['askus_customer_refresh', 'askus_customer'] },
];

const expKey = (access: string) => `${access}_exp`;

/** Record when this sign-in ends. Call once at sign-in, never on token refresh. */
export function markSignedIn(accessKey: string) {
  localStorage.setItem(expKey(accessKey), String(Date.now() + SESSION_MS));
}

export function clearSessionKeys(accessKey: string, others: string[]) {
  [accessKey, expKey(accessKey), ...others].forEach((k) => localStorage.removeItem(k));
}

/** Remove any session whose 12 hours are up (or that has no recorded end time). */
export function purgeExpiredSessions() {
  try {
    for (const { access, others } of AREAS) {
      if (!localStorage.getItem(access)) continue;
      const exp = Number(localStorage.getItem(expKey(access)));
      if (!exp || Date.now() >= exp) clearSessionKeys(access, others);
    }
  } catch {
    /* storage unavailable: nothing to purge */
  }
}

export const STAFF_SESSION_KEYS = AREAS[0];
