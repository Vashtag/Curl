/*
TUNING CONSTANTS
*/
const CFG = {
  ends: 6,
  stonesPerTeam: 5,
  dt: 1 / 60,
  throwSpeed: 860,
  friction: 0.994,
  curl: 0.011,
  lateCurl: 1.15,
  stopSpeed: 2.5,
  sweepFrictionBoost: 0.003,
  sweepCurlCut: 0.5,
  sweepDrain: 30,
  staminaMax: 100,
  staminaRegenIdle: 17,
  staminaRegenOpp: 24,
  wallDamp: 0.78,
  hitDamp: 0.93,
};

const AI_TYPES = ['Draw Team', 'Guard & Freeze Team', 'Peelers', 'Aggressive Hitters', 'Stealers'];
const NODE_TYPES = ['Normal', 'Elite', 'Shop', 'Event'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mulberry32(seed) { return () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const sheet = { x: 90, y: 36, w: 360, h: 448 };
const house = { x: sheet.x + sheet.w / 2, y: sheet.y + 95, r4: 86, r8: 56, r12: 28, btn: 8 };
const hogY = sheet.y + sheet.h - 108;
const hackY = sheet.y + sheet.h - 28;

const el = {
  seedText: document.getElementById('seedText'), copySeedBtn: document.getElementById('copySeedBtn'), creditsText: document.getElementById('creditsText'),
  endText: document.getElementById('endText'), throwText: document.getElementById('throwText'), pScore: document.getElementById('pScore'), aScore: document.getElementById('aScore'), hammerText: document.getElementById('hammerText'), aiStyleText: document.getElementById('aiStyleText'),
  handleBtn: document.getElementById('handleBtn'), powerFill: document.getElementById('powerFill'), staminaFill: document.getElementById('staminaFill'),
  nodeMap: document.getElementById('nodeMap'), log: document.getElementById('log'),
  rewardCards: document.getElementById('rewardCards'), shopCards: document.getElementById('shopCards'), eventText: document.getElementById('eventText'), eventCards: document.getElementById('eventCards'),
  endSummary: document.getElementById('endSummary'), runSummary: document.getElementById('runSummary')
};

const upgrades = buildUpgrades();
const curses = buildCurses();
const events = buildEvents();
let g;
let bound = false;

function buildUpgrades() {
  const a = [];
  const add = (id, name, r, b, d, fx) => a.push({ id, name, rarity: r, bucket: b, desc: d, apply: fx });
  // Sweep Tech 10
  add('sw1', 'Broom Grip', 'common', 'Sweep Tech', '+10 stamina', s => s.mods.staminaMax += 10);
  add('sw2', 'Cleaner Line', 'common', 'Sweep Tech', 'Sweeping straightens more', s => s.mods.sweepCurl += 0.05);
  add('sw3', 'Long Brush', 'common', 'Sweep Tech', 'Sweeping adds carry', s => s.mods.sweepCarry += 0.0007);
  add('sw4', 'Breathing Drill', 'common', 'Sweep Tech', '+8 stamina regen', s => s.mods.stamRegen += 8);
  add('sw5', 'Switch Rhythm', 'uncommon', 'Sweep Tech', 'Sweeping drains less', s => s.mods.sweepDrain *= 0.9);
  add('sw6', 'Split Step', 'uncommon', 'Sweep Tech', 'Sweeping efficiency +20%', s => s.mods.sweepEff *= 1.2);
  add('sw7', 'Hardline Head', 'uncommon', 'Sweep Tech', 'Carry ++', s => s.mods.sweepCarry += 0.0013);
  add('sw8', 'Pulse Reader', 'rare', 'Sweep Tech', 'Huge curl reduction on sweep', s => s.mods.sweepCurl += 0.13);
  add('sw9', 'Elite Cardio', 'rare', 'Sweep Tech', '+30 stamina', s => s.mods.staminaMax += 30);
  add('sw10', 'Nano Pad', 'rare', 'Sweep Tech', 'Carry +++', s => s.mods.sweepCarry += 0.002);
  // Shotbook 10
  add('sh1', 'Draw Notes', 'common', 'Shotbook', 'Draw accuracy +', s => s.mods.drawAcc += 0.06);
  add('sh2', 'Hit Notes', 'common', 'Shotbook', 'Hit accuracy +', s => s.mods.hitAcc += 0.06);
  add('sh3', 'Guard Notes', 'common', 'Shotbook', 'Guard accuracy +', s => s.mods.guardAcc += 0.06);
  add('sh4', 'Freeze Notes', 'uncommon', 'Shotbook', 'Freeze accuracy +', s => s.mods.freezeAcc += 0.08);
  add('sh5', 'Raise Notes', 'uncommon', 'Shotbook', 'Raise accuracy +', s => s.mods.raiseAcc += 0.08);
  add('sh6', 'Release Cue', 'common', 'Shotbook', 'Player spread -', s => s.mods.playerSpread *= 0.9);
  add('sh7', 'Weight Feel', 'uncommon', 'Shotbook', 'Power control +', s => s.mods.powerControl += 0.1);
  add('sh8', 'Out-turn Prep', 'common', 'Shotbook', 'Out-turn bonus', s => s.mods.outBonus += 0.05);
  add('sh9', 'In-turn Prep', 'common', 'Shotbook', 'In-turn bonus', s => s.mods.inBonus += 0.05);
  add('sh10', 'Skip Bible', 'rare', 'Shotbook', 'All shot acc +', s => { s.mods.drawAcc += .05; s.mods.hitAcc += .05; s.mods.guardAcc += .05; s.mods.freezeAcc += .05; });
  // Intel 10 (no ice conditions)
  add('in1', 'Path Ghost', 'common', 'Intel', 'Predicted path on', s => s.mods.pred = 1);
  add('in2', 'Path Ghost+', 'uncommon', 'Intel', 'Longer predicted path', s => s.mods.pred = 2);
  add('in3', 'Skip Scout', 'common', 'Intel', 'AI hint line in log', s => s.mods.scout += 1);
  add('in4', 'Replay Chip', 'uncommon', 'Intel', '1 rewind each end', s => s.mods.rewinds = 1);
  add('in5', 'Wallet Hook', 'common', 'Intel', '+25 credits now', s => s.credits += 25);
  add('in6', 'Budget Sheet', 'common', 'Intel', 'Shop costs -10%', s => s.mods.shopCost *= 0.9);
  add('in7', 'Hammer Logic', 'uncommon', 'Intel', 'Score eval with hammer +', s => s.mods.hammerIQ += 0.2);
  add('in8', 'Sabotage Clip', 'uncommon', 'Intel', 'AI noise +', s => s.mods.aiNoise += 0.02);
  add('in9', 'Elite Tape', 'rare', 'Intel', 'Elite bonus rewards +', s => s.mods.eliteBonus += 0.2);
  add('in10', 'Banker Friend', 'rare', 'Intel', '+60 credits now', s => s.credits += 60);
  return a;
}

function buildCurses() {
  return [
    ['c1', 'Lead Boots', s => s.mods.staminaMax -= 20],
    ['c2', 'Blunt Brush', s => s.mods.sweepEff *= 0.8],
    ['c3', 'Nervous Skip', s => s.mods.playerSpread *= 1.25],
    ['c4', 'Heavy Stone', s => s.mods.baseFriction -= 0.001],
    ['c5', 'Cold Fingers', s => s.mods.sweepDrain *= 1.3],
    ['c6', 'Muddled Calls', s => s.mods.drawAcc -= 0.05],
    ['c7', 'Late Panic', s => s.mods.lateCurlPenalty += 0.2],
    ['c8', 'Loose Handle', s => s.mods.handleDrift += 0.07],
    ['c9', 'Thin Purse', s => s.mods.shopCost *= 1.2],
    ['c10', 'Bad Tape', s => s.mods.aiNoise -= 0.02],
  ].map(([id, name, apply]) => ({ id, name, apply }));
}

function buildEvents() {
  return [
    {
      t: 'Prototype Brush', d: 'Risky tech from a traveling rep.',
      c: [
        { l: 'Buy (40) rare sweep', e: s => { if (s.credits >= 40) { s.credits -= 40; grant('sw8'); } } },
        { l: 'Take free + curse', e: s => { grant('sw8'); addCurse(); } },
        { l: 'Leave (+10 credits)', e: s => s.credits += 10 }
      ]
    },
    {
      t: 'Archive Room', d: 'Tape library of old champions.',
      c: [
        { l: 'Study Shotbook', e: _ => grantRnd('Shotbook') },
        { l: 'Study Intel', e: _ => grantRnd('Intel') },
        { l: 'Binge (2 upgrades + curse)', e: _ => { grantRnd('Shotbook'); grantRnd('Intel'); addCurse(); } }
      ]
    },
    {
      t: 'Sponsorship Call', d: 'Offer money if you accept pressure.',
      c: [
        { l: '+70 credits + curse', e: s => { s.credits += 70; addCurse(); } },
        { l: '+35 credits clean', e: s => s.credits += 35 },
        { l: 'Decline', e: _ => 0 }
      ]
    }
  ];
}

function newGame(seed) {
  const str = seed || String(Math.floor(Math.random() * 1e9));
  const n = [...str].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = mulberry32(n);
  const nodes = Array.from({ length: CFG.ends }, (_, i) => i ? NODE_TYPES[Math.floor(rng() * NODE_TYPES.length)] : 'Normal');
  nodes[2] = 'Elite'; nodes[CFG.ends - 1] = 'Elite';
  return {
    seed: str, rng, nodes, end: 1, nodeI: 0,
    score: { p: 0, a: 0 }, credits: 40, hammer: 'p',
    stones: [], moving: null, throwN: 0, pLeft: CFG.stonesPerTeam, aLeft: CFG.stonesPerTeam,
    state: 'aim', ai: { type: AI_TYPES[Math.floor(rng() * AI_TYPES.length)], noise: 0.08, sweep: 0.56 },
    input: { ang: -Math.PI / 2, handle: 1, charge: false, power: 0, sweep: false, stamina: CFG.staminaMax },
    up: [], curses: [], rewindsLeft: 0, lastSnap: null,
    mods: { staminaMax: CFG.staminaMax, sweepCurl: 0, sweepCarry: 0, stamRegen: 0, sweepDrain: 1, sweepEff: 1, drawAcc: 0, hitAcc: 0, guardAcc: 0, freezeAcc: 0, raiseAcc: 0, playerSpread: 1, powerControl: 0, outBonus: 0, inBonus: 0, pred: 0, scout: 0, rewinds: 0, shopCost: 1, hammerIQ: 0, aiNoise: 0, eliteBonus: 0, lateCurlPenalty: 0, handleDrift: 0, baseFriction: 0 }
  };
}

function start(seed) {
  g = newGame(seed);
  bind();
  resetEnd();
  updateHUD();
  mapRender();
  show('screenMatch');
  if (g.state === 'ai') setTimeout(aiThrow, 260);
}

function bind() {
  if (bound) return;
  bound = true;
  el.copySeedBtn.onclick = () => navigator.clipboard?.writeText(g.seed);
  el.handleBtn.onclick = () => { g.input.handle *= -1; el.handleBtn.textContent = `Handle: ${g.input.handle === 1 ? 'OUT' : 'IN'}`; };
  document.getElementById('endBtn').onclick = afterEnd;
  document.getElementById('shopDoneBtn').onclick = () => rewardScreen();
  document.getElementById('newRunBtn').onclick = () => { bound = false; start(); };

  canvas.onmousemove = e => { if (g.state !== 'aim') return; const r = canvas.getBoundingClientRect(); g.input.ang = Math.atan2((e.clientY - r.top) - hackY, (e.clientX - r.left) - house.x); };
  canvas.onmousedown = () => { if (g.state === 'aim') g.input.charge = true; if (g.state === 'move' && g.moving?.team === 'p') g.input.sweep = true; };
  canvas.onmouseup = () => { if (g.state === 'aim') throwPlayer(); g.input.sweep = false; };

  window.onkeydown = e => {
    if (e.code === 'ArrowLeft' && g.state === 'aim') g.input.ang -= 0.03;
    if (e.code === 'ArrowRight' && g.state === 'aim') g.input.ang += 0.03;
    if (e.code === 'Enter' && g.state === 'aim') g.input.charge = true;
    if (e.code === 'Space') g.input.sweep = true;
    if (e.code === 'KeyR' && g.state === 'aim' && g.rewindsLeft > 0 && g.lastSnap) rewind();
  };
  window.onkeyup = e => {
    if (e.code === 'Enter' && g.state === 'aim' && g.input.charge) throwPlayer();
    if (e.code === 'Space') g.input.sweep = false;
  };
}

function resetEnd() {
  g.stones = []; g.moving = null; g.throwN = 0; g.pLeft = CFG.stonesPerTeam; g.aLeft = CFG.stonesPerTeam;
  g.input.stamina = g.mods.staminaMax; g.rewindsLeft = g.mods.rewinds; g.state = g.hammer === 'p' ? 'aim' : 'ai';
  const elite = g.nodes[g.nodeI] === 'Elite';
  g.ai.type = AI_TYPES[Math.floor(g.rng() * AI_TYPES.length)];
  g.ai.noise = Math.max(0.015, 0.085 - (elite ? 0.035 : 0) - g.mods.aiNoise);
  g.ai.sweep = 0.55 + (elite ? 0.2 : 0);
  line(`End ${g.end} // ${g.nodes[g.nodeI]} // AI ${g.ai.type}`);
  if (g.mods.scout) line(`Scout: ${g.ai.type} likes ${g.ai.type.includes('Hit') || g.ai.type === 'Peelers' ? 'contact' : 'draw control'}.`);
}

function throwPlayer() {
  g.input.charge = false;
  if (g.state !== 'aim' || g.pLeft <= 0) return;
  const spread = 0.08 * g.mods.playerSpread;
  const handleBias = g.input.handle === 1 ? g.mods.outBonus : g.mods.inBonus;
  const ang = g.input.ang + (g.rng() - .5) * (spread - handleBias * 0.04) + g.mods.handleDrift * (g.rng() - .5);
  g.lastSnap = {
    stones: g.stones.map(s => ({ ...s })),
    throwN: g.throwN,
    pLeft: g.pLeft,
    aLeft: g.aLeft,
    state: g.state
  };
  spawn('p', clamp(g.input.power, .15, 1), ang, g.input.handle);
  g.state = 'move';
}

function spawn(team, p, ang, handle) {
  const v = CFG.throwSpeed * p * .63;
  const s = { team, x: house.x, y: hackY, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: 12, handle, moving: true, age: 0 };
  g.stones.push(s); g.moving = s;
  if (team === 'p') g.pLeft--; else g.aLeft--;
  g.throwN++;
}

function step() {
  if (g.input.charge && g.state === 'aim') {
    g.input.power += CFG.dt * (.95 + g.mods.powerControl);
    if (g.input.power > 1) g.input.power = 0;
  }
  el.powerFill.style.width = `${Math.floor(g.input.power * 100)}%`;

  let moving = false;
  for (const s of g.stones) {
    if (!s.moving) continue;
    moving = true; s.age += CFG.dt;
    const sp = Math.hypot(s.vx, s.vy);
    let fr = CFG.friction + g.mods.baseFriction;
    let curl = CFG.curl * s.handle * (1 + (1 - clamp(sp / 360, 0, 1)) * (CFG.lateCurl + g.mods.lateCurlPenalty));

    const pSweep = s === g.moving && s.team === 'p' && g.input.sweep && g.input.stamina > 0;
    const aSweep = s.team === 'a' && aiSweep(s);
    if (pSweep || aSweep) {
      fr += (CFG.sweepFrictionBoost + g.mods.sweepCarry) * g.mods.sweepEff;
      curl *= (1 - (CFG.sweepCurlCut + g.mods.sweepCurl));
      if (pSweep) g.input.stamina = clamp(g.input.stamina - CFG.sweepDrain * g.mods.sweepDrain * CFG.dt, 0, g.mods.staminaMax);
    }

    const dx = s.vx / (sp || 1), dy = s.vy / (sp || 1);
    s.vx *= fr; s.vy *= fr;
    s.vx += -dy * curl * sp * CFG.dt * 60;
    s.vy += dx * curl * sp * CFG.dt * 60;
    s.x += s.vx * CFG.dt; s.y += s.vy * CFG.dt;

    if (s.x < sheet.x + s.r || s.x > sheet.x + sheet.w - s.r) { s.vx *= -CFG.wallDamp; s.x = clamp(s.x, sheet.x + s.r, sheet.x + sheet.w - s.r); }
    if (s.y < sheet.y + s.r || s.y > sheet.y + sheet.h - s.r) { s.vy *= -CFG.wallDamp; s.y = clamp(s.y, sheet.y + s.r, sheet.y + sheet.h - s.r); }
    if (Math.hypot(s.vx, s.vy) < CFG.stopSpeed) { s.vx = 0; s.vy = 0; s.moving = false; }
  }

  for (let i = 0; i < g.stones.length; i++) for (let j = i + 1; j < g.stones.length; j++) collide(g.stones[i], g.stones[j]);
  if (!moving && g.state === 'move') stopped();

  if (!g.input.sweep && g.state === 'move' && g.moving?.team === 'p') g.input.stamina = clamp(g.input.stamina + (CFG.staminaRegenIdle + g.mods.stamRegen) * CFG.dt, 0, g.mods.staminaMax);
  if (g.state === 'ai' || (g.state === 'move' && g.moving?.team === 'a')) g.input.stamina = clamp(g.input.stamina + CFG.staminaRegenOpp * CFG.dt, 0, g.mods.staminaMax);
  el.staminaFill.style.width = `${Math.floor(g.input.stamina / g.mods.staminaMax * 100)}%`;
}

function aiSweep(s) {
  let k = g.ai.sweep;
  if (g.ai.type === 'Draw Team' && s.age > .8) k += .14;
  if (g.ai.type === 'Guard & Freeze Team' && s.age < .8) k += .13;
  if (g.ai.type === 'Aggressive Hitters') k -= .07;
  return g.rng() < clamp(k, .1, .95);
}

function collide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
  if (d <= 0 || d >= m) return;
  const nx = dx / d, ny = dy / d, ov = (m - d) / 2;
  a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
  if (vn > 0) return;
  const j = -(1 + CFG.hitDamp) * vn / 2;
  a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
  a.moving = b.moving = true;
}

function stopped() {
  g.moving = null;
  if (g.throwN >= CFG.stonesPerTeam * 2) return scoreEnd();
  if (turnPlayer() && g.pLeft > 0) g.state = 'aim';
  else if (!turnPlayer() && g.aLeft > 0) { g.state = 'ai'; setTimeout(aiThrow, 260); }
  else g.state = turnPlayer() ? 'ai' : 'aim';
}

function turnPlayer() { return g.throwN % 2 === 0; }

function aiThrow() {
  const options = aiCandidates();
  let best = options[0], bestScore = -1e9;
  for (const o of options) {
    const board = sim(o);
    const sc = evalBoard(board, o);
    if (sc > bestScore) { bestScore = sc; best = o; }
  }
  if (g.rng() < 0.13) best = options[Math.floor(g.rng() * options.length)];
  spawn('a', best.power, best.ang, best.handle); g.state = 'move';
}

function aiCandidates() {
  const arr = [];
  const add = (type, x, y, p) => arr.push({ type, ang: Math.atan2(y - hackY, x - house.x), power: clamp(p, .25, 1), handle: g.rng() < .5 ? 1 : -1 });
  const mine = g.stones.filter(s => s.team === 'a');
  const opp = g.stones.filter(s => s.team === 'p');
  for (let i = 0; i < 8; i++) add('draw', house.x + (g.rng() - .5) * 40, house.y + (g.rng() - .5) * 40, .5 + g.rng() * .14);
  for (let i = 0; i < 4; i++) add('guard', house.x + (g.rng() - .5) * 95, hogY - 20 - g.rng() * 35, .38 + g.rng() * .1);
  for (const t of opp.slice(0, 4)) add('hit', t.x, t.y, .65 + g.rng() * .2);
  if (mine.length) for (const t of mine.slice(0, 2)) add('freeze', t.x + (g.rng() - .5) * 12, t.y + 15, .5 + g.rng() * .1);
  if (g.ai.type === 'Peelers') for (const t of opp.slice(0, 4)) add('peel', t.x, t.y, .78 + g.rng() * .15);
  if (g.ai.type === 'Aggressive Hitters') for (const t of opp.slice(0, 4)) add('blast', t.x, t.y, .82 + g.rng() * .14);
  if (g.ai.type === 'Stealers' && g.hammer === 'p') for (let i = 0; i < 3; i++) add('steal', house.x + (g.rng() - .5) * 60, hogY - 35 - g.rng() * 35, .42 + g.rng() * .08);
  return arr.slice(0, 20);
}

function sim(c) {
  const stones = g.stones.map(s => ({ ...s }));
  const ang = c.ang + (g.rng() - .5) * (g.ai.noise + 0.02);
  const p = c.power + (g.rng() - .5) * g.ai.noise;
  stones.push({ team: 'a', x: house.x, y: hackY, vx: Math.cos(ang) * CFG.throwSpeed * p * .6, vy: Math.sin(ang) * CFG.throwSpeed * p * .6, r: 12, handle: c.handle, moving: true, age: 0 });
  for (let st = 0; st < 260; st++) {
    let m = false;
    for (const s of stones) {
      if (!s.moving) continue; m = true;
      const sp = Math.hypot(s.vx, s.vy);
      const fr = CFG.friction;
      const curl = CFG.curl * s.handle * (1 + (1 - clamp(sp / 360, 0, 1)) * CFG.lateCurl);
      const dx = s.vx / (sp || 1), dy = s.vy / (sp || 1);
      s.vx *= fr; s.vy *= fr; s.vx += -dy * curl * sp * .016 * 60; s.vy += dx * curl * sp * .016 * 60;
      s.x += s.vx * .016; s.y += s.vy * .016;
      if (Math.hypot(s.vx, s.vy) < 3) s.moving = false;
    }
    for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) collide(stones[i], stones[j]);
    if (!m) break;
  }
  return stones;
}

function evalBoard(stones, c) {
  const own = stones.filter(s => s.team === 'a' && inHouse(s));
  const opp = stones.filter(s => s.team === 'p' && inHouse(s));
  let score = 0;
  for (const s of own) score += 120 - dist(s, house);
  for (const s of opp) score -= 130 - dist(s, house);
  const guards = stones.filter(s => s.team === 'a' && Math.abs(s.x - house.x) < 80 && s.y > house.y + 45 && s.y < hogY + 20).length;
  score += guards * 14;
  if (g.hammer === 'a' && g.aLeft <= 1) score += own.length * (15 + g.mods.hammerIQ * 8);
  if (g.ai.type === 'Draw Team' && c.type === 'draw') score += 22;
  if (g.ai.type === 'Guard & Freeze Team' && (c.type === 'guard' || c.type === 'freeze')) score += 22;
  if (g.ai.type === 'Peelers' && (c.type === 'hit' || c.type === 'peel')) score += 24;
  if (g.ai.type === 'Aggressive Hitters' && (c.type === 'blast' || c.type === 'hit')) score += 26;
  if (g.ai.type === 'Stealers' && g.hammer === 'p' && c.type === 'steal') score += 24;
  return score + (g.rng() - .5) * 8;
}

function inHouse(s) { return dist(s, house) <= house.r4; }

function scoreEnd() {
  const p = g.stones.filter(s => s.team === 'p' && inHouse(s)).sort((a, b) => dist(a, house) - dist(b, house));
  const a = g.stones.filter(s => s.team === 'a' && inHouse(s)).sort((a, b) => dist(a, house) - dist(b, house));
  const p0 = p[0] ? dist(p[0], house) : Infinity;
  const a0 = a[0] ? dist(a[0], house) : Infinity;
  let who = 'Blank', pts = 0;
  if (p0 < a0) { who = 'You'; for (const s of p) if (dist(s, house) < a0) pts++; g.score.p += pts; g.hammer = 'a'; }
  else if (a0 < p0) { who = 'AI'; for (const s of a) if (dist(s, house) < p0) pts++; g.score.a += pts; g.hammer = 'p'; }
  g.credits += 18 + pts * 5;
  const txt = `End ${g.end}: ${who}${who !== 'Blank' ? ` scores ${pts}` : ''}. Stones ${g.throwN}/10. AI ${g.ai.type}`;
  line(txt); el.endSummary.textContent = txt; show('screenEnd'); updateHUD();
}

function afterEnd() {
  if (g.end >= CFG.ends) return finish();
  const n = g.nodes[g.nodeI + 1];
  if (n === 'Shop') return shopScreen();
  if (n === 'Event') return eventScreen();
  rewardScreen();
}

function rewardScreen() {
  show('screenReward'); el.rewardCards.innerHTML = '';
  for (const c of rewardOptions(3, g.nodes[g.nodeI + 1] === 'Elite')) {
    const d = card(c.name, `${c.bucket || 'Reward'} ${c.rarity || ''}`, c.desc || '');
    d.onclick = () => { if (c.type === 'credits') g.credits += c.amount; else if (c.type === 'cleanse') cleanse(); else takeUpgrade(c); nextEnd(); };
    el.rewardCards.appendChild(d);
  }
}

function rewardOptions(n, elite) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (g.rng() < 0.16) out.push({ type: 'credits', name: `Credits +${elite ? 45 : 30}`, amount: elite ? 45 : 30, desc: 'Cash now.' });
    else if (g.curses.length && g.rng() < 0.12) out.push({ type: 'cleanse', name: 'Cleanse', desc: 'Remove one curse.' });
    else out.push(randomUpgrade(elite));
  }
  return out;
}

function randomUpgrade(elite) {
  const r = g.rng();
  const rare = elite ? 0.2 + g.mods.eliteBonus : 0.1;
  const unc = elite ? 0.35 : 0.28;
  const tier = r < rare ? 'rare' : r < rare + unc ? 'uncommon' : 'common';
  const pool = upgrades.filter(u => u.rarity === tier && !g.up.includes(u.id));
  return pool.length ? pool[Math.floor(g.rng() * pool.length)] : upgrades[Math.floor(g.rng() * upgrades.length)];
}

function takeUpgrade(u) { if (!u || g.up.includes(u.id)) return; g.up.push(u.id); u.apply(g); line(`Upgrade: ${u.name}`); }
function grant(id) { const u = upgrades.find(x => x.id === id); if (u) takeUpgrade(u); }
function grantRnd(bucket) { const p = upgrades.filter(u => u.bucket === bucket && !g.up.includes(u.id)); if (p.length) takeUpgrade(p[Math.floor(g.rng() * p.length)]); }
function addCurse() { const p = curses.filter(c => !g.curses.includes(c.id)); if (!p.length) return; const c = p[Math.floor(g.rng() * p.length)]; g.curses.push(c.id); c.apply(g); line(`Curse: ${c.name}`); }
function cleanse() { if (!g.curses.length) return; const id = g.curses.shift(); line(`Removed curse ${id}`); }

function shopScreen() {
  show('screenShop'); el.shopCards.innerHTML = '';
  const offers = [randomUpgrade(false), randomUpgrade(true), { type: 'cleanse', name: 'Remove Curse', desc: 'Delete one curse', cost: 35 }, { type: 'reroll', name: 'Reroll', desc: 'Refresh shop once', cost: 15 }];
  offers.forEach(o => {
    const cost = Math.floor((o.cost ?? (o.rarity === 'rare' ? 70 : o.rarity === 'uncommon' ? 45 : 30)) * g.mods.shopCost);
    const d = card(o.name, `Cost ${cost}`, o.desc || '');
    d.onclick = () => {
      if (g.credits < cost) return line('Not enough credits.');
      g.credits -= cost;
      if (o.type === 'cleanse') cleanse(); else if (o.type === 'reroll') shopScreen(); else takeUpgrade(o);
      updateHUD();
    };
    el.shopCards.appendChild(d);
  });
}

function eventScreen() {
  show('screenEvent'); el.eventCards.innerHTML = '';
  const ev = events[Math.floor(g.rng() * events.length)];
  el.eventText.innerHTML = `<b>${ev.t}</b><p>${ev.d}</p>`;
  ev.c.forEach(c => { const d = card(c.l, '', ''); d.onclick = () => { c.e(g); nextEnd(); }; el.eventCards.appendChild(d); });
}

function nextEnd() {
  g.end++; g.nodeI++; resetEnd(); mapRender(); show('screenMatch'); updateHUD();
  if (g.state === 'ai') setTimeout(aiThrow, 260);
}

function finish() {
  const won = g.score.p > g.score.a;
  el.runSummary.textContent = `Seed ${g.seed}\nFinal You ${g.score.p} - ${g.score.a} AI\n${won ? 'WIN' : 'LOSS'}\nUpgrades ${g.up.length}, Curses ${g.curses.length}`;
  show('screenRun');
  const runs = JSON.parse(localStorage.getItem('rogueCurlRuns2') || '[]');
  runs.unshift({ seed: g.seed, score: g.score, won, upgrades: g.up.length, curses: g.curses.length, ts: Date.now() });
  localStorage.setItem('rogueCurlRuns2', JSON.stringify(runs.slice(0, 10)));
}

function rewind() {
  if (!g.lastSnap) return;
  g.stones = g.lastSnap.stones.map(s => ({ ...s }));
  g.throwN = g.lastSnap.throwN;
  g.pLeft = g.lastSnap.pLeft;
  g.aLeft = g.lastSnap.aLeft;
  g.moving = null;
  g.state = 'aim';
  g.rewindsLeft--;
  line('Rewind used.');
}

function updateHUD() {
  el.seedText.textContent = g.seed; el.creditsText.textContent = Math.floor(g.credits);
  el.endText.textContent = g.end; el.throwText.textContent = `${g.throwN + 1}/${CFG.stonesPerTeam * 2}`;
  el.pScore.textContent = g.score.p; el.aScore.textContent = g.score.a;
  el.hammerText.textContent = g.hammer === 'p' ? 'You' : 'AI'; el.aiStyleText.textContent = g.ai.type;
}

function mapRender() {
  el.nodeMap.innerHTML = '';
  g.nodes.forEach((n, i) => { const d = document.createElement('div'); d.className = 'node'; d.textContent = n[0]; if (i === g.nodeI) d.classList.add('cur'); if (i < g.nodeI) d.classList.add('done'); el.nodeMap.appendChild(d); });
}

function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function card(t, st, d) { const x = document.createElement('div'); x.className = 'card'; x.innerHTML = `<b>${t}</b><br><small>${st}</small><p>${d}</p>`; return x; }
function line(m) { const d = document.createElement('div'); d.className = 'logline'; d.textContent = '> ' + m; el.log.prepend(d); while (el.log.children.length > 24) el.log.lastChild.remove(); }

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#edf8ff'; ctx.fillRect(sheet.x, sheet.y, sheet.w, sheet.h);
  ctx.strokeStyle = '#88a'; ctx.strokeRect(sheet.x, sheet.y, sheet.w, sheet.h);
  ctx.strokeStyle = '#6aa'; ctx.beginPath(); ctx.moveTo(sheet.x, hogY); ctx.lineTo(sheet.x + sheet.w, hogY); ctx.stroke();
  [[house.r4, '#4af'], [house.r8, '#fff'], [house.r12, '#f66'], [house.btn, '#fff']].forEach(([r, c]) => { ctx.beginPath(); ctx.arc(house.x, house.y, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); });

  if (g.state === 'aim') {
    ctx.strokeStyle = '#0b5'; ctx.beginPath(); ctx.moveTo(house.x, hackY); ctx.lineTo(house.x + Math.cos(g.input.ang) * 170, hackY + Math.sin(g.input.ang) * 170); ctx.stroke();
  }

  if (g.state === 'aim' && g.mods.pred) {
    const steps = g.mods.pred === 1 ? 45 : 85;
    let x = house.x, y = hackY, v = CFG.throwSpeed * (g.input.power || .55) * .62;
    let vx = Math.cos(g.input.ang) * v, vy = Math.sin(g.input.ang) * v;
    ctx.strokeStyle = 'rgba(0,170,0,.6)'; ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i < steps; i++) {
      const sp = Math.hypot(vx, vy);
      vx *= CFG.friction; vy *= CFG.friction;
      const curl = CFG.curl * g.input.handle * (1 + (1 - clamp(sp / 360, 0, 1)) * CFG.lateCurl);
      const dx = vx / (sp || 1), dy = vy / (sp || 1);
      vx += -dy * curl * sp * .016 * 60; vy += dx * curl * sp * .016 * 60;
      x += vx * .016; y += vy * .016; ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (const s of g.stones) {
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = s.team === 'p' ? '#c33' : '#ff0'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.stroke();
  }
}

function tick() {
  step(); draw(); updateHUD();
  if (g.state === 'aim' && !turnPlayer()) { g.state = 'ai'; setTimeout(aiThrow, 260); }
  requestAnimationFrame(tick);
}

start();
tick();
