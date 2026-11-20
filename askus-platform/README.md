# askusnextallcode
All the projects combined into one code

## Docs
- [Staff Hierarchy & Live Presence](docs/staff-hierarchy-live-presence.md)

## Product names
The company name is **Askus Next Global Solutions Private Limited**. Use this
exact spelling, spacing, and full form in company references, legal notices,
copyrights, and publisher metadata. Product names remain distinct from the
company name; repository names, domains, and technical identifiers are unchanged.

Use **Askus Insurance** and **Askus Financial Services** in all customer and staff
interfaces. The insurance app already uses Askus Insurance; the loans app uses
Askus Financial Services. Legacy product URLs, asset filenames, knowledge-base
category values, and stored team identifiers remain unchanged for compatibility.
Calendar team labels translate those identifiers for display without changing
membership or access rules.

## Solutions design
All Solutions pages use self-hosted Poppins typography with dark headings and
body text. Public, login, staff/admin, and customer action buttons share a bright
blue (`#0066ff`) background and white labels, with darker hover/pressed states.
Disabled controls and semantic success, warning, and destructive states remain
distinct. The shared CSS tokens and Ant Design theme define these styles;
native action controls use the `action-button` class instead of inline colours.
Poppins font files are reused from the Financial Services app and distributed
under the [SIL Open Font License](apps/solutions-web/public/fonts/OFL.txt).
[SiteChrome](apps/solutions-web/src/components/SiteChrome.tsx) provides public
navigation, footer, and staff login. The public header stays fixed at the top
(72px desktop, 64px mobile), with content and anchor offsets to prevent overlap; its
[site stylesheet](apps/solutions-web/src/styles/site.css) also styles the home
page. [Public page styles](apps/solutions-web/src/styles/public-pages.css) cover
marketing pages, product details, and forms.
[Global styles](apps/solutions-web/src/index.css) and the Ant Design theme in
[App.tsx](apps/solutions-web/src/App.tsx) style staff/admin and customer screens.
Dense workspace content scrolls horizontally when needed on small screens.

The home page, solutions directory, and product detail pages use original,
lightweight SVG/CSS 3D-style illustrations from
[SolutionVisual](apps/solutions-web/src/components/SolutionVisual.tsx), not
external video embeds or downloaded stock images. AI, taxi, insurance, and
finance each have their own scene. A shared Pause/Play control stops all
decorative animations on the page; reduced-motion preferences disable them
automatically. No animation library or video download is required.

The shared [Brand](apps/solutions-web/src/components/Brand.tsx) displays
**Next Global Solutions Pvt Ltd** below the logo. Full legal/company references
remain **Askus Next Global Solutions Private Limited**. Routes, authentication,
permissions, presence tracking, and backend identifiers are unchanged.

From this directory, run `npm run dev --workspace @askus/solutions-web` and open
`http://localhost:3005/home`. Public and workspace layouts support mobile navigation,
keyboard focus, reduced-motion preferences, and the shared staff login modal.
Run layout and login interaction tests with
`npm run test --workspace @askus/solutions-web -- test/LandingPage.test.tsx test/Layouts.test.tsx test/LoginPages.test.tsx`.
On Node 25, prefix this command with `NODE_OPTIONS=--no-experimental-webstorage`
so jsdom supplies browser storage instead of Node's experimental implementation.

## Careers applications
Selecting a position navigates to `/careers?position=...`, replacing the job
list with the application form at the top of the page. The selected role survives
a refresh or shared URL. A back link returns to the openings, and an open
application is also available. Changing the form's position selector preserves
entered details and the resume; refreshing does not preserve personal fields.
The Solutions `/careers` form posts applicant details and a resume directly to
FormSubmit using `multipart/form-data`, addressed to `careers@askussolutions.in`.
The applicant email is used as Reply-To and the resume as an attachment.
PDF, DOC, and DOCX resumes are accepted, up to 10 MB (10,000,000 bytes).
FormSubmit handles CAPTCHA and the submission result on its own page; the app
does not claim email delivery from an opaque `no-cors` response.

Before using this in production, submit from the deployed site and activate the
form using the confirmation email sent to the careers inbox (check spam too).
Then send a test application and verify its details, Reply-To, and resume arrive.
Local tests do not send email or prove inbox delivery. If submission fails,
applicants can email the same address directly.
See [FormSubmit documentation](https://formsubmit.co/documentation).

## Financial services home page
The financial services `/` page uses
[HomePage.tsx](apps/loans-web/src/screens/public/HomePage.tsx) with a scoped
[stylesheet](apps/loans-web/src/screens/public/homePage.css). Its EMI preview
reuses the existing reducing-balance calculation and slider components; values
are illustrative, exclude fees, and do not trigger credit checks or submissions.
Featured loan cards and the expandable service directory appear first, above
the hero and EMI preview. They share the existing product catalogue and preserve
its destinations and availability labels.
The shared navigation, authentication, footer, and other pages are unchanged.

Run `npm run dev --workspace @askus/loans-web` and open `http://localhost:3003/`.
