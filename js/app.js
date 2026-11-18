/* The Umberverse - screen flow, memories, progress, finale. */
(function (W, D) {
  'use strict';

  var $ = function (id) { return D.getElementById(id); };
  var PLACES = W.PLACES || [];
  var KEY = 'umberverse.v1';
  var HOME = { lat: 43.42, lng: -80.05, zoom: 8.4 };
  var IST = { lat: 41.2749, lng: 28.7323, zoom: 11.4 };

  /* HOME is biased east because the sidebar covers the left third on a laptop.
     A phone has no sidebar and less width, so it needs the true midpoint of the
     pins and a wider zoom, otherwise London falls off the left edge. */
  function homeView() {
    var wide = W.innerWidth >= 860;
    var free = W.innerWidth - (wide ? 330 : 40);
    var fit = Math.log(Math.max(280, free) * 360 / (2.4 * 256)) / Math.LN2;
    return {
      lat: HOME.lat,
      lng: wide ? HOME.lng : -80.32,
      zoom: Math.max(6.9, Math.min(HOME.zoom, fit))
    };
  }

  var state = { visited: {}, open: -1, region: 'on', finaleSeen: false };
  try {
    var s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s && s.visited) { state.visited = s.visited; state.finaleSeen = !!s.finaleSeen; }
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ visited: state.visited, finaleSeen: state.finaleSeen })); } catch (e) {}
  }
  function count() { var n = 0; for (var k in state.visited) if (state.visited[k]) n++; return n; }

  /* ---------- sprite helpers ---------- */
  function paint(cv, sp, scale) {
    var c = cv.getContext('2d');
    cv.width = sp.w * scale; cv.height = sp.h * scale;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    for (var y = 0; y < sp.h; y++)
      for (var x = 0; x < sp.w; x++) {
        var col = sp.px[y * sp.w + x];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x * scale, y * scale, scale, scale);
      }
  }
  function spriteURL(sp, scale) {
    var cv = D.createElement('canvas');
    paint(cv, sp, scale);
    return cv.toDataURL();
  }
  var ICON = {
    heart: spriteURL(W.PIX.SPR.heart, 2),
    done: spriteURL(W.PIX.SPR.heartDone, 2)
  };

  /* ---------- boot / gate ---------- */
  var boot = $('boot'), app = $('app');
  paint($('bootHeart'), W.PIX.SPR.heart, 12);
  paint($('finHeart'), W.PIX.SPR.heart, 11);
  [].forEach.call(D.querySelectorAll('.brand-heart'), function (cv) { paint(cv, W.PIX.SPR.heart, 2); });

  var tries = 0;
  $('enterBtn').addEventListener('click', function () {
    $('bootStage').hidden = true;
    $('gateStage').hidden = false;
    setTimeout(function () { $('gateInput').focus(); }, 80);
  });
  $('gateBack').addEventListener('click', function () {
    $('gateStage').hidden = true;
    $('bootStage').hidden = false;
    $('gateMsg').textContent = ' ';
  });

  function correct(v) {
    var t = String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/nov/.test(t) && /(19|nineteen)/.test(t)) return true;
    if (/^11(19)(\d{2}|\d{4})?$/.test(t)) return true;   /* 11/19, 11-19-25 */
    if (/^19(11)(\d{2}|\d{4})?$/.test(t)) return true;   /* 19/11 */
    return false;
  }

  $('gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('gateMsg');
    if (correct($('gateInput').value)) {
      msg.className = 'gate-msg ok';
      msg.textContent = 'ACCESS GRANTED ♥ loading the umberverse...';
      W.Audio2.start();
      setTimeout(enter, 900);
    } else {
      tries++;
      msg.className = 'gate-msg';
      msg.textContent = tries >= 2
        ? 'nope — hint: the month we started, and the day'
        : 'ACCESS DENIED. try again <3';
      $('gateStage').classList.remove('shake');
      void $('gateStage').offsetWidth;
      $('gateStage').classList.add('shake');
      $('gateInput').select();
    }
  });

  function enter() {
    boot.classList.remove('is-on');
    app.hidden = false;
    /* timers, not rAF: a backgrounded tab suspends rAF indefinitely and the
       map would never initialise */
    setTimeout(function () { app.classList.add('is-on'); }, 20);
    setTimeout(function () { boot.hidden = true; initMap(); }, 440);
  }

  /* ---------- toast ---------- */
  var toastT = null;
  function toast(txt) {
    var el = $('toast');
    el.textContent = txt; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.hidden = true; }, 2600);
  }

  /* ---------- sidebar ---------- */
  var sidebar = $('sidebar'), rows = [];
  function buildSide() {
    var list = $('sideList'), html = [], city = null;
    PLACES.forEach(function (p, i) {
      if (p.city !== city) { city = p.city; html.push('<div class="city-h">' + esc(city.toUpperCase()) + '</div>'); }
      html.push(
        '<button class="pl" data-i="' + i + '">' +
        '<img class="pl-ic" alt="" src="' + ICON.heart + '">' +
        '<span class="pl-tx"><b>' + esc(p.title) + '</b><small>' + esc(p.address) + '</small></span>' +
        '<span class="pl-tag ' + (p.kind === 'video' ? 'v">VIDEO' : 'l">NOTE') + '</span>' +
        '</button>');
    });
    list.innerHTML = html.join('');
    rows = [].slice.call(list.querySelectorAll('.pl'));
    rows.forEach(function (b) {
      b.addEventListener('click', function () { goTo(+b.dataset.i, true); });
    });
    syncSide();
  }
  function syncSide() {
    rows.forEach(function (b) {
      var i = +b.dataset.i, done = !!state.visited[PLACES[i].slug];
      b.classList.toggle('done', done);
      b.querySelector('.pl-ic').src = done ? ICON.done : ICON.heart;
    });
    var n = count();
    $('progFill').style.width = (n / PLACES.length * 100) + '%';
    $('progTxt').textContent = n + ' / ' + PLACES.length;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  $('sideToggle').addEventListener('click', function () { sidebar.classList.toggle('closed'); });
  $('sideClose').addEventListener('click', function () { sidebar.classList.add('closed'); });

  /* ---------- map ---------- */
  var map = null;
  function initMap() {
    map = new W.PixelMap($('map'), { onMarker: function (m, i) { openAt(i); } });
    var h = homeView();
    map.setView(h.lat, h.lng, h.zoom);
    refreshMarkers();
    buildSide();
    if (W.innerWidth < 860) sidebar.classList.add('closed');
    setTimeout(function () { $('hint').classList.add('gone'); }, 7000);
  }
  function refreshMarkers() {
    var r = state.region;
    map.setMarkers(PLACES.map(function (p, i) {
      return { lat: p.lat, lng: p.lng, title: p.title, i: i, done: !!state.visited[p.slug] };
    }).filter(function (m) {
      var ist = PLACES[m.i].city === 'Turkiye';
      return r === 'ist' ? ist : !ist;
    }));
  }

  function setRegion(r) {
    state.region = r;
    if (r === 'ist') {
      map.setRegion('ist', IST.lat, IST.lng, IST.zoom);
      $('teleBtn').classList.add('home');
      $('teleBtn').innerHTML = '<em>⌂</em><span>BACK TO ONTARIO</span>';
    } else {
      var h = homeView();
      map.setRegion('on', h.lat, h.lng, h.zoom);
      $('teleBtn').classList.remove('home');
      $('teleBtn').innerHTML = '<em>✈</em><span>TELEPORT TO TÜRKİYE</span>';
    }
    refreshMarkers();
  }
  $('teleBtn').addEventListener('click', function () {
    setRegion(state.region === 'ist' ? 'on' : 'ist');
    toast(state.region === 'ist' ? 'welcome to İstanbul ✈' : 'back home ♥');
  });

  $('zoomIn').addEventListener('click', function () { map.zoomBy(0.9); });
  $('zoomOut').addEventListener('click', function () { map.zoomBy(-0.9); });
  $('homeBtn').addEventListener('click', function () {
    if (state.region !== 'on') setRegion('on');
    else { var h = homeView(); map.flyTo(h.lat, h.lng, h.zoom, 700); }
  });

  /* fly to a place, then open it */
  function goTo(i, open) {
    var p = PLACES[i];
    var ist = p.city === 'Turkiye';
    if (ist !== (state.region === 'ist')) setRegion(ist ? 'ist' : 'on');
    if (W.innerWidth < 860) sidebar.classList.add('closed');
    var z = Math.max(map.zoom, ist ? 12.4 : 13.6);
    map.flyTo(p.lat, p.lng, z, 760, function () { if (open) openAt(i); });
  }

  /* ---------- modal ---------- */
  var modal = $('modal'), mBody = $('mBody'), win = modal.querySelector('.modal-win');
  function openAt(i) {
    var p = PLACES[i];
    if (!p) return;
    state.open = i;
    $('mTitle').textContent = p.title;
    $('mAddr').textContent = p.address;
    mBody.innerHTML = '';
    win.classList.toggle('media', p.kind === 'video');
    win.style.width = '';
    if (p.kind === 'video') {
      var v = D.createElement('video');
      v.src = p.video; v.poster = p.poster;
      v.controls = true; v.playsInline = true; v.preload = 'metadata';
      v.setAttribute('controlsList', 'nodownload');
      /* portrait clips get a narrow window instead of fat black bars */
      v.addEventListener('loadedmetadata', function () {
        var maxH = W.innerHeight * 0.68;
        win.style.width =
          Math.min(760, Math.max(330, Math.round(maxH * v.videoWidth / v.videoHeight))) + 'px';
      });
      mBody.appendChild(v);
      setTimeout(function () { v.play().catch(function () {}); }, 180);
    } else {
      var d = D.createElement('div');
      d.className = 'letter';
      d.innerHTML = p.body.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
                    '<p class="sig">♥</p>';
      mBody.appendChild(d);
    }
    mBody.scrollTop = 0;
    $('mPrev').disabled = i === 0;
    $('mNext').disabled = i === PLACES.length - 1;
    modal.hidden = false;
    W.Audio2.pause();
    D.addEventListener('keydown', onKey);
  }

  function closeModal() {
    var i = state.open;
    modal.hidden = true;
    var v = mBody.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    mBody.innerHTML = '';
    D.removeEventListener('keydown', onKey);
    state.open = -1;
    if (i >= 0) {
      var p = PLACES[i];
      var fresh = !state.visited[p.slug];
      state.visited[p.slug] = true;
      save(); syncSide(); refreshMarkers();
      if (fresh) {
        var n = count();
        toast(n >= PLACES.length ? 'that’s all 19 ♥' : n + ' of ' + PLACES.length + ' memories found');
      }
    }
    W.Audio2.next();           /* new song every time she steps back out */
    if (count() >= PLACES.length) setTimeout(showFinale, 700);
  }

  function onKey(e) {
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowRight' && state.open < PLACES.length - 1) step(1);
    else if (e.key === 'ArrowLeft' && state.open > 0) step(-1);
  }
  function step(d) {
    var i = state.open;
    var j = i + d;
    if (j < 0 || j >= PLACES.length) return;
    state.visited[PLACES[i].slug] = true; save(); syncSide(); refreshMarkers();
    var p = PLACES[j], ist = p.city === 'Turkiye';
    if (ist !== (state.region === 'ist')) setRegion(ist ? 'ist' : 'on');
    map.flyTo(p.lat, p.lng, Math.max(map.zoom, ist ? 12.4 : 13.6), 600);
    openAt(j);
  }
  $('mDone').addEventListener('click', closeModal);
  $('modalX').addEventListener('click', closeModal);
  $('modalBack').addEventListener('click', closeModal);
  $('mPrev').addEventListener('click', function () { step(-1); });
  $('mNext').addEventListener('click', function () { step(1); });

  /* ---------- player ---------- */
  W.Audio2.init({ title: $('npTitle'), player: $('player') });
  $('npNext').addEventListener('click', function (e) { e.stopPropagation(); W.Audio2.next(); });
  $('npToggle').addEventListener('click', function () {
    var p = $('player'), min = p.classList.toggle('min');
    $('npToggle').textContent = min ? '▴' : '▾';
  });

  /* ---------- finale ---------- */
  var fx = null;
  function showFinale() {
    var el = $('finale');
    if (!el.hidden) return;
    el.hidden = false;
    state.finaleSeen = true; save();
    if (!fx) fx = new W.FX($('fx'));
    fx.start();
    for (var i = 0; i < 7; i++) setTimeout(function () { fx.launch(); }, i * 170);
  }
  $('finClose').addEventListener('click', function () {
    $('finale').hidden = true;
    if (fx) fx.stop();
  });

  /* replay the finale from the progress pill once it's been earned */
  $('progTxt').addEventListener('click', function () {
    if (count() >= PLACES.length) showFinale();
  });
  $('progTxt').style.cursor = 'pointer';

  W.UV = { map: function () { return map; }, state: state, finale: showFinale, reset: function () {
    state.visited = {}; state.finaleSeen = false; save(); syncSide(); refreshMarkers();
  } };
})(window, document);
