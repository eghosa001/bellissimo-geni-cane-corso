# Website visits

Public production pages load the Cloudflare Web Analytics beacon through
`assets/site-analytics.js`. Admin pages, localhost and preview hosts are excluded.
The beacon token is a public site identifier, not an API credential.

In the admin panel, choose **Visits**, then Last 7 days or Last 30 days.
Reports show visits, page views, daily totals, top ten pages and top ten countries.
Dates use UTC, including the partial current day. Cloudflare may sample data;
blocked JavaScript is not counted. A visit is an arrival from another website
or directly, not an identified unique person. Collection began 27 September 2026.

## Backend setup

The existing `bellissimo-geni-cane-corso` Worker requires a secret named
`CLOUDFLARE_ANALYTICS_TOKEN` with **Account / Account Analytics / Read**, scoped
only to the owning Cloudflare account. Save the token in Worker secrets, never
in GitHub, site-config.json or browser code. Preserve this secret on redeploy.

The Worker calls Cloudflare GraphQL for this site's fixed account, site tag and
hostname, excluding bot traffic and admin paths. `/admin/api/analytics?days=7`
accepts only GET requests, existing admin credentials and a 7- or 30-day range.
It returns no-store responses and does not expose provider errors or tokens.
Missing configuration and provider errors appear separately from zero traffic.

Run `npm test` and `npm run check` before deploying. Publish the Worker changes
as well as the GitHub Pages site. Public tracking can collect data before the
reporting credential is connected; it does not recover historic visits.
