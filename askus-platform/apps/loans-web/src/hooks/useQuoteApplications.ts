import { useEffect, useState } from 'react'
import {
  fetchCustomerDetails, subscribeQuoteApplications, subscribeQuoteHistory,
  type CustomerDetails, type QuoteApplication, type QuoteHistoryEntry,
} from '../services/api/loansApi'

/** Live list of the signed-in customer's in-progress loan applications. */
export function useQuoteApplications(uid: string | undefined) {
  const [state, setState] = useState<{ uid?: string; apps: QuoteApplication[]; error: boolean }>({ apps: [], error: false })

  useEffect(() => {
    if (!uid) return
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = subscribeQuoteApplications(
        uid,
        (apps) => setState({ uid, apps, error: false }),
        () => setState({ uid, apps: [], error: true }),
      )
    } catch {
      // API unreachable: show the empty state.
    }
    return () => unsubscribe?.()
  }, [uid])

  // Ignore data that belongs to a previous user.
  const current = state.uid === uid ? state : { apps: [] as QuoteApplication[], error: false }
  return { apps: uid ? current.apps : [], error: current.error, loaded: Boolean(uid) && state.uid === uid }
}

/** The signed-in customer's saved profile details (name, income, employment, ...). */
export function useCustomerDetails(uid: string | undefined) {
  const [state, setState] = useState<{ uid?: string; details: CustomerDetails | null }>({ details: null })

  useEffect(() => {
    if (!uid) return
    let active = true
    fetchCustomerDetails(uid)
      .then((details) => active && setState({ uid, details }))
      .catch(() => active && setState({ uid, details: null }))
    return () => {
      active = false
    }
  }, [uid])

  return { details: uid && state.uid === uid ? state.details : null, loaded: !uid || state.uid === uid }
}

/** Live status timeline (submitted, review steps, requests, decisions) for one application. */
export function useQuoteHistory(uid: string | undefined, appId: string) {
  const [state, setState] = useState<{ key: string; list: QuoteHistoryEntry[] }>({ key: '', list: [] })
  const key = uid && appId ? `${uid}/${appId}` : ''

  useEffect(() => {
    if (!key || !uid) return
    const unsubscribe = subscribeQuoteHistory(uid, appId, (list) => setState({ key, list }), () => setState({ key, list: [] }))
    return () => unsubscribe()
  }, [key, uid, appId])

  return state.key === key ? state.list : []
}
