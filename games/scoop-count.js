/* Scoop Count — daily measuring-cup puzzle for Everyday Figures. No tracking, no storage, no external code.
   All amounts are kept in twelfths of a cup so every cup size is a whole number. */
(function (root) {
  'use strict';
  var CUPS = [12, 9, 8, 6, 4, 3]; // 1, 3/4, 2/3, 1/2, 1/3, 1/4 cup
  var RECIPES = ['flour for pancakes', 'oats for flapjacks', 'rice for dinner', 'sugar for lemonade', 'milk for a pudding',
    'water for bread dough', 'flour for a sponge cake', 'stock for soup', 'yogurt for a dip', 'cocoa mix for a tray bake'];

  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  // 29 twelfths -> "2 5/12"
  function fmt(t) {
    var w = Math.floor(t / 12), r = t % 12, out = '';
    if (r) { var g = gcd(r, 12); out = (r / g) + '/' + (12 / g); }
    if (w && r) return w + ' ' + out;
    return w ? String(w) : (r ? out : '0');
  }
  // fewest scoops to make exactly `target` with the given cups (each cup can be used many times); Infinity if impossible
  function minScoops(cups, target) {
    var dp = [0];
    for (var t = 1; t <= target; t++) {
      dp[t] = Infinity;
      for (var i = 0; i < cups.length; i++) if (cups[i] <= t && dp[t - cups[i]] + 1 < dp[t]) dp[t] = dp[t - cups[i]] + 1;
    }
    return dp[target];
  }
  function bestScoops(cups, target) { // one shortest list of scoops
    var dp = [0], from = [0];
    for (var t = 1; t <= target; t++) {
      dp[t] = Infinity;
      for (var i = 0; i < cups.length; i++) if (cups[i] <= t && dp[t - cups[i]] + 1 < dp[t]) { dp[t] = dp[t - cups[i]] + 1; from[t] = cups[i]; }
    }
    if (dp[target] === Infinity) return null;
    var out = [];
    for (t = target; t > 0; t -= from[t]) out.push(from[t]);
    return out;
  }
  function greedyScoops(cups, target) { // what you get by always taking the biggest cup that still fits
    var s = cups.slice().sort(function (a, b) { return b - a; }), n = 0;
    for (var i = 0; i < s.length; i++) while (target >= s[i]) { target -= s[i]; n++; }
    return target === 0 ? n : Infinity;
  }
  function makePuzzle(seedText) {
    var r = rng(hashStr('scoop-count|' + seedText)), best = null;
    for (var attempt = 0; attempt < 500; attempt++) {
      var pool = CUPS.slice(), cups = [], k = 3 + Math.floor(r() * 2);
      while (cups.length < k) cups.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
      cups.sort(function (a, b) { return b - a; });
      var target = 13 + Math.floor(r() * 36); // between 1 1/12 and 4 cups
      if (target % 12 === 0) continue;
      var par = minScoops(cups, target);
      if (par === Infinity || par < 3 || par > 7) continue;
      var p = { cups: cups, target: target, par: par, solution: bestScoops(cups, target), greedy: greedyScoops(cups, target), recipe: RECIPES[Math.floor(r() * RECIPES.length)] };
      best = p;
      // prefer days where "biggest cup first" is not the best plan, but allow some plain days too
      if (p.greedy !== par || r() < 0.3) return p;
    }
    return best;
  }

  var api = { CUPS: CUPS, makePuzzle: makePuzzle, minScoops: minScoops, bestScoops: bestScoops, greedyScoops: greedyScoops, fmt: fmt, rng: rng, hashStr: hashStr };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.ScoopCount = api;

  // ---------- page UI ----------
  if (typeof document === 'undefined') return;
  function localDate(d) {
    function q(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate());
  }
  function start() {
    var box = document.getElementById('cups');
    if (!box) return;
    var msg = document.getElementById('msg'), today = localDate(new Date()), puzzle, used;

    function load(seed, mode) {
      puzzle = makePuzzle(seed); used = [];
      document.getElementById('label').textContent = (mode === 'daily' ? "Today's recipe (" + today + ')' : 'Practice recipe') + ': ' + puzzle.recipe;
      document.getElementById('target').textContent = fmt(puzzle.target) + ' cups';
      document.getElementById('par').textContent = puzzle.par;
      box.innerHTML = '';
      puzzle.cups.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cup'; b.textContent = fmt(c) + ' cup';
        b.setAttribute('aria-label', 'Add one ' + fmt(c) + ' cup scoop');
        b.addEventListener('click', function () { if (total() < puzzle.target) { used.push(c); draw(); } });
        box.appendChild(b);
      });
      draw();
    }
    function total() { var s = 0; for (var i = 0; i < used.length; i++) s += used[i]; return s; }
    function draw() {
      var t = total();
      document.getElementById('have').textContent = fmt(t) + ' cups';
      document.getElementById('scoops').textContent = used.length ? 'Scoops: ' + used.map(fmt).join(' + ') + ' (' + used.length + ')' : 'No scoops yet.';
      if (t === puzzle.target) {
        if (used.length === puzzle.par) { msg.textContent = 'Perfect! ' + fmt(t) + ' cups in ' + used.length + ' scoops — that is the fewest possible.'; msg.className = 'msg win'; }
        else { msg.textContent = 'Exactly ' + fmt(t) + ' cups in ' + used.length + ' scoops. It can be done in ' + puzzle.par + ' — try again?'; msg.className = 'msg win'; }
      } else if (t > puzzle.target) {
        msg.textContent = 'Too much: ' + fmt(t) + ' cups is ' + fmt(t - puzzle.target) + ' cup over. Tap Undo.'; msg.className = 'msg miss';
      } else { msg.textContent = ''; msg.className = 'msg'; }
    }
    document.getElementById('undo').addEventListener('click', function () { used.pop(); draw(); });
    document.getElementById('reset').addEventListener('click', function () { used = []; draw(); });
    document.getElementById('reveal').addEventListener('click', function () { used = puzzle.solution.slice(); draw(); msg.textContent = 'A shortest way is shown. ' + msg.textContent; });
    document.getElementById('practice').addEventListener('click', function () { load('practice-' + Math.floor(Math.random() * 1e9), 'practice'); });
    document.getElementById('daily').addEventListener('click', function () { load(today, 'daily'); });
    document.addEventListener('keydown', function (e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= puzzle.cups.length) { box.children[n - 1].click(); e.preventDefault(); }
      else if (e.key === 'Backspace') { used.pop(); draw(); e.preventDefault(); }
    });
    load(today, 'daily');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
