/* First-touch UTM memory for gtmautomation.net (30 days).
   Every link the GTM Social Media Manager posts carries ?utm_source=…&utm_medium=…&utm_campaign=…&utm_content=….
   This script reads those four values from the page URL, keeps the FIRST set it sees in localStorage for 30 days
   (a later visit from another post does not overwrite it), and the trial form on the home page sends them with
   the lead so the weekly report can say which post brought which lead. No cookie, no identifier, no network
   call: nothing leaves the page until the visitor submits the form. */
(function () {
  var KEY = 'gtm_utm', DAYS = 30;
  function clean(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  }
  function stored() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (j && j.campaign && j.ts && Date.now() - j.ts < DAYS * 864e5) return j;
    } catch (e) { /* private window / storage blocked: fall through */ }
    return null;
  }
  function fromUrl() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    var c = clean(q.get('utm_campaign'));
    if (!c) return null;
    return {
      source: clean(q.get('utm_source')) || 'unknown',
      medium: clean(q.get('utm_medium')) || 'unknown',
      campaign: c,
      content: clean(q.get('utm_content')),
      landing: String(location.pathname || '/').slice(0, 80),
      ts: Date.now()
    };
  }
  var fresh = fromUrl();
  if (fresh && !stored()) {
    try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) { /* keep `fresh` in memory for this page */ }
  }
  /* The trial form calls this: the remembered first touch, else this page's own tag, else null. */
  window.gtmUtm = function () {
    var j = stored() || fresh;
    return j ? { source: j.source, medium: j.medium, campaign: j.campaign, content: j.content || '', landing: j.landing || '' } : null;
  };
})();
