/* Pixel art: shared palette, sprite decoder, landmark art. */
(function (W) {
  'use strict';

  var C = {
    '.': null,
    K: '#20182e', k: '#3d3550',
    W: '#ffffff', s: '#cfd6e0', S: '#949cb0', d: '#5d6478',
    R: '#ff3d7f', r: '#ff8fb5', D: '#c2185b',
    G: '#5fb83d', g: '#8ed659', F: '#2e7d32', f: '#1f5c26',
    B: '#2f7fd8', b: '#6fc3f0', w: '#a8e4ff', N: '#7a4a21', n: '#b07a3c',
    Y: '#ffd93d', O: '#ff9f29', E: '#e8623c',
    P: '#a855f7', p: '#d8b4fe', C: '#22d3ee', T: '#0e7490',
    A: '#f2d9a0', M: '#8d8b86', x: '#ffe9a8'
  };

  function sprite(rows) {
    var h = rows.length, w = 0, i, j;
    for (i = 0; i < h; i++) if (rows[i].length > w) w = rows[i].length;
    var px = new Array(w * h);
    for (i = 0; i < h; i++)
      for (j = 0; j < w; j++) {
        var ch = rows[i][j] || '.';
        px[i * w + j] = C[ch] === undefined ? null : C[ch];
      }
    return { w: w, h: h, px: px };
  }

  /* Build a filled + outlined sprite from a 'X' mask. */
  function masked(rows, fill, light, dark, outline) {
    var h = rows.length, w = 0, i, j;
    for (i = 0; i < h; i++) if (rows[i].length > w) w = rows[i].length;
    var on = function (x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return (rows[y][x] || '.') === 'X';
    };
    var W2 = w + 2, H2 = h + 2, px = new Array(W2 * H2).fill(null);
    for (i = 0; i < H2; i++)
      for (j = 0; j < W2; j++) {
        var x = j - 1, y = i - 1;
        if (on(x, y)) {
          var c = fill;
          if (!on(x, y - 1) || !on(x - 1, y)) c = light;
          else if (!on(x, y + 1) || !on(x + 1, y)) c = dark;
          px[i * W2 + j] = c;
        } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ||
                   on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)) {
          px[i * W2 + j] = outline;
        }
      }
    return { w: W2, h: H2, px: px };
  }

  var HEART_MASK = [
    '..XXX...XXX..',
    '.XXXXX.XXXXX.',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    '.XXXXXXXXXXX.',
    '..XXXXXXXXX..',
    '...XXXXXXX...',
    '....XXXXX....',
    '.....XXX.....',
    '......X......'
  ];

  var SPR = {
    heart:     masked(HEART_MASK, '#ff3d7f', '#ff8fb5', '#c2185b', '#20182e'),
    heartDone: masked(HEART_MASK, '#8d93a8', '#c3c8d4', '#5d6478', '#20182e'),
    heartGold: masked(HEART_MASK, '#ffd93d', '#ffeeab', '#e0a800', '#20182e'),

    /* ---- Southern Ontario ---- */
    cnTower: sprite([
      '.....K.....', '.....Y.....', '.....Y.....', '....KYK....',
      '....sSs....', '...KsSsK...', '...WsSsW...', '..KWsSsWK..',
      '..WsSSSsW..', '...KsSsK...', '....sSs....', '....sSs....',
      '....sSs....', '....sSs....', '...KsSsK...', '...WsSsW...',
      '..KWsSsWK..', '..WSsSsSW..', '.KWSsSsSWK.', '.WSSsSsSSW.',
      'KWSSSSSSSWK', 'KKKKKKKKKKK'
    ]),
    niagara: sprite([
      'ffFFfff..ffFFff',
      'FGGGGGF..FGGGGF',
      'KMMMMMK..KMMMMK',
      'bWWWWWb..bWWWWb',
      'WwwwwwW..WwwwwW',
      'wWWWWWw..wWWWWw',
      'WwwwwwW..WwwwwW',
      'wWWWWWw..wWWWWw',
      'WwwwwwWbbWwwwwW',
      'bWWWWWWWWWWWWWb',
      'BbWWWWWWWWWWWbB',
      'BBbbWWWWWWWbbBB',
      'BBBBbbbbbbbBBBB',
      '.BBBBBBBBBBBBB.'
    ]),
    skyline: sprite([
      '....K...K......',
      '...KSK.KSK..K..',
      '..KSSKKSSSKKSK.',
      '.KSsSKSssSKSsSK',
      'KSsYSKSYsSKSYSK',
      'KSYsSKSsYSKSsSK',
      'KSsSSKSssSKSSSK',
      'KKKKKKKKKKKKKKK'
    ]),
    campus: sprite([
      '......K......',
      '.....KYK.....',
      '....KSSSK....',
      '...KSsssSK...',
      '..KSSSSSSSK..',
      '.KSsSsSsSsSK.',
      'KSSSSSSSSSSSK',
      'KSxSxSxSxSxSK',
      'KSSSSSSSSSSSK',
      'KSxSxSxSxSxSK',
      'KKKKKKKKKKKKK'
    ]),
    coaster: sprite([
      '......KKK......',
      '....KKWWWKK....',
      '..KKWWEEEWWKK..',
      '.KWWEEEEEEEWWK.',
      'KWEEEEEEEEEEEWK',
      'KEEEEEEEEEEEEEK',
      '.KEEEEEEEEEEEK.',
      '..KKEEEEEEEKK..',
      '...KRRKRRKRRK..',
      '..KYYKKYYKKYYK.',
      '.KKKKKKKKKKKKK.'
    ]),
    blueMtn: sprite([
      '......W......',
      '.....WWW.....',
      '....WWWWW....',
      '...WSWWWSW...',
      '..WSSSWSSSW..',
      '.KSSFSSSFSSK.',
      'KSFFFSSSFFFSK',
      'KFFfFFFFFfFFK',
      'KKKKKKKKKKKKK'
    ]),
    turbine: sprite([
      '..W.....W..',
      '..WW...WW..',
      '...WW.WW...',
      '....WWW....',
      '....KWK....',
      '.....W.....',
      '.....W.....',
      '.....W.....',
      '.....W.....',
      '....KWK....',
      '....KKK....'
    ]),
    lighthouse: sprite([
      '...Y...',
      '..KYK..',
      '.KWWWK.',
      '.KRRRK.',
      '.KWWWK.',
      'KKWWWKK',
      '.KRRRK.',
      '.KWWWK.',
      '.KRRRK.',
      'KWWWWWK',
      'KMMMMMK',
      'KKKKKKK'
    ]),
    barn: sprite([
      '...KKKKK...',
      '..KEEEEEK..',
      '.KEEEEEEEK.',
      'KEEEEEEEEEK',
      'KEWWEEEWWEK',
      'KEWWEEEWWEK',
      'KEEEKKKEEEK',
      'KEEEKWKEEEK',
      'KKKKKKKKKKK',
      '.ggGgGgGgg.'
    ]),
    pines: sprite([
      '..K...K..',
      '..F..KFK.',
      '.KFK.FFF.',
      '.FFF.FFF.',
      'KFFFKFfFK',
      'FfFfFFfFF',
      '.KNK.KNK.',
      '.gGg.gGg.'
    ]),
    sailboat: sprite([
      '....K....',
      '...KWK...',
      '..KWWWK..',
      '.KWWWWWK.',
      'KWWWWWWWK',
      '....K....',
      'KRRRRRRRK',
      '.KKKKKKK.',
      '..bwbwb..'
    ]),
    freighter: sprite([
      '.......KKK...',
      '......KWWWK..',
      '..KK..KRRRK..',
      '.KWWK.KWWWK..',
      'KSSSSSSSSSSSK',
      'KSsssssssssSK',
      '.KSSSSSSSSSK.',
      '..bwbwbwbwb..'
    ]),
    bridge: sprite([
      '..K.......K..',
      '..S...K...S..',
      '..SK.KSK.KS..',
      '..SSKKSKKSS..',
      '..SSSSSSSSS..',
      'KKSSSSSSSSSKK',
      'MMMMMMMMMMMMM',
      'KKKKKKKKKKKKK',
      'bbwbwbwbwbwbb'
    ]),
    deer: sprite([
      '.K...K.',
      'KNK.KNK',
      '.KNNNK.',
      '..NNN..',
      '.KNNNK.',
      'KNNNNNK',
      'KNNNNNK',
      '.K.N.K.',
      '.K...K.'
    ]),
    ferris: sprite([
      '...KKK...',
      '.KKWRWKK.',
      'KWRWWWRWK',
      'KRWWKWWRK',
      'KWWKKKWWK',
      'KRWWKWWRK',
      'KWRWWWRWK',
      '.KKWRWKK.',
      '....K....',
      '...KKK...'
    ]),

    /* ---- Istanbul ---- */
    mosque: sprite([
      '..K.....K..',
      '..Y..K..Y..',
      '.KWK.Y.KWK.',
      '.KWKKWKKWK.',
      '.KWKWWWKWK.',
      '.KWKWWWKWK.',
      'KKWKWWWKWKK',
      'KWWWWWWWWWK',
      'KWsWWsWWsWK',
      'KWWWWWWWWWK',
      'KKKKKKKKKKK'
    ]),
    galata: sprite([
      '...K...',
      '..KYK..',
      '.KEEEK.',
      '.KEEEK.',
      'KKsssKK',
      'KWsWsWK',
      'KWsWsWK',
      'KWsWsWK',
      'KWsWsWK',
      'KMMMMMK',
      'KKKKKKK'
    ]),
    ferryIst: sprite([
      '....KKK..',
      '...KWWWK.',
      '.K.KRRRK.',
      'KWKKWWWK.',
      'KWWWWWWWK',
      'KSSSSSSSK',
      '.KKKKKKK.',
      '..bwbwb..'
    ]),

    /* ---- the people ----
       9x14. Outfit bodies use k (#3d3550) rather than K so the K outline
       still reads against them - an all-K figure renders as a silhouette. */

    /* Nihal: black skull cap, brown skin, goatee, dark hoodie.
       Cap is the same width as the head - any wider and it reads as a
       brimmed hat instead of a skull cap. Row 1 is k, not K, so the cap
       has a visible band - otherwise it is pixel-identical to Haroon's
       black hair and the two faces only differ by skin tone. */
    nihal: sprite([
      '..KKKKK..',
      '..kkkkk..',
      '..nnnnn..',
      '..nKnKn..',
      '..nnnnn..',
      '..nKKKn..',
      '...KKK...',
      '..kkkkk..',
      '.KkkkkkK.',
      '.KkkkkkK.',
      '.nkkkkkn.',
      '..kkkkk..',
      '...K.K...',
      '...K.K...'
    ]),

    /* Haroon: dark hair + beard, white tee, blue jeans.
       Beard leaves a skin pixel either side so it reads as facial hair
       rather than a band across the face; sleeves are short, so the
       arms are skin, not shirt. */
    haroonC: sprite([
      '..KKKKK..',
      '..KKKKK..',
      '..AAAAA..',
      '..AKAKA..',
      '..AAAAA..',
      '..AKKKA..',
      '...KKK...',
      '..WWWWW..',
      '.AWWWWWA.',
      '.AWWWWWA.',
      '..WWWWW..',
      '..BBBBB..',
      '...B.B...',
      '...B.B...'
    ]),

    /* Umber: long brown hair, all-black outfit, wide leg.
       The hair runs unbroken from row 1 down to row 9 - leaving row 7
       bare split it into two floating brown blocks that read as sleeves
       rather than hair falling past the shoulders. */
    umberC: sprite([
      '..NNNNN..',
      '.NNNNNNN.',
      '.NAAAAAN.',
      '.NAKAKAN.',
      '.NAAAAAN.',
      '.NAAAAAN.',
      '.NNAAANN.',
      '.NkkkkkN.',
      '.NkkkkkN.',
      '.NkkkkkN.',
      '..kkkkk..',
      '..kkkkk..',
      '..kkkkk..',
      '..kk.kk..'
    ])
  };

  /* lat, lng, sprite, label, label-from-zoom, sprite-from-zoom */
  var LANDMARKS = {
    on: [
      /* the people - decorative only, never clickable, never counted
         toward the 19. Umber sits a little SW of the Tillsdown pin so she
         doesn't end up underneath its heart, which draws on a later pass. */
      [45.3876, -75.6960, 'nihal',   'NIHAL',  7.4, 6.8],
      [43.3255, -79.7990, 'haroonC', 'HAROON', 7.4, 6.8],
      [43.5912, -79.7245, 'umberC',  'UMBER',  7.4, 6.8],

      /* headline icons - visible from the very first view */
      [43.6426, -79.3871, 'cnTower',    'TORONTO',       7.4, 6.8],
      [43.0799, -79.0747, 'niagara',    'NIAGARA FALLS', 7.4, 6.8],
      [42.9850, -81.2450, 'skyline',    'LONDON',        7.4, 6.8],
      [44.5017, -80.3100, 'blueMtn',    'BLUE MOUNTAIN', 7.9, 6.8],

      /* the rest of the Horseshoe */
      [43.2560, -79.8700, 'skyline',    'HAMILTON',      8.9, 7.6],
      [43.5890, -79.6440, 'skyline',    'MISSISSAUGA',   8.9, 7.6],
      [43.4500, -80.4900, 'skyline',    'KITCHENER',     9.2, 8.2],
      [42.3150, -82.9900, 'skyline',    'WINDSOR',       9.2, 8.2],
      [44.3900, -79.6900, 'pines',      'BARRIE',        9.2, 8.2],
      [43.8300, -79.5390, 'coaster',    'WONDERLAND',    9.4, 7.6],

      /* terrain + landmarks that fill in as she zooms */
      [43.0096, -81.2737, 'campus',     'WESTERN',      10.4, 9.6],
      [43.1600, -79.2460, 'ferris',     'CLIFTON HILL', 10.0, 8.8],
      [44.0725, -81.7560, 'lighthouse', 'POINT CLARK',   9.8, 8.0],
      [43.9000, -77.4000, 'lighthouse', 'SANDBANKS',     9.8, 8.0],
      [45.4000, -78.6000, 'deer',       'ALGONQUIN',     9.0, 7.6],
      [44.9000, -79.3000, 'pines',      'MUSKOKA',       9.0, 7.6],
      [43.3100, -79.9900, 'pines',      'ESCARPMENT',   10.2, 8.6],
      [42.3115, -83.0735, 'bridge',      null,          99,   9.4],
      [43.2000, -80.8000, 'barn',        null,          99,   8.4],
      [43.7450, -81.7110, 'turbine',     null,          99,   8.4],
      [42.6400, -81.2000, 'barn',        null,          99,   8.8],
      [44.2000, -78.9000, 'pines',       null,          99,   8.8],
      [43.4200, -79.0500, 'sailboat',    null,          99,   8.6],
      [44.9000, -81.4000, 'freighter',   null,          99,   8.2],
      [42.1500, -80.6000, 'sailboat',    null,          99,   8.2],
      [43.8600, -78.6000, 'freighter',   null,          99,   8.8]
    ],
    ist: [
      [41.0086, 28.9802, 'mosque',   'SULTANAHMET',  9.4, 8.4],
      [41.0256, 28.9744, 'galata',   'GALATA',      10.2, 8.8],
      [41.0392, 29.0300, 'ferryIst', 'BOSPHORUS',    9.4, 8.4],
      [40.9700, 29.0200, 'mosque',   'KADIKOY',     10.2, 8.8],
      [41.1700, 28.9300, 'pines',    'BELGRAD',      9.8, 8.6],
      [41.0120, 28.6600, 'pines',     null,         99,   9.0],
      [40.9800, 28.8200, 'sailboat',  null,         99,   9.0]
    ]
  };

  W.PIX = { C: C, SPR: SPR, LANDMARKS: LANDMARKS, sprite: sprite, masked: masked };
})(window);
