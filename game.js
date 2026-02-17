/*
TUNING CONSTANTS
*/
const TUNE = {
  ends: 8,
  stonesPerTeam: 5,
  dt: 1 / 60,
  throwSpeed: 860,
  friction: 0.994,
  curl: 0.011,
  lateCurl: 1.2,
  stopSpeed: 2.4,
  sweepFrictionBoost: 0.003,
  sweepCurlCut: 0.52,
  wallDamp: 0.78,
  collisionDamp: 0.92,
  staminaMax: 100,
  staminaDrain: 28,
  staminaRegenIdle: 16,
  staminaRegenOpp: 24,
  aiNoise: 0.08,
};

const AI_TYPES = ['Draw Team', 'Guard & Freeze Team', 'Peelers', 'Aggressive Hitters', 'Stealers'];

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const sheet = { x: 95, y: 34, w: 360, h: 470 };
const house = { x: sheet.x + sheet.w / 2, y: sheet.y + 98, r4: 86, r8: 56, r12: 28, btn: 8 };
const hogY = sheet.y + sheet.h - 115;
const hackY = sheet.y + sheet.h - 30;

const el = {
  skillText: document.getElementById('skillText'),
  pScore: document.getElementById('pScore'),
  aScore: document.getElementById('aScore'),
  endText: document.getElementById('endText'),
  throwText: document.getElementById('throwText'),
  hammerText: document.getElementById('hammerText'),
  aiText: document.getElementById('aiText'),
  handleBtn: document.getElementById('handleBtn'),
  powerFill: document.getElementById('powerFill'),
  staminaFill: document.getElementById('staminaFill'),
  draftCards: document.getElementById('draftCards'),
  log: document.getElementById('log'),
  endSummary: document.getElementById('endSummary'),
  finalSummary: document.getElementById('finalSummary'),
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const SKILLS = [
  { id: 'sk1', name: 'Sweep Specialist', desc: 'Sweeping is stronger and drains less stamina.', apply: g => { g.mods.sweepCarry += 0.0012; g.mods.sweepCurl += 0.1; g.mods.sweepDrain *= 0.85; } },
  { id: 'sk2', name: 'Shotmaker', desc: 'Release spread reduced and power control improved.', apply: g => { g.mods.playerSpread *= 0.8; g.mods.powerControl += 0.12; } },
  { id: 'sk3', name: 'Endurance', desc: 'More stamina and faster regen.', apply: g => { g.mods.staminaMax += 30; g.mods.stamRegen += 8; } },
  { id: 'sk4', name: 'Stone Reader', desc: 'Better late-curl handling for player.', apply: g => { g.mods.latePenalty -= 0.15; } },
  { id: 'sk5', name: 'Hammer IQ', desc: 'Extra late-end value when you have hammer.', apply: g => { g.mods.hammerIQ += 0.3; } },
  { id: 'sk6', name: 'Hit Focus', desc: 'Slightly straighter high-weight shots.', apply: g => { g.mods.hitAssist += 0.08; } },
];

let G;
let bound = false;

function newGame() {
  return {
    end: 1,
    score: { p: 0, a: 0 },
    hammer: 'p',
    selectedSkill: null,
    aiType: AI_TYPES[Math.floor(Math.random() * AI_TYPES.length)],
    aiNoise: TUNE.aiNoise,
    state: 'draft',
    stones: [],
    moving: null,
    throwN: 0,
    pLeft: TUNE.stonesPerTeam,
    aLeft: TUNE.stonesPerTeam,
    input: { angle: -Math.PI / 2, handle: 1, charging: false, power: 0, sweep: false, stamina: TUNE.staminaMax },
    lastSnap: null,
    mods: {
      staminaMax: TUNE.staminaMax,
      sweepCarry: 0,
      sweepCurl: 0,
      sweepDrain: 1,
      sweepEff: 1,
      stamRegen: 0,
      playerSpread: 1,
      powerControl: 0,
      outBonus: 0,
      inBonus: 0,
      latePenalty: 0,
      hammerIQ: 0,
      hitAssist: 0,
    },
  };
}

function init() {
  G = newGame();
  bindUI();
  renderDraft();
  updateHUD();
}

function bindUI() {
  if (bound) return;
  bound = true;

  document.getElementById('nextEndBtn').onclick = () => {
    show('screenMatch');
    setupEnd();
  };
  document.getElementById('newGameBtn').onclick = () => {
    G = newGame();
    renderDraft();
    show('screenDraft');
    updateHUD();
  };

  el.handleBtn.onclick = () => {
    G.input.handle *= -1;
    el.handleBtn.textContent = `Handle: ${G.input.handle === 1 ? 'OUT' : 'IN'}`;
  };

  canvas.onmousemove = (e) => {
    if (G.state !== 'aim') return;
    const r = canvas.getBoundingClientRect();
    G.input.angle = Math.atan2((e.clientY - r.top) - hackY, (e.clientX - r.left) - house.x);
  };
  canvas.onmousedown = () => {
    if (G.state === 'aim') G.input.charging = true;
    if (G.state === 'move' && G.moving?.team === 'p') G.input.sweep = true;
  };
  canvas.onmouseup = () => {
    if (G.state === 'aim') throwPlayer();
    G.input.sweep = false;
  };

  window.onkeydown = (e) => {
    if (e.code === 'ArrowLeft' && G.state === 'aim') G.input.angle -= 0.03;
    if (e.code === 'ArrowRight' && G.state === 'aim') G.input.angle += 0.03;
    if (e.code === 'Enter' && G.state === 'aim') G.input.charging = true;
    if (e.code === 'Space') G.input.sweep = true;
  };
  window.onkeyup = (e) => {
    if (e.code === 'Enter' && G.state === 'aim' && G.input.charging) throwPlayer();
    if (e.code === 'Space') G.input.sweep = false;
  };
}

function renderDraft() {
  el.draftCards.innerHTML = '';
  const picks = shuffle([...SKILLS]).slice(0, 3);
  picks.forEach(s => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<b>${s.name}</b><p>${s.desc}</p>`;
    c.onclick = () => {
      G.selectedSkill = s;
      s.apply(G);
      G.input.stamina = G.mods.staminaMax;
      el.skillText.textContent = s.name;
      line(`Skill picked: ${s.name}`);
      show('screenMatch');
      setupEnd();
    };
    el.draftCards.appendChild(c);
  });
}

function setupEnd() {
  G.stones = [];
  G.moving = null;
  G.throwN = 0;
  G.pLeft = TUNE.stonesPerTeam;
  G.aLeft = TUNE.stonesPerTeam;
  G.input.power = 0;
  G.input.stamina = G.mods.staminaMax;
  G.aiType = AI_TYPES[Math.floor(Math.random() * AI_TYPES.length)];
  G.aiNoise = TUNE.aiNoise - (G.end >= 5 ? 0.015 : 0);
  G.state = G.hammer === 'p' ? 'aim' : 'ai';
  line(`End ${G.end} started. AI: ${G.aiType}`);
  if (G.state === 'ai') setTimeout(aiThrow, 300);
}

function throwPlayer() {
  G.input.charging = false;
  if (G.state !== 'aim' || G.pLeft <= 0) return;
  G.lastSnap = { stones: G.stones.map(s => ({ ...s })), throwN: G.throwN, pLeft: G.pLeft, aLeft: G.aLeft };

  const spread = 0.08 * G.mods.playerSpread;
  const bonus = G.input.handle === 1 ? G.mods.outBonus : G.mods.inBonus;
  let angle = G.input.angle + (Math.random() - .5) * (spread - bonus * 0.04);
  if (G.input.power > 0.7) angle += (Math.random() - .5) * G.mods.hitAssist;
  spawn('p', clamp(G.input.power, 0.15, 1), angle, G.input.handle);
  G.state = 'move';
}

function spawn(team, power, angle, handle) {
  const v = TUNE.throwSpeed * power * 0.63;
  const s = { team, x: house.x, y: hackY, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, r: 12, handle, moving: true, age: 0 };
  G.stones.push(s);
  G.moving = s;
  if (team === 'p') G.pLeft--; else G.aLeft--;
  G.throwN++;
}

function step() {
  if (G.state === 'draft') return;

  if (G.input.charging && G.state === 'aim') {
    G.input.power += TUNE.dt * (0.95 + G.mods.powerControl);
    if (G.input.power > 1) G.input.power = 0;
  }
  el.powerFill.style.width = `${Math.floor(G.input.power * 100)}%`;

  let moving = false;
  for (const s of G.stones) {
    if (!s.moving) continue;
    moving = true;
    s.age += TUNE.dt;

    const sp = Math.hypot(s.vx, s.vy);
    let fr = TUNE.friction;
    let curl = TUNE.curl * s.handle * (1 + (1 - clamp(sp / 360, 0, 1)) * (TUNE.lateCurl + G.mods.latePenalty));

    const pSweep = s === G.moving && s.team === 'p' && G.input.sweep && G.input.stamina > 0;
    const aSweep = s.team === 'a' && aiSweep(s);
    if (pSweep || aSweep) {
      fr += (TUNE.sweepFrictionBoost + G.mods.sweepCarry) * G.mods.sweepEff;
      curl *= (1 - (TUNE.sweepCurlCut + G.mods.sweepCurl));
      if (pSweep) G.input.stamina = clamp(G.input.stamina - TUNE.staminaDrain * G.mods.sweepDrain * TUNE.dt, 0, G.mods.staminaMax);
    }

    const dx = s.vx / (sp || 1), dy = s.vy / (sp || 1);
    s.vx *= fr; s.vy *= fr;
    s.vx += -dy * curl * sp * TUNE.dt * 60;
    s.vy += dx * curl * sp * TUNE.dt * 60;
    s.x += s.vx * TUNE.dt;
    s.y += s.vy * TUNE.dt;

    if (s.x < sheet.x + s.r || s.x > sheet.x + sheet.w - s.r) { s.vx *= -TUNE.wallDamp; s.x = clamp(s.x, sheet.x + s.r, sheet.x + sheet.w - s.r); }
    if (s.y < sheet.y + s.r || s.y > sheet.y + sheet.h - s.r) { s.vy *= -TUNE.wallDamp; s.y = clamp(s.y, sheet.y + s.r, sheet.y + sheet.h - s.r); }

    if (Math.hypot(s.vx, s.vy) < TUNE.stopSpeed) { s.vx = 0; s.vy = 0; s.moving = false; }
  }

  for (let i = 0; i < G.stones.length; i++) for (let j = i + 1; j < G.stones.length; j++) collide(G.stones[i], G.stones[j]);

  if (!moving && G.state === 'move') onStop();

  if (!G.input.sweep && G.state === 'move' && G.moving?.team === 'p') G.input.stamina = clamp(G.input.stamina + (TUNE.staminaRegenIdle + G.mods.stamRegen) * TUNE.dt, 0, G.mods.staminaMax);
  if (G.state === 'ai' || (G.state === 'move' && G.moving?.team === 'a')) G.input.stamina = clamp(G.input.stamina + TUNE.staminaRegenOpp * TUNE.dt, 0, G.mods.staminaMax);
  el.staminaFill.style.width = `${Math.floor((G.input.stamina / G.mods.staminaMax) * 100)}%`;
}

function aiSweep(s) {
  let k = 0.56;
  if (G.aiType === 'Draw Team' && s.age > 0.8) k += 0.15;
  if (G.aiType === 'Guard & Freeze Team' && s.age < 0.8) k += 0.13;
  if (G.aiType === 'Aggressive Hitters') k -= 0.06;
  return Math.random() < clamp(k, 0.1, 0.95);
}

function collide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
  if (d <= 0 || d >= m) return;
  const nx = dx / d, ny = dy / d, ov = (m - d) / 2;
  a.x -= nx * ov; a.y -= ny * ov;
  b.x += nx * ov; b.y += ny * ov;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
  if (vn > 0) return;
  const j = -(1 + TUNE.collisionDamp) * vn / 2;
  a.vx -= j * nx; a.vy -= j * ny;
  b.vx += j * nx; b.vy += j * ny;
  a.moving = b.moving = true;
}

function onStop() {
  G.moving = null;
  if (G.throwN >= TUNE.stonesPerTeam * 2) return scoreEnd();
  const playerTurn = G.throwN % 2 === 0;
  if (playerTurn && G.pLeft > 0) G.state = 'aim';
  else if (!playerTurn && G.aLeft > 0) { G.state = 'ai'; setTimeout(aiThrow, 300); }
  else G.state = playerTurn ? 'ai' : 'aim';
}

function aiThrow() {
  if (G.state !== 'ai' || G.aLeft <= 0) return;
  const cands = aiCandidates();
  let best = cands[0], bestScore = -1e9;
  for (const c of cands) {
    const board = sim(c);
    const sc = evalBoard(board, c);
    if (sc > bestScore) { best = c; bestScore = sc; }
  }
  if (Math.random() < 0.13) best = cands[Math.floor(Math.random() * cands.length)];
  spawn('a', best.power, best.angle, best.handle);
  G.state = 'move';
}

function aiCandidates() {
  const arr = [];
  const add = (type, x, y, p) => arr.push({ type, angle: Math.atan2(y - hackY, x - house.x), power: clamp(p, .22, 1), handle: Math.random() < .5 ? 1 : -1 });
  const mine = G.stones.filter(s => s.team === 'a');
  const opp = G.stones.filter(s => s.team === 'p');

  for (let i = 0; i < 8; i++) add('draw', house.x + (Math.random() - .5) * 45, house.y + (Math.random() - .5) * 45, .5 + Math.random() * .15);
  for (let i = 0; i < 4; i++) add('guard', house.x + (Math.random() - .5) * 95, hogY - 25 - Math.random() * 35, .38 + Math.random() * .1);
  for (const t of opp.slice(0, 4)) add('hit', t.x, t.y, .64 + Math.random() * .2);
  if (mine.length) for (const t of mine.slice(0, 2)) add('freeze', t.x + (Math.random() - .5) * 12, t.y + 14, .5 + Math.random() * .1);
  if (G.aiType === 'Peelers') for (const t of opp.slice(0, 4)) add('peel', t.x, t.y, .78 + Math.random() * .14);
  if (G.aiType === 'Aggressive Hitters') for (const t of opp.slice(0, 4)) add('blast', t.x, t.y, .8 + Math.random() * .14);
  if (G.aiType === 'Stealers' && G.hammer === 'p') for (let i = 0; i < 3; i++) add('steal', house.x + (Math.random() - .5) * 60, hogY - 30 - Math.random() * 30, .42 + Math.random() * .08);
  return arr.slice(0, 20);
}

function sim(c) {
  const st = G.stones.map(s => ({ ...s }));
  const angle = c.angle + (Math.random() - .5) * (G.aiNoise + .02);
  const power = c.power + (Math.random() - .5) * G.aiNoise;
  st.push({ team: 'a', x: house.x, y: hackY, vx: Math.cos(angle) * TUNE.throwSpeed * power * .6, vy: Math.sin(angle) * TUNE.throwSpeed * power * .6, r: 12, handle: c.handle, moving: true, age: 0 });

  for (let n = 0; n < 260; n++) {
    let m = false;
    for (const s of st) {
      if (!s.moving) continue;
      m = true;
      const sp = Math.hypot(s.vx, s.vy);
      const fr = TUNE.friction;
      const curl = TUNE.curl * s.handle * (1 + (1 - clamp(sp / 360, 0, 1)) * TUNE.lateCurl);
      const dx = s.vx / (sp || 1), dy = s.vy / (sp || 1);
      s.vx *= fr; s.vy *= fr;
      s.vx += -dy * curl * sp * .016 * 60;
      s.vy += dx * curl * sp * .016 * 60;
      s.x += s.vx * .016; s.y += s.vy * .016;
      if (Math.hypot(s.vx, s.vy) < 3) s.moving = false;
    }
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) collide(st[i], st[j]);
    if (!m) break;
  }
  return st;
}

function evalBoard(st, c) {
  const own = st.filter(s => s.team === 'a' && inHouse(s));
  const opp = st.filter(s => s.team === 'p' && inHouse(s));
  let score = 0;
  for (const s of own) score += 120 - dist(s, house);
  for (const s of opp) score -= 130 - dist(s, house);
  const guards = st.filter(s => s.team === 'a' && Math.abs(s.x - house.x) < 80 && s.y > house.y + 40 && s.y < hogY + 20).length;
  score += guards * 14;
  if (G.hammer === 'a' && G.aLeft <= 1) score += own.length * 15;
  if (G.aiType === 'Draw Team' && c.type === 'draw') score += 22;
  if (G.aiType === 'Guard & Freeze Team' && (c.type === 'guard' || c.type === 'freeze')) score += 22;
  if (G.aiType === 'Peelers' && (c.type === 'peel' || c.type === 'hit')) score += 24;
  if (G.aiType === 'Aggressive Hitters' && (c.type === 'blast' || c.type === 'hit')) score += 25;
  if (G.aiType === 'Stealers' && c.type === 'steal') score += 24;
  return score + (Math.random() - .5) * 8;
}

function inHouse(s) { return dist(s, house) <= house.r4; }

function scoreEnd() {
  const p = G.stones.filter(s => s.team === 'p' && inHouse(s)).sort((a, b) => dist(a, house) - dist(b, house));
  const a = G.stones.filter(s => s.team === 'a' && inHouse(s)).sort((a, b) => dist(a, house) - dist(b, house));
  const p0 = p[0] ? dist(p[0], house) : Infinity;
  const a0 = a[0] ? dist(a[0], house) : Infinity;

  let winner = 'Blank', points = 0;
  if (p0 < a0) {
    winner = 'You';
    for (const s of p) if (dist(s, house) < a0) points++;
    G.score.p += points;
    G.hammer = 'a';
  } else if (a0 < p0) {
    winner = 'AI';
    for (const s of a) if (dist(s, house) < p0) points++;
    G.score.a += points;
    G.hammer = 'p';
  }

  line(`End ${G.end}: ${winner}${winner !== 'Blank' ? ` scores ${points}` : ''}. Throws ${G.throwN}/10`);
  el.endSummary.textContent = `End ${G.end}: ${winner}${winner !== 'Blank' ? ` scores ${points}` : ''}.`;

  if (G.end >= TUNE.ends) return finishGame();
  G.end++;
  show('screenEnd');
}

function finishGame() {
  const won = G.score.p > G.score.a;
  el.finalSummary.textContent = `Skill: ${G.selectedSkill?.name || '-'}\nFinal Score: You ${G.score.p} - ${G.score.a} AI\n${won ? 'YOU WIN' : 'YOU LOSE'}\nMode: Normal Curling`;
  show('screenFinal');
}

function updateHUD() {
  el.pScore.textContent = G.score.p;
  el.aScore.textContent = G.score.a;
  el.endText.textContent = G.end;
  el.throwText.textContent = `${G.throwN + 1} / ${TUNE.stonesPerTeam * 2}`;
  el.hammerText.textContent = G.hammer === 'p' ? 'You' : 'AI';
  el.aiText.textContent = G.aiType;
}

function line(msg) {
  const d = document.createElement('div');
  d.className = 'logline';
  d.textContent = `> ${msg}`;
  el.log.prepend(d);
  while (el.log.children.length > 24) el.log.lastChild.remove();
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  document.getElementById(id).classList.add('active');
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw() {
  if (G.state === 'draft') return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ecf8ff';
  ctx.fillRect(sheet.x, sheet.y, sheet.w, sheet.h);
  ctx.strokeStyle = '#88a';
  ctx.strokeRect(sheet.x, sheet.y, sheet.w, sheet.h);

  ctx.strokeStyle = '#7aa';
  ctx.beginPath();
  ctx.moveTo(sheet.x, hogY);
  ctx.lineTo(sheet.x + sheet.w, hogY);
  ctx.stroke();

  [[house.r4, '#4af'], [house.r8, '#fff'], [house.r12, '#f66'], [house.btn, '#fff']].forEach(([r, c]) => {
    ctx.beginPath();
    ctx.arc(house.x, house.y, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });

  if (G.state === 'aim') {
    ctx.strokeStyle = '#0b5';
    ctx.beginPath();
    ctx.moveTo(house.x, hackY);
    ctx.lineTo(house.x + Math.cos(G.input.angle) * 170, hackY + Math.sin(G.input.angle) * 170);
    ctx.stroke();
  }

  for (const s of G.stones) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.team === 'p' ? '#c33' : '#ff0';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.stroke();
  }
}

function loop() {
  step();
  draw();
  updateHUD();
  if (G.state === 'aim' && G.throwN % 2 === 1) { G.state = 'ai'; setTimeout(aiThrow, 300); }
  requestAnimationFrame(loop);
}

init();
loop();
