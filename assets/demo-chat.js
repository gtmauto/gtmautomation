/* GTM Automation — live web demo chat (index.html, section #live-demo).
 *
 * Contract with the n8n "web-demo" webhook (same origin, CSP connect-src 'self'):
 *   POST /webhook/web-demo
 *   request  JSON: { "session_id": "<random per browser tab>", "message": "<visitor text, <=500 chars>" }
 *   response JSON: { "reply": "<Bangla answer from the GTM knowledge base>" }
 *
 * This file is the ONLY script that talks to that endpoint and it talks to nothing else.
 * It is loaded as an external file because every page carries a Content-Security-Policy meta;
 * script-src 'self' allows it and connect-src 'self' allows the same-origin fetch.
 * Nothing here is stored except a random session id in sessionStorage (guarded by try/catch).
 */
(function () {
  'use strict';

  var ENDPOINT = '/webhook/web-demo';
  var MAX_LEN = 500;
  var TIMEOUT_MS = 30000;
  var STORAGE_KEY = 'gtm_demo_session';

  var widget = document.getElementById('live-demo-widget');
  if (!widget) return;
  var log = document.getElementById('demo-chat-log');
  var form = document.getElementById('demo-chat-form');
  var input = document.getElementById('demo-chat-input');
  var sendBtn = document.getElementById('demo-chat-send');
  var status = document.getElementById('demo-chat-status');
  var counter = document.getElementById('demo-chat-count');
  if (!log || !form || !input || !sendBtn) return;

  var MSG = {
    greeting: 'আসসালামু আলাইকুম! আমি GTM Automation-এর AI সহকারী — Messenger, WhatsApp, Instagram আর Telegram-এ যে বট চলে, সেটাই। দাম, চ্যানেল, ফ্রি ট্রায়াল বা সেটআপ নিয়ে প্রশ্ন করুন।',
    empty: 'কিছু লিখুন, তারপর পাঠান।',
    tooLong: 'সর্বোচ্চ ৫০০ অক্ষর লেখা যাবে।',
    waiting: 'উত্তর আসছে…',
    typing: 'লিখছে…',
    fail: 'দুঃখিত, এখন উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন — অথবা WhatsApp (+880 1886 723675) বা Telegram (@GTM_Autobot)-এ বটকে সরাসরি মেসেজ দিন।',
    timeout: 'উত্তর আসতে বেশি সময় লাগছে। একটু পরে আবার চেষ্টা করুন।',
    tooFast: 'অনেক দ্রুত মেসেজ যাচ্ছে — এক মিনিট পরে আবার চেষ্টা করুন।'
  };

  var BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function toBn(n) { return String(n).replace(/\d/g, function (d) { return BN[d]; }); }

  function randomId() {
    try { if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); } catch (e) { /* fall through */ }
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        var hex = '';
        for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
        return hex;
      }
    } catch (e) { /* fall through */ }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  var sessionId = null;
  try { sessionId = window.sessionStorage.getItem(STORAGE_KEY); } catch (e) { sessionId = null; }
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 8) {
    sessionId = 'web-' + randomId();
    try { window.sessionStorage.setItem(STORAGE_KEY, sessionId); } catch (e) { /* private mode: session id lives in memory only */ }
  }

  function bubble(who, text) {
    var wrap = document.createElement('div');
    wrap.className = 'flex ' + (who === 'me' ? 'justify-end' : 'justify-start');
    var inner = document.createElement('div');
    inner.className = who === 'me'
      ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-neon-blue/25 to-neon-purple/25 px-3.5 py-2 text-white border border-neon-blue/30'
      : 'max-w-[80%] rounded-2xl rounded-bl-sm bg-white/10 px-3.5 py-2 text-slate-200';
    inner.style.whiteSpace = 'pre-wrap';
    inner.style.overflowWrap = 'anywhere';
    inner.textContent = text; // text only: a reply is never rendered as HTML
    wrap.appendChild(inner);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  function setStatus(text, isError) {
    if (!status) return;
    status.textContent = text || '';
    status.className = isError ? 'text-red-300' : 'text-slate-500';
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
    sendBtn.style.opacity = busy ? '.55' : '';
    sendBtn.style.cursor = busy ? 'not-allowed' : '';
    log.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (!busy) { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function updateCounter() {
    if (counter) counter.textContent = toBn(input.value.length);
  }

  function ask(message) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
    var opts = {
      method: 'POST',
      mode: 'same-origin',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message: message })
    };
    if (controller) opts.signal = controller.signal;
    return fetch(ENDPOINT, opts).then(function (res) {
      if (res.status === 429) return { reply: MSG.tooFast };
      if (!res.ok) {
        // 4xx answers carry a Bangla reply from the server (empty message, bad origin…): show it
        return res.json().then(function (d) {
          if (d && typeof d.reply === 'string' && d.reply.trim()) return d;
          throw new Error('HTTP ' + res.status);
        }, function () { throw new Error('HTTP ' + res.status); });
      }
      return res.json();
    }).then(function (data) {
      var reply = data && typeof data.reply === 'string' ? data.reply.trim() : '';
      if (!reply) throw new Error('empty reply');
      return reply;
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  var inFlight = false;
  function submit() {
    if (inFlight) return;
    var message = (input.value || '').replace(/\s+/g, ' ').trim();
    if (!message) { setStatus(MSG.empty, true); return; }
    if (message.length > MAX_LEN) { message = message.slice(0, MAX_LEN); setStatus(MSG.tooLong, true); }
    inFlight = true;
    setBusy(true);
    setStatus(MSG.waiting, false);
    bubble('me', message);
    input.value = '';
    updateCounter();
    var typing = bubble('bot', MSG.typing);
    typing.setAttribute('aria-hidden', 'true');
    ask(message).then(function (reply) {
      typing.remove();
      bubble('bot', reply);
      setStatus('', false);
    }).catch(function (err) {
      typing.remove();
      var aborted = err && (err.name === 'AbortError');
      bubble('bot', aborted ? MSG.timeout : MSG.fail);
      setStatus(aborted ? MSG.timeout : MSG.fail, true);
    }).finally(function () {
      inFlight = false;
      setBusy(false);
    });
  }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });
  input.addEventListener('input', function () {
    if (input.value.length > MAX_LEN) input.value = input.value.slice(0, MAX_LEN);
    updateCounter();
    if (status && status.textContent) setStatus('', false);
  });

  var suggestions = widget.querySelectorAll('[data-demo-suggest]');
  for (var s = 0; s < suggestions.length; s++) {
    suggestions[s].addEventListener('click', function (ev) {
      var q = ev.currentTarget.getAttribute('data-demo-suggest') || '';
      if (!q || inFlight) return;
      input.value = q;
      updateCounter();
      submit();
    });
  }

  bubble('bot', MSG.greeting);
  updateCounter();
  setBusy(false);
})();
