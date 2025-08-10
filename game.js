import { Howl } from "howler";

// Simple assets mapping for ingredient ids to image file
const ING = {
  tofu: { id: "tofu", name: "Tofu", img: "./ingredient_tofu.png", cook: true },
  broccoli: { id: "broccoli", name: "Broccoli", img: "./ingredient_broccoli.png", cook: true },
  carrot: { id: "carrot", name: "Carrot", img: "./ingredient_carrot.png", cook: true },
  mushroom: { id: "mushroom", name: "Mushroom", img: "./ingredient_mushroom.png", cook: true },
  rice: { id: "rice", name: "Rice", img: "./ingredient_rice.png", cook: false },
  sauce: { id: "sauce", name: "Sauce", img: "./ingredient_sauce.png", cook: false },
};

const RECIPES = [
  { name: "Tofu Stir-Fry", req: ["tofu", "broccoli", "carrot", "sauce"], price: 25 },
  { name: "Mushroom Rice", req: ["mushroom", "rice", "sauce"], price: 22 },
  { name: "Green Bowl", req: ["broccoli", "rice", "sauce"], price: 18 },
  { name: "Savory Tofu Rice", req: ["tofu", "rice", "sauce"], price: 20 },
];

const sfx = {
  pop: new Howl({ src: ["./sfx_pop.mp3"], volume: 0.5 }),
  sizzle: new Howl({ src: ["./sfx_sizzle.mp3"], volume: 0.35, loop: true }),
  serve: new Howl({ src: ["./sfx_serve.mp3"], volume: 0.6 }),
  success: new Howl({ src: ["./sfx_success.mp3"], volume: 0.6 }),
  fail: new Howl({ src: ["./sfx_fail.mp3"], volume: 0.6 }),
  tick: new Howl({ src: ["./sfx_tick.mp3"], volume: 0.2 })
};

const $ = (sel, p = document) => p.querySelector(sel);
const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

const state = {
  day: 1,
  score: 0,
  lives: 3,
  orders: [],
  nextOrderId: 1,
  running: false,
  drag: null,
  pans: [
    { items: [], heat: 0, cooking: false, sizzleId: null },
    { items: [], heat: 0, cooking: false, sizzleId: null },
  ],
  plates: [
    { items: [] },
    { items: [] },
  ],
};

function init() {
  // Hearts
  renderHearts();
  // Orders UI
  addOrder();
  addOrder();
  renderOrders();

  // Pantry buttons -> spawn draggable items
  $$("#pantry .ing").forEach(btn => {
    btn.addEventListener("pointerdown", e => {
      const id = btn.dataset.id;
      startDragFrom(btn, ING[id]);
      sfx.pop.play();
    });
  });

  // Pan and plate dropzones
  $$(".pan-slot, .plate-slot").forEach(zone => {
    zone.addEventListener("pointerenter", () => zone.classList.add("drop-target"));
    zone.addEventListener("pointerleave", () => zone.classList.remove("drop-target"));
  });

  $("#btnServe").addEventListener("click", serveClosestMatch);
  $("#btnTrash").addEventListener("click", trashActivePlate);
  $("#btnPause").addEventListener("click", togglePause);
  $("#btnStart").addEventListener("click", () => {
    $("#overlay").classList.remove("show");
    startGame();
  });

  // Drag cancel on escape/back
  window.addEventListener("blur", endDrag);
  window.addEventListener("pointerup", endDrag);

  loop();
}

// GAME LOOP
let last = performance.now();
function loop(ts) {
  const now = ts || performance.now();
  const dt = Math.min(32, now - last) / 1000;
  last = now;

  if (state.running) {
    updateOrders(dt);
    updatePans(dt);
  }
  requestAnimationFrame(loop);
}

function startGame() {
  state.running = true;
  toast("Day " + state.day + " started!");
}

function togglePause() {
  state.running = !state.running;
  $("#btnPause").textContent = state.running ? "Pause" : "Resume";
  toast(state.running ? "Resumed" : "Paused");
}

function renderHearts() {
  const hearts = $("#hearts");
  hearts.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const iEl = document.createElement("i");
    if (i >= state.lives) iEl.classList.add("dead");
    hearts.appendChild(iEl);
  }
}

function addOrder() {
  const recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  state.orders.push({
    id: state.nextOrderId++,
    recipe,
    ttl: 28 - Math.min(12, state.day * 2), // seconds
    max: null,
  });
}

function renderOrders() {
  const container = $("#orders");
  container.innerHTML = "";
  state.orders.forEach(o => {
    const card = document.createElement("div");
    card.className = "order";
    card.dataset.id = o.id;

    const reqIcons = o.recipe.req.map(r => `<img src="${ING[r].img}" alt="${ING[r].name}" />`).join("");
    card.innerHTML = `
      <div class="row">
        <div class="customer">
          <img src="./customer.png" alt="" />
          <div>
            <strong>${o.recipe.name}</strong>
            <div style="font-size:11px;color:#b6d0bf">+$${o.recipe.price}</div>
          </div>
        </div>
        <div class="stars">
          <img src="./star.png" alt="" style="width:16px;height:16px;opacity:.9" />
        </div>
      </div>
      <div class="timer"><i style="width:100%"></i></div>
      <div class="req">${reqIcons}</div>
    `;
    container.appendChild(card);
    o.max = o.ttl;
  });
}

function updateOrders(dt) {
  // Spawn new orders periodically
  if (state.orders.length < 4 && Math.random() < dt * (0.25 + state.day * 0.05)) {
    addOrder();
    renderOrders();
    sfx.pop.play();
  }

  // Decrease timers
  state.orders.forEach(o => {
    o.ttl -= dt;
    const el = $(`.order[data-id="${o.id}"] .timer > i`);
    if (el) el.style.width = Math.max(0, Math.floor((o.ttl / o.max) * 100)) + "%";
  });

  // Remove failed
  const before = state.orders.length;
  state.orders = state.orders.filter(o => o.ttl > 0);
  if (state.orders.length !== before) {
    renderOrders();
    loseLife();
  }
}

function loseLife() {
  state.lives--;
  renderHearts();
  sfx.fail.play();
  if (state.lives <= 0) {
    gameOver();
  }
}

function gameOver() {
  state.running = false;
  $("#overlay").classList.add("show");
  $(".card").innerHTML = `
    <h1>Day ${state.day} Over</h1>
    <p>Your score: <strong>$${state.score}</strong></p>
    <button id="btnRestart" class="primary xl">Try Again</button>
  `;
  $("#btnRestart").addEventListener("click", () => {
    Object.assign(state, {
      day: 1, score: 0, lives: 3, orders: [], nextOrderId: 1, running: true,
      pans: [{items:[],heat:0,cooking:false,sizzleId:null},{items:[],heat:0,cooking:false,sizzleId:null}],
      plates: [{items:[]},{items:[]}]
    });
    renderHearts();
    addOrder(); addOrder();
    renderOrders();
    $("#overlay").classList.remove("show");
  });
}

// DRAG & DROP
function startDragFrom(sourceEl, ing) {
  state.drag = { ing, sourceEl, x: 0, y: 0 };
  const ghost = document.createElement("div");
  ghost.id = "drag-ghost";
  ghost.innerHTML = `<div class="item"><img src="${ing.img}" alt="${ing.name}"></div>`;
  $("#drag-layer").appendChild(ghost);

  const move = (e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    state.drag.x = x; state.drag.y = y;
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
  };

  const up = (e) => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    dropAt(state.drag.x, state.drag.y, ing);
    endDrag();
  };

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
}

function endDrag() {
  const ghost = $("#drag-ghost");
  if (ghost) ghost.remove();
  state.drag = null;
}

function dropAt(x, y, ing) {
  const el = document.elementFromPoint(x, y);
  if (!el) return;

  const zone = el.closest?.(".pan-slot, .plate-slot");
  if (!zone) return;

  const isPan = zone.classList.contains("pan-slot");
  const slot = Number(zone.dataset.slot);
  if (isPan) {
    addToPan(slot, ing);
  } else {
    addToPlate(slot, ing);
  }
}

function addToPan(idx, ing) {
  const pan = state.pans[idx];
  if (!ing.cook) {
    toast("No need to cook " + ing.name);
    sfx.pop.play();
    return;
  }
  if (pan.items.length >= 4) return toast("Pan is full!");
  pan.items.push({ ...ing, cookTime: 0, burnt: false });
  renderPan(idx);
  startCooking(idx);
}

function addToPlate(idx, ing) {
  const plate = state.plates[idx];
  if (plate.items.length >= 5) return toast("Plate is full!");
  plate.items.push({ ...ing, cooked: !ing.cook, fromPan: false });
  renderPlate(idx);
  sfx.pop.play();
}

function moveFromPanToPlate(panIdx, plateIdx) {
  const pan = state.pans[panIdx];
  const plate = state.plates[plateIdx];
  if (!pan.items.length) return toast("Nothing in pan");
  if (plate.items.length >= 5) return toast("Plate is full!");
  const item = pan.items.shift();
  item.cooked = item.cook ? item.cookTime >= 2 && item.cookTime < 6 && !item.burnt : true;
  if (item.burnt) {
    toast("Burnt! Might upset customers...");
  }
  item.fromPan = true;
  plate.items.push(item);
  renderPan(panIdx);
  renderPlate(plateIdx);
  sfx.pop.play();
}

function trashActivePlate() {
  const plateIdx = 0; // use first plate as active
  state.plates[plateIdx].items = [];
  renderPlate(plateIdx);
  toast("Cleared plate");
}

function serveClosestMatch() {
  // Use plate 0 as active serving plate
  const plate = state.plates[0];
  if (!plate.items.length) return toast("Nothing to serve");

  // Compile plate contents into set
  const contents = plate.items.map(i => i.id).sort();
  const cookedOk = plate.items.every(i => !ING[i.id]?.cook || i.cooked);

  // Find best order match by Jaccard + cooked constraint
  let best = null;
  state.orders.forEach(o => {
    const need = o.recipe.req.slice().sort();
    const inter = intersect(contents, need).length;
    const union = new Set([...contents, ...need]).size;
    const score = inter / union + (arraysEqual(contents, need) ? 0.25 : 0);
    if (!best || score > best.score) best = { o, score, exact: arraysEqual(contents, need) };
  });

  if (!best) return;

  if (best.exact && cookedOk) {
    const tip = Math.floor(Math.max(0, (best.o.ttl / best.o.max)) * 10);
    const payout = best.o.recipe.price + tip;
    state.score += payout;
    $("#score").textContent = state.score;
    toast(`Served ${best.o.recipe.name} +$${payout}`);
    sfx.serve.play(); sfx.success.play();
    // Remove order and clear plate
    state.orders = state.orders.filter(o => o.id !== best.o.id);
    renderOrders();
    plate.items = [];
    renderPlate(0);
    // Chance to spawn replacement quickly
    setTimeout(() => { if (state.running) { addOrder(); renderOrders(); } }, 600);
  } else {
    toast("Order mismatch or undercooked");
    sfx.fail.play();
    // Small penalty
    state.score = Math.max(0, state.score - 5);
    $("#score").textContent = state.score;
  }
}

function renderPan(idx) {
  const slot = $(`.pan-slot[data-slot="${idx}"]`);
  const contents = slot.querySelector(".pan-contents");
  contents.innerHTML = "";
  state.pans[idx].items.forEach(it => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<img src="${it.img}" alt="${it.name}"/>`;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = it.burnt ? "🔥" : formatCookBadge(it.cookTime);
    div.appendChild(badge);
    contents.appendChild(div);
  });
}

function renderPlate(idx) {
  const slot = $(`.plate-slot[data-slot="${idx}"]`);
  const contents = slot.querySelector(".plate-contents");
  contents.innerHTML = "";
  state.plates[idx].items.forEach(it => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<img src="${it.img}" alt="${it.name}"/>`;
    if (ING[it.id].cook) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = it.cooked ? "✓" : "⏳";
      div.appendChild(badge);
    }
    contents.appendChild(div);
  });
}

function startCooking(idx) {
  const pan = state.pans[idx];
  pan.cooking = true;
  updateHeatBar(idx);
  if (!pan.sizzleId) {
    pan.sizzleId = sfx.sizzle.play();
  }
}

function stopCookingIfEmpty(idx) {
  const pan = state.pans[idx];
  if (pan.items.length === 0) {
    pan.cooking = false;
    pan.heat = 0;
    updateHeatBar(idx);
    if (pan.sizzleId !== null) {
      sfx.sizzle.stop(pan.sizzleId);
      pan.sizzleId = null;
    }
  }
}

function updatePans(dt) {
  state.pans.forEach((pan, idx) => {
    if (!pan.cooking) return;
    pan.heat = Math.min(1, pan.heat + dt * 0.5);
    pan.items.forEach(it => {
      it.cookTime += dt * (0.8 + pan.heat * 0.6);
      if (it.cookTime > 8) it.burnt = true;
    });
    updateHeatBar(idx);
    renderPan(idx);
  });
}

function updateHeatBar(idx) {
  const el = $(`.pan-slot[data-slot="${idx}"] .heat::after`);
  // direct style on pseudo is not possible; instead target .heat element width via dataset
  const heat = state.pans[idx].heat;
  const bar = $(`.pan-slot[data-slot="${idx}"] .heat`);
  bar.style.setProperty("--w", Math.floor(heat * 100) + "%");
  // apply width to ::after using inline style trick:
  bar.querySelector(".w")?.remove();
  const w = document.createElement("i");
  w.className = "w";
  w.style.display = "block";
  w.style.height = "100%";
  w.style.width = Math.floor(heat * 100) + "%";
  w.style.background = "linear-gradient(90deg, #ffb36b, #ff6b6b)";
  bar.appendChild(w);
}

// UTIL
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove("show"), 1200);
}

function intersect(a, b) {
  const setB = new Set(b);
  return a.filter(x => setB.has(x));
}
function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function formatCookBadge(t) {
  if (t < 2) return "⏳";
  if (t < 6) return "✓";
  if (t < 8) return "⚠";
  return "🔥";
}

// Touch helpers: tap pan to move to plate 0, tap plate 0 to serve
function bindTapTransfers() {
  $$(".pan-slot").forEach(p => {
    p.addEventListener("click", () => {
      const idx = Number(p.dataset.slot);
      moveFromPanToPlate(idx, 0);
      stopCookingIfEmpty(idx);
    });
  });
  $$(".plate-slot").forEach(pl => {
    pl.addEventListener("dblclick", () => {
      if (Number(pl.dataset.slot) === 0) serveClosestMatch();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init();
  bindTapTransfers();
});

