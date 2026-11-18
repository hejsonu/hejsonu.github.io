/* Pure calculation functions shared by the tool pages (no DOM). Also loadable in Node for tests. */
(function (root) {
  'use strict';

  // ---------- Unit price ----------
  // Base units: grams (weight), millilitres (volume), items (count).
  var UNITS = {
    oz:   { dim: 'weight', f: 28.349523125, label: 'oz' },
    lb:   { dim: 'weight', f: 453.59237,    label: 'lb' },
    g:    { dim: 'weight', f: 1,            label: 'g' },
    kg:   { dim: 'weight', f: 1000,         label: 'kg' },
    floz: { dim: 'volume', f: 29.5735295625, label: 'fl oz' },
    pt:   { dim: 'volume', f: 473.176473,   label: 'pint' },
    qt:   { dim: 'volume', f: 946.352946,   label: 'quart' },
    gal:  { dim: 'volume', f: 3785.411784,  label: 'gallon' },
    ml:   { dim: 'volume', f: 1,            label: 'mL' },
    l:    { dim: 'volume', f: 1000,         label: 'L' },
    ct:   { dim: 'count',  f: 1,            label: 'count' }
  };
  // How we display the comparison price for each dimension.
  var DISPLAY = {
    weight: [{ key: 'oz', per: 1 }, { key: 'lb', per: 1 }, { key: 'g', per: 100 }],
    volume: [{ key: 'floz', per: 1 }, { key: 'l', per: 1 }],
    count:  [{ key: 'ct', per: 1 }]
  };

  /** items: [{name, price, qty, unit, packs}] -> {ok, error, dim, rows:[...sorted cheapest first]} */
  function unitPrice(items) {
    var rows = [], dim = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var price = Number(it.price), qty = Number(it.qty), packs = it.packs === undefined || it.packs === '' ? 1 : Number(it.packs);
      var u = UNITS[it.unit];
      if (!u) return { ok: false, error: 'Unknown unit on item ' + (i + 1) };
      if (!(price > 0) || !(qty > 0) || !(packs > 0)) return { ok: false, error: 'Item ' + (i + 1) + ' needs a price, size and pack count above zero.' };
      if (dim && u.dim !== dim) return { ok: false, error: 'Items mix ' + dim + ' and ' + u.dim + ' units. Compare weight with weight, volume with volume, or count with count.' };
      dim = u.dim;
      var base = qty * packs * u.f; // total grams / mL / items
      rows.push({ name: it.name || ('Item ' + (i + 1)), price: price, base: base, perBase: price / base });
    }
    if (rows.length < 2) return { ok: false, error: 'Enter at least two items to compare.' };
    rows.sort(function (a, b) { return a.perBase - b.perBase; });
    var best = rows[0].perBase;
    rows.forEach(function (r, idx) {
      r.rank = idx + 1;
      r.pctMore = (r.perBase / best - 1) * 100;
      r.prices = DISPLAY[dim].map(function (d) {
        return { label: (d.per === 1 ? 'per ' : 'per ' + d.per + ' ') + UNITS[d.key].label, value: r.perBase * UNITS[d.key].f * d.per };
      });
    });
    return { ok: true, dim: dim, rows: rows };
  }

  // ---------- Stacked discounts ----------
  /** opts: {price, percents:[..], couponAmount, couponWhen:'before'|'after', taxRate}
   *  Percent discounts apply one after another to the remaining price. */
  function stackedDiscount(o) {
    var price = Number(o.price);
    if (!(price > 0)) return { ok: false, error: 'Enter an original price above zero.' };
    var pcts = (o.percents || []).map(Number).filter(function (p) { return !isNaN(p) && p !== 0; });
    for (var i = 0; i < pcts.length; i++) if (pcts[i] < 0 || pcts[i] > 100) return { ok: false, error: 'Percent discounts must be between 0 and 100.' };
    var coupon = Number(o.couponAmount) || 0, tax = Number(o.taxRate) || 0;
    if (coupon < 0 || tax < 0) return { ok: false, error: 'Coupon and tax cannot be negative.' };
    // Like a register: every step is rounded to whole cents (half-up), so the lines always add up.
    function cents(x) { return Math.round((x + 1e-9) * 100) / 100; }
    var steps = [], p = price;
    function applyCoupon() {
      if (coupon > 0) { var c = Math.min(coupon, p); var np = cents(p - c); steps.push({ label: '$' + coupon.toFixed(2) + ' coupon', amount: cents(p - np), after: np }); p = np; }
    }
    if (o.couponWhen === 'before') applyCoupon();
    pcts.forEach(function (pc) { var np = cents(p * (1 - pc / 100)); steps.push({ label: pc + '% off', amount: cents(p - np), after: np }); p = np; });
    if (o.couponWhen !== 'before') applyCoupon();
    var preTax = p, taxAmt = cents(preTax * tax / 100);
    var simpleSum = pcts.reduce(function (a, b) { return a + b; }, 0);
    return {
      ok: true, steps: steps, preTax: preTax, tax: taxAmt, total: cents(preTax + taxAmt),
      saved: cents(price - preTax), effectivePct: (price - preTax) / price * 100,
      naivePct: Math.min(simpleSum, 100)
    };
  }

  // ---------- Cake pans ----------
  function panArea(pan) {
    var a = Number(pan.a), b = Number(pan.b);
    if (pan.shape === 'round') return a > 0 ? Math.PI * a * a / 4 : NaN;
    if (pan.shape === 'square') return a > 0 ? a * a : NaN;
    if (pan.shape === 'rect') return a > 0 && b > 0 ? a * b : NaN;
    return NaN;
  }
  function panName(pan) {
    if (pan.shape === 'round') return pan.a + '-inch round';
    if (pan.shape === 'square') return pan.a + '-inch square';
    return pan.a + ' x ' + pan.b + '-inch rectangle';
  }
  var COMMON_PANS = [
    { shape: 'round', a: 6 }, { shape: 'round', a: 8 }, { shape: 'round', a: 9 }, { shape: 'round', a: 10 }, { shape: 'round', a: 12 },
    { shape: 'square', a: 8 }, { shape: 'square', a: 9 }, { shape: 'square', a: 10 },
    { shape: 'rect', a: 11, b: 7 }, { shape: 'rect', a: 13, b: 9 }, { shape: 'rect', a: 15, b: 10 }
  ];
  /** from/to: {shape, a, b, count}. Same pan depth assumed. */
  function panConvert(from, to) {
    var fa = panArea(from) * (Number(from.count) || 1), ta = panArea(to) * (Number(to.count) || 1);
    if (!(fa > 0) || !(ta > 0)) return { ok: false, error: 'Enter pan sizes above zero.' };
    var mult = ta / fa;
    var fromName = (Number(from.count) || 1) === 1 ? panName({ shape: from.shape, a: Number(from.a), b: Number(from.b) }) : '';
    var close = COMMON_PANS.filter(function (p) {
      // skip the recipe pan itself (13x9 entered as 9x13 too)
      if (p.shape === 'rect' && from.shape === 'rect') return !(fromName && ((p.a == from.a && p.b == from.b) || (p.a == from.b && p.b == from.a)));
      return panName(p) !== fromName;
    }).map(function (p) {
      var ar = panArea(p);
      return { name: panName(p), area: ar, diff: (ar - fa) / fa * 100 };
    }).filter(function (p) { return Math.abs(p.diff) <= 12; })
      .sort(function (x, y) { return Math.abs(x.diff) - Math.abs(y.diff); });
    return { ok: true, fromArea: fa, toArea: ta, multiplier: mult, close: close };
  }

  // ---------- Plant spacing ----------
  // All lengths in the same unit. Plants are kept `margin` away from every edge.
  function gridSquare(len, wid, s) {
    if (len < 0 || wid < 0) return [];
    var nx = Math.floor(len / s + 1e-9) + 1, ny = Math.floor(wid / s + 1e-9) + 1, pts = [];
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) pts.push([i * s, j * s]);
    return pts;
  }
  function gridTri(len, wid, s) { // rows run along `len`, every other row shifted by s/2
    if (len < 0 || wid < 0) return [];
    var gap = s * Math.sqrt(3) / 2, rows = Math.floor(wid / gap + 1e-9) + 1, pts = [];
    for (var j = 0; j < rows; j++) {
      var off = j % 2 ? s / 2 : 0;
      if (len - off < -1e-9) continue;
      var n = Math.floor((len - off) / s + 1e-9) + 1;
      for (var i = 0; i < n; i++) pts.push([off + i * s, j * gap]);
    }
    return pts;
  }
  /** o: {length, width, spacing, margin} -> counts for square grid and best triangular layout */
  function plantSpacing(o) {
    var L = Number(o.length), W = Number(o.width), s = Number(o.spacing);
    var m = o.margin === '' || o.margin === undefined ? s / 2 : Number(o.margin);
    if (!(L > 0) || !(W > 0) || !(s > 0) || !(m >= 0)) return { ok: false, error: 'Enter bed size and spacing above zero (edge gap can be 0).' };
    var l = L - 2 * m, w = W - 2 * m;
    if (l < 0 || w < 0) return { ok: false, error: 'The edge gap is larger than half the bed. Use a smaller edge gap or a bigger bed.' };
    var sq = gridSquare(l, w, s);
    var triA = gridTri(l, w, s); // rows along the length
    var triB = gridTri(w, l, s).map(function (p) { return [p[1], p[0]]; }); // rows along the width
    var tri = triA.length >= triB.length ? triA : triB;
    var area = L * W;
    return {
      ok: true, margin: m,
      square: { count: sq.length, pts: sq },
      tri: { count: tri.length, pts: tri, along: triA.length >= triB.length ? 'length' : 'width', other: Math.min(triA.length, triB.length) },
      ruleSquare: area / (s * s), ruleTri: area / (s * s * Math.sqrt(3) / 2)
    };
  }

  // ---------- Photo print size & crop ----------
  /** o: {w, h (pixels), pl, ps (print long/short side, inches)} */
  function photoPrint(o) {
    var w = Number(o.w), h = Number(o.h), a = Number(o.pl), b = Number(o.ps);
    if (!(w > 0) || !(h > 0) || !(a > 0) || !(b > 0)) return { ok: false, error: 'Enter the image size in pixels and a print size above zero.' };
    var L = Math.max(w, h), S = Math.min(w, h), pl = Math.max(a, b), ps = Math.min(a, b);
    var ri = L / S, rp = pl / ps, keepL, keepS, cropSide;
    if (ri > rp + 1e-12) { keepL = S * rp; keepS = S; cropSide = 'long'; }
    else if (ri < rp - 1e-12) { keepL = L; keepS = L / rp; cropSide = 'short'; }
    else { keepL = L; keepS = S; cropSide = 'none'; }
    var dpi = keepS / ps;
    var tier = dpi >= 300 ? 'excellent' : dpi >= 200 ? 'good' : dpi >= 150 ? 'fair' : 'low';
    return {
      ok: true, landscape: w >= h, keepL: keepL, keepS: keepS, cropSide: cropSide,
      cropPct: (1 - keepL * keepS / (L * S)) * 100, dpi: dpi, tier: tier,
      max300: [L / 300, S / 300], max150: [L / 150, S / 150]
    };
  }

  // ---------- Potting soil ----------
  var CUIN = { dryqt: 67.2006249, liqqt: 57.75, l: 61.0237441, cuft: 1728, gal: 231 };
  /** o: {shape:'round'|'taper'|'rect', d, dBottom, l, w, depth, headroom, count, extraPct} all inches */
  function pottingSoil(o) {
    var depth = Number(o.depth), head = Number(o.headroom) || 0, n = Number(o.count) || 1, extra = Number(o.extraPct) || 0;
    if (!(depth > 0) || head < 0 || head >= depth) return { ok: false, error: 'Enter a pot depth above zero and a gap at the top smaller than the depth.' };
    if (!(n >= 1) || extra < 0) return { ok: false, error: 'Number of pots must be 1 or more and extra cannot be negative.' };
    var h = depth - head, v, topAtFill = null, naive = null;
    if (o.shape === 'round') {
      var d = Number(o.d); if (!(d > 0)) return { ok: false, error: 'Enter the pot diameter.' };
      v = Math.PI * d * d / 4 * h;
    } else if (o.shape === 'taper') {
      var D = Number(o.d), db = Number(o.dBottom);
      if (!(D > 0) || !(db > 0)) return { ok: false, error: 'Enter both the top and bottom diameters.' };
      topAtFill = db + (D - db) * h / depth; // the wall slopes in a straight line
      v = Math.PI * h / 12 * (topAtFill * topAtFill + topAtFill * db + db * db);
      naive = Math.PI * D * D / 4 * h;
    } else {
      var l = Number(o.l), wd = Number(o.w);
      if (!(l > 0) || !(wd > 0)) return { ok: false, error: 'Enter the length and width.' };
      v = l * wd * h;
    }
    var total = v * n, buy = total * (1 + extra / 100);
    function conv(x) { return { dryqt: x / CUIN.dryqt, l: x / CUIN.l, cuft: x / CUIN.cuft, gal: x / CUIN.gal }; }
    var bags = [{ label: '8 qt bag', qt: 8 }, { label: '16 qt bag', qt: 16 }, { label: '1 cu ft bag', cf: 1 }, { label: '1.5 cu ft bag', cf: 1.5 }, { label: '2 cu ft bag', cf: 2 }]
      .map(function (b) { var size = b.qt ? b.qt * CUIN.dryqt : b.cf * CUIN.cuft; return { label: b.label, n: Math.ceil(buy / size - 1e-9) }; });
    return { ok: true, fillDepth: h, topAtFill: topAtFill, each: conv(v), total: conv(total), buy: conv(buy), cuinEach: v,
      naive: naive === null ? null : { each: conv(naive), overPct: (naive / v - 1) * 100 }, bags: bags };
  }

  // ---------- Bulk buy with waste ----------
  /** o: {rp, rs, bp, bs, use (per week), life (weeks after opening, blank = no waste)} */
  function bulkBuy(o) {
    var rp = Number(o.rp), rs = Number(o.rs), bp = Number(o.bp), bs = Number(o.bs);
    if (!(rp > 0) || !(rs > 0) || !(bp > 0) || !(bs > 0)) return { ok: false, error: 'Enter a price and size above zero for both packs.' };
    var hasLife = o.life !== '' && o.life !== undefined && o.life !== null && Number(o.life) > 0;
    var use = Number(o.use);
    if (hasLife && !(use > 0)) return { ok: false, error: 'To count waste, enter how much you use per week.' };
    var ru = rp / rs, bu = bp / bs;
    var used = hasLife ? Math.min(bs, use * Number(o.life)) : bs;
    var eff = bp / used;
    return { ok: true, ru: ru, bu: bu, used: used, waste: bs - used, eff: eff, diffPct: (eff / ru - 1) * 100,
      mustUse: bp / ru, mustUsePct: bp / ru / bs * 100, hasLife: hasLife, weeks: use > 0 ? bs / use : null };
  }

  // ---------- Paint ----------
  /** o: {l, w, h (ft), doors, windows, coats, coverage (sq ft/gal), gal, qt, five ($), ceiling:bool} */
  function paintNeed(o) {
    var L = Number(o.l), W = Number(o.w), H = Number(o.h), doors = Number(o.doors) || 0, wins = Number(o.windows) || 0;
    var coats = Number(o.coats) || 1, cov = Number(o.coverage), g = Number(o.gal), q = Number(o.qt), f = Number(o.five);
    if (!(L > 0) || !(W > 0) || !(H > 0) || !(cov > 0)) return { ok: false, error: 'Enter the room size, wall height and coverage above zero.' };
    var area = 2 * (L + W) * H - 21 * doors - 15 * wins;
    if (!(area > 0)) return { ok: false, error: 'Doors and windows take up more than the wall area. Check the numbers.' };
    function plan(need) {
      if (!(g > 0)) return null;
      var best = null, maxF = f > 0 ? Math.ceil(need / 5) : 0;
      for (var fi = 0; fi <= maxF; fi++) for (var gi = 0; gi <= Math.ceil(need); gi++) {
        var rest = need - 5 * fi - gi, qi = q > 0 ? Math.max(0, Math.ceil(rest * 4 - 1e-9)) : 0;
        if (!(q > 0) && rest > 1e-9) continue;
        var cost = fi * (f || 0) + gi * g + qi * (q || 0), vol = 5 * fi + gi + qi / 4;
        if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) < 1e-9 && vol < best.vol)) best = { cost: cost, five: fi, gal: gi, qt: qi, vol: vol };
      }
      return best;
    }
    var need = area * coats / cov, ceil = L * W, needC = ceil * coats / cov;
    return { ok: true, area: area, need: need, plan: plan(need), ceilArea: ceil, needCeil: needC, planCeil: o.ceiling ? plan(needC) : null };
  }

  // ---------- Quilt backing ----------
  /** o: {w, l (quilt, in), over (extra per side, in), fw (usable fabric width, in), seam (allowance per seam, in)} */
  function quiltBacking(o) {
    var W = Number(o.w), L = Number(o.l), ov = Number(o.over) || 0, fw = Number(o.fw), seam = o.seam === '' || o.seam === undefined ? 0.5 : Number(o.seam);
    if (!(W > 0) || !(L > 0) || !(fw > 0) || ov < 0 || seam < 0 || seam >= fw) return { ok: false, error: 'Enter the quilt size and fabric width above zero.' };
    var bw = W + 2 * ov, bl = L + 2 * ov;
    function panels(span) { var n = 1; while (n * fw - (n - 1) * seam < span - 1e-9) n++; return n; }
    function eighth(inches) { return Math.ceil(inches / 36 * 8 - 1e-9) / 8; }
    var nv = panels(bw), nh = panels(bl);
    var vert = { panels: nv, cut: bl, inches: nv * bl, yards: eighth(nv * bl) };   // seams run along the length
    var horiz = { panels: nh, cut: bw, inches: nh * bw, yards: eighth(nh * bw) };  // seams run across
    var best = vert.inches <= horiz.inches ? 'vertical' : 'horizontal';
    return { ok: true, bw: bw, bl: bl, vertical: vert, horizontal: horiz, best: best };
  }
  // ---------- Fence posts, pickets, rails, concrete ----------
  /** o: {sides: "50, 30, 50", closed:bool, spacing (max ft), gates: [{w (ft), side (1-based)}],
   *      pw (picket width in), gap (in), spare (%), rails (per section), post (post width in),
   *      hole (diameter in), depth (in), gravel (in)}
   *  Gates are assumed to sit at one end of their side, next to a corner or end post. */
  function fence(o) {
    var sides = String(o.sides || '').split(/[,\s]+/).filter(function (s) { return s !== ''; }).map(Number);
    if (!sides.length || sides.some(function (s) { return !(s > 0); })) return { ok: false, error: 'Enter each side length in feet, separated by commas (for example 50, 30, 50).' };
    var sp = Number(o.spacing);
    if (!(sp > 0)) return { ok: false, error: 'Enter a post spacing above zero.' };
    var fenced = sides.slice(), gates = [];
    (o.gates || []).forEach(function (g) {
      var w = Number(g.w), s = Number(g.side);
      if (w > 0) gates.push({ w: w, side: s });
    });
    for (var i = 0; i < gates.length; i++) {
      var gi = gates[i];
      if (!(gi.side >= 1 && gi.side <= sides.length && Math.floor(gi.side) === gi.side)) return { ok: false, error: 'Gate ' + (i + 1) + ' is on side ' + gi.side + ', but there are only ' + sides.length + ' side(s).' };
      fenced[gi.side - 1] -= gi.w;
      if (!(fenced[gi.side - 1] > 0)) return { ok: false, error: 'The gates on side ' + gi.side + ' are as wide as the side itself.' };
    }
    var pw = Number(o.pw), gap = Number(o.gap) || 0, spare = Number(o.spare) || 0, rails = Number(o.rails) || 0;
    if (!(pw > 0) || gap < 0) return { ok: false, error: 'Enter a picket width above zero.' };
    var per = fenced.map(function (len) {
      var sec = Math.ceil(len / sp - 1e-9);
      return { len: len, sections: sec, actual: len / sec, pickets: Math.ceil(len * 12 / (pw + gap) - 1e-9) }; // repeating unit = one picket + one gap
    });
    var sections = per.reduce(function (a, p) { return a + p.sections; }, 0);
    var posts = sections + (o.closed ? 0 : 1) + gates.length;
    var total = sides.reduce(function (a, b) { return a + b; }, 0);
    var naive = Math.ceil(total / sp - 1e-9);
    var pickets = per.reduce(function (a, p) { return a + p.pickets; }, 0);
    var picketsBuy = Math.ceil(pickets * (1 + spare / 100) - 1e-9);
    var concrete = null, hole = Number(o.hole), depth = Number(o.depth), gravel = Number(o.gravel) || 0, post = Number(o.post);
    if (hole > 0 && depth > 0 && post > 0) {
      var fill = depth - gravel;
      if (!(fill > 0)) return { ok: false, error: 'The gravel layer is as deep as the hole.' };
      if (post >= hole) return { ok: false, error: 'The hole must be wider than the post.' };
      var each = (Math.PI * Math.pow(hole / 2, 2) - post * post) * fill / 1728; // cu ft per post
      var all = each * posts;
      concrete = { each: each, total: all, bags50: Math.ceil(all / 0.375 - 1e-9), bags80: Math.ceil(all / 0.6 - 1e-9) };
    }
    return { ok: true, per: per, sections: sections, posts: posts, naive: naive, total: total, fencedTotal: total - gates.reduce(function (a, g) { return a + g.w; }, 0),
      gates: gates.length, pickets: pickets, picketsBuy: picketsBuy, rails: sections * rails, concrete: concrete };
  }

  function yardsText(y) {
    var whole = Math.floor(y + 1e-9), e = Math.round((y - whole) * 8);
    var fr = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'][e];
    return (whole ? whole + (fr ? ' ' : '') : '') + (fr || (whole ? '' : '0')) + ' yd';
  }

  // ---------- formatting ----------
  function money(v, digits) {
    digits = digits === undefined ? 2 : digits;
    var f = Math.pow(10, digits), n = Number(v);
    n = Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * f) / f; // half-up, so 12.495 shows as 12.50 (toFixed alone gives 12.49)
    var parts = n.toFixed(digits).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + parts.join('.');
  }

  var api = { UNITS: UNITS, unitPrice: unitPrice, stackedDiscount: stackedDiscount, panArea: panArea, panConvert: panConvert, COMMON_PANS: COMMON_PANS, plantSpacing: plantSpacing, photoPrint: photoPrint, pottingSoil: pottingSoil, bulkBuy: bulkBuy, paintNeed: paintNeed, quiltBacking: quiltBacking, fence: fence, yardsText: yardsText, money: money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(this);
