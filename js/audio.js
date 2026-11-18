/* Shuffled playlist through the official Spotify embed controller. */
(function (W, D) {
  'use strict';

  var list = (W.TRACKS || []).slice();
  var order = [], idx = -1, ctl = null, armed = false, wantPlay = false;
  var lastPos = 0, titleEl = null, playerEl = null;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function label(t) { return t ? t.n + ' — ' + t.a : 'our playlist'; }

  function show(t) {
    if (titleEl) titleEl.textContent = label(t);
  }

  function load(play) {
    var t = order[idx];
    if (!t) return;
    show(t);
    lastPos = 0;
    if (!ctl) { wantPlay = play; return; }
    ctl.loadUri('spotify:track:' + t.i);
    if (play) {
      wantPlay = true;
      setTimeout(function () { if (wantPlay && ctl) { try { ctl.play(); } catch (e) {} } }, 420);
    }
  }

  var Audio = {
    paused: true,

    init: function (opts) {
      titleEl = opts.title; playerEl = opts.player;
      order = shuffle(list.slice());
      idx = 0;
      show(order[0]);
    },

    /* must be called from a user gesture */
    start: function () {
      if (armed) return;
      armed = true;
      this.paused = false;
      if (playerEl) playerEl.classList.remove('paused');
      load(true);
    },

    next: function () {
      if (!order.length) return;
      idx = (idx + 1) % order.length;
      if (idx === 0) shuffle(order);
      this.paused = false;
      if (playerEl) playerEl.classList.remove('paused');
      load(armed);
    },

    pause: function () {
      this.paused = true;
      if (playerEl) playerEl.classList.add('paused');
      wantPlay = false;
      if (ctl) { try { ctl.pause(); } catch (e) {} }
    },

    resume: function () {
      if (!armed) return this.start();
      this.paused = false;
      if (playerEl) playerEl.classList.remove('paused');
      wantPlay = true;
      if (ctl) { try { ctl.play(); } catch (e) {} }
    },

    _attach: function (c) {
      ctl = c;
      c.addListener('playback_update', function (e) {
        var d = e && e.data; if (!d) return;
        if (playerEl) playerEl.classList.toggle('paused', !!d.isPaused);
        Audio.paused = !!d.isPaused;
        /* preview finished -> roll onto the next song */
        if (d.duration > 0 && d.position > 0 && d.position >= d.duration - 400) {
          if (lastPos !== d.position) { lastPos = d.position; Audio.next(); }
        }
      });
      if (wantPlay) load(true);
    }
  };

  W.onSpotifyIframeApiReady = function (API) {
    var host = D.getElementById('spotify');
    if (!host) return;
    var first = order[idx] || list[0];
    API.createController(host, {
      uri: 'spotify:track:' + (first ? first.i : ''),
      width: '100%', height: 80
    }, function (c) { Audio._attach(c); });
  };

  W.Audio2 = Audio;
})(window, document);
