/* Pixel-art slippy map: real Web Mercator, drag/zoom, palette-quantised render. */
(function (W) {
  'use strict';

  var TILE = 256;
  var PX = 3;                       // screen pixels per map "pixel"
  var DEG = Math.PI / 180;

  function projX(lng) { return (lng + 180) / 360; }
  function projY(lat) {
    var s = Math.sin(lat * DEG);
    if (s > 0.9999) s = 0.9999; if (s < -0.9999) s = -0.9999;
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  function unprojX(x) { return x * 360 - 180; }
  function unprojY(y) {
    return (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / DEG;
  }

  /* Google-encoded polyline -> flat world-unit array. Encoder wrote lng,lat. */
  function decodePoly(str) {
    var i = 0, lng = 0, lat = 0, out = [], b, sh, r;
    while (i < str.length) {
      sh = 0; r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lng += (r & 1) ? ~(r >> 1) : (r >> 1);
      sh = 0; r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      out.push(projX(lng * 1e-5), projY(lat * 1e-5));
    }
    return out;
  }

  /* ---------- palette ---------- */
  var PALETTE = [
    '#0b2a52', '#14407e', '#1f5fae', '#2f7fd8', '#4da3e8', '#6fc3f0', '#a8e4ff',
    '#0f3d1c', '#1f5c26', '#2e7d32', '#44a148', '#5fb83d', '#8ed659', '#b6e87f',
    '#5d4a24', '#7a4a21', '#b07a3c', '#d9b676', '#f2d9a0', '#ffe9a8',
    '#3b3a44', '#5d6478', '#8d8b86', '#949cb0', '#cfd6e0', '#eef2f7', '#ffffff',
    '#c2185b', '#ff3d7f', '#ff8fb5', '#ffd93d', '#ff9f29', '#e8623c',
    '#20182e', '#3d3550', '#a855f7', '#d8b4fe', '#22d3ee', '#0e7490', '#e0a800'
  ];
  var LUT = null;
  function buildLUT() {
    var rgb = PALETTE.map(function (h) {
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    });
    LUT = new Uint8Array(32768 * 3);
    for (var r = 0; r < 32; r++)
      for (var g = 0; g < 32; g++)
        for (var b = 0; b < 32; b++) {
          var R = r * 8 + 4, G = g * 8 + 4, B = b * 8 + 4, best = 1e9, bi = 0;
          for (var i = 0; i < rgb.length; i++) {
            var dr = R - rgb[i][0], dg = G - rgb[i][1], db = B - rgb[i][2];
            var d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
            if (d < best) { best = d; bi = i; }
          }
          var o = ((r << 10) | (g << 5) | b) * 3;
          LUT[o] = rgb[bi][0]; LUT[o + 1] = rgb[bi][1]; LUT[o + 2] = rgb[bi][2];
        }
  }

  /* ---------- textures ---------- */
  function tex(size, draw) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return c;
  }
  function rnd(seed) { var x = Math.sin(seed) * 43758.5453; return x - Math.floor(x); }

  var TEX = {};
  function buildTex() {
    TEX.water = tex(24, function (c, s) {
      c.fillStyle = '#1f5fae'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#2f7fd8';
      for (var i = 0; i < 26; i++) {
        var x = Math.floor(rnd(i * 3.1) * s), y = Math.floor(rnd(i * 7.7) * s);
        c.fillRect(x, y, 2, 1);
      }
      c.fillStyle = '#4da3e8';
      for (i = 0; i < 9; i++) c.fillRect(Math.floor(rnd(i * 11.3) * s), Math.floor(rnd(i * 5.2) * s), 3, 1);
    });
    TEX.land = tex(24, function (c, s) {
      c.fillStyle = '#5fb83d'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#8ed659';
      for (var i = 0; i < 40; i++) c.fillRect(Math.floor(rnd(i * 2.3) * s), Math.floor(rnd(i * 9.1) * s), 1, 1);
      c.fillStyle = '#44a148';
      for (i = 0; i < 30; i++) c.fillRect(Math.floor(rnd(i * 4.7) * s), Math.floor(rnd(i * 6.3) * s), 1, 1);
      c.fillStyle = '#b6e87f';
      for (i = 0; i < 10; i++) c.fillRect(Math.floor(rnd(i * 13.1) * s), Math.floor(rnd(i * 8.8) * s), 2, 1);
    });
    TEX.forest = tex(16, function (c, s) {
      c.fillStyle = '#2e7d32'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#1f5c26';
      for (var i = 0; i < 20; i++) c.fillRect(Math.floor(rnd(i * 3.9) * s), Math.floor(rnd(i * 2.1) * s), 2, 2);
      c.fillStyle = '#44a148';
      for (i = 0; i < 14; i++) c.fillRect(Math.floor(rnd(i * 5.5) * s), Math.floor(rnd(i * 7.2) * s), 1, 1);
    });
    TEX.urbanFar = tex(16, function (c, s) {
      c.fillStyle = '#d9b676'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#cfd6e0';
      for (var i = 0; i < 26; i++) c.fillRect(Math.floor(rnd(i * 6.1) * s), Math.floor(rnd(i * 3.3) * s), 2, 2);
      c.fillStyle = '#949cb0';
      for (i = 0; i < 16; i++) c.fillRect(Math.floor(rnd(i * 8.4) * s), Math.floor(rnd(i * 4.9) * s), 1, 1);
    });
    TEX.urbanNear = tex(32, function (c, s) {
      c.fillStyle = '#d9b676'; c.fillRect(0, 0, s, s);
      for (var gy = 0; gy < 4; gy++)
        for (var gx = 0; gx < 4; gx++) {
          var seed = gx * 17.3 + gy * 29.7;
          var w = 3 + Math.floor(rnd(seed) * 3), h = 3 + Math.floor(rnd(seed + 1.7) * 3);
          var x = gx * 8 + 1, y = gy * 8 + 1;
          var t = rnd(seed + 5.1);
          c.fillStyle = t > 0.75 ? '#e8623c' : (t > 0.45 ? '#cfd6e0' : '#949cb0');
          c.fillRect(x, y, w, h);
          c.fillStyle = '#5d6478';
          c.fillRect(x, y + h, w, 1);
        }
      c.fillStyle = '#b07a3c';
      for (var i = 0; i < s; i += 8) { c.fillRect(0, i, s, 1); c.fillRect(i, 0, 1, s); }
    });
  }

  /* ---------- map ---------- */
  function PixelMap(canvas, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buf = document.createElement('canvas');
    this.bx = this.buf.getContext('2d', { alpha: false, willReadFrequently: true });
    this.region = 'on';
    this.center = { lat: 43.45, lng: -79.95 };
    this.zoom = 8.2;
    this.minZoom = 6.4; this.maxZoom = 16;
    this.markers = [];
    this.onMarker = opts && opts.onMarker;
    this.onChange = opts && opts.onChange;
    this.quantise = true;
    this._raf = null; this._dirty = true;
    this._anim = null;
    this._hover = -1;
    this._drawn = [];
    if (!LUT) { buildLUT(); buildTex(); }
    this._bindEvents();
    this.resize();
  }

  PixelMap.prototype.data = function () { return W.MAPDATA[this.region]; };

  PixelMap.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    this.cv.width = w; this.cv.height = h;
    this.bw = Math.ceil(w / PX); this.bh = Math.ceil(h / PX);
    this.buf.width = this.bw; this.buf.height = this.bh;
    this.ctx.imageSmoothingEnabled = false;
    this.invalidate();
  };

  PixelMap.prototype.invalidate = function () {
    this._dirty = true;
    if (!this._raf) {
      var self = this;
      this._raf = requestAnimationFrame(function () { self._raf = null; self._frame(); });
    }
  };

  /* low-res buffer pixels per world unit */
  PixelMap.prototype.k = function () { return TILE * Math.pow(2, this.zoom) / PX; };

  PixelMap.prototype.toBuf = function (lat, lng) {
    var k = this.k();
    return [(projX(lng) - projX(this.center.lng)) * k + this.bw / 2,
            (projY(lat) - projY(this.center.lat)) * k + this.bh / 2];
  };
  PixelMap.prototype.toScreen = function (lat, lng) {
    var p = this.toBuf(lat, lng); return [p[0] * PX, p[1] * PX];
  };
  PixelMap.prototype.fromScreen = function (sx, sy) {
    var k = TILE * Math.pow(2, this.zoom);
    var wx = projX(this.center.lng) + (sx - this.cv.width / 2) / k;
    var wy = projY(this.center.lat) + (sy - this.cv.height / 2) / k;
    return { lat: unprojY(wy), lng: unprojX(wx) };
  };

  PixelMap.prototype.clamp = function () {
    var b = this.data().box;                   // [w, s, e, n]
    var k = TILE * Math.pow(2, this.zoom);
    var halfW = this.cv.width / 2 / k, halfH = this.cv.height / 2 / k;
    var x0 = projX(b[0]), x1 = projX(b[2]), y0 = projY(b[3]), y1 = projY(b[1]);
    var cx = projX(this.center.lng), cy = projY(this.center.lat);
    if (x1 - x0 < halfW * 2) cx = (x0 + x1) / 2;
    else cx = Math.min(Math.max(cx, x0 + halfW), x1 - halfW);
    if (y1 - y0 < halfH * 2) cy = (y0 + y1) / 2;
    else cy = Math.min(Math.max(cy, y0 + halfH), y1 - halfH);
    this.center.lng = unprojX(cx); this.center.lat = unprojY(cy);
  };

  PixelMap.prototype.setView = function (lat, lng, zoom) {
    this.center.lat = lat; this.center.lng = lng;
    if (zoom != null) this.zoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
    this.clamp(); this.invalidate();
    if (this.onChange) this.onChange();
  };

  PixelMap.prototype.flyTo = function (lat, lng, zoom, ms, done) {
    var self = this;
    var t0 = performance.now(), dur = ms == null ? 900 : ms;
    var a = { lat: this.center.lat, lng: this.center.lng, z: this.zoom };
    var b = { lat: lat, lng: lng, z: Math.min(Math.max(zoom == null ? this.zoom : zoom, this.minZoom), this.maxZoom) };
    this._anim = function (t) {
      var u = Math.min(1, (t - t0) / dur);
      var e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      self.center.lat = a.lat + (b.lat - a.lat) * e;
      self.center.lng = a.lng + (b.lng - a.lng) * e;
      self.zoom = a.z + (b.z - a.z) * e;
      self.clamp();
      if (u >= 1) { self._anim = null; if (done) done(); }
      if (self.onChange) self.onChange();
      return u < 1;
    };
    this.invalidate();
  };

  PixelMap.prototype.setRegion = function (r, lat, lng, zoom) {
    this.region = r;
    var b = this.data().box;
    this.minZoom = r === 'ist' ? 8.6 : 6.4;
    this.center.lat = lat != null ? lat : (b[1] + b[3]) / 2;
    this.center.lng = lng != null ? lng : (b[0] + b[2]) / 2;
    this.zoom = zoom != null ? zoom : this.minZoom + 1.2;
    this.clamp(); this.invalidate();
    if (this.onChange) this.onChange();
  };

  /* ---------- drawing ---------- */
  function pathPoly(c, arr, ox, oy, k) {
    c.beginPath();
    for (var i = 0; i < arr.length; i += 2) {
      var x = arr[i] * k + ox, y = arr[i + 1] * k + oy;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }
  function pathLine(c, arr, ox, oy, k) {
    c.beginPath();
    for (var i = 0; i < arr.length; i += 2) {
      var x = arr[i] * k + ox, y = arr[i + 1] * k + oy;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
  }

  /* geo coords are lng/lat; convert to world then to buffer */
  function mkProj(self) {
    var k = self.k();
    var ox = -projX(self.center.lng) * k + self.bw / 2;
    var oy = -projY(self.center.lat) * k + self.bh / 2;
    return { k: k, ox: ox, oy: oy };
  }
  function toWorldArr(arr) {
    // arr is [lng,lat,...] -> [wx,wy,...]
    var o = new Float64Array(arr.length);
    for (var i = 0; i < arr.length; i += 2) { o[i] = projX(arr[i]); o[i + 1] = projY(arr[i + 1]); }
    return o;
  }

  PixelMap.prototype._world = function () {
    if (this._wcache && this._wcache.r === this.region) return this._wcache;
    var d = this.data(), o = { r: this.region };
    ['land', 'lake', 'urban', 'river', 'road'].forEach(function (key) {
      o[key] = (d[key] || []).map(toWorldArr);
    });
    this._wcache = o;
    return o;
  };

  /* ---------- tree cover ----------
     Southern Ontario is farmland; the shield to the north is forest. Scatter
     deterministic blobs with that gradient so the land never reads as flat. */
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function density(region, lat) {
    if (region === 'ist') return lat > 41.14 ? 0.60 : (lat > 41.05 ? 0.22 : 0.08);
    if (lat < 42.9) return 0.07;
    if (lat < 43.6) return 0.12;
    if (lat < 44.2) return 0.22;
    if (lat < 44.9) return 0.46;
    return 0.74;
  }
  PixelMap.prototype._forest = function () {
    if (this._fc && this._fc.r === this.region) return this._fc.cells;
    var b = this.data().box, step = this.region === 'ist' ? 0.022 : 0.075, cells = [];
    for (var gy = Math.floor(b[1] / step); gy <= Math.ceil(b[3] / step); gy++)
      for (var gx = Math.floor(b[0] / step); gx <= Math.ceil(b[2] / step); gx++) {
        if (hash2(gx, gy) >= density(this.region, gy * step)) continue;
        var jx = (hash2(gx + 7.3, gy) - 0.5) * step * 0.8;
        var jy = (hash2(gx, gy + 3.9) - 0.5) * step * 0.8;
        cells.push([projX(gx * step + jx), projY(gy * step + jy),
                    step * (0.45 + hash2(gx + 1.7, gy + 5.1) * 0.5)]);
      }
    this._fc = { r: this.region, cells: cells };
    return cells;
  };

  /* ---------- city street detail ---------- */
  var CITYKEYS = ['park', 'water', 'river', 'rail', 'r0', 'r1', 'r2', 'r3'];
  var cityCache = {};
  function cityWorld(key) {
    if (cityCache[key]) return cityCache[key];
    var src = (W.CITYDATA || {})[key];
    if (!src) return null;
    var o = { box: src.box };
    CITYKEYS.forEach(function (k) { o[k] = (src[k] || []).map(decodePoly); });
    cityCache[key] = o;
    return o;
  }

  /* city areas whose bbox overlaps the current viewport */
  PixelMap.prototype._cities = function () {
    var cd = W.CITYDATA; if (!cd) return [];
    var a = this.fromScreen(0, 0), b = this.fromScreen(this.cv.width, this.cv.height);
    var w = Math.min(a.lng, b.lng), e = Math.max(a.lng, b.lng);
    var s = Math.min(a.lat, b.lat), n = Math.max(a.lat, b.lat);
    var out = [];
    for (var k in cd) {
      var x = cd[k].box;                     // [w, s, e, n]
      if (x[2] < w || x[0] > e || x[3] < s || x[1] > n) continue;
      out.push({ key: k, box: x,
                 inside: this.center.lng > x[0] && this.center.lng < x[2] &&
                         this.center.lat > x[1] && this.center.lat < x[3] });
    }
    return out;
  };

  function strokeSet(c, arr, ox, oy, k, width, colour) {
    if (!arr || !arr.length) return;
    c.strokeStyle = colour; c.lineWidth = width;
    c.beginPath();
    for (var n = 0; n < arr.length; n++) {
      var a = arr[n];
      for (var i = 0; i < a.length; i += 2) {
        var x = a[i] * k + ox, y = a[i + 1] * k + oy;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
    }
    c.stroke();
  }
  function fillSet(c, arr, ox, oy, k, fill, stroke) {
    if (!arr || !arr.length) return;
    c.beginPath();
    for (var n = 0; n < arr.length; n++) {
      var a = arr[n];
      for (var i = 0; i < a.length; i += 2) {
        var x = a[i] * k + ox, y = a[i + 1] * k + oy;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    }
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }

  PixelMap.prototype._drawCities = function (c, areas, P) {
    var z = this.zoom, k = P.k, ox = P.ox, oy = P.oy;
    var self = this;
    var showR3 = z >= 12.6, showR2 = z >= 11.9, showR1 = z >= 10.8;
    var t = Math.min(1, Math.max(0, (z - 10.8) / 3.4));
    var wMain = 1 + t * 3.2, wSec = 1 + t * 2.1, wMin = Math.max(1, t * 1.6);

    areas.forEach(function (a) {
      var g = cityWorld(a.key); if (!g) return;

      fillSet(c, g.park, ox, oy, k, '#44a148', null);
      fillSet(c, g.water, ox, oy, k, '#2f7fd8', '#6fc3f0');
      strokeSet(c, g.river, ox, oy, k, Math.max(1, wSec * 0.8), '#2f7fd8');

      c.lineJoin = 'round'; c.lineCap = 'round';

      /* dark casing first so the whole network reads as one network */
      if (showR3) strokeSet(c, g.r3, ox, oy, k, wMin + 1.1, '#8d8b86');
      if (showR2) strokeSet(c, g.r2, ox, oy, k, wSec + 1.2, '#7a4a21');
      if (showR1) strokeSet(c, g.r1, ox, oy, k, wSec + 1.6, '#7a4a21');
      strokeSet(c, g.r0, ox, oy, k, wMain + 1.8, '#5d4a24');

      if (showR3) strokeSet(c, g.r3, ox, oy, k, wMin, '#f2d9a0');
      if (showR2) strokeSet(c, g.r2, ox, oy, k, wSec, '#ffe9a8');
      if (showR1) strokeSet(c, g.r1, ox, oy, k, wSec + 0.4, '#ffd93d');
      strokeSet(c, g.r0, ox, oy, k, wMain, '#ff9f29');

      if (z >= 12.2) {
        strokeSet(c, g.rail, ox, oy, k, Math.max(1, wMin), '#5d6478');
        c.save();
        c.setLineDash([2, 3]);
        strokeSet(c, g.rail, ox, oy, k, Math.max(1, wMin * 0.6), '#cfd6e0');
        c.restore();
      }
      void self;
    });
  };

  PixelMap.prototype._frame = function () {
    if (this._anim) { if (this._anim(performance.now())) this.invalidate(); }
    if (this._inertia) this._stepInertia();
    this._render();
  };

  PixelMap.prototype._render = function () {
    var c = this.bx, w = this.bw, h = this.bh;
    var P = mkProj(this), k = P.k, ox = P.ox, oy = P.oy;
    var g = this._world();
    var z = this.zoom;

    c.save();
    c.imageSmoothingEnabled = false;

    /* water base */
    var wp = c.createPattern(TEX.water, 'repeat');
    if (wp.setTransform) wp.setTransform(new DOMMatrix().translate(ox % 24, oy % 24));
    c.fillStyle = wp; c.fillRect(0, 0, w, h);

    /* land */
    var lp = c.createPattern(TEX.land, 'repeat');
    if (lp.setTransform) lp.setTransform(new DOMMatrix().translate(ox % 24, oy % 24));
    c.fillStyle = lp;
    c.beginPath();
    g.land.forEach(function (a) {
      for (var i = 0; i < a.length; i += 2) {
        var x = a[i] * k + ox, y = a[i + 1] * k + oy;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    });
    c.fill();
    /* shoreline */
    c.strokeStyle = '#f2d9a0'; c.lineWidth = 1; c.stroke();

    /* tree cover on top of the farmland, before the water is carved back out */
    var fp = c.createPattern(TEX.forest, 'repeat');
    if (fp.setTransform) fp.setTransform(new DOMMatrix().translate(ox % 16, oy % 16));
    c.fillStyle = fp;
    c.beginPath();
    this._forest().forEach(function (f) {
      var x = f[0] * k + ox, y = f[1] * k + oy, r = f[2] * k / 360;
      if (x < -r * 2 || y < -r * 2 || x > w + r * 2 || y > h + r * 2) return;
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, 6.2832);
    });
    c.fill();

    /* lakes carve back out */
    var wp2 = c.createPattern(TEX.water, 'repeat');
    if (wp2.setTransform) wp2.setTransform(new DOMMatrix().translate(ox % 24, oy % 24));
    c.fillStyle = wp2;
    c.beginPath();
    g.lake.forEach(function (a) {
      for (var i = 0; i < a.length; i += 2) {
        var x = a[i] * k + ox, y = a[i + 1] * k + oy;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    });
    c.fill();
    c.strokeStyle = '#6fc3f0'; c.lineWidth = 1; c.stroke();

    /* urban: blobby texture far out, flat ground once real streets appear */
    var areas = z >= 10.2 ? this._cities() : [];
    var cityMode = areas.some(function (a) { return a.inside; }) && z >= 10.8;
    var ufill;
    if (cityMode) {
      ufill = '#e3c489';
    } else {
      var usz = z >= 9.6 ? 32 : 16;
      var up = c.createPattern(z >= 9.6 ? TEX.urbanNear : TEX.urbanFar, 'repeat');
      if (up.setTransform) up.setTransform(new DOMMatrix().translate(ox % usz, oy % usz));
      ufill = up;
    }
    c.fillStyle = ufill;
    c.beginPath();
    g.urban.forEach(function (a) {
      for (var i = 0; i < a.length; i += 2) {
        var x = a[i] * k + ox, y = a[i + 1] * k + oy;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    });
    c.fill();
    c.strokeStyle = '#b07a3c'; c.lineWidth = 1; c.stroke();

    /* rivers */
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = '#4da3e8';
    c.lineWidth = Math.max(1, Math.min(3, (z - 6) * 0.45));
    g.river.forEach(function (a) { pathLine(c, a, ox, oy, k); c.stroke(); });

    /* highways from the continental set, faded out once city streets take over */
    if (!cityMode) {
      var rw = Math.max(1, Math.min(3.4, (z - 6.8) * 0.62));
      c.strokeStyle = '#7a4a21'; c.lineWidth = rw + 1.2;
      g.road.forEach(function (a) { pathLine(c, a, ox, oy, k); c.stroke(); });
      c.strokeStyle = z < 8 ? '#e0a800' : '#ffd93d'; c.lineWidth = rw;
      g.road.forEach(function (a) { pathLine(c, a, ox, oy, k); c.stroke(); });
    }

    if (areas.length) this._drawCities(c, areas, P);

    c.restore();

    /* landmarks */
    this._drawLandmarks(c);

    /* quantise to palette */
    if (this.quantise) {
      var img = c.getImageData(0, 0, w, h), d8 = img.data;
      for (var i = 0; i < d8.length; i += 4) {
        var o = (((d8[i] >> 3) << 10) | ((d8[i + 1] >> 3) << 5) | (d8[i + 2] >> 3)) * 3;
        d8[i] = LUT[o]; d8[i + 1] = LUT[o + 1]; d8[i + 2] = LUT[o + 2];
      }
      c.putImageData(img, 0, 0);
    }

    /* blit upscaled */
    var m = this.ctx;
    m.imageSmoothingEnabled = false;
    m.drawImage(this.buf, 0, 0, w, h, 0, 0, w * PX, h * PX);

    /* markers drawn crisp on top (screen space) */
    this._drawMarkers(m);
    this._dirty = false;
  };

  function blitSprite(c, sp, cx, cy, scale) {
    var w = sp.w, h = sp.h, px = sp.px;
    var x0 = Math.round(cx - w * scale / 2), y0 = Math.round(cy - h * scale);
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var col = px[y * w + x];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
      }
  }

  PixelMap.prototype._drawLandmarks = function (c) {
    var list = W.PIX.LANDMARKS[this.region] || [];
    var z = this.zoom, self = this;
    if (z < 6.8) return;
    var scale = z >= 11.5 ? 3 : (z >= 9.2 ? 2 : 1);
    c.save();
    c.font = '6px "Press Start 2P", monospace';
    c.textAlign = 'center';
    var boxes = [];
    function free(x, y, w, h) {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (x < b[2] && x + w > b[0] && y < b[3] && y + h > b[1]) return false;
      }
      boxes.push([x, y, x + w, y + h]);
      return true;
    }
    /* hearts are drawn later, over this layer, so claim their space first.
       sprites sit above their anchor, and clusters carry a badge above that */
    this._layout().forEach(function (p) {
      var x = p.ax / PX, y = p.ay / PX;
      boxes.push([x - 9, y - (p.n > 1 ? 24 : 16), x + 9, y + 2]);
    });

    /* Pass 1 - draw every sprite and claim the ground it stands on. This has
       to finish before a single label is placed: in one combined pass a
       sprite later in the list paints straight over a label already sitting
       there, which is how HAMILTON's icon used to land on HAROON's name. The
       claimed box stops at the anchor, not below it, so a sprite never
       blocks its own label from the slot directly underneath. */
    var labelled = [];
    list.forEach(function (L) {
      if (z < (L[5] == null ? 6.8 : L[5])) return;
      var p = self.toBuf(L[0], L[1]);
      var sp = W.PIX.SPR[L[2]];
      if (!sp) return;
      if (p[0] < -60 || p[1] < -60 || p[0] > self.bw + 60 || p[1] > self.bh + 60) return;
      /* dark ground shadow keeps the sprite readable over bright terrain */
      c.fillStyle = 'rgba(32,24,46,.28)';
      c.beginPath();
      c.ellipse(p[0], p[1] + 1, sp.w * scale * 0.42, scale * 1.1, 0, 0, 6.3);
      c.fill();
      blitSprite(c, sp, p[0], p[1], scale);
      var hw = sp.w * scale / 2;
      boxes.push([p[0] - hw, p[1] - sp.h * scale, p[0] + hw, p[1]]);

      if (!L[3] || z < (L[4] == null ? 7.8 : L[4])) return;
      labelled.push([L, p, sp]);
    });

    /* Pass 2 - fit the names into whatever space is left over */
    labelled.forEach(function (it) {
      var L = it[0], p = it[1], sp = it[2];
      var tw = Math.round(c.measureText(L[3]).width) + 6;
      var cx = Math.round(p[0]), cy = Math.round(p[1]);
      var spots = [[cx - tw / 2, cy + 2], [cx - tw / 2, cy + 5],
                   [cx - tw / 2, cy - sp.h * scale - 13],
                   [cx + 14, cy - 5], [cx - tw - 14, cy - 5]];
      var tx, ty, i;
      for (i = 0; i < spots.length; i++) {
        tx = Math.round(spots[i][0]); ty = Math.round(spots[i][1]);
        if (free(tx - 1, ty - 1, tw + 2, 13)) break;
      }
      if (i === spots.length) return;
      c.fillStyle = '#20182e'; c.fillRect(tx, ty, tw, 11);
      c.fillStyle = '#5d4a24'; c.fillRect(tx, ty + 11, tw, 1);
      c.fillStyle = '#ffe9a8'; c.fillText(L[3], tx + tw / 2, ty + 8);
    });
    c.restore();
  };

  /* ---------- markers ---------- */
  PixelMap.prototype.setMarkers = function (list) { this.markers = list; this.invalidate(); };

  /* Group nearby pins into one badge, the way a real map does, then nudge
     whatever is left so no two hearts sit on top of each other. */
  PixelMap.prototype._layout = function () {
    var self = this;
    var pts = this.markers.map(function (m, i) {
      var s = self.toScreen(m.lat, m.lng);
      return { i: i, m: m, x: s[0], y: s[1] };
    });

    var GRP = 52, taken = [], out = [];
    pts.forEach(function (p) {
      if (taken[p.i]) return;
      var g = [p];
      taken[p.i] = true;
      pts.forEach(function (q) {
        if (taken[q.i]) return;
        if (Math.hypot(q.x - p.x, q.y - p.y) <= GRP) { g.push(q); taken[q.i] = true; }
      });
      var cx = 0, cy = 0, done = true;
      g.forEach(function (q) { cx += q.x; cy += q.y; if (!q.m.done) done = false; });
      cx /= g.length; cy /= g.length;
      out.push({ x: cx, y: cy, ax: cx, ay: cy, g: g, n: g.length,
                 i: g.length === 1 ? p.i : -1, m: p.m, done: done });
    });

    var R = 34;
    for (var pass = 0; pass < 20; pass++) {
      var moved = false;
      for (var a = 0; a < out.length; a++)
        for (var b = a + 1; b < out.length; b++) {
          var A = out[a], B = out[b];
          var dx = B.ax - A.ax, dy = (B.ay - A.ay) * 1.3;
          var d = Math.hypot(dx, dy);
          if (d > R) continue;
          if (d === 0) { dx = 0.7; dy = -0.7; d = 1; }
          var push = (R - d) / 2 + 0.4, ux = dx / d, uy = dy / d;
          A.ax -= ux * push; A.ay -= uy * push;
          B.ax += ux * push; B.ay += uy * push;
          moved = true;
        }
      if (!moved) break;
    }
    this._drawn = out;
    return out;
  };

  PixelMap.prototype._drawMarkers = function (c) {
    var list = this._layout(), self = this;
    c.save();
    c.textAlign = 'center';
    list.forEach(function (p, k) {
      if (p.ax < -90 || p.ay < -90 || p.ax > self.cv.width + 90 || p.ay > self.cv.height + 90) return;
      var hov = self._hover === k;

      if (Math.hypot(p.ax - p.x, p.ay - p.y) > 3) {
        c.strokeStyle = 'rgba(32,24,46,.5)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.ax, p.ay); c.stroke();
        c.fillStyle = '#20182e'; c.fillRect(p.x - 2, p.y - 2, 4, 4);
      }

      var sp = p.done ? W.PIX.SPR.heartDone : W.PIX.SPR.heart;
      var s = (p.n > 1 ? PX + 1 : PX) + (hov ? 1 : 0);

      c.fillStyle = 'rgba(32,24,46,.30)';
      c.beginPath();
      c.ellipse(p.ax, p.ay + 3, 3 * s, 1.2 * s, 0, 0, 6.3);
      c.fill();
      blitSprite(c, sp, p.ax, p.ay, s);

      if (p.n > 1) {
        var bx = Math.round(p.ax + sp.w * s / 2 - 5), by = Math.round(p.ay - sp.h * s - 4);
        var txt = String(p.n), bw = txt.length > 1 ? 22 : 16;
        c.fillStyle = '#20182e'; c.fillRect(bx - 2, by - 2, bw + 4, 20);
        c.fillStyle = '#ffd93d'; c.fillRect(bx, by, bw, 16);
        c.fillStyle = '#20182e';
        c.font = '9px "Press Start 2P", monospace';
        c.fillText(txt, bx + bw / 2, by + 12);
      }

      if (hov) {
        c.font = '9px "Press Start 2P", monospace';
        var t = p.n > 1 ? p.n + ' MEMORIES HERE' : p.m.title.toUpperCase();
        var tw = c.measureText(t).width;
        var ty = p.ay - sp.h * s - (p.n > 1 ? 28 : 10);
        c.fillStyle = '#20182e';
        c.fillRect(Math.round(p.ax - tw / 2) - 6, ty - 12, Math.round(tw) + 12, 18);
        c.fillStyle = '#ff8fb5';
        c.fillRect(Math.round(p.ax - tw / 2) - 6, ty + 5, Math.round(tw) + 12, 2);
        c.fillStyle = '#ffffff';
        c.fillText(t, Math.round(p.ax), ty);
      }
    });
    c.restore();
  };

  /* returns an index into _drawn, not into markers */
  PixelMap.prototype.hitTest = function (sx, sy) {
    var list = this._drawn;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      if (Math.abs(sx - p.ax) < 24 && Math.abs(sy - (p.ay - 18)) < 26) return i;
    }
    return -1;
  };

  /* open a single heart, or zoom into a cluster */
  PixelMap.prototype._activate = function (k) {
    var p = this._drawn[k];
    if (!p) return;
    if (p.n === 1) { if (this.onMarker) this.onMarker(p.m, p.i); return; }
    var lat = 0, lng = 0;
    p.g.forEach(function (q) { lat += q.m.lat; lng += q.m.lng; });
    this.flyTo(lat / p.n, lng / p.n, Math.min(this.zoom + 1.9, this.maxZoom), 560);
  };

  /* ---------- interaction ---------- */
  PixelMap.prototype._bindEvents = function () {
    var self = this, cv = this.cv;
    var drag = null, pts = {}, pinch = null;

    function pos(e) {
      var r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      pts[e.pointerId] = pos(e);
      var ids = Object.keys(pts);
      if (ids.length === 1) {
        self._anim = null; self._inertia = null;
        drag = { id: e.pointerId, last: pos(e), start: pos(e), t: performance.now(), vx: 0, vy: 0, moved: 0 };
      } else if (ids.length === 2) {
        drag = null;
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(b[0] - a[0], b[1] - a[1]), z: self.zoom };
      }
    });

    cv.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in pts)) {
        if (!drag) {
          var p0 = pos(e);
          var h = self.hitTest(p0[0], p0[1]);
          if (h !== self._hover) { self._hover = h; cv.style.cursor = h >= 0 ? 'pointer' : 'grab'; self.invalidate(); }
        }
        return;
      }
      pts[e.pointerId] = pos(e);
      var ids = Object.keys(pts);
      if (pinch && ids.length >= 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (pinch.d > 0) {
          self.zoom = Math.min(Math.max(pinch.z + Math.log2(d / pinch.d), self.minZoom), self.maxZoom);
          self.clamp(); self.invalidate();
          if (self.onChange) self.onChange();
        }
        return;
      }
      if (drag && e.pointerId === drag.id) {
        var p = pos(e);
        var dx = p[0] - drag.last[0], dy = p[1] - drag.last[1];
        drag.moved += Math.abs(dx) + Math.abs(dy);
        var now = performance.now(), dt = Math.max(1, now - drag.t);
        drag.vx = dx / dt * 16; drag.vy = dy / dt * 16;
        drag.t = now; drag.last = p;
        self._panPx(-dx, -dy);
        cv.style.cursor = 'grabbing';
      }
    });

    function end(e) {
      delete pts[e.pointerId];
      if (drag && e.pointerId === drag.id) {
        if (drag.moved < 6) {
          var p = pos(e), h = self.hitTest(p[0], p[1]);
          if (h >= 0) self._activate(h);
        } else {
          self._inertia = { vx: drag.vx, vy: drag.vy };
          self.invalidate();
        }
        drag = null;
        cv.style.cursor = 'grab';
      }
      if (Object.keys(pts).length < 2) pinch = null;
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', function () {
      if (self._hover !== -1) { self._hover = -1; self.invalidate(); }
    });

    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      self._anim = null; self._inertia = null;
      var p = pos(e);
      var before = self.fromScreen(p[0], p[1]);
      var dz = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022);
      self.zoom = Math.min(Math.max(self.zoom + dz, self.minZoom), self.maxZoom);
      var after = self.fromScreen(p[0], p[1]);
      self.center.lat += before.lat - after.lat;
      self.center.lng += before.lng - after.lng;
      self.clamp(); self.invalidate();
      if (self.onChange) self.onChange();
    }, { passive: false });

    cv.addEventListener('dblclick', function (e) {
      var p = pos(e), t = self.fromScreen(p[0], p[1]);
      self.flyTo(t.lat, t.lng, self.zoom + 1.4, 420);
    });

    window.addEventListener('resize', function () { self.resize(); });
  };

  PixelMap.prototype._panPx = function (dx, dy) {
    var k = TILE * Math.pow(2, this.zoom);
    var wx = projX(this.center.lng) + dx / k;
    var wy = projY(this.center.lat) + dy / k;
    this.center.lng = unprojX(wx); this.center.lat = unprojY(wy);
    this.clamp(); this.invalidate();
    if (this.onChange) this.onChange();
  };

  PixelMap.prototype._stepInertia = function () {
    var I = this._inertia;
    if (!I) return;
    I.vx *= 0.92; I.vy *= 0.92;
    if (Math.abs(I.vx) < 0.25 && Math.abs(I.vy) < 0.25) { this._inertia = null; return; }
    this._panPx(-I.vx, -I.vy);
    this.invalidate();
  };

  PixelMap.prototype.zoomBy = function (d) {
    this._anim = null;
    this.zoom = Math.min(Math.max(this.zoom + d, this.minZoom), this.maxZoom);
    this.clamp(); this.invalidate();
    if (this.onChange) this.onChange();
  };

  W.PixelMap = PixelMap;
  W.PixelMapUtil = { projX: projX, projY: projY, PX: PX };
})(window);
