// The browser build's stand-in for the local server: app.js's api() calls window.retconApi,
// which hands each call to the engine in worker.js. The game in progress is kept as its setup
// and your moves, so reloading the page replays it (the engine and bots are deterministic).
"use strict";

(() => {
  const KEY = "retcon.game";
  const worker = new Worker("static/worker.js", { name: document.documentElement.dataset.version });
  const pending = new Map();
  let next = 0;

  worker.onmessage = (e) => {
    const { id, code, data } = e.data;
    const { resolve, reject } = pending.get(id);
    pending.delete(id);
    if (code === 200) resolve(data); else reject(new Error(data.error || "error " + code));
  };

  function call(path, body) {
    return new Promise((resolve, reject) => {
      pending.set(++next, { resolve, reject });
      worker.postMessage({ id: next, path, body });
    });
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  function store(game) {
    try {
      if (game) localStorage.setItem(KEY, JSON.stringify(game)); else localStorage.removeItem(KEY);
    } catch { /* storage unavailable: a reload starts afresh */ }
  }

  async function restore() {
    const game = load();
    if (!game || game.version !== document.documentElement.dataset.version) return { none: true };
    try {
      let s = await call("/api/new", game.setup);
      for (const i of game.moves) s = await call("/api/act", { i });
      s.frames = [];                       // nothing to watch: you've seen it
      return s;
    } catch {
      store(null);
      return { none: true };
    }
  }

  let first = true;
  window.retconApi = async (path, body) => {
    if (first) {
      first = false;
      document.getElementById("status").textContent = "Loading the game (a few seconds the first time)…";
    }
    if (path === "/api/state") {
      const s = await call(path);
      return s.none ? restore() : s;
    }
    const s = await call(path, body);
    if (path === "/api/new") store({ version: s.version, setup: { ...body, seed: s.seed }, moves: [] });
    if (path === "/api/act") {
      const game = load();
      if (game) { game.moves.push(body.i); store(s.over ? null : game); }
    }
    return s;
  };
})();
