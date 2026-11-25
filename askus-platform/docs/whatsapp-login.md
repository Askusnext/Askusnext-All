# Login with WhatsApp (Loans, Insurance, Solutions)

One backend feature, three apps. A person asks for their sign-in code **on WhatsApp** instead of SMS or email. Nothing about who may sign in changes: the code still proves the person controls the number, and every existing rule (staff approval, suspended accounts, first sign-in verifying mobile *and* email) still applies.

## How it behaves
| Situation | Without WhatsApp (as before) | With "Get code on WhatsApp" |
|---|---|---|
| **First sign-in** (needs mobile and email) | mobile code by SMS + email code by email | mobile code on **WhatsApp** + email code by email (WhatsApp replaces the SMS) |
| **Later sign-ins** (verified account) | one code by email | one code on **WhatsApp** to the mobile already on the account |
| WhatsApp cannot deliver | n/a | the code goes by **SMS** (first sign-in) or **email** (later); the screen says so; a "send it by SMS/email instead" link is always shown |
| WhatsApp not set up | n/a | the button is **not shown** (`GET /auth/options` says `whatsapp: false`) |

* Staff can use it too (they type their email; the code goes to the verified mobile on their account). A verified account always gets the code at **its own** number: a number supplied by the requester is ignored, so nobody can send codes to a stranger.
* Cost control: at most **5 WhatsApp codes per number per 10 minutes** (then HTTP 429 with "use SMS or email"). The per-IP limit on `request-otp` (5 per minute) still applies.
* Codes are never logged. Only Meta's error code and message are.

## API
* `POST /auth/request-otp` accepts `"channel": "whatsapp"` (only that value; anything else is a 400). The answer adds `channels` (may contain `"whatsapp"`), `mobileHint` (e.g. `+91 ******3210`, last four digits only) and `whatsappFailed: true` when WhatsApp was asked for but not used.
* `GET /auth/options` returns `{ "whatsapp": true|false }`. Public, no secrets.
* `verify-otp` is unchanged: the code is checked exactly as before, whichever channel carried it.

## What the business has to set up (Meta WhatsApp Business Platform / Cloud API)
1. A **Meta Business account**, verified (Business Verification).
2. A **WhatsApp Business Account (WABA)** and a **phone number** for it. The number must not be in use on a normal WhatsApp app (or must be migrated). Its **display name** must be approved.
3. A **payment method** on the WABA. Meta bills per authentication message; check the current India rate card.
4. A permanent **access token**: create a *System User* in Business Settings, give it the WABA with full control, generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`. (Not the 24-hour test token.)
5. The **Phone number ID** (WhatsApp Manager > API setup).
6. An approved **Authentication** message template (category *Authentication*, not Utility or Marketing; Meta rejects OTPs in other categories). Choose "Copy code" as the button. Note its **exact name** and **language**.

## Settings (backend `.env` / Railway variables)
| Variable | Value |
|---|---|
| `WHATSAPP_TOKEN` | the permanent access token (same one the leads module uses) |
| `WHATSAPP_PHONE_ID` | the Phone number ID (same one the leads module uses) |
| `WHATSAPP_OTP_TEMPLATE` | the approved authentication template's name (separate from `WHATSAPP_TEMPLATE`, which is for lead messages) |
| `WHATSAPP_OTP_LANG` | optional, the template language, e.g. `en` or `en_US` (defaults to `WHATSAPP_LANG`, then `en`) |
| `WHATSAPP_OTP_BUTTON` | optional, `false` only if the template has no button (default `true`) |
| `WHATSAPP_BASE_URL` | optional, Graph API URL with version (default `https://graph.facebook.com/v20.0`). Meta retires old versions after about two years, so check that the version is still supported. |

The button appears only when `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` **and** `WHATSAPP_OTP_TEMPLATE` are all set. In development with `DUMMY_OTP_CODE` set it also appears, and "sending" only logs; the code is the fixed test code.

## What is not built yet
* **Delivery receipts (webhook).** Meta accepts a message even if the number is not on WhatsApp and reports the failure later. Today the person uses "send it by SMS/email instead". A webhook (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`) could trigger the fallback automatically.
* **Admin web** (`apps/admin-web`) sign-in has no WhatsApp button.
* Tested against a fake Meta: not yet against a live WhatsApp number. First real test: set the three variables, open a sign-in screen, press the WhatsApp button with your own number.

## Tests
* `npm test -w @askus/api -- whatsapp` runs 14 unit tests (what we send to Meta, what happens when Meta refuses, nothing secret logged) and 16 flow tests against a real database (first sign-in, verified sign-in, fallbacks, limits, validation, "cannot target someone else's number").
