/* Budget Aisle — daily path puzzle for Everyday Figures. No tracking, no storage, no external code. */
(function (root) {
  'use strict';
  var N = 5;

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
  function randomPath(r) {
    var moves = [], i, j, tmp;
    for (i = 0; i < N - 1; i++) { moves.push('R', 'D'); }
    for (i = moves.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); tmp = moves[i]; moves[i] = moves[j]; moves[j] = tmp; }
    var row = 0, col = 0, path = [[0, 0]];
    for (i = 0; i < moves.length; i++) { if (moves[i] === 'R') col++; else row++; path.push([row, col]); }
    return path;
  }
  function pathSum(grid, path) {
    var s = 0;
    for (var i = 0; i < path.length; i++) s += grid[path[i][0]][path[i][1]];
    return s;
  }
  // number of right/down paths from top-left to bottom-right whose prices add up to target
  function countPaths(grid, target) {
    var dp = [], r, c, s;
    for (r = 0; r < N; r++) { dp.push([]); for (c = 0; c < N; c++) { dp[r].push(new Array(target + 1).fill(0)); } }
    if (grid[0][0] <= target) dp[0][0][grid[0][0]] = 1;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
      if (r === 0 && c === 0) continue;
      var v = grid[r][c];
      for (s = v; s <= target; s++) {
        var w = 0;
        if (r > 0) w += dp[r - 1][c][s - v];
        if (c > 0) w += dp[r][c - 1][s - v];
        dp[r][c][s] = w;
      }
    }
    return dp[N - 1][N - 1][target];
  }
  // a partial or complete path is valid if it starts at the entrance and every step goes one cell right or down
  function isValidPath(path) {
    if (!path.length || path[0][0] !== 0 || path[0][1] !== 0) return false;
    for (var i = 1; i < path.length; i++) {
      var dr = path[i][0] - path[i - 1][0], dc = path[i][1] - path[i - 1][1];
      if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;
      if (path[i][0] >= N || path[i][1] >= N) return false;
    }
    return true;
  }
  function isComplete(path) {
    var last = path[path.length - 1];
    return isValidPath(path) && last[0] === N - 1 && last[1] === N - 1;
  }
  function makePuzzle(seedText) {
    var r = rng(hashStr('budget-aisle|' + seedText)), best = null;
    for (var attempt = 0; attempt < 300; attempt++) {
      var grid = [];
      for (var i = 0; i < N; i++) { grid.push([]); for (var j = 0; j < N; j++) grid[i].push(1 + Math.floor(r() * 9)); }
      var path = randomPath(r), target = pathSum(grid, path), count = countPaths(grid, target);
      best = { grid: grid, target: target, count: count, solution: path };
      if (count >= 1 && count <= 3) return best;
    }
    return best;
  }

  var api = { N: N, makePuzzle: makePuzzle, countPaths: countPaths, isValidPath: isValidPath, isComplete: isComplete, pathSum: pathSum, randomPath: randomPath, rng: rng, hashStr: hashStr };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.BudgetAisle = api;

  // ---------- page UI ----------
  if (typeof document === 'undefined') return;
  function localDate(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function start() {
    var board = document.getElementById('board');
    if (!board) return;
    var info = document.getElementById('info'), msg = document.getElementById('msg');
    var today = localDate(new Date()), seed = today, mode = 'daily', puzzle, path;

    function load(newSeed, newMode) {
      seed = newSeed; mode = newMode; puzzle = makePuzzle(seed); path = [[0, 0]];
      document.getElementById('label').textContent = mode === 'daily' ? "Today's store (" + today + ')' : 'Practice store';
      document.getElementById('target').textContent = '$' + puzzle.target;
      msg.textContent = ''; draw();
    }
    function inPath(r, c) { for (var i = 0; i < path.length; i++) if (path[i][0] === r && path[i][1] === c) return i; return -1; }
    function last() { return path[path.length - 1]; }
    function canStep(r, c) { var l = last(); return (r === l[0] + 1 && c === l[1]) || (r === l[0] && c === l[1] + 1); }
    function draw() {
      board.innerHTML = '';
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var b = document.createElement('button'), k = inPath(r, c);
        b.type = 'button'; b.className = 'cell';
        b.textContent = '$' + puzzle.grid[r][c];
        if (k >= 0) b.className += ' on';
        if (k === path.length - 1) b.className += ' here';
        if (k < 0 && canStep(r, c) && !isComplete(path)) b.className += ' next';
        if (r === 0 && c === 0) b.className += ' entry';
        if (r === N - 1 && c === N - 1) b.className += ' till';
        b.setAttribute('aria-label', 'Row ' + (r + 1) + ', aisle ' + (c + 1) + ', $' + puzzle.grid[r][c] + (k >= 0 ? ', in your cart' : ''));
        b.dataset.r = r; b.dataset.c = c;
        b.addEventListener('click', onCell);
        board.appendChild(b);
      }
      var spent = pathSum(puzzle.grid, path), left = puzzle.target - spent;
      info.textContent = 'Spent $' + spent + ' · ' + (left >= 0 ? '$' + left + ' left' : '$' + (-left) + ' over budget') + ' · steps ' + (path.length - 1) + '/' + (2 * (N - 1));
      if (isComplete(path)) {
        if (spent === puzzle.target) {
          msg.textContent = 'Exact change! You hit the $' + puzzle.target + ' budget. ' +
            (puzzle.count === 1 ? 'This was the only route that works.' : 'There are ' + puzzle.count + ' routes that work — can you find another?');
          msg.className = 'msg win';
        } else {
          msg.textContent = 'You reached the checkout with $' + spent + ' — the budget is $' + puzzle.target + '. Tap Undo to change your route.';
          msg.className = 'msg miss';
        }
      } else { msg.textContent = ''; msg.className = 'msg'; }
    }
    function step(r, c) {
      var k = inPath(r, c);
      if (k >= 0 && k > 0) { path = path.slice(0, k); draw(); return; } // tap a cart cell to walk back to just before it
      if (k < 0 && canStep(r, c) && !isComplete(path)) { path.push([r, c]); draw(); }
    }
    function onCell(e) { step(+e.currentTarget.dataset.r, +e.currentTarget.dataset.c); }
    document.getElementById('undo').addEventListener('click', function () { if (path.length > 1) { path.pop(); draw(); } });
    document.getElementById('reset').addEventListener('click', function () { path = [[0, 0]]; draw(); });
    document.getElementById('practice').addEventListener('click', function () { load('practice-' + Math.floor(Math.random() * 1e9), 'practice'); });
    document.getElementById('daily').addEventListener('click', function () { load(today, 'daily'); });
    document.getElementById('reveal').addEventListener('click', function () { path = puzzle.solution.slice(); draw(); msg.textContent = 'One working route is shown. ' + msg.textContent; });
    document.addEventListener('keydown', function (e) {
      var l = last();
      if (e.key === 'ArrowRight') { step(l[0], l[1] + 1); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { step(l[0] + 1, l[1]); e.preventDefault(); }
      else if (e.key === 'Backspace') { if (path.length > 1) { path.pop(); draw(); } e.preventDefault(); }
    });
    load(today, 'daily');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
