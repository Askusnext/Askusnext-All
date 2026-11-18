# Staff Hierarchy & Live Presence (Solutions)

Applies to Solutions staff only. Browser presence is **not verified working time and is never used for attendance or payroll**.

## 1. Architecture and data flow
```
Browser (Admin/Employee/Agent) --REST heartbeat--> PresenceService --> Postgres (sessions, state, transitions)
                                                         |  in-process bus
Manager dashboard <--WebSocket /ws/presence-- PresenceGateway (per-viewer scoped, re-checked on every delivery)
```
* Heartbeats are plain authenticated REST (`POST /api/presence/heartbeat`); they work through any proxy. The WebSocket carries only manager-side live updates, so a blocked WebSocket degrades to a 60-second REST refresh, never to wrong data.
* Server time only. A 15-second timer re-evaluates everyone who is not Offline, so tabs that vanish become Offline with no client event.
* Files: `solutions/presence.{entities,logic,service,gateway,controller}.ts`, `staff-hierarchy.service.ts`, `tms-role.ts`; UI in `apps/solutions-web/src/{presence,components/PresenceGate.tsx,views/PresencePage.tsx}`; assignment control in `UserManagementPage.tsx`.

## 2. Role matrix (enforced by the backend; roles are read from the database, never from the token)
| Role | Own consent/tracking | Team presence | Assign staff | Notes |
|---|---|---|---|---|
| Super Admin | no (observer) | all Admins, Employees, Agents, assigned or not | yes (Employee/Agent -> Admin) | |
| Admin | yes | only Employees/Agents currently assigned to them | no | no peers, no other teams, no unassigned |
| Employee / Agent | yes | none (403) | no | no staff lists, history, exports, sockets |
| Customer / product admins | none (403) | none | no | never prompted |

Out-of-scope subjects return **404**, identical to a nonexistent id. Non-managers get 403.

## 3. Assignment and audit
`identity.users.reporting_admin_id` (nullable, indexed, FK -> users `ON DELETE SET NULL`, CHECK not self). One Admin per Employee/Agent. Existing staff start **unassigned**; nothing is guessed. `PUT /api/presence/assignments/:userId {adminId|null, reason?}` is Super-Admin-only, runs in one transaction with the subject row locked, validates an active approved Admin target, and writes `solutions.staff_assignment_audit` (actor, subject, old, new, time, reason). Deactivating an Admin, or changing someone's role, clears the affected links with audit rows. The existing `solutions.team_members` (calendar ventures) is a different, many-to-many concept and is untouched.

## 4. Consent lifecycle
Notice version in `presence.logic.ts` (`NOTICE_VERSION`). `GET /presence/me` -> `needsDecision`. Allow (`POST /presence/consent/accept`) persists version + time and only then does the client start a session. Not now (`/consent/defer`) starts nothing and is not re-offered for `PRESENCE_DEFER_DAYS`. Withdraw (`/consent/withdraw`) ends every session at once. Bumping `NOTICE_VERSION` forces a new decision; older acceptances are never migrated. Desktop-monitoring consent is separate and never reused.

## 5. States
Active (a fresh session is visible and focused) > Background (fresh but out of view) > Away (out of view continuously >= away threshold) > Offline (no fresh heartbeat; cause unknown) ; **Not enabled** (no valid consent) is distinct from Offline. Aggregation is across all of a person's sessions; an expired tab never overrides a fresh one; per-session `seq` rejects duplicate/out-of-order heartbeats; the aggregate `version` only increases.

## 6. Configuration
See `.env.example`: `PRESENCE_HEARTBEAT_SECONDS=30`, `PRESENCE_OFFLINE_SECONDS=120`, `PRESENCE_AWAY_MINUTES=10`, `PRESENCE_HISTORY_RETENTION_DAYS=30`, `PRESENCE_MAX_SESSIONS=8`, `PRESENCE_DEFER_DAYS=1`, `PRESENCE_SINGLE_INSTANCE_GUARD=true`. Test-only: `DISABLE_RATE_LIMIT=true` (ignored when `NODE_ENV=production`), `PRESENCE_DISABLE_EXPIRY=true`.

## 7. Browser throttling limitation
Browsers slow timers in background tabs and may suspend sleeping devices. A delayed heartbeat can make a reachable person look Offline for a while. Offline never claims a cause.

## 8. Migration
Migration `1795800000000-AddStaffHierarchyPresence`. Run: `npm run build && npm run migration:run` (Railway runs it as `preDeployCommand`). Rollback: `npx typeorm migration:revert -d dist/data-source.js`. **Rollback drops** the assignment column, the audit table and all presence tables, discarding assignments, audit rows, consents and presence history created since. It touches no attendance, payroll or monitoring table. `migration:generate` will propose dropping the FK and CHECK constraints (they are DB-level safeguards the entities do not model): do not accept those lines.

## 9. Retention
State-change rows older than `PRESENCE_HISTORY_RETENTION_DAYS` and sessions idle > 2 days are deleted hourly by `PresenceService.purge()` (presence tables only). Heartbeats themselves are never stored as history.

## 10. Local development and tests
`docker compose up -d postgres` (port 5440), `npm run dev`. Use Node >= 20.19 (tailwind needs `require(esm)`). Backend: `npm test -w @askus/api` (Jest; boots the real app against a throw-away database `askus_test` and a real WebSocket server). Frontend: `npm test -w @askus/solutions-web` (Vitest + Testing Library).

## 11. Data minimisation
Stored: user id, opaque random session id (not a token), `in_view` flag, `seq`, server timestamps, state, consent version/decision/time. Never stored: URLs/titles of other tabs, desktop apps, keystrokes, screenshots, media, location, tokens. Heartbeat DTOs reject unknown fields (400). Tests assert the schema has no such columns.

## 12. WebSocket, proxy and TLS
* Path `/ws/presence` on the API host. Auth is the **first message** `{type:"auth", token:<access JWT>}`; nothing secret is in the URL. The socket closes at token expiry (15 min, close 4401) and the client reconnects with a refreshed token. 4403 = not authorized (no retry), 4400 bad message, 4429 rate limited.
* Origin must be listed in `CORS_ORIGINS`; otherwise HTTP 403 at upgrade. Per-IP cap 20 connections; 30 messages / 10 s.
* The proxy must forward `Upgrade: websocket` and `Connection: Upgrade`, terminate TLS (clients use `wss://`), and allow idle connections > 60 s (client pings every 25 s). The per-IP cap uses the socket address; behind a proxy this is the proxy's address unless trust-proxy handling is added.
* **Not verified on Railway/Cloudflare.** Operator checks: connect with `wscat -H "Origin: https://<web-origin>" -c wss://<api>/ws/presence`, send an auth message, expect `ready`.

## 13. Replicas
Single instance by design (no Redis). A Postgres advisory lock (`pg_try_advisory_lock(727001)`) ensures only one API process serves live presence; other processes refuse WebSocket upgrades (503) and log an error; browsers fall back to 60-second polling. Heartbeats/REST are DB-backed and correct on any instance, but live pushes and the expiry timer rely on the lock holder, which also publishes changes made by other processes within ~15 s. Scaling beyond one instance requires a shared pub/sub (e.g. Redis) and was not built.

## 14. Deployment / rollback sequence
Deploy API (migration runs first) -> deploy web (static export) -> confirm Super Admin assigns staff in User Management -> confirm WebSocket upgrade. Rollback: redeploy previous web+API; run `migration:revert` only if the new tables must be removed (data loss as above).

## 15. Existing endpoints now scoped
Admin = own reports (+ self); Employee/Agent = self only; Super Admin = all. Applied to: `/users` list and per-user actions, `/attendance/live`, `/attendance/trail`, `/attendance/register|late-report|missed-checkouts|export|manual`, `/leave/requests|approve|balance|balance-summary`, `/timesheet*`, `/time/active-status|daily-summary|settings`, `/reports/export`. Self-service (check-in/out, own leave, own timesheet, own work hours) is unchanged. **Behaviour change:** Employees/Agents holding `timesheet`/`users` permissions no longer see peers there. **Not changed:** role-wide work-hour rules still editable by any Admin; the Activity log and Calendar team/organisation views (venture-based `team_members`) still use their own scoping; `/users` lets an Admin also see people they created and pending access requests.

## 16. Troubleshooting
* WebSocket 403: origin missing from `CORS_ORIGINS`. 503: another API instance holds the lock. 4403: viewer not Admin/Super Admin or disabled. Repeated 4401: clock skew or token not refreshing.
* Everyone Offline: expiry/timer blocked or heartbeats failing (401 = session expired; 403 = consent withdrawn).
* Admin sees nobody: nobody is assigned yet (expected after rollout).
