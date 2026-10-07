// Degamed play sandbox host.
// This page runs inside <iframe sandbox="allow-scripts"> on its own origin, so game code can never
// touch the editor's cookies, storage or API. It talks to the editor only through postMessage.
// The real engine runtime replaces the placeholder renderer in milestone 2.
(function () {
  'use strict';
  var ENGINE_VERSION = '0.1.0';
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var files = null;
  var running = true;
  var frames = 0;
  var lastFpsAt = performance.now();

  function send(message) {
    message.channel = 'degamed';
    // The parent's origin is unknown to an opaque-origin sandbox, so '*' is required.
    // Messages never contain secrets: only logs, errors, fps and screenshots.
    parent.postMessage(message, '*');
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    var w = innerWidth, h = innerHeight;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#140830');
    g.addColorStop(0.6, '#4A1670');
    g.addColorStop(1, '#FF5CA8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#22D3EE';
    ctx.font = '600 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    var title = files && files['project.json'] ? safeTitle(files['project.json']) : 'Degamed';
    ctx.fillText(title + ' · engine arrives in milestone 2', w / 2, h / 2 + Math.sin(t / 400) * 6);
  }

  function safeTitle(json) {
    try { return String(JSON.parse(json).title || 'Untitled').slice(0, 80); } catch (e) { return 'Untitled'; }
  }

  function loop(t) {
    if (running) draw(t);
    frames++;
    if (t - lastFpsAt >= 1000) {
      send({ type: 'fps', fps: Math.round((frames * 1000) / (t - lastFpsAt)) });
      frames = 0;
      lastFpsAt = t;
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== parent) return;
    var msg = event.data;
    if (!msg || msg.channel !== 'degamed' || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'load':
        files = msg.files && typeof msg.files === 'object' ? msg.files : null;
        send({ type: 'log', level: 'info', message: 'Loaded ' + (files ? Object.keys(files).length : 0) + ' files' });
        break;
      case 'play': running = true; break;
      case 'pause': running = false; break;
      case 'step': draw(performance.now()); break;
      case 'restart': running = true; break;
      case 'screenshot':
        send({ type: 'screenshot', requestId: String(msg.requestId), dataUrl: canvas.toDataURL('image/png') });
        break;
    }
  });

  window.addEventListener('error', function (e) {
    send({ type: 'error', message: String(e.message), file: e.filename || undefined, line: e.lineno || undefined });
  });

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
  send({ type: 'ready', engineVersion: ENGINE_VERSION });
})();
