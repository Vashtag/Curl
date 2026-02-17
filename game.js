/*
TUNING CONSTANTS
- Adjust these values to tune core feel:
*/
const TUNE = {
  endsMin: 6,
  endsMax: 8,
  defaultEnds: 6,
  stonesPerTeam: 5,
  dt: 1 / 60,
  baseFriction: 0.994,
  sweepFrictionBonus: 0.0032,
  wallDamp: 0.78,
  stoneBounceDamp: 0.92,
  baseCurl: 0.013,
  lateCurlBoost: 1.25,
  sweepCurlReduction: 0.55,
  minSpeedStop: 2.4,
  maxThrowSpeed: 850,
  sweepDrainPerSec: 26,
  staminaRegenOwnIdle: 16,
  staminaRegenOppTurn: 24,
  staminaMax: 100,
  aiNoiseBase: 0.09,
  aiEliteNoiseScale: 0.55,
  aiSweepSkillBase: 0.55,
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const sheet = { x: 80, y: 40, w: 360, h: 440 };
const house = { x: sheet.x + sheet.w / 2, y: sheet.y + 100, r4: 86, r8: 56, r12: 28, button: 8 };
const hogY = sheet.y + sheet.h - 110;
const hackY = sheet.y + sheet.h - 30;

const el = {
  seedText: document.getElementById('seedText'), copySeedBtn: document.getElementById('copySeedBtn'), creditsText: document.getElementById('creditsText'),
  endText: document.getElementById('endText'), playerScore: document.getElementById('playerScore'), aiScore: document.getElementById('aiScore'),
  throwText: document.getElementById('throwText'), hammerText: document.getElementById('hammerText'),
  iceCurlBar: document.getElementById('iceCurlBar'), iceSpeedBar: document.getElementById('iceSpeedBar'), iceLateBar: document.getElementById('iceLateBar'),
  eventLog: document.getElementById('eventLog'), nodeMap: document.getElementById('nodeMap'),
  toggleHandleBtn: document.getElementById('toggleHandleBtn'), powerFill: document.getElementById('powerFill'), staminaFill: document.getElementById('staminaFill'),
  rewardCards: document.getElementById('rewardCards'), shopItems: document.getElementById('shopItems'), eventText: document.getElementById('eventText'), eventChoices: document.getElementById('eventChoices'),
  endSummaryText: document.getElementById('endSummaryText'), runSummaryText: document.getElementById('runSummaryText')
};

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;

const RARITY = { common: 0.62, uncommon: 0.28, rare: 0.10 };
const AI_ARCHETYPES = ['Draw Team', 'Guard & Freeze Team', 'Peelers', 'Aggressive Hitters', 'Stealers'];
const NODE_TYPES = ['Normal', 'Elite', 'Shop', 'Event'];

const upgradePool = buildUpgradePool();
const cursesPool = buildCurses();
const eventPool = buildEvents();

let game;

function buildUpgradePool() {
  const list = [];
  const add = (id, name, rarity, bucket, desc, apply) => list.push({ id, name, rarity, bucket, desc, apply });
  // Sweep Tech (10)
  add('sw1','Carbon Fiber Brush','common','Sweep Tech','+12 max stamina',s=>s.mods.staminaMax+=12);
  add('sw2','Friction Whisper','common','Sweep Tech','Sweeping carries farther',s=>s.mods.sweepFriction+=0.0008);
  add('sw3','Line Keeper','common','Sweep Tech','Sweeping keeps it straighter',s=>s.mods.sweepCurlReduction+=0.05);
  add('sw4','Aerobic Split','common','Sweep Tech','+8 stamina regen',s=>s.mods.stamRegen+=8);
  add('sw5','Burst Rhythm','uncommon','Sweep Tech','Initial sweep stronger',s=>s.mods.firstSweepBoost+=0.08);
  add('sw6','Pulse Meter','uncommon','Sweep Tech','Power timing easier',s=>s.mods.powerWindow+=0.05);
  add('sw7','Nano Bristles','uncommon','Sweep Tech','Sweeping 25% more efficient',s=>s.mods.sweepEff*=1.25);
  add('sw8','Dual Brush Rig','rare','Sweep Tech','Huge carry while sweeping',s=>s.mods.sweepFriction+=0.0022);
  add('sw9','Stamina Overclock','rare','Sweep Tech','+30 stamina max',s=>s.mods.staminaMax+=30);
  add('sw10','Drag Equalizer','rare','Sweep Tech','Base friction slightly lower',s=>s.mods.baseFriction+=0.0015);
  // Shotbook (10)
  add('sh1','Draw Notebook','common','Shotbook','Draws are more accurate',s=>s.mods.drawAcc+=0.06);
  add('sh2','Hit Angles I','common','Shotbook','Hits are more accurate',s=>s.mods.hitAcc+=0.06);
  add('sh3','Guard Atlas','common','Shotbook','Guard shots tighter',s=>s.mods.guardAcc+=0.08);
  add('sh4','Freeze Matrix','uncommon','Shotbook','Freeze lines improved',s=>s.mods.freezeAcc+=0.08);
  add('sh5','Raise Primer','uncommon','Shotbook','Raise attempts stabilize',s=>s.mods.raiseAcc+=0.07);
  add('sh6','Weight Lexicon','uncommon','Shotbook','Power meter sensitivity +',s=>s.mods.powerControl+=0.12);
  add('sh7','Out-turn Bible','common','Shotbook','Out-turn correction bonus',s=>s.mods.outTurnBonus+=0.05);
  add('sh8','In-turn Bible','common','Shotbook','In-turn correction bonus',s=>s.mods.inTurnBonus+=0.05);
  add('sh9','Situational Pages','rare','Shotbook','All shot categories +',s=>{s.mods.drawAcc+=0.05;s.mods.hitAcc+=0.05;s.mods.guardAcc+=0.05;s.mods.freezeAcc+=0.05;});
  add('sh10','Perfect Release Drill','rare','Shotbook','Execution noise heavily reduced',s=>s.mods.execNoise*=0.72);
  // Ice / Intel (10)
  add('ii1','Pebble Sensor','common','Ice/Intel','Ice report accuracy +',s=>s.mods.iceRead+=0.14);
  add('ii2','Path Ghost','common','Ice/Intel','Show predicted path',s=>s.mods.predictionLevel=1);
  add('ii3','Path Ghost+','uncommon','Ice/Intel','Longer predicted path',s=>s.mods.predictionLevel=2);
  add('ii4','Scout Notes','common','Ice/Intel','Reveal AI archetype intent hints',s=>s.mods.scout+=1);
  add('ii5','Mini Replay Rig','uncommon','Ice/Intel','1 rewind per end',s=>s.mods.rewindsPerEnd=1);
  add('ii6','Thermal Lens','uncommon','Ice/Intel','Better late curl report',s=>s.mods.iceReadLate+=0.2);
  add('ii7','Hammer Tutor','common','Ice/Intel','Hammer strategy bonus points',s=>s.mods.hammerIQ+=0.2);
  add('ii8','Wear Monitor','uncommon','Ice/Intel','Wear growth reduced',s=>s.mods.wearSlow+=0.12);
  add('ii9','Silent Skip Radio','rare','Ice/Intel','AI noise + for one end start',s=>s.mods.aiDisrupt+=0.16);
  add('ii10','Oracle Screen','rare','Ice/Intel','Ice report near perfect',s=>s.mods.iceRead=1.0);
  return list;
}

function buildCurses() {
  return [
    {id:'c1',name:'Blunt Brush',desc:'Sweeping efficiency -20%',apply:s=>s.mods.sweepEff*=0.8},
    {id:'c2',name:'Heavy Boots',desc:'Stamina max -20',apply:s=>s.mods.staminaMax-=20},
    {id:'c3',name:'Fogged Glass',desc:'Ice read worsens',apply:s=>s.mods.iceRead-=0.2},
    {id:'c4',name:'Shaky Release',desc:'Execution noise +20%',apply:s=>s.mods.execNoise*=1.2},
    {id:'c5',name:'Late Panic',desc:'Late curl feels stronger',apply:s=>s.mods.playerLateCurlPenalty+=0.2},
    {id:'c6',name:'Thin Handle',desc:'Handle drift',apply:s=>s.mods.handleDrift+=0.08},
    {id:'c7',name:'Bad Pebble',desc:'Wear increases faster',apply:s=>s.mods.wearSlow-=0.15},
    {id:'c8',name:'Nervy Skip',desc:'Power control worse',apply:s=>s.mods.powerControl-=0.14},
    {id:'c9',name:'Crunchy Ice',desc:'Base friction higher',apply:s=>s.mods.baseFriction-=0.0014},
    {id:'c10',name:'Cold Grip',desc:'Sweeping drains more stamina',apply:s=>s.mods.sweepDrainMult*=1.25},
  ];
}

function buildEvents() {
  return [
    {
      title: 'Broken Broom Vendor',
      text: 'A shady tech offers a prototype brush core.',
      choices: [
        { label: 'Buy for 40 credits (+rare sweep)', effect: s => { if (s.credits>=40){s.credits-=40; grantSpecificUpgrade(s,'sw8');} else log('Not enough credits.'); } },
        { label: 'Take cursed version (free + curse)', effect: s => { grantSpecificUpgrade(s,'sw8'); giveRandomCurse(s);} },
        { label: 'Walk away', effect: s => s.credits += 5 }
      ]
    },
    {
      title: 'Video Room',
      text: 'Ancient tapes reveal elite release timing.',
      choices: [
        { label: 'Study (Shotbook upgrade)', effect: s => giveRandomUpgrade(s, 'Shotbook') },
        { label: 'Sell tapes (+35 credits)', effect: s => s.credits += 35 },
        { label: 'Overstudy (2 upgrades + curse)', effect: s => {giveRandomUpgrade(s,'Shotbook');giveRandomUpgrade(s,'Ice/Intel');giveRandomCurse(s);} }
      ]
    },
    {
      title: 'Mystery Pebbling',
      text: 'An arena worker offers custom pebble prep.',
      choices: [
        { label: 'Accept (+ice intel)', effect: s => giveRandomUpgrade(s, 'Ice/Intel') },
        { label: 'Demand premium (+rare, pay 30)', effect: s => { if (s.credits>=30){s.credits-=30; offerRare(s);} } },
        { label: 'Refuse (gain 10 credits)', effect: s => s.credits += 10 }
      ]
    }
  ];
}

function createGame(seedInput) {
  const seed = seedInput || String(Math.floor(Math.random()*9e8)+1);
  const seedNum = [...seed].reduce((a,c)=>a + c.charCodeAt(0),0) >>> 0;
  const rng = mulberry32(seedNum);
  const ends = TUNE.defaultEnds;
  const nodes = Array.from({length: ends}, (_,i)=> i===0 ? 'Normal' : NODE_TYPES[Math.floor(rng()*NODE_TYPES.length)]);
  nodes[Math.floor(ends/2)-1] = 'Elite';
  nodes[ends-1] = 'Elite';
  return {
    seed, seedNum, rng, ends, nodes, currentEnd: 1, currentNodeIndex: 0,
    state: 'aim', stones: [], movingStone: null, pendingAI:false,
    throwIndex: 0, playerStonesLeft: TUNE.stonesPerTeam, aiStonesLeft: TUNE.stonesPerTeam,
    hammer: 'player',
    score: { player:0, ai:0 }, credits: 40,
    runLog: [], upgrades: [], curses: [],
    lastStoneSnapshot:null, rewindsLeft:0,
    ice: { baseCurl:0.012, iceSpeed:1, lateCurl:1, wear:0 },
    ai: { archetype: AI_ARCHETYPES[Math.floor(rng()*AI_ARCHETYPES.length)], noise: TUNE.aiNoiseBase, sweepSkill:TUNE.aiSweepSkillBase },
    playerInput: { angle: -Math.PI/2, handle: 1, charging:false, power:0, sweepActive:false, stamina:TUNE.staminaMax },
    mods: {
      staminaMax:TUNE.staminaMax, sweepFriction: TUNE.sweepFrictionBonus, sweepCurlReduction:TUNE.sweepCurlReduction,
      stamRegen:0, firstSweepBoost:0, powerWindow:0, sweepEff:1,
      drawAcc:0, hitAcc:0, guardAcc:0, freezeAcc:0, raiseAcc:0,
      powerControl:0, outTurnBonus:0, inTurnBonus:0, execNoise:1,
      predictionLevel:0, iceRead:0.42, iceReadLate:0, scout:0, rewindsPerEnd:0,
      hammerIQ:0, wearSlow:0, aiDisrupt:0,
      playerLateCurlPenalty:0, handleDrift:0, baseFriction:0, sweepDrainMult:1,
    },
    history: []
  };
}

function startRun(seed) {
  game = createGame(seed);
  log('New run booted.');
  setupEnd();
  bindUI();
  updateHUD();
  renderNodeMap();
  showScreen('screenMatch');
}

function bindUI() {
  el.copySeedBtn.onclick = () => navigator.clipboard?.writeText(game.seed);
  el.toggleHandleBtn.onclick = () => {
    game.playerInput.handle *= -1;
    el.toggleHandleBtn.textContent = `Handle: ${game.playerInput.handle===1?'OUT':'IN'}`;
  };
  document.getElementById('endSummaryContinueBtn').onclick = afterEndContinue;
  document.getElementById('shopContinueBtn').onclick = () => showRewardScreen();
  document.getElementById('newRunBtn').onclick = () => startRun();

  canvas.onmousemove = (e) => {
    if (game.state !== 'aim') return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    game.playerInput.angle = Math.atan2(my - hackY, mx - house.x);
  };
  canvas.onmousedown = () => { if (game.state==='aim') game.playerInput.charging = true; };
  canvas.onmouseup = () => { if (game.state==='aim') launchPlayerStone(); };

  window.onkeydown = (e) => {
    if (e.code === 'ArrowLeft' && game.state==='aim') game.playerInput.angle -= 0.03;
    if (e.code === 'ArrowRight' && game.state==='aim') game.playerInput.angle += 0.03;
    if (e.code === 'Enter' && game.state==='aim' && !game.playerInput.charging) game.playerInput.charging = true;
    if (e.code === 'Space') game.playerInput.sweepActive = true;
    if (e.code === 'KeyR' && game.state==='aim' && game.rewindsLeft>0 && game.lastStoneSnapshot) rewindStone();
  };
  window.onkeyup = (e) => {
    if (e.code === 'Enter' && game.state==='aim' && game.playerInput.charging) launchPlayerStone();
    if (e.code === 'Space') game.playerInput.sweepActive = false;
  };
}

function setupEnd() {
  const elite = game.nodes[game.currentNodeIndex] === 'Elite';
  const base = 0.009 + game.rng()*0.008;
  game.ice.baseCurl = base;
  game.ice.iceSpeed = 0.9 + game.rng()*0.25;
  game.ice.lateCurl = 0.85 + game.rng()*0.55;
  game.ice.wear += (0.02 * (1 - game.mods.wearSlow)) + (elite ? 0.03 : 0);

  game.stones = [];
  game.movingStone = null;
  game.throwIndex = 0;
  game.playerStonesLeft = TUNE.stonesPerTeam;
  game.aiStonesLeft = TUNE.stonesPerTeam;
  game.playerInput.stamina = game.mods.staminaMax;
  game.rewindsLeft = game.mods.rewindsPerEnd;
  game.ai.archetype = AI_ARCHETYPES[Math.floor(game.rng()*AI_ARCHETYPES.length)];
  game.ai.noise = (TUNE.aiNoiseBase + (elite ? -0.03 : 0)) * (elite ? TUNE.aiEliteNoiseScale : 1) - game.mods.aiDisrupt;
  game.ai.sweepSkill = TUNE.aiSweepSkillBase + (elite ? 0.22 : 0);
  log(`End ${game.currentEnd} on ${game.nodes[game.currentNodeIndex]} node. AI: ${game.ai.archetype}`);
}

function launchPlayerStone() {
  game.playerInput.charging = false;
  if (game.playerStonesLeft <= 0 || game.state !== 'aim') return;
  const p = clamp(game.playerInput.power, 0.15, 1);
  const angle = game.playerInput.angle + ((game.rng()-0.5) * (0.08 - game.mods.powerControl*0.04));
  createStone('player', p, angle, game.playerInput.handle);
  game.lastStoneSnapshot = snapshotBoard();
  game.state = 'moving';
}

function createStone(team, power, angle, handle) {
  const speed = (TUNE.maxThrowSpeed * power * 0.64) * game.ice.iceSpeed;
  const stone = {
    team, x: house.x, y: hackY, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    r: 12, handle, moving:true, age:0, sweptTime:0
  };
  game.stones.push(stone);
  game.movingStone = stone;
  if (team === 'player') game.playerStonesLeft--; else game.aiStonesLeft--;
  game.throwIndex++;
  updateHUD();
}

function physicsStep(dt) {
  if (game.playerInput.charging && game.state === 'aim') {
    game.playerInput.power += dt * 0.95;
    if (game.playerInput.power > 1) game.playerInput.power = 0;
    el.powerFill.style.width = `${Math.floor(game.playerInput.power*100)}%`;
  }

  let anyMoving = false;
  for (const s of game.stones) {
    if (!s.moving) continue;
    anyMoving = true;
    s.age += dt;
    const speed = Math.hypot(s.vx, s.vy);
    let friction = TUNE.baseFriction + game.mods.baseFriction - game.ice.wear*0.03;
    let curlCoeff = (game.ice.baseCurl + game.ice.wear*0.003) * s.handle;
    const lateFactor = 1 + ((1 - clamp(speed/360, 0, 1)) * game.ice.lateCurl * TUNE.lateCurlBoost);
    curlCoeff *= lateFactor;

    const isPlayerStone = s === game.movingStone && s.team==='player';
    const aiSweeping = s.team==='ai' && aiSweepDecision(s);
    const sweepOn = (isPlayerStone && game.playerInput.sweepActive && game.playerInput.stamina > 0) || aiSweeping;
    if (sweepOn) {
      friction += game.mods.sweepFriction * game.mods.sweepEff;
      curlCoeff *= (1 - game.mods.sweepCurlReduction);
      s.sweptTime += dt;
      if (isPlayerStone) {
        game.playerInput.stamina = clamp(game.playerInput.stamina - TUNE.sweepDrainPerSec * game.mods.sweepDrainMult * dt, 0, game.mods.staminaMax);
      }
    }

    const dirx = s.vx / (speed || 1), diry = s.vy / (speed || 1);
    s.vx *= friction;
    s.vy *= friction;
    s.vx += (-diry) * curlCoeff * speed * dt * 60;
    s.vy += (dirx) * curlCoeff * speed * dt * 60;

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.x < sheet.x + s.r || s.x > sheet.x + sheet.w - s.r) { s.vx *= -TUNE.wallDamp; s.x = clamp(s.x, sheet.x+s.r, sheet.x+sheet.w-s.r); }
    if (s.y < sheet.y + s.r || s.y > sheet.y + sheet.h - s.r) { s.vy *= -TUNE.wallDamp; s.y = clamp(s.y, sheet.y+s.r, sheet.y+sheet.h-s.r); }

    if (Math.hypot(s.vx, s.vy) < TUNE.minSpeedStop) { s.vx = 0; s.vy = 0; s.moving = false; }
  }

  for (let i=0;i<game.stones.length;i++) for (let j=i+1;j<game.stones.length;j++) resolveCollision(game.stones[i], game.stones[j]);

  if (!anyMoving && game.state === 'moving') onStoneStop();

  if (!game.playerInput.sweepActive && game.state==='moving' && game.movingStone?.team==='player') {
    game.playerInput.stamina = clamp(game.playerInput.stamina + (TUNE.staminaRegenOwnIdle + game.mods.stamRegen)*dt, 0, game.mods.staminaMax);
  }
  if ((game.state==='aiThink' || (game.state==='moving' && game.movingStone?.team==='ai'))) {
    game.playerInput.stamina = clamp(game.playerInput.stamina + TUNE.staminaRegenOppTurn*dt, 0, game.mods.staminaMax);
  }
  el.staminaFill.style.width = `${Math.floor((game.playerInput.stamina/game.mods.staminaMax)*100)}%`;
}

function aiSweepDecision(stone) {
  const t = stone.age;
  const style = game.ai.archetype;
  let skill = game.ai.sweepSkill;
  if (style === 'Draw Team' && t > 0.8) skill += 0.15;
  if (style === 'Guard & Freeze Team' && t < 0.8) skill += 0.12;
  if (style === 'Aggressive Hitters') skill -= 0.06;
  return game.rng() < clamp(skill,0.1,0.95);
}

function resolveCollision(a,b){
  const dx=b.x-a.x, dy=b.y-a.y; const d=Math.hypot(dx,dy); const min=a.r+b.r;
  if (d<=0 || d>=min) return;
  const nx=dx/d, ny=dy/d;
  const overlap=(min-d)/2;
  a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
  const rvx=b.vx-a.vx, rvy=b.vy-a.vy;
  const velAlongNormal = rvx*nx + rvy*ny;
  if (velAlongNormal>0) return;
  const j = -(1+TUNE.stoneBounceDamp)*velAlongNormal/2;
  const ix = j*nx, iy=j*ny;
  a.vx -= ix; a.vy -= iy; b.vx += ix; b.vy += iy;
  a.moving = b.moving = true;
}

function onStoneStop() {
  game.movingStone = null;
  if (game.throwIndex >= TUNE.stonesPerTeam*2) return endScoring();

  const playerTurn = isPlayerTurn();
  if (playerTurn && game.playerStonesLeft > 0) {
    game.state = 'aim';
  } else if (!playerTurn && game.aiStonesLeft > 0) {
    game.state = 'aiThink';
    setTimeout(aiTakeShot, 300);
  } else {
    game.state = playerTurn ? 'aiThink':'aim';
  }
  updateHUD();
}

function isPlayerTurn() { return game.throwIndex % 2 === 0; }

function aiTakeShot() {
  const candidates = generateAICandidates();
  let best = null;
  for (const c of candidates) {
    const sim = simulateShot(c, 'ai', game.ai.noise);
    const score = evaluateBoard(sim, c);
    if (!best || score > best.score) best = { c, score };
  }
  const pick = (game.rng() < 0.15) ? candidates[Math.floor(game.rng()*candidates.length)] : best.c;
  createStone('ai', pick.power, pick.angle, pick.handle);
  game.state = 'moving';
}

function generateAICandidates() {
  const arr = [];
  const style = game.ai.archetype;
  const add = (type, tx, ty, pow, handle=1) => {
    const ang = Math.atan2(ty-hackY, tx-house.x);
    arr.push({ type, tx, ty, power: clamp(pow,0.22,1), angle: ang, handle});
  };
  const my = game.stones.filter(s=>s.team==='ai');
  const opp = game.stones.filter(s=>s.team==='player');
  for (let i=0;i<8;i++) add('draw', house.x + (game.rng()-0.5)*40, house.y + (game.rng()-0.5)*45, 0.52+game.rng()*0.12, game.rng()<0.5?1:-1);
  for (let i=0;i<4;i++) add('guard', house.x + (game.rng()-0.5)*90, hogY - 30 - game.rng()*30, 0.38+game.rng()*0.1, game.rng()<0.5?1:-1);
  for (const t of opp.slice(0,3)) add('hit', t.x, t.y, 0.62 + game.rng()*0.22, game.rng()<0.5?1:-1);
  if (my.length) for (const t of my.slice(0,2)) add('freeze', t.x + (game.rng()-0.5)*10, t.y + 14, 0.49 + game.rng()*0.1, game.rng()<0.5?1:-1);
  if (style==='Peelers') for (const t of opp.slice(0,4)) add('peel', t.x, t.y, 0.78+game.rng()*0.16);
  if (style==='Aggressive Hitters') for (const t of opp.slice(0,4)) add('hit+', t.x, t.y, 0.76+game.rng()*0.16);
  if (style==='Stealers' && game.hammer==='player') for (let i=0;i<3;i++) add('steal-guard', house.x+(game.rng()-0.5)*60, hogY-40-game.rng()*40, 0.41+game.rng()*0.08);
  return arr.slice(0,20);
}

function simulateShot(cand, team, noiseAmp) {
  const temp = game.stones.map(s=>({...s}));
  const angle = cand.angle + (game.rng()-0.5)*(noiseAmp + 0.03);
  const power = cand.power + (game.rng()-0.5)*(noiseAmp*0.7);
  const stone = { team, x: house.x, y: hackY, vx: Math.cos(angle)*power*TUNE.maxThrowSpeed*0.6, vy: Math.sin(angle)*power*TUNE.maxThrowSpeed*0.6, r:12, handle:cand.handle, moving:true, age:0 };
  temp.push(stone);
  for (let step=0;step<280;step++) {
    let moving=false;
    for (const s of temp){
      if(!s.moving) continue; moving=true;
      const speed=Math.hypot(s.vx,s.vy);
      const friction = TUNE.baseFriction - game.ice.wear*0.03;
      let curl = game.ice.baseCurl * s.handle * (1 + (1-clamp(speed/360,0,1))*game.ice.lateCurl);
      s.vx*=friction; s.vy*=friction;
      const dx=s.vx/(speed||1), dy=s.vy/(speed||1);
      s.vx+=(-dy)*curl*speed*0.016*60; s.vy+=(dx)*curl*speed*0.016*60;
      s.x+=s.vx*0.016; s.y+=s.vy*0.016;
      if(Math.hypot(s.vx,s.vy)<3) s.moving=false;
    }
    for (let i=0;i<temp.length;i++) for(let j=i+1;j<temp.length;j++) resolveCollision(temp[i],temp[j]);
    if(!moving) break;
  }
  return temp;
}

function evaluateBoard(stones, cand) {
  const own=stones.filter(s=>s.team==='ai' && inHouse(s));
  const opp=stones.filter(s=>s.team==='player' && inHouse(s));
  const style=game.ai.archetype;
  let sc=0;
  for(const s of own) sc += 120 - dist(s,house);
  for(const s of opp) sc -= 130 - dist(s,house);
  const guards = stones.filter(s=>s.team==='ai' && s.y>house.y+45 && s.y<hogY+20 && Math.abs(s.x-house.x)<80).length;
  sc += guards*14;
  const openCenter = stones.filter(s=>Math.abs(s.x-house.x)<26 && s.y<hogY && s.y>house.y-20).length===0;
  if(openCenter) sc -= 12;
  if(game.hammer==='ai' && game.aiStonesLeft<=1) sc += own.length*16;
  if(game.hammer==='player' && style==='Stealers') sc += guards*18;
  if(style==='Draw Team' && cand.type==='draw') sc += 22;
  if(style==='Guard & Freeze Team' && (cand.type==='guard'||cand.type==='freeze')) sc += 20;
  if(style==='Peelers' && (cand.type==='peel'||cand.type==='hit')) sc += 24;
  if(style==='Aggressive Hitters' && cand.type.includes('hit')) sc += 25;
  return sc + (game.rng()-0.5)*8;
}

function inHouse(s){ return dist(s,house)<=house.r4; }

function endScoring() {
  const p = game.stones.filter(s=>s.team==='player' && inHouse(s)).sort((a,b)=>dist(a,house)-dist(b,house));
  const a = game.stones.filter(s=>s.team==='ai' && inHouse(s)).sort((a,b)=>dist(a,house)-dist(b,house));
  let endPts=0,winner='none';
  const p0 = p[0] ? dist(p[0],house) : Infinity;
  const a0 = a[0] ? dist(a[0],house) : Infinity;
  if (p0 < a0) {
    winner='player';
    for (const s of p) { if (dist(s,house) < a0) endPts++; }
    game.score.player += endPts;
    game.hammer = 'ai';
  } else if (a0 < p0) {
    winner='ai';
    for (const s of a) { if (dist(s,house) < p0) endPts++; }
    game.score.ai += endPts;
    game.hammer = 'player';
  }
  game.credits += 18 + endPts*5;
  const summary = `End ${game.currentEnd}: ${winner==='none'?'Blank end':`${winner} scores ${endPts}`}. Stones: ${game.throwIndex}/10`;
  log(summary);
  el.endSummaryText.textContent = `${summary} | AI: ${game.ai.archetype}`;
  showScreen('screenEndSummary');
  updateHUD();
}

function afterEndContinue() {
  if (game.currentEnd >= game.ends) return finishRun();
  const node = game.nodes[game.currentNodeIndex+1];
  if (node === 'Shop') return showShopScreen();
  if (node === 'Event') return showEventScreen();
  showRewardScreen();
}

function showRewardScreen() {
  showScreen('screenReward');
  el.rewardCards.innerHTML = '';
  const options = pickRewardCards(3, game.nodes[game.currentNodeIndex+1] === 'Elite');
  options.forEach(opt => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<b>${opt.name}</b><br><small>${opt.bucket || 'Reward'} | ${opt.rarity || 'bonus'}</small><p>${opt.desc || ''}</p>`;
    c.onclick = () => {
      if (opt.type === 'credits') game.credits += opt.amount;
      else if (opt.type === 'removeCurse') removeCurse();
      else grantUpgrade(opt);
      proceedNextEnd();
    };
    el.rewardCards.appendChild(c);
  });
}

function pickRewardCards(n, elite) {
  const out = [];
  for (let i=0;i<n;i++) {
    if (game.rng()<0.16) out.push({type:'credits',name:`Credits Cache +${elite?45:30}`,amount:elite?45:30,desc:'Immediate funding.'});
    else if (game.curses.length && game.rng()<0.12) out.push({type:'removeCurse',name:'Cleanse',desc:'Remove one curse.'});
    else out.push(pickUpgradeByRarity(elite));
  }
  return out;
}

function pickUpgradeByRarity(elite=false) {
  const r = game.rng();
  const rareChance = elite ? 0.2 : RARITY.rare;
  const uncommonChance = elite ? 0.35 : RARITY.uncommon;
  const rarity = r < rareChance ? 'rare' : (r < rareChance + uncommonChance ? 'uncommon' : 'common');
  const pool = upgradePool.filter(u=>u.rarity===rarity && !game.upgrades.includes(u.id));
  return pool.length ? pool[Math.floor(game.rng()*pool.length)] : upgradePool[Math.floor(game.rng()*upgradePool.length)];
}

function grantUpgrade(up) {
  if (!up || game.upgrades.includes(up.id)) return;
  game.upgrades.push(up.id);
  up.apply(game);
  log(`Upgrade acquired: ${up.name}`);
}
function giveRandomUpgrade(state,bucket){
  const pool = upgradePool.filter(u=>u.bucket===bucket && !state.upgrades.includes(u.id));
  if(pool.length){const up=pool[Math.floor(state.rng()*pool.length)];state.upgrades.push(up.id);up.apply(state);log(`Event gain: ${up.name}`);} }
function grantSpecificUpgrade(state,id){const up=upgradePool.find(u=>u.id===id);if(up&&!state.upgrades.includes(id)){state.upgrades.push(id);up.apply(state);log(`Upgrade: ${up.name}`);} }
function offerRare(state){const pool=upgradePool.filter(u=>u.rarity==='rare'&&!state.upgrades.includes(u.id));if(pool.length){const up=pool[Math.floor(state.rng()*pool.length)];state.upgrades.push(up.id);up.apply(state);log(`Rare gained: ${up.name}`);} }
function giveRandomCurse(state=game){
  const avail = cursesPool.filter(c=>!state.curses.includes(c.id));
  if(!avail.length) return;
  const c = avail[Math.floor(state.rng()*avail.length)];
  state.curses.push(c.id); c.apply(state); log(`Curse gained: ${c.name}`);
}
function removeCurse(){ if(!game.curses.length) return; const id=game.curses.shift(); log(`Removed curse: ${id}`); }

function showShopScreen() {
  showScreen('screenShop');
  el.shopItems.innerHTML='';
  const offers = [pickUpgradeByRarity(false), pickUpgradeByRarity(true), {type:'removeCurse',name:'Curse Cleanse',desc:'Remove a curse (35c)',cost:35}, {type:'reroll',name:'Reroll Shelf',desc:'Reroll once (15c)',cost:15}];
  offers.forEach(o=>{
    const c=document.createElement('div');c.className='card';
    const cost = o.cost ?? (o.rarity==='rare'?70:o.rarity==='uncommon'?45:30);
    c.innerHTML=`<b>${o.name}</b><p>${o.desc||''}</p><small>Cost ${cost}</small>`;
    c.onclick=()=>{
      if(game.credits<cost)return log('Insufficient credits.');
      game.credits-=cost;
      if(o.type==='removeCurse') removeCurse();
      else if(o.type==='reroll') showShopScreen();
      else grantUpgrade(o);
      updateHUD();
    };
    el.shopItems.appendChild(c);
  });
}

function showEventScreen() {
  showScreen('screenEvent');
  el.eventChoices.innerHTML='';
  const e = eventPool[Math.floor(game.rng()*eventPool.length)];
  el.eventText.innerHTML = `<b>${e.title}</b><p>${e.text}</p>`;
  e.choices.forEach(ch=>{
    const c=document.createElement('div'); c.className='card'; c.innerHTML=`${ch.label}`;
    c.onclick=()=>{ ch.effect(game); proceedNextEnd(); };
    el.eventChoices.appendChild(c);
  });
}

function proceedNextEnd() {
  game.currentEnd++;
  game.currentNodeIndex++;
  setupEnd();
  renderNodeMap();
  showScreen('screenMatch');
  game.state = (game.hammer === 'player') ? 'aim' : 'aiThink';
  if (game.state === 'aiThink') setTimeout(aiTakeShot, 300);
  updateHUD();
}

function finishRun() {
  const won = game.score.player > game.score.ai;
  const text = `Seed ${game.seed}\nFinal: You ${game.score.player} - ${game.score.ai} AI\n${won?'RUN WON':'RUN LOST'}\nUpgrades: ${game.upgrades.length}\nCurses: ${game.curses.length}`;
  el.runSummaryText.textContent = text;
  showScreen('screenRunSummary');
  const key = 'rogueCurlRuns';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.unshift({ seed:game.seed, score:game.score, upgrades:game.upgrades.length, curses:game.curses.length, won, ts:Date.now() });
  localStorage.setItem(key, JSON.stringify(arr.slice(0,10)));
  const bestKey='rogueCurlBest';
  const best = JSON.parse(localStorage.getItem(bestKey) || 'null');
  if (!best || game.score.player > best.score.player) localStorage.setItem(bestKey, JSON.stringify({ seed:game.seed, score:game.score }));
}

function rewindStone() {
  game.stones = game.lastStoneSnapshot.map(s=>({...s}));
  game.rewindsLeft--;
  log('Rewind used.');
}

function snapshotBoard(){ return game.stones.map(s=>({...s})); }

function renderNodeMap() {
  el.nodeMap.innerHTML='';
  game.nodes.forEach((n,i)=>{
    const d=document.createElement('div'); d.className='node'; d.textContent=n[0];
    if(i===game.currentNodeIndex) d.classList.add('current');
    if(i<game.currentNodeIndex) d.classList.add('done');
    el.nodeMap.appendChild(d);
  });
}

function updateHUD() {
  el.seedText.textContent = game.seed;
  el.creditsText.textContent = Math.floor(game.credits);
  el.endText.textContent = game.currentEnd;
  el.playerScore.textContent = game.score.player;
  el.aiScore.textContent = game.score.ai;
  el.throwText.textContent = `${game.throwIndex + 1} / ${TUNE.stonesPerTeam*2}`;
  el.hammerText.textContent = game.hammer === 'player' ? 'You' : 'AI';
  const repAcc = clamp(game.mods.iceRead, 0.12, 1);
  const noise = () => (game.rng()-0.5)*(1-repAcc)*0.5;
  const curlRep = clamp(game.ice.baseCurl / 0.02 + noise(),0,1);
  const spdRep = clamp((game.ice.iceSpeed - 0.8)/0.4 + noise(),0,1);
  const lateRep = clamp(game.ice.lateCurl/1.6 + ((game.rng()-0.5)*(1-(game.mods.iceRead+game.mods.iceReadLate))),0,1);
  el.iceCurlBar.style.width = `${curlRep*100}%`;
  el.iceSpeedBar.style.width = `${spdRep*100}%`;
  el.iceLateBar.style.width = `${lateRep*100}%`;
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  document.getElementById(id).classList.add('active');
}

function drawSheet() {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#eef9ff'; ctx.fillRect(sheet.x,sheet.y,sheet.w,sheet.h);
  ctx.strokeStyle = '#88a'; ctx.strokeRect(sheet.x,sheet.y,sheet.w,sheet.h);
  ctx.strokeStyle = '#7aa'; ctx.beginPath(); ctx.moveTo(sheet.x,hogY); ctx.lineTo(sheet.x+sheet.w,hogY); ctx.stroke();
  for (const [r,col] of [[house.r4,'#4af'],[house.r8,'#fff'],[house.r12,'#f66'],[house.button,'#fff']]) {
    ctx.beginPath(); ctx.arc(house.x,house.y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  }
  if (game.state==='aim') {
    ctx.strokeStyle='#1c5'; ctx.beginPath(); ctx.moveTo(house.x,hackY);
    ctx.lineTo(house.x + Math.cos(game.playerInput.angle)*160, hackY + Math.sin(game.playerInput.angle)*160); ctx.stroke();
  }
}

function drawPrediction() {
  if (game.state!=='aim' || game.mods.predictionLevel<=0) return;
  const steps = game.mods.predictionLevel===1 ? 40 : 80;
  let x=house.x,y=hackY;
  let speed=TUNE.maxThrowSpeed*clamp(game.playerInput.power||0.55,0.2,1)*0.62;
  let vx=Math.cos(game.playerInput.angle)*speed, vy=Math.sin(game.playerInput.angle)*speed;
  const handle=game.playerInput.handle;
  ctx.strokeStyle='rgba(0,180,0,0.6)'; ctx.beginPath(); ctx.moveTo(x,y);
  for(let i=0;i<steps;i++){
    const sp=Math.hypot(vx,vy);
    vx*=TUNE.baseFriction;
    vy*=TUNE.baseFriction;
    const curl=(game.ice.baseCurl*handle)*(1+(1-clamp(sp/350,0,1))*game.ice.lateCurl);
    vx+=(-vy/(sp||1))*curl*sp*0.016*60;
    vy+=(vx/(sp||1))*curl*sp*0.016*60;
    x+=vx*0.016; y+=vy*0.016;
    ctx.lineTo(x,y);
  }
  ctx.stroke();
}

function drawStones() {
  for (const s of game.stones) {
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle = s.team==='player' ? '#c33' : '#ff0'; ctx.fill();
    ctx.strokeStyle='#111'; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillRect(s.x-2,s.y-2,4,4);
  }
}

function log(msg) {
  const d=document.createElement('div'); d.className='log-line'; d.textContent=`> ${msg}`;
  el.eventLog.prepend(d);
  while (el.eventLog.children.length>24) el.eventLog.lastChild.remove();
}

function loop() {
  physicsStep(TUNE.dt);
  drawSheet();
  drawPrediction();
  drawStones();
  if (game.state==='aim' && !isPlayerTurn()) {
    game.state='aiThink'; setTimeout(aiTakeShot,350);
  }
  requestAnimationFrame(loop);
}

startRun();
loop();
