"use strict";

const $ = (id) => document.getElementById(id);
let state = null;
let selected = null;      // name of the hand card being placed ("♥ Ancestor")
let busy = false;
let replay = null;        // step-by-step playback of what happened since your last move

function pref(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === "1"; }
  catch { return fallback; }
}
function setPref(key, on) {
  try { localStorage.setItem(key, on ? "1" : "0"); } catch { /* storage unavailable */ }
}
let treeView = pref("retcon.tree", true);    // each card drawn once; branches start under their split
let watchRounds = pref("retcon.watch", true);

async function api(path, body) {
  if (window.retconApi) return window.retconApi(path, body);   // the browser build (pyodide.js)
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function arrive(s, watch) {
  state = s; selected = null;
  if (state.version) document.querySelector(".brand .ver").textContent = "v" + state.version;   // the engine's sim.VERSION
  if (watch && watchRounds && state.frames && state.frames.length) startReplay();
  else render();
}

async function act(i) {
  if (busy || replay) return;
  busy = true; selected = null;
  $("status").textContent = "The other travellers are moving…";
  try { const s = await api("/api/act", { i }); busy = false; arrive(s, true); }
  catch (e) { busy = false; alert(e.message); render(); }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function tokenChips(marks) {
  const box = el("div", "tokens");
  for (const [p, n] of Object.entries(marks)) {
    const t = el("span", "tok", String(n));
    t.style.background = state.players[p].color;
    t.title = `${state.players[p].name}: ${n} lineage`;
    box.appendChild(t);
  }
  return box;
}

function suitEl(suit) {
  return el("span", "suit" + (suit === "♥" || suit === "♦" ? " red" : ""), suit);
}

function kindEl(kind, suit) {
  const k = el("div", "kind");
  if (suit) { k.appendChild(suitEl(suit)); k.appendChild(document.createTextNode(" ")); }
  k.appendChild(document.createTextNode(kind === null ? "?" : kind));
  return k;
}

function rowSuit(rid) {
  const row = state.rows.find((r) => r.rid === rid);
  return row ? row.suit : null;
}

function cardEl(c, opts = {}) {
  const d = el("div", "card");
  d.dataset.uid = c.uid;
  if (c.present) {
    d.classList.add("present");
    d.appendChild(document.createTextNode("PRESENT"));
    if (c.suit) {
      d.appendChild(el("br"));
      d.appendChild(suitEl(c.suit));
      d.title = `T${c.row}'s suit: ${c.suit} cards are trumps in its trick`;
    }
    return d;
  }
  if (c.anchored) {
    d.classList.add("anchor");
    d.appendChild(el("div", "kind", "⑂ Rupture"));
    d.appendChild(el("div", "owner", opts.startsRow !== undefined ? `T${opts.startsRow} begins here` : "split point"));
  } else {
    const mine = c.owner === state.human;
    const player = state.players[c.owner];
    if (c.pending) d.classList.add("facedown");
    d.appendChild(kindEl(c.kind, c.suit));
    d.appendChild(el("div", "owner", (mine ? "You" : player.name) + (c.pending ? " · facedown" : "")));
    d.style.borderColor = player.color;
    d.style.background = c.pending ? "" : `color-mix(in srgb, ${player.color} 10%, var(--panel))`;
  }
  d.appendChild(tokenChips(c.marks));
  if (c.frozen) d.classList.add("frozen");
  if (c.zone) { d.classList.add("now"); d.appendChild(el("span", "tag", "this round's trick")); }
  if ((replay ? opts.focus : state.focus) === c.uid) d.classList.add("focus");
  if (opts.hit === c.uid) d.classList.add("hit");
  if (opts.shared) {
    d.classList.add("shared");
    d.appendChild(el("span", "tag", `shared · T${c.row}`));
  }
  if (opts.branches && opts.branches.length) {
    d.appendChild(el("span", "fork-badge", "⑂ " + opts.branches.map((b) => `T${b}`).join(" ")));
  }
  d.title = opts.shared
    ? `Shared history: this is the same card as on T${c.row} (column ${c.col}). Anything that happens to it happens on every timeline that shares it.`
    : `T${c.row}, column ${c.col}`;
  d.onmouseenter = () => document.querySelectorAll(`[data-uid="${c.uid}"]`).forEach((e) => e.classList.add("hl"));
  d.onmouseleave = () => document.querySelectorAll(`[data-uid="${c.uid}"]`).forEach((e) => e.classList.remove("hl"));
  return d;
}

function sendsFor(card) {
  return state.legal.filter((a) => a.type === "send" && a.card === card);
}

function splits() {
  return state.decision === "split" ? state.legal.filter((a) => a.type === "split") : [];
}

function trickFor(card) {
  return state.legal.find((a) => a.type === "trick" && a.card === card);
}

function lightPath(row, on) {
  for (const c of row.path) {
    document.querySelectorAll(`[data-uid="${c.uid}"]`).forEach((e) => e.classList.toggle("path-hl", on));
  }
}

function renderBoard(rows = state.rows, marks = {}) {
  const board = $("board");
  board.innerHTML = "";
  board.classList.add("slots");             // timelines line up slot for slot
  const splitting = !replay && state.my_turn && state.decision === "split";
  const legal = replay ? [] : splitting ? splits() : selected ? sendsFor(selected) : [];
  const branchesFrom = {};                 // card uid -> timelines that split off after it
  for (const row of rows) {
    if (row.fork) (branchesFrom[row.fork.uid] = branchesFrom[row.fork.uid] || []).push(row.rid);
  }
  for (const row of rows) {
    const r = el("div", "row" + (row.locked ? " locked" : "") +
      (!replay && state.trick_row === row.rid && state.my_turn ? " trick-row" : ""));
    const label = el("div", "row-label");
    const lockedBy = row.locked_by === null || row.locked_by === undefined ? ""
      : ` by ${row.locked_by === state.human ? "you" : state.players[row.locked_by].name}`;
    const name = el("div", "tl-name", `T${row.rid} `);
    if (row.suit) name.appendChild(suitEl(row.suit));
    if (row.locked) name.appendChild(document.createTextNode(` · locked${lockedBy}`));
    label.appendChild(name);
    if (row.parent !== null) {
      label.appendChild(el("div", "tl-from", `split from T${row.parent}` + (row.fork ? ` after ${row.fork.label}` : "")));
    }
    label.title = "Hover to light up this timeline's whole history";
    label.onmouseenter = () => lightPath(row, true);
    label.onmouseleave = () => lightPath(row, false);
    r.appendChild(label);
    const cells = el("div", "row-cells");
    // tree view: each card once, and a branch starts under the card it split from
    // (slot for slot: its split point sits under the last card the timelines share)
    const shown = treeView ? row.path.filter((c) => !c.shared) : row.path;
    let splits = [];                       // slot for slot, every card shown: a split point takes no slot
    if (treeView && row.start > 0) {
      const sp = el("div", "spacer" + (row.parent !== null ? " branch" : ""));
      sp.style.width = `calc((var(--card-w) + var(--gap-w)) * ${row.start})`;
      cells.appendChild(sp);
    }
    for (const c of shown) {
      if (!treeView && c.anchored) { splits.push(`T${c.row}`); continue; }
      const gap = el("div", "gap");
      if (splits.length) {                 // ...so it's a mark between the cards on either side of the split
        gap.classList.add("split");
        gap.title = `${splits.join(" and ")} split${splits.length === 1 ? "s" : ""} off here`;
        splits = [];
      }
      // a + belongs to the timeline whose Past this is
      const here = c.zone ? [] : legal.filter((a) => a.row === c.row && a.gap === c.index &&
        (treeView || a.via === row.rid));
      if (here.length && splitting) {
        gap.classList.add("legal", "rupture");
        gap.title = `Split T${here[0].via} here: the new timeline shares everything before this point, ` +
          "and the lineage on it";
        gap.onclick = () => act(here[0].i);
      } else if (here.length) {
        gap.classList.add("legal");
        gap.title = `Send your ${selected} back here` + (c.row !== row.rid ? ` (into history T${row.rid} shares)` : "") +
          (here[0].cost !== undefined ? ` · ${here[0].steps} step${here[0].steps === 1 ? "" : "s"} back: ` +
            `${here[0].cost} charge` : "") +
          (here[0].ruptures ? ` · instability reaches ${state.split_at}: T${here[0].via} ruptures, and you choose where` : "");
        if (here[0].cost !== undefined) gap.dataset.cost = String(here[0].cost);
        if (here[0].ruptures) gap.classList.add("ruptures");
        gap.onclick = () => act(here[0].i);
      }
      cells.appendChild(gap);
      cells.appendChild(cardEl(c, {
        shared: !treeView && c.shared, branches: branchesFrom[c.uid],
        startsRow: c.anchored && c.row === row.rid ? row.rid : undefined,
        focus: marks.focus, hit: marks.hit,
      }));
    }
    r.appendChild(cells);
    board.appendChild(r);
  }
}

function renderDecision() {
  const box = $("decision");
  box.innerHTML = "";
  let prompt = null, opts = [];
  if (replay) { box.classList.add("hidden"); return; }
  if (state.my_turn && state.decision) {
    prompt = state.prompt;
    opts = state.legal;
  }
  if (!prompt) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.appendChild(el("p", "", prompt));
  const row = el("div", "opts");
  for (const o of opts) {
    const b = el("button", /^(Don't|Leave)/.test(o.label) ? "ghost" : "", o.label);
    b.onclick = () => act(o.i);
    row.appendChild(b);
  }
  box.appendChild(row);
}

function renderHand() {
  const hand = $("hand");
  hand.innerHTML = "";
  const canAct = state.my_turn && !state.decision && !busy && !replay;
  const tricking = canAct && state.phase === "present";
  const trumps = tricking ? rowSuit(state.trick_row) : null;
  for (const card of state.hand) {
    const c = el("div", "card");
    c.appendChild(kindEl(card.kind, card.suit));
    c.appendChild(el("div", "owner", `value ${state.rules.values[card.kind]}`));
    if (trumps && card.suit === trumps) {
      c.classList.add("trump");
      c.appendChild(el("span", "tag", `trump in T${state.trick_row}`));
    }
    const playable = canAct && (tricking ? !!trickFor(card.card) : sendsFor(card.card).length > 0);
    if (!playable) c.classList.add("unplayable");
    if (selected === card.card) c.classList.add("selected");
    c.onclick = () => {
      if (!playable) return;
      if (tricking) { act(trickFor(card.card).i); return; }
      selected = selected === card.card ? null : card.card; render();
    };
    hand.appendChild(c);
  }
  if (!state.hand.length) hand.appendChild(el("p", "hint", "Your hand is empty."));
  const draw = state.legal.find((a) => a.type === "draw");
  $("drawBtn").disabled = !(canAct && draw);
  $("drawBtn").onclick = () => draw && act(draw.i);
  const pass = state.legal.find((a) => a.type === "pass");
  $("passBtn").classList.toggle("hidden", !(canAct && pass));
  $("passBtn").onclick = () => pass && act(pass.i);
  const recalls = canAct ? state.legal.filter((a) => a.type === "recall") : [];
  const box = $("recall");
  box.innerHTML = "";
  box.classList.toggle("hidden", !recalls.length);
  if (recalls.length) {
    box.appendChild(el("span", "", `Recall from the discard pile (${state.rules.recall_cost} charge): `));
    for (const a of recalls) {
      const b = el("button", "ghost", a.label);
      b.onclick = () => act(a.i);
      box.appendChild(b);
    }
  }
  const left = state.split_at - state.instability;
  const clock = !state.can_rupture ? ""
    : left > 0 ? ` A send or recall costing ${left} or more ruptures T${state.trick_row}, and you choose where it splits.`
      : ` The next send or recall ruptures T${state.trick_row}, and you choose where it splits.`;
  $("hint").textContent = replay ? "Watching what happened since your last move…" : !canAct ? "" : tricking
    ? `The Present: click a card to play it facedown into T${state.trick_row}'s trick. ` +
      (trumps ? `${trumps} cards are trumps here: the best trump wins, else the most valuable card; ties go to the card played first. `
        : "The most valuable card wins; ties go to the card played first. ")
    : selected
      ? `The Past, T${state.trick_row}: click a highlighted gap in T${state.trick_row}'s history to send your ${selected} back. ` +
        "The number is its cost in charge; a ⑂ beside it means that send ruptures the timeline." + clock
      : `The Past, T${state.trick_row}: you have ${state.players[state.human].charge} charge. Pick a card to send back into ` +
        `T${state.trick_row}'s history, or draw one card, or recall one from the discard pile (${state.rules.recall_cost} charge, buttons below your hand), or pass. (Your hand tops up at the start of next round.)` + clock;
}

function renderGauge(instability, timelines) {
  const g = $("gauge");
  g.innerHTML = "";
  if (!state.can_rupture) {
    g.textContent = timelines >= state.total_timelines ? `${state.total_timelines} timelines: no more ruptures`
      : `${state.max_timelines} open timelines: no rupture until one locks`;
    g.title = "Spending ruptures nothing while there is no free Present marker, or once every timeline has been made.";
    return;
  }
  g.appendChild(el("span", "", "Instability "));
  const pips = el("span", "pips");
  for (let k = 0; k < state.split_at; k++) pips.appendChild(el("span", "pip" + (k < instability ? " full" : "")));
  g.appendChild(pips);
  g.appendChild(el("span", "", ` ${instability} of ${state.split_at}`));
  g.title = "Every charge spent on sending cards back or recalling them, by anyone, adds to the instability. When it reaches " +
    `${state.split_at}, the timeline whose Past it is ruptures at once, and whoever's send or recall got it there chooses where ` +
    "it splits and the new timeline's suit. Then the instability goes back to 0.";
}

function renderPlayers(now) {
  const players = $("players");
  players.innerHTML = "";
  state.players.forEach((p, i) => {
    const points = now ? now[i].points : p.points;
    const charge = now ? now[i].charge : p.charge;
    const d = el("div", "player" + (!now && state.to_play === i && !state.over ? " turn" : ""));
    const chip = el("span", "chip"); chip.style.background = p.color;
    d.appendChild(chip);
    d.appendChild(el("span", "name", (i === state.human ? "You (Red)" : p.name) + (state.first === i ? " · First" : "")));
    d.appendChild(el("span", "meta", `${points} locked · ${charge} charge · ${p.hand_count} cards · ${p.lineage_left} lineage`));
    players.appendChild(d);
  });
}

function renderTally(rows) {
  const tally = $("tally");
  tally.innerHTML = "";
  const need = state.rules.secure;
  for (const row of rows) {
    const d = el("div", "tally-row" + (row.locked ? " locked" : ""));
    const tl = el("span", "tl", `T${row.rid} `);
    if (row.suit) tl.appendChild(suitEl(row.suit));
    d.appendChild(tl);
    const bar = el("div", "bar");
    const top = Math.max(...row.tally);
    const leaders = row.tally.filter((n) => n === top).length;
    row.tally.forEach((n, p) => {
      const t = el("span", "tok", String(n));
      t.style.background = state.players[p].color;
      if (n >= need && n === top && leaders === 1) { t.classList.add("secured"); t.title = "secured: locks at round end"; }
      bar.appendChild(t);
    });
    d.appendChild(bar);
    d.appendChild(el("span", "meta", row.locked ? "locked" : `need ${need} and the lead`));
    tally.appendChild(d);
  }
}

function renderLog(lines, mark, follow) {
  const log = $("log");
  log.innerHTML = "";
  let firstNew = null;
  lines.forEach((line, i) => {
    const d = el("div", /^(===|---)/.test(line) ? "head" : "", line.replace(/^=== |^--- | ===$| ---$/g, ""));
    if (i >= mark) { d.classList.add("new"); if (firstNew === null) firstNew = d; }
    log.appendChild(d);
  });
  if (follow) { log.scrollTop = log.scrollHeight; return; }                 // the replay keeps up with its step
  const target = firstNew || log.lastChild;                                   // scroll the log panel only
  if (target) log.scrollTop = Math.max(0, target.offsetTop - log.offsetTop - 8);
}

function renderSide() {
  renderPlayers();
  renderTally(state.rows);
  renderLog(state.log, state.mark, false);
}

function renderStatus() {
  const st = $("status");
  st.classList.remove("mine");
  if (replay) {
    st.textContent = "Watching the round…";
  } else if (state.over) {
    const names = state.winners.map((w) => (w === state.human ? "You" : state.players[w].name));
    st.textContent = `Game over: ${names.join(" and ")} ${names.length > 1 ? "share the win" : (names[0] === "You" ? "win" : "wins")} ` +
      `(${state.end_reason === "won" ? "3 locks" : state.end_reason === "complete" ? "every timeline locked" : "the round limit"}).` +
      (state.saved && !state.saved_text ? ` Log saved to ${state.saved}.` : "");
    if (state.saved_text) {      // the browser build has no folder to save to: offer the log instead
      const a = el("a", "save-link", "Download the log");
      a.href = URL.createObjectURL(new Blob([state.saved_text], { type: "text/plain" }));
      a.download = state.saved;
      st.append(" ", a);
    }
  } else if (state.my_turn) {
    st.classList.add("mine");
    st.textContent = state.decision ? "Your decision" :
      state.phase === "present" ? `The Present: play into T${state.trick_row}'s trick` :
      `The Past: T${state.trick_row}'s history: send a card back, draw, or pass`;
  } else {
    st.textContent = "Waiting for the other travellers…";
  }
  const first = state.players[state.first];
  $("roundInfo").textContent = `Round ${state.round} of ${state.round_limit} · ${state.actions_per_round} trick(s) · ` +
    `${state.first === state.human ? "you lead" : first.name + " leads"} · ` +
    `timelines ${state.rows.length} of ${state.total_timelines} (open at most ${state.max_timelines}) · first to ${state.locks_to_win} locks wins · deck: ${state.deck} cards`;
  if (!replay) renderGauge(state.instability, state.rows.length);
  $("legend").innerHTML = treeView
    ? "Each card appears <b>once</b>. A new timeline starts under the card it split from, so cards in the same " +
      "column are at the same point in time (a split point takes no slot). Hover a timeline's name to light up its whole history."
    : "Faded cards are <b>shared history</b>, the same card shown on every timeline that shares it. Hover a card to see it " +
      "everywhere. Cards in the same column are at the same point in time; ⑂ marks where a timeline splits off.";
}

function render() {
  if (!state) return;
  renderStatus();
  renderBoard();
  renderDecision();
  renderHand();
  renderSide();
  showWhereTheActionIs();
}

function showWhereTheActionIs() {
  // the action is at the Presents: show the card in focus, else this trick's Present, else the newest history
  const wrap = document.querySelector(".board-wrap");
  const target = document.querySelector("#board .card.focus") ||
    document.querySelector("#board .trick-row .card.present");
  if (target) target.scrollIntoView({ block: "nearest", inline: "center" });
  else wrap.scrollLeft = wrap.scrollWidth;
}

// --- the step-by-step replay ------------------------------------------------

function framesRows(k) {
  for (let j = k; j >= 0; j--) if (replay.frames[j].rows) return replay.frames[j].rows;
  return state.rows;
}

function rowsHave(rows, uid) {
  return rows.some((row) => row.path.some((c) => c.uid === uid));
}

function startReplay() {
  const frames = state.frames;
  replay = { frames, i: -1, playing: true, timer: null, base: state.log.length - frames.length };
  $("caption").classList.remove("hidden");
  renderStatus(); renderDecision(); renderHand();
  replayStep();
}

function drawFrame(rows, marks) {
  const f = replay.frames[replay.i];
  renderBoard(rows, marks);
  renderTally(rows);
  renderPlayers(f.players);
  renderGauge(f.instability, rows.length);
  renderLog(state.log.slice(0, replay.base + replay.i + 1), replay.base, true);
  $("captionText").textContent = f.line.replace(/^=== |^--- | ===$| ---$/g, "").trim();
  $("captionStep").textContent = `step ${replay.i + 1} of ${replay.frames.length}`;
  $("replayPause").textContent = replay.playing ? "Pause" : "Play";
  const focus = document.querySelector("#board .card.hit") || document.querySelector("#board .card.focus");
  if (focus) focus.scrollIntoView({ block: "nearest", inline: "center" });
}

function replayStep() {
  if (!replay) return;
  clearTimeout(replay.timer);
  replay.i += 1;
  if (replay.i >= replay.frames.length) { endReplay(); return; }
  const f = replay.frames[replay.i];
  const before = replay.i > 0 ? framesRows(replay.i - 1) : null;
  const after = framesRows(replay.i);
  if (f.hit && before && rowsHave(before, f.hit) && !rowsHave(after, f.hit)) {
    drawFrame(before, { focus: f.focus, hit: f.hit });          // show the strike before the card disappears
    replay.timer = setTimeout(() => {
      if (!replay) return;
      drawFrame(after, { focus: f.focus });
      scheduleNext(f);
    }, 750);
  } else {
    drawFrame(after, { focus: f.focus, hit: f.hit });
    scheduleNext(f);
  }
}

function scheduleNext(f) {
  if (!replay || !replay.playing) return;
  const wait = /^(===|---)/.test(f.line) ? 600 : f.rows ? 1300 : 800;
  replay.timer = setTimeout(replayStep, wait);
}

function endReplay() {
  if (replay) clearTimeout(replay.timer);
  replay = null;
  $("caption").classList.add("hidden");
  render();
}

$("replayPause").onclick = () => {
  if (!replay) return;
  replay.playing = !replay.playing;
  $("replayPause").textContent = replay.playing ? "Pause" : "Play";
  if (replay.playing) replayStep(); else clearTimeout(replay.timer);
};
$("replayStep").onclick = () => {
  if (!replay) return;
  replay.playing = false;
  replayStep();
};
$("replaySkip").onclick = () => endReplay();

// --- view options ------------------------------------------------------------

$("treeView").checked = treeView;
$("treeView").onchange = () => { treeView = $("treeView").checked; setPref("retcon.tree", treeView); if (replay) replayRedraw(); else render(); };
$("watchRounds").checked = watchRounds;
$("watchRounds").onchange = () => { watchRounds = $("watchRounds").checked; setPref("retcon.watch", watchRounds); };

function replayRedraw() {
  const f = replay.frames[replay.i];
  if (f) drawFrame(framesRows(replay.i), { focus: f.focus, hit: f.hit });
}

// --- dialogs ---------------------------------------------------------------

$("newBtn").onclick = () => $("newDialog").showModal();
$("rulesBtn").onclick = () => $("rulesDialog").showModal();
$("rulesClose").onclick = () => $("rulesDialog").close();
$("newDialog").addEventListener("close", async () => {
  if ($("newDialog").returnValue !== "ok") return;
  const f = new FormData($("newForm"));
  const seed = (f.get("seed") || "").trim();
  const body = {
    players: Number(f.get("players")), bot: f.get("bot"), auto_ancestor: f.has("auto_ancestor"),
    seed: seed ? Number(seed) : null,
  };
  if (replay) endReplay();
  $("status").textContent = "Setting up…";
  try { arrive(await api("/api/new", body), true); }
  catch (e) { alert(e.message); }
});

(async () => {
  const s = await api("/api/state");
  if (s.none) { $("status").textContent = "Start a new game"; $("newDialog").showModal(); }
  else arrive(s, false);
})();
