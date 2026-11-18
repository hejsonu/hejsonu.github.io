/* Even Baskets — daily split puzzle for Everyday Figures. No tracking, no storage, no external code. */
(function (root) {
  'use strict';
  var K = 8; // items per puzzle
  var FRAGILE = ['Eggs', 'Strawberries', 'Glass jar of honey', 'Loaf of bread'];
  var HEAVY = ['Watermelon', 'Bag of potatoes', 'Six-pack of water', 'Big bag of flour'];
  var OTHER = ['Milk', 'Apples', 'Cheese', 'Rice', 'Coffee', 'Pasta', 'Butter', 'Tea', 'Onions', 'Yogurt',
    'Cereal', 'Olive oil', 'Bananas', 'Soap', 'Carrots', 'Oranges', 'Peanut butter', 'Tomatoes'];

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
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  // side[i] is 0 (basket A) or 1 (basket B). Returns '' when the split is a full answer, otherwise a reason.
  function check(p, side) {
    var a = 0, b = 0, i;
    for (i = 0; i < K; i++) {
      if (side[i] === 0) a += p.items[i].price; else if (side[i] === 1) b += p.items[i].price; else return 'unplaced';
    }
    if (a !== b) return 'uneven';
    if (side[p.fragile] === side[p.heavy]) return 'crushed';
    return '';
  }
  // Every split, counted once (mirror images are the same answer), sorted into equal-and-safe vs equal-but-crushed.
  function solve(p) {
    var good = [], crushed = 0;
    for (var m = 0; m < (1 << (K - 1)); m++) { // item 0 always in basket A, so mirrors are not counted twice
      var side = [];
      for (var i = 0; i < K; i++) side.push(i === 0 ? 0 : (m >> (i - 1)) & 1);
      var why = check(p, side);
      if (why === '') good.push(side); else if (why === 'crushed') crushed++;
    }
    return { good: good, crushed: crushed };
  }
  function makePuzzle(seedText) {
    var r = rng(hashStr('even-baskets|' + seedText)), best = null;
    for (var attempt = 0; attempt < 500; attempt++) {
      var names = shuffle(r, OTHER.slice()).slice(0, K - 2);
      var f = pick(r, FRAGILE), h = pick(r, HEAVY);
      names.push(f, h);
      shuffle(r, names);
      var items = [];
      for (var i = 0; i < K; i++) {
        var lo = names[i] === h ? 6 : 1; // heavy things cost a bit more
        items.push({ name: names[i], price: lo + Math.floor(r() * (13 - lo)) });
      }
      var p = { items: items, fragile: names.indexOf(f), heavy: names.indexOf(h) };
      var total = 0; for (i = 0; i < K; i++) total += items[i].price;
      if (total % 2) continue;
      var s = solve(p);
      p.count = s.good.length; p.crushed = s.crushed; p.solution = s.good[0] || null; p.half = total / 2;
      if (p.count >= 1) best = p;
      // keep boards with 1-3 answers where the fragile rule actually rules out at least one even split
      if (p.count >= 1 && p.count <= 3 && p.crushed >= 1) return p;
    }
    return best;
  }

  var api = { K: K, makePuzzle: makePuzzle, check: check, solve: solve, rng: rng, hashStr: hashStr };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.EvenBaskets = api;

  // ---------- page UI ----------
  if (typeof document === 'undefined') return;
  function localDate(d) {
    function q(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate());
  }
  function start() {
    var list = document.getElementById('items');
    if (!list) return;
    var msg = document.getElementById('msg'), today = localDate(new Date()), puzzle, side;

    function load(seed, mode) {
      puzzle = makePuzzle(seed); side = []; for (var i = 0; i < K; i++) side.push(-1);
      document.getElementById('label').textContent = mode === 'daily' ? "Today's shopping (" + today + ')' : 'Practice shopping';
      document.getElementById('rule').textContent = 'Keep the ' + puzzle.items[puzzle.fragile].name.toLowerCase() +
        ' away from the ' + puzzle.items[puzzle.heavy].name.toLowerCase() + ' — they must go in different baskets.';
      draw();
    }
    function draw() {
      list.innerHTML = '';
      var a = 0, b = 0;
      puzzle.items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'item' + (side[i] === 0 ? ' in-a' : side[i] === 1 ? ' in-b' : '');
        var tag = i === puzzle.fragile ? ' <span class="tag">fragile</span>' : i === puzzle.heavy ? ' <span class="tag">heavy</span>' : '';
        row.innerHTML = '<span class="name">' + it.name + tag + '</span><span class="price">$' + it.price + '</span>';
        ['A', 'B'].forEach(function (L, k) {
          var btn = document.createElement('button');
          btn.type = 'button'; btn.textContent = L;
          btn.className = 'pick' + (side[i] === k ? ' chosen' : '');
          btn.setAttribute('aria-pressed', side[i] === k ? 'true' : 'false');
          btn.setAttribute('aria-label', 'Put ' + it.name + ' in basket ' + L);
          btn.addEventListener('click', function () { side[i] = side[i] === k ? -1 : k; draw(); });
          row.appendChild(btn);
        });
        list.appendChild(row);
        if (side[i] === 0) a += it.price; else if (side[i] === 1) b += it.price;
      });
      document.getElementById('sumA').textContent = '$' + a;
      document.getElementById('sumB').textContent = '$' + b;
      var why = check(puzzle, side);
      if (why === '') {
        msg.textContent = 'Even baskets! $' + a + ' each, and nothing fragile gets crushed. ' +
          (puzzle.count === 1 ? 'This was the only way to do it.' : 'There are ' + puzzle.count + ' ways in total — can you find another?');
        msg.className = 'msg win';
      } else if (why === 'uneven') {
        msg.textContent = 'All packed, but basket A is $' + a + ' and basket B is $' + b + '. Move something across.'; msg.className = 'msg miss';
      } else if (why === 'crushed') {
        msg.textContent = 'The totals match, but the fragile item (' + puzzle.items[puzzle.fragile].name.toLowerCase() + ') shares a basket with the heavy one (' +
          puzzle.items[puzzle.heavy].name.toLowerCase() + '). Try another split.'; msg.className = 'msg miss';
      } else { msg.textContent = ''; msg.className = 'msg'; }
    }
    document.getElementById('reset').addEventListener('click', function () { for (var i = 0; i < K; i++) side[i] = -1; draw(); });
    document.getElementById('reveal').addEventListener('click', function () { side = puzzle.solution.slice(); draw(); msg.textContent = 'One answer is shown. ' + msg.textContent; });
    document.getElementById('practice').addEventListener('click', function () { load('practice-' + Math.floor(Math.random() * 1e9), 'practice'); });
    document.getElementById('daily').addEventListener('click', function () { load(today, 'daily'); });
    load(today, 'daily');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
