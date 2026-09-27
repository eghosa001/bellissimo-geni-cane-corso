/* Owner-only reports; credentials are sent by the existing admin API helper. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const count = value => Math.max(0, Math.round(Number(value) || 0));
  const format = value => count(value).toLocaleString('en');
  let selectedDays = 7;

  window.renderVisits = async (days = selectedDays) => {
    selectedDays = Number(days) === 30 ? 30 : 7;
    const controls = `<div class="visits-toolbar"><div><h3>Website visits</h3><p class="muted">Traffic to bellissimogeni.com</p></div><label>Period <select id="visitsPeriod" onchange="changeVisitsPeriod(this.value)"><option value="7" ${selectedDays === 7 ? 'selected' : ''}>Last 7 days</option><option value="30" ${selectedDays === 30 ? 'selected' : ''}>Last 30 days</option></select></label><button class="btn" onclick="renderPage('visits')">Refresh</button></div>`;
    let data;
    try { data = await apiFetch('/admin/api/analytics?days=' + selectedDays); }
    catch (_) { data = { ok: false }; }
    if (!data.ok) {
      const message = data.error === 'analytics_not_configured'
        ? 'Reports are waiting for the analytics connection to be completed. Tracking starts when the public-site update is deployed.'
        : ['missing_auth', 'unauthorized'].includes(data.error)
          ? 'Your session has expired. Sign out and sign in again to view visits.'
          : 'Visit reports are temporarily unavailable. Please try again shortly.';
      return controls + `<div class="panel"><div class="panel-body" role="status">${message}</div></div>`;
    }
    const max = Math.max(1, ...data.daily.map(row => count(row.pageViews)), ...data.daily.map(row => count(row.visits)));
    const bars = data.daily.map(row => {
      const label = `${row.date}: ${format(row.visits)} visits, ${format(row.pageViews)} page views`;
      return `<div class="visits-day" tabindex="0" aria-label="${escape(label)}" title="${escape(label)}"><div class="visits-bars"><span class="visits-pageviews" style="height:${count(row.pageViews) / max * 100}%"></span><span class="visits-count" style="height:${count(row.visits) / max * 100}%"></span></div><small>${escape(row.date.slice(5))}</small></div>`;
    }).join('');
    const table = (title, heading, rows) => `<section class="panel"><div class="panel-header"><h3>${title}</h3></div><table class="datatable"><thead><tr><th>${heading}</th><th>Page views</th></tr></thead><tbody>${rows || '<tr><td colspan="2" class="muted">No data yet</td></tr>'}</tbody></table></section>`;
    const pageRows = data.pages.map(row => `<tr><td class="visits-path">${escape(row.path)}</td><td>${format(row.pageViews)}</td></tr>`).join('');
    const countryRows = data.countries.map(row => {
      let name = row.country;
      try { name = new Intl.DisplayNames(['en'], { type: 'region' }).of(row.country) || name; } catch (_) { /* Country may already be a full name. */ }
      return `<tr><td>${escape(name)}</td><td>${format(row.pageViews)}</td></tr>`;
    }).join('');
    return controls + `<div class="stats-row"><div class="stat-card"><div class="num">${format(data.totals.visits)}</div><div class="label">Visits</div></div><div class="stat-card"><div class="num">${format(data.totals.pageViews)}</div><div class="label">Page views</div></div></div>
      <p class="muted visits-note">A visit begins when someone arrives directly or from another website. Visits are not a count of unique people. Figures may be estimated or delayed; blocked tracking is not counted. Dates use UTC and today is partial. Admin pages are excluded.</p>
      ${data.totals.pageViews === 0 ? '<div class="panel"><div class="panel-body" role="status">No visits recorded for this period yet. New traffic can take a few minutes to appear.</div></div>' : ''}
      <section class="panel"><div class="panel-header"><h3>Daily traffic</h3><span class="visits-legend">Gold: visits · Grey: page views</span></div><div class="panel-body"><div class="visits-chart" role="group" aria-label="Daily visits and page views">${bars}</div><details class="visits-details"><summary>View daily numbers</summary><table class="datatable"><thead><tr><th>Date (UTC)</th><th>Visits</th><th>Page views</th></tr></thead><tbody>${data.daily.map(row => `<tr><td>${escape(row.date)}</td><td>${format(row.visits)}</td><td>${format(row.pageViews)}</td></tr>`).join('')}</tbody></table></details></div></section>
      <div class="visits-breakdowns">${table('Popular pages', 'Page', pageRows)}${table('Countries', 'Country', countryRows)}</div><p class="muted visits-note">Powered by Cloudflare Web Analytics. Collection began 27 September 2026; earlier visits are unavailable.</p>`;
  };
  window.changeVisitsPeriod = value => {
    selectedDays = Number(value) === 30 ? 30 : 7;
    return renderPage('visits');
  };
})();
