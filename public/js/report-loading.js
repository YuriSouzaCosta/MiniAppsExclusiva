(function () {
  'use strict';

  var pending = 0;
  var showTimer = null;
  var hideTimer = null;
  var visibleSince = 0;
  var overlay = null;

  function build() {
    if (overlay || !document.body) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'report-loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Carregando dados do relatório');
    overlay.innerHTML = '<div class="report-loading-card"><div class="report-loading-spinner" aria-hidden="true"></div><strong>Carregando dados</strong><span>Aguarde enquanto o relatório é atualizado…</span></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function reveal() {
    if (!pending) return;
    var element = build();
    if (!element) return;
    visibleSince = Date.now();
    element.classList.add('is-visible');
    document.body.classList.add('report-is-loading');
  }

  function begin() {
    pending += 1;
    clearTimeout(hideTimer);
    if (pending === 1) showTimer = setTimeout(reveal, 120);
  }

  function finish() {
    pending = Math.max(0, pending - 1);
    if (pending) return;
    clearTimeout(showTimer);
    var wait = Math.max(0, 280 - (Date.now() - visibleSince));
    hideTimer = setTimeout(function () {
      if (pending || !overlay) return;
      overlay.classList.remove('is-visible');
      document.body.classList.remove('report-is-loading');
    }, wait);
  }

  window.ReportLoading = { show: begin, hide: finish };

  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function () {
      begin();
      return originalFetch.apply(this, arguments).then(function (response) {
        finish();
        return response;
      }, function (error) {
        finish();
        throw error;
      });
    };
  }

  if (window.XMLHttpRequest) {
    var originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      begin();
      this.addEventListener('loadend', finish, { once: true });
      try { return originalSend.apply(this, arguments); }
      catch (error) { finish(); throw error; }
    };
  }
}());
