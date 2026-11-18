/* Pixel fireworks that launch in from every side. */
(function (W) {
  'use strict';

  var SCALE = 4;                       // buffer pixels -> screen pixels
  var HUES = [
    ['#ff3d7f', '#ff8fb5', '#ffd1e3'],
    ['#ffd93d', '#ffe9a8', '#fff6d6'],
    ['#22d3ee', '#a8e4ff', '#e2fbff'],
    ['#a855f7', '#d8b4fe', '#f0e0ff'],
    ['#5fb83d', '#b6e87f', '#e4ffcb'],
    ['#ff9f29', '#ffc96b', '#ffe9c4']
  ];

  /* heart outline in unit space, used for a few of the bursts */
  var HEART = (function () {
    var p = [];
    for (var i = 0; i < 46; i++) {
      var t = i / 46 * Math.PI * 2;
      var s = Math.sin(t), c = Math.cos(t);
      p.push([16 * s * s * s / 17, -(13 * c - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]);
    }
    return p;
  })();

  function FX(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buf = document.createElement('canvas');
    this.bx = this.buf.getContext('2d', { alpha: false });
    this.rockets = []; this.parts = []; this.sparks = [];
    this.t = 0; this.raf = null; this.running = false;
    var self = this;
    this._rs = function () { self.resize(); };
  }

  FX.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect();
    this.cv.width = Math.max(1, Math.round(r.width));
    this.cv.height = Math.max(1, Math.round(r.height));
    this.w = Math.ceil(this.cv.width / SCALE);
    this.h = Math.ceil(this.cv.height / SCALE);
    this.buf.width = this.w; this.buf.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
  };

  FX.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.resize();
    W.addEventListener('resize', this._rs);
    this.bx.fillStyle = '#0a0614';
    this.bx.fillRect(0, 0, this.w, this.h);
    var self = this;
    (function loop() {
      if (!self.running) return;
      self.step();
      self.raf = requestAnimationFrame(loop);
    })();
  };

  FX.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    W.removeEventListener('resize', this._rs);
    this.rockets.length = this.parts.length = this.sparks.length = 0;
  };

  /* fire from one of the four edges, aimed at a point in the middle band */
  FX.prototype.launch = function (side) {
    var w = this.w, h = this.h;
    if (side == null) side = Math.floor(Math.random() * 4);
    var x, y, tx, ty;
    tx = w * (0.16 + Math.random() * 0.68);
    ty = h * (0.12 + Math.random() * 0.52);
    if (side === 0) { x = -2; y = h * (0.3 + Math.random() * 0.7); }
    else if (side === 1) { x = w + 2; y = h * (0.3 + Math.random() * 0.7); }
    else if (side === 2) { x = w * (0.1 + Math.random() * 0.8); y = h + 2; }
    else { x = w * (0.1 + Math.random() * 0.8); y = -2; ty = h * (0.3 + Math.random() * 0.4); }
    var dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
    var sp = 3.0 + Math.random() * 1.6;
    this.rockets.push({
      x: x, y: y, vx: dx / d * sp, vy: dy / d * sp,
      life: d / sp, age: 0,
      col: HUES[Math.floor(Math.random() * HUES.length)],
      heart: Math.random() < 0.3
    });
  };

  FX.prototype.burst = function (r) {
    var col = r.col, n, i, a, sp;
    if (r.heart) {
      for (i = 0; i < HEART.length; i++) {
        var p = HEART[i];
        sp = 0.95 + Math.random() * 0.25;
        this.parts.push({
          x: r.x, y: r.y, vx: p[0] * 3.2 * sp, vy: p[1] * 3.2 * sp,
          life: 56 + Math.random() * 22, age: 0, col: col, g: 0.03
        });
      }
    } else {
      n = 26 + Math.floor(Math.random() * 20);
      var rings = Math.random() < 0.45 ? 2 : 1;
      for (var k = 0; k < rings; k++) {
        var base = 1.5 + k * 1.1 + Math.random() * 0.6;
        for (i = 0; i < n; i++) {
          a = i / n * Math.PI * 2 + Math.random() * 0.12;
          sp = base * (0.72 + Math.random() * 0.5);
          this.parts.push({
            x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 42 + Math.random() * 34, age: 0, col: col, g: 0.045
          });
        }
      }
    }
    for (i = 0; i < 9; i++) {
      a = Math.random() * Math.PI * 2; sp = Math.random() * 1.1;
      this.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                         life: 16 + Math.random() * 14, age: 0, col: col });
    }
  };

  FX.prototype.step = function () {
    var c = this.bx, w = this.w, h = this.h, i, p;
    this.t++;

    /* trail fade */
    c.globalAlpha = 0.26;
    c.fillStyle = '#0a0614';
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;

    if (this.t % 21 === 0) this.launch(this.t / 21 % 4 | 0);
    if (this.t % 47 === 0) this.launch();

    for (i = this.rockets.length - 1; i >= 0; i--) {
      p = this.rockets[i];
      p.x += p.vx; p.y += p.vy; p.age++;
      c.strokeStyle = p.col[0]; c.lineWidth = 1;
      c.beginPath();
      c.moveTo((p.x - p.vx * 2.2 | 0) + 0.5, (p.y - p.vy * 2.2 | 0) + 0.5);
      c.lineTo((p.x | 0) + 0.5, (p.y | 0) + 0.5);
      c.stroke();
      c.fillStyle = p.col[2];
      c.fillRect(p.x | 0, p.y | 0, 1, 1);
      if (p.age >= p.life) { this.burst(p); this.rockets.splice(i, 1); }
    }

    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.g; p.vx *= 0.93; p.vy *= 0.93;
      p.age++;
      if (p.age >= p.life || p.y > h + 4) { this.parts.splice(i, 1); continue; }
      var u = p.age / p.life;
      c.fillStyle = u < 0.3 ? p.col[2] : (u < 0.68 ? p.col[1] : p.col[0]);
      var s = u > 0.85 ? 1 : 2;
      c.fillRect(p.x | 0, p.y | 0, s, s);
    }

    for (i = this.sparks.length - 1; i >= 0; i--) {
      p = this.sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.age++;
      if (p.age >= p.life) { this.sparks.splice(i, 1); continue; }
      c.fillStyle = '#ffffff';
      c.fillRect(p.x | 0, p.y | 0, 1, 1);
    }

    var m = this.ctx;
    m.imageSmoothingEnabled = false;
    m.drawImage(this.buf, 0, 0, w, h, 0, 0, w * SCALE, h * SCALE);
  };

  W.FX = FX;
})(window);
