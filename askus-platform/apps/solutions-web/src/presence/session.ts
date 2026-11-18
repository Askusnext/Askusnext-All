// Lets logout stop browser presence cleanly without AppLayout knowing about the tracker's internals.
type Stopper = () => void;
let stopper: Stopper | null = null;

export const registerPresenceStopper = (fn: Stopper | null) => {
  stopper = fn;
};

/** Call before clearing the session: stops heartbeats and tells the server the tab is gone. */
export const stopPresenceForLogout = () => {
  try {
    stopper?.();
  } catch {
    /* logout must never fail because of presence */
  }
};

/** Only these roles take part: Super Admin only observes and Customers never enter the flow. */
export const takesPartInPresence = (role?: string) => role === 'Admin' || role === 'Employee' || role === 'Agent';
