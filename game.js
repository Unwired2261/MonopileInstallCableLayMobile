// ═══════════════════════════════════════════════════════
//  OFFSHORE CRANE VESSEL — MONOPILE INSTALLER
//  Een Boskalis offshore-game in Mario-retrostijl
// ═══════════════════════════════════════════════════════

/* ─── Canvas ─── */
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const W = 768, H = 512;
const RES_SCALE = 2;
canvas.width = W * RES_SCALE; canvas.height = H * RES_SCALE;
ctx.scale(RES_SCALE, RES_SCALE);

/* ─── World / tuning ─── */
const WORLD_W = 3200, WORLD_H = 1400;
const TILE    = 24;
const INSTALL_FRAMES = 90;
const LOAD_FRAMES    = 60;
const INSTALL_BUSY   = 30;   // how long player is blocked
const LOAD_BUSY      = 20;   // how long player is blocked
const V_TURN  = 0.035;

/* ─── Vessel fleet definitions ─── */
const VESSELS = [
  {
    id:'bokalift1',
    name:'BOKALIFT 1',
    company:'BOSKALIS',
    speed:5.0,
    cargo:[3,2,1],  // S, M, L per-type max
    maxCargo:4,     // total monopiles on deck
    desc:'FAST, MAX 4 TOTAL',
    detail:'3,000t crane • 8 knots',
    // Visual: grey hull, white pedestal, yellow boom, helideck
    hull:'#6B7B8D', hullDk:'#4A5A6A', deck:'#B0B8C0',
    pedestal:'#E8E8E8', boom:'#E8C800',
    bridge:'#F0F0F0', funnel:'#FF6600',
    antifoul:'#8B2020',
  },
  {
    id:'bokalift2',
    name:'BOKALIFT 2',
    company:'BOSKALIS',
    speed:3.5,
    cargo:[4,2,1],  // S, M, L per-type max
    maxCargo:5,     // total monopiles on deck
    desc:'SLOW, MAX 7 TOTAL',
    detail:'4,000t crane • 5 knots',
    // Visual: dark blue/grey drillship hull, orange markings, tall yellow crane
    hull:'#3A4F6B', hullDk:'#283A50', deck:'#8899AA',
    pedestal:'#FFD700', boom:'#E8C800',
    bridge:'#E0E0E0', funnel:'#FF6600',
    antifoul:'#7A1A1A',
  },
  {
    id:'alizés',
    name:'LES ALIZÉS',
    company:'JAN DE NUL',
    speed:2.5,
    cargo:[1,1,1],  // S, M, L per-type max
    maxCargo:1,     // total monopiles on deck
    desc:'VERY SLOW, MAX 1 TOTAL',
    detail:'5,000t crane • 3 knots',
    // Visual: blue hull (Jan De Nul blue), white superstructure, yellow crane
    hull:'#1B4F8A', hullDk:'#0E3460', deck:'#7090B0',
    pedestal:'#F0F0F0', boom:'#D4B000',
    bridge:'#FFFFFF', funnel:'#1B4F8A',
    antifoul:'#6A1515',
  },
];
let selectedVessel = 0;  // index into VESSELS
let activeVessel = VESSELS[0]; // current vessel config

/* ─── Cable laying vessel definitions ─── */
const CABLE_VESSELS = [
  {
    id:'ndurance',
    name:'NDURANCE',
    company:'BOSKALIS',
    speed:4.0,
    corridorWidth:55,
    desc:'FAST & AGILE',
    detail:'Cable lay vessel \u2022 120m',
    hull:'#4A6080', hullDk:'#334B60', deck:'#8899AA',
    bridge:'#E0E0E0', funnel:'#FF6600', antifoul:'#7A1A1A',
  },
  {
    id:'bokaocean',
    name:'BOKA OCEAN',
    company:'BOSKALIS',
    speed:2.8,
    corridorWidth:75,
    desc:'STEADY & WIDE CORRIDOR',
    detail:'Subsea construction \u2022 150m',
    hull:'#5A6A7A', hullDk:'#3A4A5A', deck:'#A0A8B0',
    bridge:'#F0F0F0', funnel:'#FF6600', antifoul:'#8B2020',
  },
];
let selectedCableVessel = 0;
let activeCableVessel = CABLE_VESSELS[0];

/* ─── Cable phase constants ─── */
const UXO_RADIUS = 5;
const UXO_PENALTY = 15;
const CORRIDOR_PENALTY_TIME = 2;
const CORRIDOR_GRACE = 0.5;
let screenShake = 0;  // remaining shake frames

/* ─── Storm settings ─── */
const STORM_MIN_INTERVAL = 40;
const STORM_MAX_INTERVAL = 80;
const STORM_WARNING_SEC  = 8;   // longer warning
const STORM_DURATION_SEC = 15;
const STORM_SPEED_MULT   = 0.5;

/* ─── Engine breakdown settings ─── */
const ENGINE_MIN_INTERVAL = 50;
const ENGINE_MAX_INTERVAL = 120;
const ENGINE_SPEED_MULT   = 0.4;  // limping speed

/* ─── Monopile definitions (base — cap is overridden by vessel choice) ─── */
const TYPES = [
  { name:'SMALL',  cap:4, col:'#00B800', dk:'#007000', r:8,  label:'S', depth:'<10m' },
  { name:'MEDIUM', cap:2, col:'#E8A000', dk:'#B07800', r:12, label:'M', depth:'10-25m' },
  { name:'LARGE',  cap:1, col:'#D83800', dk:'#A02000', r:16, label:'L', depth:'>25m' },
];
function getTypeCap(typeIdx){ return activeVessel.cargo[typeIdx]; }

/* ─── Port locations (furthest → closest to field) ─── */
const PORTS = [
  { x:300,  y:700, type:2, label:'LARGE (L)'  },
  { x:900,  y:700, type:1, label:'MEDIUM (M)' },
  { x:1600, y:700, type:0, label:'SMALL (S)'  },
];

/* ─── Installation field ─── */
const FX = 2300, FY = 350, FCOLS = 3, FROWS = 3, FDX = 200, FDY = 220;
const FIELD_RECT = { x:FX-80, y:FY-80, w:FCOLS*FDX+80, h:FROWS*FDY-80 };
const TOTAL_SITES = 7;

// ═════════════════════  AUDIO  ═════════════════════
let audioCtx = null;
let soundEnabled = true;
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
function beep(f,d,t){
  if(!audioCtx||!soundEnabled) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=t||'square'; o.frequency.value=f;
  g.gain.setValueAtTime(0.12,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+d);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+d);
}
function sfxLoad()   { beep(523,.1); setTimeout(()=>beep(659,.1),100); setTimeout(()=>beep(784,.15),200); }
function sfxInstall(){ beep(784,.1); setTimeout(()=>beep(988,.1),100); setTimeout(()=>beep(1318,.2),200); }
function sfxWin()    { [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,.25),i*140)); }
function sfxErr()    { beep(185,.35,'sawtooth'); }

function drawSoundIndicator(){
  ctx.save();
  ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillStyle=soundEnabled?'#888':'#F44';
  ctx.font='7px "Press Start 2P"';
  ctx.fillText(soundEnabled?'M = MUTE':'M = UNMUTE',W-8,H-16);
  ctx.restore();
}

// ═════════════════════  STATE  ═════════════════════
let state     = 'TITLE';   // TITLE | PHASE_SELECT | SELECT | PLAYING | CABLE_SELECT | CABLE_LAYING | CABLE_LOADING | WIN
let frame     = 0;
let gameTime  = 0;          // seconds (real clock)
let bestTime  = null;
let gameMode  = 'monopile'; // 'monopile' | 'cable' | 'both'
let selectedPhase = 0;      // 0=monopile, 1=cable, 2=both
function loadBest(){ const k='best_'+activeVessel.id; bestTime=localStorage.getItem(k)?+localStorage.getItem(k):null; }
function saveBest(){ const k='best_'+activeVessel.id; localStorage.setItem(k,''+gameTime); }

let vessel = { x:1600, y:700, ang:0, spd:0, hold:[0,0,0], busy:false, bTimer:0, bAct:null, bTgt:null, craneAng:0 };
function totalCargo(){ return vessel.hold[0]+vessel.hold[1]+vessel.hold[2]; }
function hasCargoType(t){ return vessel.hold[t]>0; }
let cam = { x:0, y:0 };
let sites = [];
let particles = [];
let floats = [];
let anims = [];  // active animations
let msg='', msgTimer=0;
let contextHint = '';

/* ─── Storm state ─── */
let storm = { active:false, warning:false, timer:0, nextStorm:0, survived:0 };

/* ─── Engine state ─── */
let engine = { broken:false, nextBreak:0 };

/* ─── Cable phase state ─── */
let cableSegments = [];
let activeCable = null;
let uxos = [];
let cableOutsideTimer = 0;
let monopileTime = 0;
let cableZoom = 1.0;
const CABLE_ZOOM_LAYING = 1.8;
const CABLE_LAYING_SPEED_MULT = 0.4;

/* ─── Cable loading minigame state ─── */
const CABLE_PORT = { x:1900, y:700 }; // port location for cable loading
const CABLE_PER_LOAD = 3;            // segments of cable per load
const CABLE_MAX_LOADS = 2;           // max times player can load cable
let cableLoaded = 0;                 // remaining cable segments on vessel
let cableLoadCount = 0;              // how many times cable has been loaded
let cableLoadProgress = 0;           // 0→1 loading progress
let cableLoadLastKey = '';           // 'up' or 'down' — must alternate
let cableLoadSpinSpeed = 0;          // carousel spin speed (decays)
let cableLoadAngle = 0;              // carousel visual rotation

/* ─── Init / reset ─── */
function initGame(){
  loadBest();
  vessel = { x:1600, y:700, ang:0, spd:0,
             hold:[0,0,0],
             busy:false, bTimer:0, bAct:null, bTgt:null, craneAng:0 };
  cam = { x:0, y:0 };
  particles = [];
  floats    = [];
  anims     = [];
  gameTime  = 0;
  frame     = 0;
  msg=''; msgTimer=0;
  storm = { active:false, warning:false, timer:0,
            nextStorm: STORM_MIN_INTERVAL + Math.random()*(STORM_MAX_INTERVAL-STORM_MIN_INTERVAL),
            survived:0 };
  engine = { broken:false,
             nextBreak: ENGINE_MIN_INTERVAL + Math.random()*(ENGINE_MAX_INTERVAL-ENGINE_MIN_INTERVAL) };
  genSites();
}

function genSites(){
  // 4x Small (shallow), 2x Medium, 1x Large (deep water) = 7 total
  const arr = [0,0,0,0, 1,1, 2];
  for(let i=arr.length-1;i>0;i--){ const j=Math.random()*i|0; [arr[i],arr[j]]=[arr[j],arr[i]]; }
  // Place 7 sites in a natural offshore pattern
  const positions = [
    {r:0,c:0},{r:0,c:1},{r:0,c:2},
    {r:1,c:0},{r:1,c:2},
    {r:2,c:0},{r:2,c:1}
  ];
  sites=[];
  for(let k=0;k<positions.length;k++){
    const p=positions[k];
    sites.push({ x:FX+p.c*FDX, y:FY+p.r*FDY, type:arr[k], done:false });
  }
  // Set port stock based on how many sites need each type
  for(const p of PORTS){
    p.stock = sites.filter(s=>s.type===p.type).length;
  }
}

// ═════════════════════  INPUT  ═════════════════════
const keys={};
window.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Space') e.preventDefault();
  // Toggle sound
  if(e.code==='KeyM'){ soundEnabled=!soundEnabled; return; }
  if(state==='TITLE'  && (e.code==='Enter'||e.code==='Space')){ ensureAudio(); state='PHASE_SELECT'; selectedPhase=0; return; }
  if(state==='PHASE_SELECT'){
    if(e.code==='ArrowLeft'||e.code==='KeyA')  { selectedPhase=(selectedPhase+2)%3; beep(400,.05); return; }
    if(e.code==='ArrowRight'||e.code==='KeyD') { selectedPhase=(selectedPhase+1)%3; beep(400,.05); return; }
    if(e.code==='Enter'||e.code==='Space'){
      if(selectedPhase===0){ gameMode='monopile'; state='SELECT'; selectedVessel=0; }
      else if(selectedPhase===1){ gameMode='cable'; state='CABLE_SELECT'; selectedCableVessel=0; }
      else { gameMode='both'; state='SELECT'; selectedVessel=0; }
      beep(600,.1); return;
    }
    if(e.code==='Escape'||e.code==='Backspace'){ state='TITLE'; return; }
    return;
  }
  if(state==='SELECT'){
    if(e.code==='ArrowLeft'||e.code==='KeyA')  { selectedVessel=(selectedVessel+2)%3; beep(400,.05); return; }
    if(e.code==='ArrowRight'||e.code==='KeyD') { selectedVessel=(selectedVessel+1)%3; beep(400,.05); return; }
    if(e.code==='Enter'||e.code==='Space'){
      activeVessel=VESSELS[selectedVessel];
      state='PLAYING'; initGame();
      beep(600,.1); setTimeout(()=>beep(800,.1),100);
      return;
    }
    if(e.code==='Escape'||e.code==='Backspace'){ state='PHASE_SELECT'; return; }
  }
  if(state==='PLAYING'&&  e.code==='Space') doAction();
  if(state==='CABLE_SELECT'){
    if(e.code==='ArrowLeft'||e.code==='KeyA'||e.code==='ArrowRight'||e.code==='KeyD')
      { selectedCableVessel=(selectedCableVessel+1)%2; beep(400,.05); return; }
    if(e.code==='Enter'||e.code==='Space'){
      activeCableVessel=CABLE_VESSELS[selectedCableVessel];
      state='CABLE_LAYING'; initCablePhase();
      beep(600,.1); setTimeout(()=>beep(800,.1),100);
      return;
    }
    if(e.code==='Escape'||e.code==='Backspace'){ state='PHASE_SELECT'; return; }
    return;
  }
  if(state==='CABLE_LAYING' && e.code==='Space') doCableAction();
  if(state==='CABLE_LOADING'){
    if(e.code==='ArrowUp'||e.code==='KeyW'){
      if(cableLoadLastKey!=='up'){ cableLoadSpinSpeed=Math.min(cableLoadSpinSpeed+0.12,1.0); cableLoadLastKey='up'; beep(300+cableLoadProgress*400,.03); } return;
    }
    if(e.code==='ArrowDown'||e.code==='KeyS'){
      if(cableLoadLastKey!=='down'){ cableLoadSpinSpeed=Math.min(cableLoadSpinSpeed+0.12,1.0); cableLoadLastKey='down'; beep(300+cableLoadProgress*400,.03); } return;
    }
    return;
  }
  if(state==='WIN'    && (e.code==='Enter'||e.code==='Space')){ state='TITLE'; return; }
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });

// ═════════════════════  TOUCH INPUT  ═════════════════════
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* Prevent ALL scroll/zoom/bounce on iOS */
document.addEventListener('touchstart', e => { if(e.target===canvas) e.preventDefault(); }, {passive:false});
document.addEventListener('touchmove',  e => e.preventDefault(), {passive:false});
document.addEventListener('touchend',   e => { if(e.target===canvas) e.preventDefault(); }, {passive:false});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

/* ─── Touch steering: finger position on screen to steer ─── */
let steerTouchId = null;       // active steering touch
let steerTouchPos = null;      // current {x,y} screen pos of steering finger
let steerOrigin = null;        // for cable loading flick detection
let touchSteering = false;     // true while actively steering via touch

function canvasTouchToGame(t){
  const rect = canvas.getBoundingClientRect();
  return { x: (t.clientX - rect.left) / rect.width * W,
           y: (t.clientY - rect.top)  / rect.height * H };
}

/* Convert screen touch to game-world position */
function screenTouchToWorld(t){
  const rect = canvas.getBoundingClientRect();
  const gx = (t.clientX - rect.left) / rect.width * W;
  const gy = (t.clientY - rect.top)  / rect.height * H;
  return { x: gx + cam.x, y: gy + cam.y };
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  ensureAudio();
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  const t = e.changedTouches[0];
  const gp = canvasTouchToGame(t);

  // Menu screens: handle taps
  if(state==='TITLE'){ state='PHASE_SELECT'; selectedPhase=0; return; }
  if(state==='PHASE_SELECT'){
    if(gp.x < W*0.33){ selectedPhase=(selectedPhase+2)%3; beep(400,.05); }
    else if(gp.x > W*0.67){ selectedPhase=(selectedPhase+1)%3; beep(400,.05); }
    else {
      if(selectedPhase===0){ gameMode='monopile'; state='SELECT'; selectedVessel=0; }
      else if(selectedPhase===1){ gameMode='cable'; state='CABLE_SELECT'; selectedCableVessel=0; }
      else { gameMode='both'; state='SELECT'; selectedVessel=0; }
      beep(600,.1);
    }
    return;
  }
  if(state==='SELECT'){
    if(gp.x < W*0.33){ selectedVessel=(selectedVessel+2)%3; beep(400,.05); }
    else if(gp.x > W*0.67){ selectedVessel=(selectedVessel+1)%3; beep(400,.05); }
    else {
      activeVessel=VESSELS[selectedVessel];
      state='PLAYING'; initGame();
      beep(600,.1); setTimeout(()=>beep(800,.1),100);
    }
    return;
  }
  if(state==='CABLE_SELECT'){
    if(gp.x < W*0.5){ selectedCableVessel=(selectedCableVessel+1)%2; beep(400,.05); }
    else {
      activeCableVessel=CABLE_VESSELS[selectedCableVessel];
      state='CABLE_LAYING'; initCablePhase();
      beep(600,.1); setTimeout(()=>beep(800,.1),100);
    }
    return;
  }
  if(state==='WIN'){ state='TITLE'; return; }

  // Cable loading minigame: flick up/down
  if(state==='CABLE_LOADING'){
    steerOrigin = {x: t.clientX, y: t.clientY};
    steerTouchId = t.identifier;
    return;
  }

  // Gameplay states: start steering touch
  if(state==='PLAYING' || state==='CABLE_LAYING'){
    if(steerTouchId === null){
      steerTouchId = t.identifier;
      steerTouchPos = {x: t.clientX, y: t.clientY};
      touchSteering = true;
    }
  }
}, {passive:false});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for(const t of e.changedTouches){
    if(t.identifier === steerTouchId){
      steerTouchPos = {x: t.clientX, y: t.clientY};

      // Cable loading: detect up/down flicks
      if(state==='CABLE_LOADING' && steerOrigin){
        const dy = t.clientY - steerOrigin.y;
        if(dy < -30 && cableLoadLastKey!=='up'){
          cableLoadSpinSpeed=Math.min(cableLoadSpinSpeed+0.12,1.0); cableLoadLastKey='up';
          beep(300+cableLoadProgress*400,.03);
          steerOrigin.y = t.clientY;
        } else if(dy > 30 && cableLoadLastKey!=='down'){
          cableLoadSpinSpeed=Math.min(cableLoadSpinSpeed+0.12,1.0); cableLoadLastKey='down';
          beep(300+cableLoadProgress*400,.03);
          steerOrigin.y = t.clientY;
        }
      }
    }
  }
}, {passive:false});

const endSteer = e => {
  for(const t of e.changedTouches){
    if(t.identifier === steerTouchId){
      steerTouchId = null;
      steerTouchPos = null;
      steerOrigin = null;
      touchSteering = false;
      keys['ArrowLeft'] = false; keys['ArrowRight'] = false;
      keys['ArrowUp'] = false; keys['ArrowDown'] = false;
    }
  }
};
canvas.addEventListener('touchend', endSteer);
canvas.addEventListener('touchcancel', endSteer);

/* Apply touch steering in update — boat turns toward finger position */
function applyTouchSteering(){
  if(!touchSteering || steerTouchId === null || !steerTouchPos) return;
  if(state!=='PLAYING' && state!=='CABLE_LAYING') return;

  // Convert finger screen pos to world coordinates
  const rect = canvas.getBoundingClientRect();
  const gx = (steerTouchPos.x - rect.left) / rect.width * W + cam.x;
  const gy = (steerTouchPos.y - rect.top)  / rect.height * H + cam.y;

  // Angle from vessel to finger in world space
  const dx = gx - vessel.x;
  const dy = gy - vessel.y;
  const targetAng = Math.atan2(dy, dx);

  // Calculate shortest angle difference
  let diff = targetAng - vessel.ang;
  while(diff > Math.PI)  diff -= Math.PI*2;
  while(diff < -Math.PI) diff += Math.PI*2;

  // Steer toward the finger
  const deadzone = 0.15; // ~8 degrees
  keys['ArrowLeft']  = diff < -deadzone;
  keys['ArrowRight'] = diff > deadzone;

  // Always throttle while touching
  keys['ArrowUp'] = true;
  keys['ArrowDown'] = false;
}

/* ─── Action button ─── */
const btnAction = document.getElementById('btn-action');
if(btnAction){
  btnAction.addEventListener('touchstart', e => {
    e.preventDefault();
    ensureAudio();
    if(state==='TITLE'){ state='PHASE_SELECT'; selectedPhase=0; return; }
    if(state==='PHASE_SELECT'){
      if(selectedPhase===0){ gameMode='monopile'; state='SELECT'; selectedVessel=0; }
      else if(selectedPhase===1){ gameMode='cable'; state='CABLE_SELECT'; selectedCableVessel=0; }
      else { gameMode='both'; state='SELECT'; selectedVessel=0; }
      beep(600,.1); return;
    }
    if(state==='SELECT'){
      activeVessel=VESSELS[selectedVessel];
      state='PLAYING'; initGame();
      beep(600,.1); setTimeout(()=>beep(800,.1),100);
      return;
    }
    if(state==='CABLE_SELECT'){
      activeCableVessel=CABLE_VESSELS[selectedCableVessel];
      state='CABLE_LAYING'; initCablePhase();
      beep(600,.1); setTimeout(()=>beep(800,.1),100);
      return;
    }
    if(state==='PLAYING') doAction();
    if(state==='CABLE_LAYING') doCableAction();
    if(state==='WIN'){ state='TITLE'; return; }
  }, {passive:false});
}

/* ─── Mute button ─── */
const btnMute = document.getElementById('btn-mute');
if(btnMute){
  btnMute.addEventListener('touchstart', e => {
    e.preventDefault();
    soundEnabled = !soundEnabled;
  }, {passive:false});
}

// ═════════════════════  ACTIONS  ═════════════════════
function doAction(){
  if(vessel.busy) return;

  // Port?
  for(const p of PORTS){
    if(dist(vessel,p)<90){
      const t=TYPES[p.type];
      const remaining = sites.filter(s=>!s.done && s.type===p.type).length;
      const alreadyLoaded = vessel.hold[p.type];
      const need = remaining - alreadyLoaded;
      const freeSpace = activeVessel.maxCargo - totalCargo();
      if(freeSpace<=0){
        setMsg('DECK FULL!');
        sfxErr();
        return;
      }
      if(need<=0){
        setMsg(alreadyLoaded>0 ? 'ALREADY LOADED!' : 'NO '+t.name+' SITES LEFT!');
        sfxErr();
        return;
      }
      const cap = Math.min(getTypeCap(p.type), need, freeSpace);
      vessel.hold[p.type]+=cap;
      p.stock-=cap;
      vessel.busy=true; vessel.bTimer=LOAD_BUSY;
      vessel.bAct='load'; vessel.bTgt=p;
      vessel.spd=0;
      setMsg('LOADING '+cap+'x '+t.name+'...');
      anims.push({ type:'load', timer:LOAD_FRAMES, maxT:LOAD_FRAMES, port:p, pType:p.type, amt:cap });
      sfxLoad();
      return;
    }
  }

  // Install site?
  if(totalCargo()>0){
    for(const s of sites){
      if(s.done) continue;
      if(dist(vessel,s)<55){
        if(hasCargoType(s.type)){
          vessel.busy=true; vessel.bTimer=INSTALL_BUSY;
          vessel.bAct='install'; vessel.bTgt=s;
          setMsg('INSTALLING '+TYPES[s.type].name+'...');
          anims.push({ type:'install', timer:INSTALL_FRAMES, maxT:INSTALL_FRAMES, site:s, pType:s.type });
          return;
        } else {
          setMsg('NO '+TYPES[s.type].name+' ON BOARD!');
          sfxErr();
          return;
        }
      }
    }
  }
}

function setMsg(t){ msg=t; msgTimer=110; }

function addFloat(x,y,text,col){
  floats.push({x,y,text,col:col||'#FFF',life:60});
}

// ═════════════════════  UPDATE  ═════════════════════
function update(dt){
  if(state==='CABLE_LOADING'){ updateCableLoading(dt); return; }
  if(state==='CABLE_LAYING'){ updateCableLaying(dt); return; }
  if(state!=='PLAYING') return;
  frame++;
  gameTime += dt;
  if(msgTimer>0) msgTimer--;

  // Busy (loading / installing)
  if(vessel.busy){
    vessel.bTimer--;
    if(vessel.bTimer<=0){
      if(vessel.bAct==='load'){
        const lt=vessel.bTgt; const ltype=lt.type;
        setMsg(vessel.hold[ltype]+'x '+TYPES[ltype].name+' LOADED!');
        burst(vessel.x, vessel.y, 8, TYPES[ltype].col);
      }
      if(vessel.bAct==='install' && vessel.bTgt){
        const itype=vessel.bTgt.type;
        vessel.bTgt.done = true;
        vessel.hold[itype]--;
        if(vessel.hold[itype]<0) vessel.hold[itype]=0;
        addFloat(vessel.bTgt.x, vessel.bTgt.y-30, 'INSTALLED!', '#0F0');
        // big splash
        for(let i=0;i<20;i++){
          const a=Math.random()*Math.PI*2, sp=1.5+Math.random()*3;
          particles.push({x:vessel.bTgt.x,y:vessel.bTgt.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:30+Math.random()*20,col:'#8CF',sz:3});
        }
        // water ring anim
        anims.push({type:'splash', x:vessel.bTgt.x, y:vessel.bTgt.y, timer:40, maxT:40});
        sfxInstall();
        if(sites.every(s=>s.done)){
          monopileTime = gameTime;
          if(gameMode==='both'){
            state='CABLE_SELECT';
            selectedCableVessel=0;
            sfxWin();
            setMsg('PHASE 1 COMPLETE!');
          } else {
            state='WIN';
            if(!bestTime||gameTime<bestTime){ bestTime=gameTime; saveBest(); }
            sfxWin();
          }
        }
      }
      vessel.busy=false; vessel.bAct=null; vessel.bTgt=null;
    }
    // Tick animations and particles while busy so crane anim plays immediately
    for(let i=anims.length-1;i>=0;i--){
      anims[i].timer--;
      if(anims[i].timer<=0) anims.splice(i,1);
    }
    for(let i=particles.length-1;i>=0;i--){
      const p2=particles[i]; p2.x+=p2.vx; p2.y+=p2.vy; p2.life--;
      if(p2.life<=0) particles.splice(i,1);
    }
    for(let i=floats.length-1;i>=0;i--){
      const f=floats[i]; f.y-=0.7; f.life--;
      if(f.life<=0) floats.splice(i,1);
    }
    return;
  }

  // Movement – ship steering: Left/Right rotate, Up = throttle, Down = brake
  applyTouchSteering();
  let turning=0, throttle=false, braking=false;
  if(keys['ArrowLeft']||keys['KeyA'])  turning--;
  if(keys['ArrowRight']||keys['KeyD']) turning++;
  if(keys['ArrowUp']||keys['KeyW'])    throttle=true;
  if(keys['ArrowDown']||keys['KeyS'])  braking=true;

  vessel.ang += turning * V_TURN * (0.5 + Math.min(vessel.spd / activeVessel.speed, 1) * 0.5);
  if(throttle){
    vessel.spd = Math.min(vessel.spd + activeVessel.speed * 0.03, activeVessel.speed);
  } else if(braking){
    vessel.spd *= 0.90;
  } else {
    vessel.spd *= 0.97;
  }
  const spdMult = storm.active ? STORM_SPEED_MULT : engine.broken ? ENGINE_SPEED_MULT : 1;
  if(vessel.spd>0.08){
    vessel.x += Math.cos(vessel.ang)*vessel.spd*spdMult;
    vessel.y += Math.sin(vessel.ang)*vessel.spd*spdMult;
    // wake
    if(frame%2===0) particles.push({
      x:vessel.x - Math.cos(vessel.ang)*32,
      y:vessel.y - Math.sin(vessel.ang)*32,
      vx:(Math.random()-.5)*.5, vy:(Math.random()-.5)*.5,
      life:40, col:'rgba(200,230,255,0.5)', sz:3
    });
  } else if(!throttle) vessel.spd=0;

  vessel.x = clamp(vessel.x,30,WORLD_W-30);
  vessel.y = clamp(vessel.y,30,WORLD_H-30);

  // Camera
  cam.x += (vessel.x-W/2 - cam.x)*0.08;
  cam.y += (vessel.y-H/2 - cam.y)*0.08;
  cam.x = clamp(cam.x, 0, WORLD_W-W);
  cam.y = clamp(cam.y, 0, WORLD_H-H);

  // Context hint
  contextHint = '';
  for(const p of PORTS){
    if(dist(vessel,p)<90){
      const rem2 = sites.filter(s2=>!s2.done && s2.type===p.type).length - vessel.hold[p.type];
      const free2 = activeVessel.maxCargo - totalCargo();
      if(free2<=0) contextHint = 'DECK FULL! ('+totalCargo()+'/'+activeVessel.maxCargo+')';
      else if(rem2>0) contextHint = (isTouchDevice?'TAP':'SPACE')+' = LOAD '+TYPES[p.type].name+' ('+Math.min(getTypeCap(p.type),rem2,free2)+'x) ['+totalCargo()+'/'+activeVessel.maxCargo+']';
      else if(vessel.hold[p.type]>0) contextHint = TYPES[p.type].name+' ALREADY LOADED';
      else contextHint = 'NO '+TYPES[p.type].name+' SITES LEFT';
      break;
    }
  }
  if(!contextHint && totalCargo()>0){
    for(const s of sites){
      if(s.done) continue;
      if(dist(vessel,s)<55){
        contextHint = hasCargoType(s.type) ? (isTouchDevice?'TAP':'SPACE')+' = INSTALL '+TYPES[s.type].name : 'NO '+TYPES[s.type].name+' ON BOARD';
        break;
      }
    }
  }
  if(!contextHint && totalCargo()===0 && frame>60){
    contextHint = engine.broken ? 'ENGINE FAILURE! GO TO PORT FOR REPAIRS' : 'SAIL TO A PORT TO PICK UP MONOPILES';
  }

  // Particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
  // Floats
  for(let i=floats.length-1;i>=0;i--){
    const f=floats[i]; f.y-=0.7; f.life--;
    if(f.life<=0) floats.splice(i,1);
  }
  // Animations
  for(let i=anims.length-1;i>=0;i--){
    anims[i].timer--;
    if(anims[i].timer<=0) anims.splice(i,1);
  }

  // ── Engine breakdown system ──
  if(!engine.broken && !vessel.busy){
    engine.nextBreak -= dt;
    if(engine.nextBreak <= 0){
      engine.broken = true;
      setMsg('ENGINE FAILURE! REDUCED SPEED!');
      beep(100,.6,'sawtooth');
      burst(vessel.x, vessel.y, 10, '#555');
    }
  }
  // Repair engine at port
  if(engine.broken){
    for(const p of PORTS){
      if(dist(vessel,p) < 90){
        engine.broken = false;
        engine.nextBreak = ENGINE_MIN_INTERVAL + Math.random()*(ENGINE_MAX_INTERVAL-ENGINE_MIN_INTERVAL);
        setMsg('ENGINE REPAIRED!');
        sfxLoad();
        break;
      }
    }
  }

  // ── Storm system ──
  if(!storm.active && !storm.warning && !vessel.busy){
    storm.nextStorm -= dt;
    if(storm.nextStorm <= 0){
      storm.warning = true;
      storm.timer = STORM_WARNING_SEC;
      setMsg('STORM APPROACHING! HEAD TO PORT!');
      beep(220,.4,'sawtooth');
    }
  }
  if(storm.warning){
    storm.timer -= dt;
    if(storm.timer <= 0){
      storm.warning = false;
      storm.active = true;
      storm.timer = STORM_DURATION_SEC;
      setMsg('STORM! GET TO PORT!');
      beep(150,.6,'sawtooth');
    }
  }
  if(storm.active){
    storm.timer -= dt;
    // Check if vessel reached any port
    let inPort = false;
    for(const p of PORTS){
      if(dist(vessel,p) < 90){ inPort = true; break; }
    }
    if(inPort){
      storm.active = false;
      storm.survived++;
      storm.nextStorm = STORM_MIN_INTERVAL + Math.random()*(STORM_MAX_INTERVAL-STORM_MIN_INTERVAL);
      setMsg('STORM SURVIVED!');
      sfxLoad();
    } else if(storm.timer <= 0){
      // Failed — lose cargo and teleport to nearest port, time penalty
      storm.active = false;
      storm.nextStorm = STORM_MIN_INTERVAL + Math.random()*(STORM_MAX_INTERVAL-STORM_MIN_INTERVAL);
      vessel.hold = [0,0,0];
      // teleport to closest port
      let closest = PORTS[0], md2 = Infinity;
      for(const p of PORTS){ const d2=dist(vessel,p); if(d2<md2){md2=d2; closest=p;} }
      vessel.x = closest.x; vessel.y = closest.y;
      gameTime += 30; // 30 sec penalty
      setMsg('STORM! CARGO LOST (+30s)');
      beep(110,.5,'sawtooth');
      burst(vessel.x, vessel.y, 20, '#F44');
    }
  }
}

// ═════════════════════  HELPERS  ═════════════════════
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function clamp(v,lo,hi){ return v<lo?lo:v>hi?hi:v; }
function burst(x,y,n,col){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, s=1+Math.random()*2.5;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30+Math.random()*20,col,sz:3});
  }
}

// ═══════════  UXO EXPLOSION  ═══════════
let explosions = [];
function spawnExplosion(wx,wy){
  explosions.push({x:wx, y:wy, t:0, maxT:140});
  // massive debris burst
  for(let i=0;i<80;i++){
    const a=Math.random()*Math.PI*2, s=2+Math.random()*7;
    const cols=['#FF4400','#FF8800','#FFCC00','#FFF','#FF2200','#AA3300','#FF6600'];
    particles.push({x:wx,y:wy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:60+Math.random()*60, col:cols[Math.random()*cols.length|0], sz:3+Math.random()*6});
  }
  // smoke clouds
  for(let i=0;i<35;i++){
    const a=Math.random()*Math.PI*2, s=0.4+Math.random()*2;
    particles.push({x:wx,y:wy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:90+Math.random()*50, col:'rgba(80,60,40,0.6)', sz:5+Math.random()*8});
  }
}
function drawExplosions(){
  for(let i=explosions.length-1;i>=0;i--){
    const e=explosions[i];
    const sx=e.x-cam.x, sy=e.y-cam.y;
    const p=e.t/e.maxT; // 0→1
    // Screen flash (first 10%)
    if(p<0.1){
      const fp=p/0.1;
      ctx.fillStyle=`rgba(255,240,200,${0.4*(1-fp)})`;
      ctx.fillRect(0,0,W,H);
    }
    // Fireball flash (first 40%)
    if(p<0.4){
      const fp=p/0.4;
      const r=40+fp*140;
      const a2=1-fp;
      ctx.save();
      const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r);
      g.addColorStop(0,`rgba(255,255,220,${a2})`);
      g.addColorStop(0.2,`rgba(255,200,50,${a2*0.9})`);
      g.addColorStop(0.5,`rgba(255,100,0,${a2*0.7})`);
      g.addColorStop(0.8,`rgba(200,40,0,${a2*0.4})`);
      g.addColorStop(1,`rgba(100,20,0,0)`);
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // Secondary fireball (delayed 10%-50%)
    if(p>0.1&&p<0.5){
      const fp=(p-0.1)/0.4;
      const r=25+fp*100;
      const a2=0.7*(1-fp);
      ctx.save();
      const g=ctx.createRadialGradient(sx+15,sy-10,0,sx+15,sy-10,r);
      g.addColorStop(0,`rgba(255,220,100,${a2})`);
      g.addColorStop(0.5,`rgba(255,80,0,${a2*0.6})`);
      g.addColorStop(1,`rgba(80,10,0,0)`);
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(sx+15,sy-10,r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // Expanding smoke ring (25%-100%)
    if(p>0.25){
      const rp=(p-0.25)/0.75;
      const rr=50+rp*180;
      const a3=0.5*(1-rp);
      ctx.strokeStyle=`rgba(60,40,20,${a3})`;
      ctx.lineWidth=8+rp*18;
      ctx.beginPath(); ctx.arc(sx,sy,rr,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=1;
    }
    // Shockwave ring (first 45%)
    if(p<0.45){
      const sp=p/0.45;
      const sr=sp*220;
      ctx.strokeStyle=`rgba(255,200,100,${0.6*(1-sp)})`;
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=1;
    }
    // Water splash ring (15%-60%)
    if(p>0.15&&p<0.6){
      const wp=(p-0.15)/0.45;
      const wr=30+wp*160;
      ctx.strokeStyle=`rgba(150,200,255,${0.35*(1-wp)})`;
      ctx.lineWidth=4+wp*6;
      ctx.beginPath(); ctx.arc(sx,sy,wr,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=1;
    }
    e.t++;
    if(e.t>=e.maxT) explosions.splice(i,1);
  }
}

// ═════════════════════  DRAWING  ═════════════════════

/* ── Water ── */
function drawWater(time){
  const cols=['#1255A0','#1565C0','#1976D2','#1E88E5'];
  const sx=Math.floor(cam.x/TILE)*TILE;
  const sy=Math.floor(cam.y/TILE)*TILE;
  for(let y=sy;y<cam.y+H+TILE;y+=TILE){
    for(let x=sx;x<cam.x+W+TILE;x+=TILE){
      ctx.fillStyle=cols[((x/TILE|0)+(y/TILE|0))&3];
      ctx.fillRect(x-cam.x, y-cam.y, TILE, TILE);
    }
  }
}

/* ── Brick block ── */
function drawBrick(bx,by,bw,bh){
  ctx.fillStyle='#C84C09';
  ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle='#A03800';
  const BW=12,BH=6;
  for(let r=0;r<bh;r+=BH){
    const off=((r/BH|0)&1)*(BW/2);
    for(let c=-BW;c<bw+BW;c+=BW){
      const lx=bx+c+off;
      if(lx>=bx&&lx<bx+bw) ctx.fillRect(lx,by+r,1,Math.min(BH,bh-r));
    }
    if(r>0) ctx.fillRect(bx,by+r,bw,1);
  }
  ctx.strokeStyle='#7A2C06'; ctx.strokeRect(bx,by,bw,bh);
}

/* ── Mario-style pipe (= monopile!) ── */
function drawPipe(px, py, r, h, col, dk){
  ctx.fillStyle=col;
  ctx.fillRect(px-r, py, r*2, h);
  // rim
  ctx.fillRect(px-r-2, py, r*2+4, 5);
  // highlight
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.fillRect(px-r+1, py+5, 2, h-5);
  // shadow
  ctx.fillStyle=dk;
  ctx.fillRect(px+r-2, py+5, 2, h-5);
  ctx.fillRect(px-r-2, py, r*2+4, 1);
  // inner hole (dark)
  ctx.fillStyle='rgba(0,0,0,0.25)';
  ctx.fillRect(px-r+2, py+1, r*2-4, 3);
}

/* ── Port ── */
function drawPort(p){
  const sx=p.x-cam.x, sy=p.y-cam.y;
  const iw=140, ih=100;
  const time=Date.now();

  // Water edge / waves around port
  ctx.fillStyle='rgba(60,140,200,0.15)';
  ctx.beginPath();
  ctx.ellipse(sx,sy+ih/2+5,iw/2+20,14,0,0,Math.PI*2); ctx.fill();
  for(let i=0;i<5;i++){
    const wx=sx-iw/2-10+i*(iw+20)/4;
    const wy=sy+ih/2+2+Math.sin(time/600+i*1.3)*3;
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(wx,wy); ctx.quadraticCurveTo(wx+10,wy-3,wx+20,wy); ctx.stroke();
  }

  // Concrete quay base
  const qx=sx-iw/2, qy=sy-ih/2;
  ctx.fillStyle='#8A8A8A'; ctx.fillRect(qx,qy,iw,ih);
  ctx.fillStyle='#9A9A9A'; ctx.fillRect(qx,qy,iw,4); // top highlight
  ctx.fillStyle='#6A6A6A'; ctx.fillRect(qx,qy+ih-3,iw,3); // bottom shadow
  // Concrete texture lines
  ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1;
  for(let i=1;i<4;i++) { ctx.beginPath(); ctx.moveTo(qx,qy+i*ih/4); ctx.lineTo(qx+iw,qy+i*ih/4); ctx.stroke(); }
  ctx.strokeStyle='#666'; ctx.strokeRect(qx,qy,iw,ih);

  // Wooden dock fenders (brown bumpers on sides)
  ctx.fillStyle='#6B4226';
  ctx.fillRect(qx-6,qy+10,6,ih-20);
  ctx.fillRect(qx+iw,qy+10,6,ih-20);
  // Fender bolts
  ctx.fillStyle='#444';
  for(let i=0;i<3;i++){
    ctx.fillRect(qx-5,qy+18+i*25,4,4);
    ctx.fillRect(qx+iw+1,qy+18+i*25,4,4);
  }

  // Bollards (mooring posts)
  for(let i=0;i<2;i++){
    const bx=qx+20+i*(iw-40);
    ctx.fillStyle='#333'; ctx.fillRect(bx-3,qy-6,6,8);
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(bx,qy-6,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(bx,qy-6,2,0,Math.PI*2); ctx.fill();
  }

  // Crane gantry (port crane silhouette)
  const crX=qx+iw-25, crY=qy-8;
  ctx.fillStyle='#E8C800'; // yellow crane
  ctx.fillRect(crX-3,crY-55,6,55); // vertical mast
  ctx.fillRect(crX-3,crY-55,30,4); // horizontal boom
  ctx.fillRect(crX-3,crY-55,-15,4); // counter-boom
  ctx.fillStyle='#D0B000';
  ctx.fillRect(crX+23,crY-51,4,4); // boom tip block
  // Cable from boom
  ctx.strokeStyle='#666'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(crX+25,crY-47); ctx.lineTo(crX+25,crY-20); ctx.stroke();
  // Hook
  ctx.fillStyle='#888'; ctx.fillRect(crX+23,crY-22,4,5);

  // Pipes/monopiles stored on quay — based on actual stock
  const t=TYPES[p.type];
  const stockCount = p.stock||0;
  const sp=30;
  for(let i=0;i<stockCount;i++){
    drawPipe(sx-(stockCount-1)*sp/2+i*sp-10, qy+18, t.r, t.r*2+8, t.col, t.dk);
  }

  // Pipe rack supports
  ctx.fillStyle='#777';
  const rackW = Math.max(stockCount,1)*sp;
  ctx.fillRect(sx-rackW/2-5,qy+18+t.r*2+6,rackW,3);
  ctx.fillRect(sx-rackW/2,qy+18+t.r*2+9,3,8);
  ctx.fillRect(sx+rackW/2-5,qy+18+t.r*2+9,3,8);

  // Safety striping (yellow/black) along quay edge
  const stripeW=iw;
  for(let i=0;i<stripeW;i+=8){
    ctx.fillStyle=(i/8|0)%2===0?'#E8C800':'#222';
    ctx.fillRect(qx+i,qy+ih-6,Math.min(8,stripeW-i),3);
  }

  // Sign board with better styling
  const sw=110, sh=26;
  const signX=sx-sw/2, signY=qy-sh-12;
  // Sign posts
  ctx.fillStyle='#666';
  ctx.fillRect(signX+10,signY+sh,3,12); ctx.fillRect(signX+sw-13,signY+sh,3,12);
  // Sign background
  ctx.fillStyle='#1A3A5C';
  ctx.fillRect(signX,signY,sw,sh);
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.fillRect(signX+2,signY+2,sw-4,sh/2-2);
  ctx.strokeStyle='#FFF'; ctx.lineWidth=2;
  ctx.strokeRect(signX+3,signY+3,sw-6,sh-6);
  ctx.lineWidth=1;
  ctx.strokeStyle='#0D2440'; ctx.strokeRect(signX,signY,sw,sh);
  // Text
  ctx.fillStyle='#FFF'; ctx.font='8px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(p.label, sx, signY+sh/2);

  // Light on sign (blinking)
  const blink=Math.sin(time/500)>0;
  ctx.fillStyle=blink?'#0F0':'#040';
  ctx.beginPath(); ctx.arc(signX+sw-10,signY+5,2,0,Math.PI*2); ctx.fill();

  // Interaction ring when close
  if(state==='PLAYING' && dist(vessel,p)<90){
    const pulse=0.4+Math.sin(time/200)*0.3;
    ctx.strokeStyle=`rgba(255,255,0,${pulse})`;
    ctx.lineWidth=2;
    ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(sx,sy,75,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth=1;
  }
}

/* ── Field boundary / buoys ── */
function drawField(){
  const r=FIELD_RECT;
  const rx=r.x-cam.x, ry=r.y-cam.y;
  // dashed border
  ctx.setLineDash([8,5]);
  ctx.strokeStyle='rgba(255,220,0,0.22)';
  ctx.strokeRect(rx, ry, r.w, r.h);
  ctx.setLineDash([]);
  // label
  ctx.fillStyle='rgba(255,220,0,0.25)'; ctx.font='10px "Press Start 2P"';
  ctx.textAlign='center';
  ctx.fillText('WIND FARM', rx+r.w/2, ry-10);
  // corner buoys
  const bPos=[[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]];
  for(const [bx,by] of bPos){
    const sx2=bx-cam.x, sy2=by-cam.y;
    ctx.fillStyle='#FF4400'; ctx.fillRect(sx2-4,sy2-4,8,8);
    ctx.fillStyle='#FF0';    ctx.fillRect(sx2-3,sy2-9,6,6);
  }
}

/* ── Installation site ── */
function drawSite(s){
  const sx=s.x-cam.x, sy=s.y-cam.y;
  const t=TYPES[s.type];
  if(s.done){
    // installed pipe sticking out
    drawPipe(sx, sy-t.r*2-6, t.r, t.r*2+8, t.col, t.dk);
    // splash ring
    ctx.strokeStyle='rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, t.r+8, 4, 0, 0, Math.PI*2);
    ctx.stroke();
    // check mark
    ctx.fillStyle='#0F0'; ctx.font='10px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('\u2713', sx, sy+18);
  } else {
    // pulsing marker
    const pulse = Math.sin(frame*0.06)*3;
    const match = hasCargoType(s.type);
    // glow for matching type
    if(match){
      ctx.fillStyle=`rgba(255,255,100,${0.12+Math.sin(frame*0.08)*0.06})`;
      ctx.fillRect(sx-24, sy-24, 48, 48);
    }
    // circle
    ctx.strokeStyle= match ? '#FF0' : t.col;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(sx, sy, 20+pulse, 0, Math.PI*2); ctx.stroke();
    ctx.lineWidth=1;
    // inner marker
    ctx.fillStyle=t.col; ctx.font='12px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.label, sx, sy+1);
    // near & interactable
    if(state==='PLAYING' && dist(vessel,s)<55 && totalCargo()>0){
      ctx.strokeStyle='rgba(255,255,255,0.4)';
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(sx,sy,28,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/* ── Vessel (dynamic per activeVessel) ── */
function drawVessel(){
  const sx=vessel.x-cam.x, sy=vessel.y-cam.y;
  ctx.save();
  ctx.translate(sx,sy);
  ctx.rotate(vessel.ang);
  if(vessel.busy){ ctx.translate((Math.random()-.5)*1.5,(Math.random()-.5)*1.5); }

  const av = activeVessel;
  const time=Date.now();

  // Wake spray behind vessel
  if(vessel.spd>0.5){
    const wAlpha=Math.min(vessel.spd/activeVessel.speed,1)*0.15;
    ctx.fillStyle=`rgba(200,230,255,${wAlpha})`;
    for(let i=0;i<3;i++){
      const wo=Math.sin(time/200+i*2)*4;
      ctx.beginPath(); ctx.arc(-42-i*6,wo,3+i*2,0,Math.PI*2); ctx.fill();
    }
  }

  // Hull shadow (water reflection)
  ctx.fillStyle='rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(2,2,44,20,0,0,Math.PI*2);
  ctx.fill();

  // === PER-VESSEL HULL SHAPE ===
  if(av.id==='bokalift1'){
    // ── Bokalift 1: Semi-submersible crane vessel ──
    // Main hull
    ctx.fillStyle=av.hull;
    ctx.beginPath();
    ctx.moveTo(-40,-17); ctx.lineTo(38,-17); ctx.quadraticCurveTo(50,-17,50,-6);
    ctx.lineTo(50,6); ctx.quadraticCurveTo(50,17,38,17); ctx.lineTo(-40,17);
    ctx.closePath(); ctx.fill();
    // Hull bottom stripe
    ctx.fillStyle=av.antifoul; ctx.fillRect(-40,13,88,4);
    // Waterline
    ctx.fillStyle=av.hullDk; ctx.fillRect(-40,-17,88,2);
    ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(-40,-15,88,5);
    // Orange Boskalis stripe
    ctx.fillStyle='#FF6600'; ctx.fillRect(-40,-6,88,2);
    // Deck plating
    ctx.fillStyle=av.deck; ctx.fillRect(-34,-13,72,26);
    // Deck grid lines
    ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=0.5;
    for(let gx=-30;gx<38;gx+=8){ ctx.beginPath(); ctx.moveTo(gx,-13); ctx.lineTo(gx,13); ctx.stroke(); }
    ctx.lineWidth=1;
    // Main working area
    ctx.fillStyle='#A0A8B0'; ctx.fillRect(4,-12,30,24);
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.strokeRect(4,-12,30,24);
    // White pedestal base
    ctx.fillStyle=av.pedestal; ctx.fillRect(-12,-13,20,26);
    ctx.fillStyle='#D8D8D8'; ctx.fillRect(-12,-13,20,2);
    ctx.fillStyle='#C0C0C0'; ctx.fillRect(-12,11,20,2);
    // Lattice detail on pedestal
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=0.5;
    for(let ly=-11;ly<13;ly+=4){ ctx.beginPath(); ctx.moveTo(-10,ly); ctx.lineTo(6,ly); ctx.stroke(); }
    ctx.lineWidth=1;
    // Company text
    ctx.fillStyle='rgba(255,100,0,0.5)'; ctx.font='3px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Boskalis', -2, 0);
    // Bridge block
    ctx.fillStyle=av.bridge; ctx.fillRect(-38,-13,22,26);
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.strokeRect(-38,-13,22,26);
    // Bridge windows
    ctx.fillStyle='#FFFFFF'; ctx.fillRect(-36,-11,18,22);
    ctx.fillStyle='#5DADEC'; ctx.fillRect(-35,-9,5,7); ctx.fillRect(-28,-9,5,7);
    ctx.fillStyle='#4A9AD9'; ctx.fillRect(-35,-5,12,1);
    // Bridge top / radar mast
    ctx.fillStyle='#DDD'; ctx.fillRect(-36,-16,14,4);
    ctx.fillStyle='#555'; ctx.fillRect(-31,-20,2,6);
    ctx.fillStyle='#888'; ctx.fillRect(-34,-19,8,1);
    // Radar dish
    ctx.fillStyle='#AAA';
    ctx.beginPath(); ctx.arc(-30,-20,2,0,Math.PI*2); ctx.fill();
    // Helideck (aft)
    ctx.fillStyle='#556B2F'; ctx.beginPath(); ctx.arc(-30,0,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4A6028'; ctx.beginPath(); ctx.arc(-30,0,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.arc(-30,0,6,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,215,0,0.4)'; ctx.beginPath(); ctx.moveTo(-30,-5); ctx.lineTo(-30,5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-35,0); ctx.lineTo(-25,0); ctx.stroke();
    ctx.fillStyle='#FFD700'; ctx.font='4px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('H',-30,0); ctx.lineWidth=1;
    // Bollards on deck edge
    ctx.fillStyle='#444';
    for(let bx=-20;bx<35;bx+=12){ ctx.fillRect(bx,-14,2,1); ctx.fillRect(bx,13,2,1); }
    // Railing (top & bottom)
    ctx.strokeStyle='rgba(100,100,100,0.3)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(-34,-14); ctx.lineTo(34,-14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-34,14); ctx.lineTo(34,14); ctx.stroke();
    ctx.lineWidth=1;

  } else if(av.id==='bokalift2'){
    // ── Bokalift 2: Large crane vessel (drillship conversion) ──
    // Main hull
    ctx.fillStyle=av.hull;
    ctx.beginPath();
    ctx.moveTo(-42,-17); ctx.lineTo(40,-17); ctx.quadraticCurveTo(54,-14,54,-4);
    ctx.lineTo(54,4); ctx.quadraticCurveTo(54,14,40,17); ctx.lineTo(-42,17);
    ctx.closePath(); ctx.fill();
    // Hull bottom
    ctx.fillStyle=av.antifoul; ctx.fillRect(-42,13,94,4);
    // Waterline highlight
    ctx.fillStyle=av.hullDk; ctx.fillRect(-42,-17,94,2);
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(-42,-15,94,4);
    // Orange Boskalis stripe
    ctx.fillStyle='#FF6600'; ctx.fillRect(-42,-7,94,2);
    // Deck plating
    ctx.fillStyle=av.deck; ctx.fillRect(-36,-13,78,26);
    ctx.strokeStyle='rgba(0,0,0,0.05)'; ctx.lineWidth=0.5;
    for(let gx=-32;gx<42;gx+=8){ ctx.beginPath(); ctx.moveTo(gx,-13); ctx.lineTo(gx,13); ctx.stroke(); }
    ctx.lineWidth=1;
    // Working area
    ctx.fillStyle='#7888A0'; ctx.fillRect(0,-12,36,24);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.strokeRect(0,-12,36,24);
    // Yellow lattice crane tower
    ctx.fillStyle=av.pedestal; ctx.fillRect(-10,-15,16,30);
    // Lattice cross-hatching
    ctx.strokeStyle='rgba(180,150,0,0.4)'; ctx.lineWidth=0.5;
    for(let ly=-13;ly<15;ly+=3){ ctx.beginPath(); ctx.moveTo(-8,ly); ctx.lineTo(4,ly); ctx.stroke(); }
    for(let lx=-8;lx<6;lx+=4){ ctx.beginPath(); ctx.moveTo(lx,-15); ctx.lineTo(lx,15); ctx.stroke(); }
    ctx.lineWidth=1;
    ctx.fillStyle='#E8C800'; ctx.fillRect(-12,-15,20,3);
    // Bridge superstructure
    ctx.fillStyle=av.bridge; ctx.fillRect(-40,-13,26,26);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.strokeRect(-40,-13,26,26);
    ctx.fillStyle='#FFFFFF'; ctx.fillRect(-38,-11,22,22);
    // Windows (3 rows)
    ctx.fillStyle='#5DADEC';
    ctx.fillRect(-37,-9,5,6); ctx.fillRect(-30,-9,5,6); ctx.fillRect(-23,-9,5,6);
    ctx.fillStyle='#4A9AD9'; ctx.fillRect(-37,-5,19,1);
    // Bridge wings
    ctx.fillStyle='#CCC'; ctx.fillRect(-40,-8,3,16);
    ctx.fillStyle='#CCC'; ctx.fillRect(-15,-8,3,16);
    // Radar/mast
    ctx.fillStyle='#DDD'; ctx.fillRect(-38,-17,18,5);
    ctx.fillStyle='#555'; ctx.fillRect(-32,-22,2,7);
    ctx.fillStyle='#888'; ctx.fillRect(-35,-21,8,1);
    ctx.fillStyle='#AAA'; ctx.beginPath(); ctx.arc(-31,-22,2,0,Math.PI*2); ctx.fill();
    // Funnel
    ctx.fillStyle='#555'; ctx.fillRect(-36,-19,10,5);
    ctx.fillStyle='#FF6600'; ctx.fillRect(-36,-17,10,2);
    // Exhaust puff
    ctx.fillStyle='rgba(150,150,150,0.12)';
    ctx.beginPath(); ctx.arc(-31,-21,3+Math.sin(time/300),0,Math.PI*2); ctx.fill();
    // Portholes along hull
    ctx.fillStyle='rgba(200,220,255,0.3)';
    for(let px2=-30;px2<30;px2+=10){ ctx.beginPath(); ctx.arc(px2,-14,1.5,0,Math.PI*2); ctx.fill(); }
    // Bollards
    ctx.fillStyle='#444';
    for(let bx=-24;bx<38;bx+=10){ ctx.fillRect(bx,-14,2,1); ctx.fillRect(bx,13,2,1); }
    // Railings
    ctx.strokeStyle='rgba(100,100,100,0.3)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(-36,-14); ctx.lineTo(36,-14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-36,14); ctx.lineTo(36,14); ctx.stroke();
    ctx.lineWidth=1;

  } else {
    // ── Les Alizés: Ultra-large installation vessel ──
    // Main hull (biggest)
    ctx.fillStyle=av.hull;
    ctx.beginPath();
    ctx.moveTo(-44,-19); ctx.lineTo(42,-19); ctx.quadraticCurveTo(56,-16,56,-6);
    ctx.lineTo(56,6); ctx.quadraticCurveTo(56,16,42,19); ctx.lineTo(-44,19);
    ctx.closePath(); ctx.fill();
    // Hull bottom
    ctx.fillStyle=av.antifoul; ctx.fillRect(-44,15,98,4);
    // Waterline
    ctx.fillStyle=av.hullDk; ctx.fillRect(-44,-19,98,2);
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(-44,-17,98,4);
    // Blue accent stripe (Jan De Nul)
    ctx.fillStyle='#2468B0'; ctx.fillRect(-44,-8,98,2);
    // Deck
    ctx.fillStyle=av.deck; ctx.fillRect(-38,-15,82,30);
    ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=0.5;
    for(let gx=-34;gx<44;gx+=8){ ctx.beginPath(); ctx.moveTo(gx,-15); ctx.lineTo(gx,15); ctx.stroke(); }
    ctx.lineWidth=1;
    // Large working area
    ctx.fillStyle='#6080A0'; ctx.fillRect(2,-14,34,28);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.strokeRect(2,-14,34,28);
    // White crane tower (massive)
    ctx.fillStyle=av.pedestal; ctx.fillRect(-12,-16,20,32);
    ctx.fillStyle='#D8D8D8'; ctx.fillRect(-12,-16,2,32);
    ctx.fillStyle='#D8D8D8'; ctx.fillRect(6,-16,2,32);
    ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=0.5;
    for(let ly=-14;ly<16;ly+=3){ ctx.beginPath(); ctx.moveTo(-10,ly); ctx.lineTo(6,ly); ctx.stroke(); }
    ctx.lineWidth=1;
    ctx.fillStyle='#DDD'; ctx.fillRect(-14,-17,24,3);
    // Bridge (largest)
    ctx.fillStyle=av.bridge; ctx.fillRect(-42,-15,26,30);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.strokeRect(-42,-15,26,30);
    ctx.fillStyle='#F8F8F8'; ctx.fillRect(-40,-13,22,26);
    // Windows (3 levels)
    ctx.fillStyle='#5DADEC';
    ctx.fillRect(-39,-11,5,6); ctx.fillRect(-32,-11,5,6); ctx.fillRect(-25,-11,5,6);
    ctx.fillStyle='#4A9AD9'; ctx.fillRect(-39,-7,19,1);
    // Side windows
    ctx.fillStyle='#5DADEC';
    ctx.fillRect(-39,3,5,5); ctx.fillRect(-32,3,5,5);
    // Bridge wings
    ctx.fillStyle='#E0E0E0'; ctx.fillRect(-42,-10,3,20);
    // Radar/navigation top
    ctx.fillStyle='#EEE'; ctx.fillRect(-39,-18,18,5);
    ctx.fillStyle=av.funnel; ctx.fillRect(-37,-23,10,7);
    ctx.fillStyle='#FFD700'; ctx.fillRect(-37,-23,10,1);
    // Radar dish
    ctx.fillStyle='#555'; ctx.fillRect(-33,-26,2,5);
    ctx.fillStyle='#AAA'; ctx.beginPath(); ctx.arc(-32,-27,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#888'; ctx.fillRect(-36,-25,10,1);
    // DP thruster bumps
    ctx.fillStyle=av.hullDk; 
    ctx.beginPath(); ctx.arc(-42,10,3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-42,-10,3,0,Math.PI*2); ctx.fill();
    // Portholes
    ctx.fillStyle='rgba(200,220,255,0.25)';
    for(let px2=-30;px2<35;px2+=8){ ctx.beginPath(); ctx.arc(px2,-16,1.5,0,Math.PI*2); ctx.fill(); }
    // Bollards & railings
    ctx.fillStyle='#444';
    for(let bx=-26;bx<40;bx+=10){ ctx.fillRect(bx,-16,2,1); ctx.fillRect(bx,15,2,1); }
    ctx.strokeStyle='rgba(100,100,100,0.25)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(-38,-16); ctx.lineTo(38,-16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-38,16); ctx.lineTo(38,16); ctx.stroke();
    ctx.lineWidth=1;
  }

  // Bow wave (speed-dependent)
  if(vessel.spd>0.3){
    const bwA=Math.min(vessel.spd/activeVessel.speed,1)*0.25;
    ctx.strokeStyle=`rgba(255,255,255,${bwA})`; ctx.lineWidth=1;
    const bowX=av.id==='alizés'?56:av.id==='bokalift2'?54:50;
    ctx.beginPath();
    ctx.moveTo(bowX,-10); ctx.quadraticCurveTo(bowX+8,-4,bowX+14,0);
    ctx.quadraticCurveTo(bowX+8,4,bowX,10);
    ctx.stroke(); ctx.lineWidth=1;
  }

  // === CRANE BOOM (shared logic) ===
  let craneSwing = 0;
  const loadAnim  = anims.find(a=>a.type==='load');
  const instAnim  = anims.find(a=>a.type==='install');
  if(loadAnim){
    const prog = 1 - loadAnim.timer / loadAnim.maxT;
    if(prog < 0.15)      craneSwing = -0.4 * (prog/0.15);
    else if(prog < 0.5) craneSwing = -0.4;
    else                craneSwing = -0.4 * (1-(prog-0.5)/0.5);
  }
  if(instAnim){
    const prog = 1 - instAnim.timer / instAnim.maxT;
    if(prog < 0.15)      craneSwing = 0.35 * (prog/0.15);
    else if(prog < 0.6) craneSwing = 0.35;
    else                craneSwing = 0.35 * (1-(prog-0.6)/0.4);
  }

  ctx.save();
  ctx.translate(-1, 0);
  ctx.rotate(craneSwing);
  ctx.fillStyle=av.boom; ctx.fillRect(0,-2.5,44,5);
  ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(0,-2.5,44,1.5);
  ctx.fillStyle='#FFD700'; ctx.fillRect(42,-3.5,4,7);
  let cableLen = 8;
  if(instAnim){
    const prog = 1 - instAnim.timer / instAnim.maxT;
    cableLen = 8 + (prog < 0.6 ? prog/0.6 * 18 : 26 * (1-(prog-0.6)/0.4));
  }
  if(loadAnim){
    const prog = 1 - loadAnim.timer / loadAnim.maxT;
    if(prog < 0.15)      cableLen = 8 + (prog/0.15)*14;
    else if(prog < 0.5) cableLen = 22;
    else                cableLen = 22 - ((prog-0.5)/0.5)*14;
  }
  ctx.fillStyle='#222'; ctx.fillRect(41,-0.5,1, cableLen);
  ctx.fillStyle='#555'; ctx.fillRect(39,cableLen-2,5,3); ctx.fillRect(40,cableLen+1,3,2);
  if(instAnim && (1-instAnim.timer/instAnim.maxT)<0.6){
    const t=TYPES[instAnim.pType];
    ctx.fillStyle=t.col; ctx.fillRect(41-t.r/2, cableLen+3, t.r, t.r+4);
    ctx.fillStyle=t.dk; ctx.fillRect(41-t.r/2, cableLen+3, t.r, 2);
  }
  if(loadAnim && (1-loadAnim.timer/loadAnim.maxT)>0.15){
    const t=TYPES[loadAnim.pType];
    ctx.fillStyle=t.col; ctx.fillRect(41-t.r/2, cableLen+3, t.r, t.r+4);
    ctx.fillStyle=t.dk; ctx.fillRect(41-t.r/2, cableLen+3, t.r, 2);
  }
  ctx.restore();

  // Cargo on deck (multi-type)
  if(totalCargo()>0 && !loadAnim){
    let ci=0;
    const tc=totalCargo();
    const gap=32/Math.max(tc,1);
    for(let ti=0;ti<3;ti++){
      const t=TYPES[ti];
      for(let j=0;j<vessel.hold[ti];j++){
        const cx2= 10 + ci*gap - (tc-1)*gap/2 + 8;
        ctx.fillStyle=t.col; ctx.fillRect(cx2-t.r/2, -t.r/2, t.r, t.r);
        ctx.fillStyle=t.dk; ctx.fillRect(cx2-t.r/2, -t.r/2, t.r, 2);
        ci++;
      }
    }
  }

  // Vessel name label
  ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font='3.5px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(av.name, 20, 9);

  ctx.restore();
}

/* ── Splash ring animation ── */
function drawSplashAnims(){
  for(const a of anims){
    if(a.type!=='splash') continue;
    const prog = 1 - a.timer/a.maxT;
    const r = 10 + prog*35;
    const alpha = 1 - prog;
    ctx.save();
    ctx.globalAlpha = alpha*0.6;
    ctx.strokeStyle='#AADDFF';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.ellipse(a.x-cam.x, a.y-cam.y, r, r*0.35, 0, 0, Math.PI*2);
    ctx.stroke();
    // inner ring
    if(prog<0.5){
      ctx.globalAlpha = (0.5-prog)*0.8;
      ctx.strokeStyle='#FFF';
      ctx.beginPath();
      ctx.ellipse(a.x-cam.x, a.y-cam.y, r*0.5, r*0.18, 0, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ── Load crane animation at port ── */
function drawLoadAnims(){
  for(const a of anims){
    if(a.type!=='load') continue;
    const prog = 1 - a.timer/a.maxT;
    const port = a.port;
    const t = TYPES[a.pType];
    const px = port.x-cam.x, py = port.y-cam.y;
    // sparks at port when picking up (0.2–0.5 progress)
    if(prog>0.2 && prog<0.5 && frame%3===0){
      particles.push({x:port.x+(Math.random()-0.5)*20, y:port.y-10,
        vx:(Math.random()-.5)*2, vy:-1-Math.random()*2,
        life:15+Math.random()*10, col:'#FFD700', sz:2});
    }
  }
}

/* ── Install animation overlay ── */
function drawInstallAnims(){
  for(const a of anims){
    if(a.type!=='install') continue;
    const prog = 1 - a.timer/a.maxT;
    const s = a.site;
    const t = TYPES[a.pType];
    const sx2 = s.x-cam.x, sy2 = s.y-cam.y;
    // pipe descending into water (0.15–0.6)
    if(prog>0.15 && prog<=0.6){
      const dp = (prog-0.15)/0.45;
      const py = sy2 - t.r*2*(1-dp) - 6;
      drawPipe(sx2, py, t.r, t.r*2+8, t.col, t.dk);
    }
    // bubbles during install
    if(prog>0.15 && prog<0.7 && frame%2===0){
      particles.push({x:s.x+(Math.random()-0.5)*16, y:s.y,
        vx:(Math.random()-.5)*1, vy:-0.8-Math.random()*1.5,
        life:20+Math.random()*15, col:'rgba(180,220,255,0.7)', sz:2+Math.random()*2});
    }
    // water splash at 0.55+
    if(prog>0.5 && prog<0.55){
      for(let i=0;i<4;i++){
        const ang=Math.random()*Math.PI*2, sp=1+Math.random()*2;
        particles.push({x:s.x, y:s.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp,
          life:20, col:'#8CF', sz:3});
      }
    }
  }
}

/* ── Particles ── */
function drawParticles(){
  for(const p of particles){
    const a=p.life/40;
    ctx.globalAlpha=Math.min(1,a);
    ctx.fillStyle=p.col;
    ctx.fillRect(p.x-cam.x, p.y-cam.y, p.sz||3, p.sz||3);
  }
  ctx.globalAlpha=1;
}

/* ── Floats (rising text) ── */
function drawFloats(){
  for(const f of floats){
    ctx.globalAlpha=f.life/60;
    ctx.fillStyle=f.col; ctx.font='10px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(f.text, f.x-cam.x, f.y-cam.y);
  }
  ctx.globalAlpha=1;
}

/* ── HUD ── */
function drawHUD(){
  // top bar
  ctx.fillStyle='rgba(0,0,0,0.82)';
  ctx.fillRect(0,0,W,42);
  ctx.fillStyle='#444'; ctx.fillRect(0,42,W,1);
  drawSoundIndicator();

  ctx.font='10px "Press Start 2P"';
  ctx.textBaseline='top';

  // Timer
  ctx.textAlign='left';
  ctx.fillStyle='#AAA'; ctx.fillText('TIME',12,4);
  const m=(gameTime/60|0), s=(gameTime%60|0);
  ctx.fillStyle='#FFF'; ctx.fillText(m+':'+(''+s).padStart(2,'0'),12,22);

  // Cargo (multi-type)
  ctx.textAlign='center';
  ctx.fillStyle='#AAA'; ctx.fillText('CARGO ('+totalCargo()+'/'+activeVessel.maxCargo+')',W/2,4);
  if(totalCargo()>0){
    let cargoStr='';
    for(let ti=0;ti<3;ti++){
      if(vessel.hold[ti]>0) cargoStr+=(cargoStr?' ':'')+ vessel.hold[ti]+TYPES[ti].label;
    }
    ctx.fillStyle='#FFF';
    ctx.fillText(cargoStr, W/2, 22);
  } else {
    ctx.fillStyle='#666'; ctx.fillText('EMPTY',W/2,22);
  }

  // Installed
  const done=sites.filter(s=>s.done).length;
  ctx.textAlign='right';
  ctx.fillStyle='#AAA'; ctx.fillText('INSTALLED',W-12,4);
  ctx.fillStyle=done===TOTAL_SITES?'#0F0':'#FFF';
  ctx.fillText(done+'/'+TOTAL_SITES,W-12,22);

  // ── Speedometer (bottom-left) ──
  const spdMult = storm.active ? STORM_SPEED_MULT : engine.broken ? ENGINE_SPEED_MULT : 1;
  const curSpd = vessel.spd * spdMult;
  const maxSpd = activeVessel.speed;
  const spdPct = Math.min(1, curSpd / maxSpd);

  const smX = 8, smY = H - 60;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(smX, smY, 100, 28);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(smX, smY, 100, 28);

  // Speed bar background
  ctx.fillStyle = '#222';
  ctx.fillRect(smX+4, smY+16, 92, 8);
  // Speed bar fill
  const spdCol = engine.broken ? '#F44' : storm.active ? '#FFA500' : '#0C0';
  ctx.fillStyle = spdCol;
  ctx.fillRect(smX+4, smY+16, 92 * spdPct, 8);
  ctx.strokeStyle = '#555';
  ctx.strokeRect(smX+4, smY+16, 92, 8);

  // Speed label
  ctx.font='7px "Press Start 2P"';
  ctx.textAlign='left'; ctx.textBaseline='top';
  if(engine.broken){
    const blink = (frame%20)<10;
    ctx.fillStyle = blink ? '#F44' : '#A00';
    ctx.fillText('ENGINE FAIL', smX+4, smY+3);
  } else if(storm.active){
    ctx.fillStyle = '#FFA500';
    ctx.fillText('STORM SPD', smX+4, smY+3);
  } else {
    ctx.fillStyle = '#8F8';
    ctx.fillText('SPEED', smX+4, smY+3);
  }

  // Wrench icon when engine broken
  if(engine.broken){
    const wx = smX + 88, wy = smY + 5;
    ctx.fillStyle = (frame%16)<8 ? '#F44' : '#800';
    ctx.fillRect(wx, wy, 2, 8);
    ctx.fillRect(wx-2, wy, 6, 2);
    ctx.fillRect(wx-2, wy+6, 6, 2);
  }

  // Context hint (bottom)
  if(contextHint){
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,H-26,W,26);
    ctx.fillStyle='#FF0'; ctx.font='8px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(contextHint, W/2, H-13);
  }

  // Center message
  if(msgTimer>0){
    const a=Math.min(1,msgTimer/20);
    ctx.globalAlpha=a;
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.fillRect(W/2-160, H/2-20, 320, 40);
    ctx.fillStyle='#FFF'; ctx.font='12px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(msg, W/2, H/2);
    ctx.globalAlpha=1;
  }

  // Storm warning / active HUD
  if(storm.warning){
    const blink = (frame%20)<10;
    if(blink){
      ctx.fillStyle='rgba(255,165,0,0.15)';
      ctx.fillRect(0,42,W,8);
    }
    ctx.fillStyle='#FFA500'; ctx.font='9px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('STORM APPROACHING IN '+Math.ceil(storm.timer)+'s...', W/2, 48);
  }
  if(storm.active){
    const blink = (frame%10)<5;
    ctx.fillStyle= blink ? 'rgba(255,0,0,0.2)' : 'rgba(255,0,0,0.08)';
    ctx.fillRect(0,42,W,12);
    ctx.fillStyle='#F44'; ctx.font='10px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('STORM! GET TO PORT: '+Math.ceil(storm.timer)+'s', W/2, 46);
    // arrow to nearest port
    let nearPort=PORTS[0], npd=Infinity;
    for(const p of PORTS){ const d=dist(vessel,p); if(d<npd){npd=d; nearPort=p;}}
    if(npd>90){
      const ang2=Math.atan2(nearPort.y-vessel.y, nearPort.x-vessel.x);
      const arrX=W/2+Math.cos(ang2)*60, arrY=56+Math.sin(ang2)*10;
      ctx.save(); ctx.translate(arrX,arrY+14); ctx.rotate(ang2);
      ctx.fillStyle='#F44';
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-4,-5); ctx.lineTo(-4,5); ctx.fill();
      ctx.restore();
    }
  }
}

/* ── Navigation arrow ── */
function drawNavArrow(){
  let target=null;
  if(totalCargo()>0){
    let md=Infinity;
    for(const s of sites){
      if(s.done||!hasCargoType(s.type)) continue;
      const d=dist(vessel,s); if(d<md){md=d; target=s;}
    }
  } else {
    let md=Infinity;
    for(const p of PORTS){
      if(!sites.some(s=>!s.done&&s.type===p.type)) continue;
      const d=dist(vessel,p); if(d<md){md=d; target=p;}
    }
  }
  if(!target) return;
  // is target on screen?
  const tsx=target.x-cam.x, tsy=target.y-cam.y;
  if(tsx>50&&tsx<W-50&&tsy>55&&tsy<H-35) return;

  const ang=Math.atan2(target.y-vessel.y, target.x-vessel.x);
  const d2=dist(vessel,target);
  let ax=W/2+Math.cos(ang)*Math.min(280,W/2-40);
  let ay=H/2+Math.sin(ang)*Math.min(180,H/2-40);
  ax=clamp(ax,30,W-30);
  ay=clamp(ay,55,H-30);

  ctx.save();
  ctx.translate(ax,ay);
  ctx.rotate(ang);
  const pulse=0.6+Math.sin(frame*0.12)*0.4;
  ctx.globalAlpha=pulse;
  ctx.fillStyle=totalCargo()>0?'#0F0':'#FFF';
  ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-7,-9); ctx.lineTo(-7,9); ctx.fill();
  ctx.globalAlpha=1;
  // distance
  ctx.rotate(-ang);
  ctx.fillStyle='#FFF'; ctx.font='7px "Press Start 2P"';
  ctx.textAlign='center';
  ctx.fillText((d2|0)+'m', 0, -16);
  ctx.restore();
}

/* ── Minimap ── */
function drawMinimap(){
  const mw=130, mh=50, mx=W-mw-8, my=H-mh-30;
  const sx2=WORLD_W/mw, sy2=WORLD_H/mh;
  // bg
  ctx.fillStyle='rgba(0,0,30,0.75)';
  ctx.fillRect(mx-1,my-1,mw+2,mh+2);
  // water
  ctx.fillStyle='#0D3B6E';
  ctx.fillRect(mx,my,mw,mh);
  // field rect
  const fr=FIELD_RECT;
  ctx.fillStyle='rgba(255,220,0,0.15)';
  ctx.fillRect(mx+fr.x/sx2, my+fr.y/sy2, fr.w/sx2, fr.h/sy2);
  // ports
  for(const p of PORTS){
    ctx.fillStyle='#A04000';
    ctx.fillRect(mx+p.x/sx2-2, my+p.y/sy2-1, 4, 3);
  }
  // sites
  for(const s of sites){
    ctx.fillStyle=s.done? '#0A0' : TYPES[s.type].col;
    ctx.fillRect(mx+s.x/sx2-1, my+s.y/sy2-1, 2, 2);
  }
  // vessel
  ctx.fillStyle='#FFF';
  ctx.fillRect(mx+vessel.x/sx2-2, my+vessel.y/sy2-1, 4, 3);
  // viewport
  ctx.strokeStyle='rgba(255,255,255,0.35)';
  ctx.strokeRect(mx+cam.x/sx2, my+cam.y/sy2, W/sx2, H/sy2);
  // border
  ctx.strokeStyle='#446'; ctx.strokeRect(mx-1,my-1,mw+2,mh+2);
}

/* ── Clouds (decorative) ── */
function drawClouds(time){
  ctx.fillStyle='rgba(255,255,255,0.07)';
  const t=time/4000;
  for(let i=0;i<6;i++){
    const cx2 = ((i*430 + t*100)%(WORLD_W+200))-100 - cam.x;
    const cy2 = 80+i*140 - cam.y;
    ctx.fillRect(cx2,cy2,48,8);
    ctx.fillRect(cx2+8,cy2-4,32,4);
    ctx.fillRect(cx2+4,cy2+8,40,4);
  }
}

// ═════════════════════  VESSEL PIXEL ART (for selection screen)  ═════════════════════

/* Draw a side-view vessel card at (cx, cy) center, scaled */
function drawVesselCard(v, cx, cy, selected){
  ctx.save();
  ctx.translate(cx, cy);

  const sc = selected ? 1.0 : 0.7;
  ctx.scale(sc, sc);

  // Glow when selected
  if(selected){
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
  }

  if(v.id === 'bokalift1') drawBokalift1Card();
  else if(v.id === 'bokalift2') drawBokalift2Card();
  else drawAlizesCard();

  ctx.shadowBlur = 0;
  ctx.restore();
}

/* Bokalift 1: Semi-sub crane vessel. Grey hull, massive white pedestal, yellow boom */
function drawBokalift1Card(){
  // Hull (flat barge-like)
  ctx.fillStyle='#6B7B8D';
  ctx.fillRect(-55, -6, 110, 18);
  // Bow (blunt)
  ctx.beginPath(); ctx.moveTo(55,-4); ctx.lineTo(62,0); ctx.lineTo(62,8); ctx.lineTo(55,10); ctx.fill();
  // Anti-fouling
  ctx.fillStyle='#8B2020'; ctx.fillRect(-55, 8, 117, 4);
  // Hull edge
  ctx.fillStyle='#4A5A6A'; ctx.fillRect(-55, -6, 117, 2);
  // Deck
  ctx.fillStyle='#B0B8C0'; ctx.fillRect(-50, -10, 100, 6);

  // White pedestal tower (distinctive Bokalift 1 feature)
  ctx.fillStyle='#E8E8E8'; ctx.fillRect(-5, -50, 14, 42);
  ctx.fillStyle='#D0D0D0'; ctx.fillRect(7, -50, 2, 42);
  ctx.fillStyle='#F5F5F5'; ctx.fillRect(-5, -50, 2, 42);
  // Cap
  ctx.fillStyle='#C8C8C8'; ctx.fillRect(-7, -53, 18, 5);

  // Crane boom (yellow)
  ctx.fillStyle='#E8C800'; ctx.fillRect(2, -52, 56, 4);
  ctx.fillStyle='#FFD700'; ctx.fillRect(55, -54, 4, 8);
  // Cable
  ctx.fillStyle='#333'; ctx.fillRect(56, -48, 1, 20);
  ctx.fillStyle='#555'; ctx.fillRect(54, -30, 5, 3);

  // Bridge at stern
  ctx.fillStyle='#F0F0F0'; ctx.fillRect(-50, -32, 22, 22);
  ctx.fillStyle='#5DADEC'; ctx.fillRect(-46, -28, 6, 8);
  ctx.fillRect(-38, -28, 6, 8);
  // Funnel (Boskalis orange)
  ctx.fillStyle='#555'; ctx.fillRect(-44, -38, 8, 8);
  ctx.fillStyle='#FF6600'; ctx.fillRect(-44, -35, 8, 3);

  // Helideck
  ctx.fillStyle='#556B2F'; ctx.fillRect(-55, -12, 10, 3);
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=0.5;
  ctx.strokeRect(-54, -12, 8, 3);
  ctx.lineWidth=1;

  // Label
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='4px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('BOKALIFT 1', 15, 2);
}

/* Bokalift 2: Converted drillship. Dark blue-grey hull, ship-shaped, tall yellow crane, orange markings */
function drawBokalift2Card(){
  // Hull (ship-shaped, longer, converted drillship)
  ctx.fillStyle='#3A4F6B';
  ctx.fillRect(-60, -6, 120, 18);
  // Bow (sharper — drillship heritage)
  ctx.beginPath(); ctx.moveTo(60,-4); ctx.lineTo(72,-2); ctx.lineTo(72,6); ctx.lineTo(60,10); ctx.fill();
  // Anti-fouling
  ctx.fillStyle='#7A1A1A'; ctx.fillRect(-60, 8, 132, 4);
  // Hull edge
  ctx.fillStyle='#283A50'; ctx.fillRect(-60, -6, 132, 2);
  // Orange hull stripe (Boskalis)
  ctx.fillStyle='#FF6600'; ctx.fillRect(-60, -4, 132, 2);
  // Deck
  ctx.fillStyle='#8899AA'; ctx.fillRect(-55, -10, 115, 6);

  // Tall yellow crane (Huisman 4000t)
  ctx.fillStyle='#FFD700'; ctx.fillRect(0, -58, 10, 50);
  // Lattice detail
  ctx.fillStyle='#DAB800';
  for(let i=0;i<50;i+=5) ctx.fillRect(1, -58+i, 8, 1);
  // Cap
  ctx.fillStyle='#E8C800'; ctx.fillRect(-2, -60, 14, 4);
  // Boom
  ctx.fillStyle='#E8C800'; ctx.fillRect(5, -58, 50, 4);
  ctx.fillStyle='#FFD700'; ctx.fillRect(52, -60, 4, 8);
  // Cable
  ctx.fillStyle='#333'; ctx.fillRect(53, -54, 1, 22);
  ctx.fillStyle='#555'; ctx.fillRect(51, -34, 5, 3);

  // Bridge at stern (bigger — drillship)
  ctx.fillStyle='#E0E0E0'; ctx.fillRect(-55, -36, 28, 26);
  ctx.fillStyle='#5DADEC';
  ctx.fillRect(-51, -32, 6, 8); ctx.fillRect(-43, -32, 6, 8);
  ctx.fillRect(-35, -32, 6, 8);
  // Funnel
  ctx.fillStyle='#555'; ctx.fillRect(-49, -44, 10, 10);
  ctx.fillStyle='#FF6600'; ctx.fillRect(-49, -40, 10, 4);

  // Derrick remnant (drillship heritage — small structure)
  ctx.fillStyle='#666'; ctx.fillRect(35, -16, 4, 8);
  ctx.fillRect(33, -18, 8, 3);

  // Label
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='4px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('BOKALIFT 2', 15, 2);
}

/* Les Alizés: Jan De Nul mega-vessel. Blue hull, very wide/large, white superstructure, large crane */
function drawAlizesCard(){
  // Hull (very wide, blue — Jan De Nul identity)
  ctx.fillStyle='#1B4F8A';
  ctx.fillRect(-65, -6, 130, 20);
  // Bow (broad, slightly rounded)
  ctx.beginPath(); ctx.moveTo(65,-4); ctx.lineTo(74,0); ctx.lineTo(74,10); ctx.lineTo(65,12); ctx.fill();
  // Anti-fouling
  ctx.fillStyle='#6A1515'; ctx.fillRect(-65, 10, 139, 4);
  // Hull edge
  ctx.fillStyle='#0E3460'; ctx.fillRect(-65, -6, 139, 2);
  // Blue hull stripe (Jan De Nul)
  ctx.fillStyle='#2468B0'; ctx.fillRect(-65, -4, 139, 2);
  // Deck (wider)
  ctx.fillStyle='#7090B0'; ctx.fillRect(-60, -10, 125, 6);

  // Massive crane tower (white/light, 5000t)
  ctx.fillStyle='#F0F0F0'; ctx.fillRect(5, -60, 14, 52);
  ctx.fillStyle='#D8D8D8'; ctx.fillRect(17, -60, 2, 52);
  ctx.fillStyle='#FAFAFA'; ctx.fillRect(5, -60, 2, 52);
  // Cap
  ctx.fillStyle='#DDD'; ctx.fillRect(3, -62, 18, 4);

  // Boom (yellow)
  ctx.fillStyle='#D4B000'; ctx.fillRect(12, -60, 55, 4);
  ctx.fillStyle='#E8C800'; ctx.fillRect(64, -62, 4, 8);
  // Cable
  ctx.fillStyle='#333'; ctx.fillRect(65, -56, 1, 24);
  ctx.fillStyle='#555'; ctx.fillRect(63, -34, 5, 3);

  // Large bridge at stern (Jan De Nul style)
  ctx.fillStyle='#FFFFFF'; ctx.fillRect(-58, -38, 30, 28);
  ctx.fillStyle='#5DADEC';
  ctx.fillRect(-54, -34, 5, 8); ctx.fillRect(-47, -34, 5, 8);
  ctx.fillRect(-40, -34, 5, 8);
  // Upper bridge deck
  ctx.fillStyle='#EEE'; ctx.fillRect(-54, -42, 22, 6);
  // Funnel (Jan De Nul blue)
  ctx.fillStyle='#1B4F8A'; ctx.fillRect(-50, -50, 10, 10);
  ctx.fillStyle='#FFD700'; ctx.fillRect(-50, -50, 10, 2);

  // DP thrusters (visible at stern — large vessel)
  ctx.fillStyle='#0E3460';
  ctx.fillRect(-65, 6, 6, 4); ctx.fillRect(-55, 6, 6, 4);

  // Label
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='4px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('LES ALIZÉS', 15, 4);
}

// ═════════════════════  VESSEL SELECT SCREEN  ═════════════════════
function drawSelectScreen(){
  const time = Date.now();
  cam.x=0; cam.y=200;
  drawWater(time);
  drawClouds(time);

  // dark overlay
  ctx.fillStyle='rgba(0,0,40,0.65)';
  ctx.fillRect(0,0,W,H);

  // Title
  ctx.fillStyle='#FFD700'; ctx.font='14px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('SELECT YOUR VESSEL', W/2, 30);

  // Three vessel cards
  const cardW = 240, cardH = 340, gap = 4;
  const totalW = 3*cardW + 2*gap;
  const startX = W/2 - totalW/2 + cardW/2;

  for(let i=0; i<3; i++){
    const v = VESSELS[i];
    const cx = startX + i*(cardW+gap);
    const topY = 50;
    const sel = (i === selectedVessel);

    // Card background
    ctx.fillStyle = sel ? 'rgba(40,40,80,0.9)' : 'rgba(10,10,30,0.8)';
    ctx.fillRect(cx-cardW/2, topY, cardW, cardH);
    // Border
    ctx.strokeStyle = sel ? '#FFD700' : '#334';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.strokeRect(cx-cardW/2, topY, cardW, cardH);
    ctx.lineWidth = 1;

    // Selection glow
    if(sel){
      const pulse = 0.7 + Math.sin(time/200)*0.3;
      ctx.fillStyle = `rgba(255,215,0,${pulse*0.08})`;
      ctx.fillRect(cx-cardW/2+2, topY+2, cardW-4, cardH-4);
      // Arrow above
      ctx.fillStyle='#FFD700';
      ctx.beginPath();
      ctx.moveTo(cx, topY-8); ctx.lineTo(cx-8, topY); ctx.lineTo(cx+8, topY);
      ctx.fill();
    }

    // === Vessel pixel art (centered, larger) ===
    drawVesselCard(v, cx, topY + 70, sel);

    // === Vessel name ===
    ctx.fillStyle = sel ? '#FFD700' : '#AAA';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign='center';
    ctx.fillText(v.name, cx, topY + 130);

    // Company
    ctx.fillStyle = v.id==='alizés' ? '#5DADEC' : '#FF6600';
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText(v.company, cx, topY + 148);

    // === Stats section ===
    const statsY = topY + 170;
    const lx = cx - cardW/2 + 14;
    const rw = cardW - 28;

    // Speed bar
    drawStatBar(lx, statsY, rw, 'SPEED', v.speed, 5.0, sel ? '#0C0' : '#060', sel);

    // Total deck capacity
    drawStatBar(lx, statsY+28, rw, 'DECK CAPACITY', v.maxCargo, 5, sel ? '#FFD700' : '#7A6800', sel);

    // Per-type max
    drawStatBar(lx, statsY+52, rw, 'MAX SMALL', v.cargo[0], 4, sel ? '#00B800' : '#005800', sel);
    drawStatBar(lx, statsY+76, rw, 'MAX MEDIUM', v.cargo[1], 3, sel ? '#E8A000' : '#7A5000', sel);
    drawStatBar(lx, statsY+100, rw, 'MAX LARGE', v.cargo[2], 2, sel ? '#D83800' : '#6A1C00', sel);

    // Description
    ctx.fillStyle = sel ? '#FFF' : '#777';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(v.desc, cx, statsY + 128);

    // Crane detail
    ctx.fillStyle = sel ? '#AAA' : '#555';
    ctx.fillText(v.detail, cx, statsY + 142);
  }

  // Controls
  const ctrlY = 410;
  if((time/500|0)%2){
    ctx.fillStyle='#FFF'; ctx.font='10px "Press Start 2P"';
    ctx.textAlign='center';
    ctx.fillText(isTouchDevice?'TAP CENTER = SELECT':'SPACE = SELECT', W/2, ctrlY);
  }
  ctx.fillStyle='#888'; ctx.font='7px "Press Start 2P"';
  ctx.textAlign='center';
  ctx.fillText(isTouchDevice?'\u25C4  SWIPE  \u25BA':'\u25C4  ARROWS  \u25BA', W/2, ctrlY + 22);
  if(!isTouchDevice){ ctx.fillStyle='#555'; ctx.font='6px "Press Start 2P"'; ctx.fillText('ESC = BACK', W/2, ctrlY + 40); }
}

/* Helper: draw a labeled stat bar */
function drawStatBar(x, y, w, label, value, maxVal, col, sel){
  ctx.fillStyle = sel ? '#AAA' : '#555';
  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  // value number
  ctx.textAlign = 'right';
  ctx.fillStyle = sel ? '#FFF' : '#888';
  ctx.fillText(value+'', x + w, y);
  // bar
  const barY = y + 6, barH = 6;
  ctx.fillStyle = '#111';
  ctx.fillRect(x, barY, w, barH);
  const pct = Math.min(1, value / maxVal);
  ctx.fillStyle = col;
  ctx.fillRect(x, barY, w * pct, barH);
  // notches
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for(let n=1; n<maxVal; n++){
    const nx = x + (w * n / maxVal);
    ctx.fillRect(nx, barY, 1, barH);
  }
  ctx.strokeStyle = '#333';
  ctx.strokeRect(x, barY, w, barH);
}

// ═════════════════════  TITLE SCREEN  ═════════════════════
function drawTitle(){
  const time=Date.now();
  cam.x=0; cam.y=200;
  drawWater(time);
  drawClouds(time);
  // overlay
  ctx.fillStyle='rgba(0,0,40,0.55)';
  ctx.fillRect(0,0,W,H);

  // Boskalis
  ctx.fillStyle='#FF6600'; ctx.font='10px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('OFFSHORE', W/2, 75);

  // Title
  ctx.fillStyle='#FFD700'; ctx.font='20px "Press Start 2P"';
  ctx.fillText('MONOPILE', W/2, 115);
  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillText('MONOPILE', W/2+2, 117);
  ctx.fillStyle='#FFD700'; ctx.fillText('MONOPILE', W/2, 115);

  // Subtitle
  ctx.fillStyle='#FFF'; ctx.font='14px "Press Start 2P"';
  ctx.fillText('INSTALLER', W/2, 155);

  // Three animated vessels sailing across at different speeds
  const vx1=((time/18)%(W+240))-120;
  const vx2=((time/25+300)%(W+240))-120;
  const vx3=((time/35+150)%(W+240))-120;
  ctx.save(); ctx.translate(vx1,230);
  ctx.fillStyle='#6B7B8D'; ctx.fillRect(-24,-8,48,16);
  ctx.beginPath(); ctx.moveTo(24,-6); ctx.lineTo(30,-2); ctx.lineTo(30,6); ctx.lineTo(24,8); ctx.fill();
  ctx.fillStyle='#E8E8E8'; ctx.fillRect(-2,-16,8,10);
  ctx.fillStyle='#E8C800'; ctx.fillRect(2,-16,24,3);
  ctx.fillStyle='#F0F0F0'; ctx.fillRect(-20,-14,12,8);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(-30,-2,6,5);
  ctx.restore();
  ctx.save(); ctx.translate(vx2,260);
  ctx.fillStyle='#3A4F6B'; ctx.fillRect(-28,-8,56,16);
  ctx.beginPath(); ctx.moveTo(28,-6); ctx.lineTo(36,-2); ctx.lineTo(36,4); ctx.lineTo(28,8); ctx.fill();
  ctx.fillStyle='#FFD700'; ctx.fillRect(-2,-20,8,14);
  ctx.fillStyle='#E8C800'; ctx.fillRect(2,-20,26,3);
  ctx.fillStyle='#E0E0E0'; ctx.fillRect(-24,-16,14,10);
  ctx.fillStyle='#FF6600'; ctx.fillRect(-28,-6,64,2);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(-34,-2,6,5);
  ctx.restore();
  ctx.save(); ctx.translate(vx3,290);
  ctx.fillStyle='#1B4F8A'; ctx.fillRect(-30,-9,60,18);
  ctx.beginPath(); ctx.moveTo(30,-7); ctx.lineTo(38,-2); ctx.lineTo(38,6); ctx.lineTo(30,9); ctx.fill();
  ctx.fillStyle='#F0F0F0'; ctx.fillRect(-2,-22,10,15);
  ctx.fillStyle='#D4B000'; ctx.fillRect(4,-22,28,3);
  ctx.fillStyle='#FFF'; ctx.fillRect(-26,-18,14,10);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(-36,-2,6,5);
  ctx.restore();

  // Blink prompt
  if((time/500|0)%2){
    ctx.fillStyle='#FFF'; ctx.font='11px "Press Start 2P"';
    ctx.fillText(isTouchDevice?'TAP TO START':'PRESS SPACE', W/2, 330);
  }

  // Controls
  ctx.fillStyle='#888'; ctx.font='8px "Press Start 2P"';
  ctx.fillText(isTouchDevice?'TOUCH = VAREN  SLEEP = STUREN':'UP = THROTTLE  L/R = STEER  SPACE = ACTION', W/2, 380);
  drawSoundIndicator();

  // Monopile info
  ctx.font='7px "Press Start 2P"';
  ctx.fillStyle='#00B800'; ctx.fillText('S = SMALL  (SHALLOW <10m)',  W/2, 410);
  ctx.fillStyle='#E8A000'; ctx.fillText('M = MEDIUM (MID 10-25m)',   W/2, 428);
  ctx.fillStyle='#D83800'; ctx.fillText('L = LARGE  (DEEP >25m)',    W/2, 446);

  // Best
  if(bestTime){
    ctx.fillStyle='#FFD700'; ctx.font='8px "Press Start 2P"';
    const bm=(bestTime/60|0), bs=(bestTime%60|0);
    ctx.fillText('BEST: '+bm+':'+(''+bs).padStart(2,'0'), W/2, 490);
  }
}

// ═════════════════════  PHASE SELECT  ═════════════════════
function drawPhaseSelect(){
  const time=Date.now();
  cam.x=0; cam.y=200;
  drawWater(time);
  drawClouds(time);
  ctx.fillStyle='rgba(0,0,40,0.55)';
  ctx.fillRect(0,0,W,H);

  // Title
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#FF6600'; ctx.font='10px "Press Start 2P"';
  ctx.fillText('CHOOSE YOUR MISSION', W/2, 60);

  const labels=['INSTALL\nMONOPILES','LAY\nCABLES','BOTH\nPHASES'];
  const descs=['Transport and install\nmonopile foundations\nat 7 offshore sites','Lay subsea cables\nbetween installed\nmonopile locations','Install monopiles\nthen lay cables\nfor the full project'];
  const icons=[drawPhaseIconMonopile, drawPhaseIconCable, drawPhaseIconBoth];
  const cardW=180, cardH=260, gap=25;
  const totalW=cardW*3+gap*2;
  const startX=W/2-totalW/2;

  for(let i=0;i<3;i++){
    const cx=startX+i*(cardW+gap);
    const cy=100;
    const sel=i===selectedPhase;

    // Card bg
    ctx.fillStyle=sel?'rgba(0,40,120,0.85)':'rgba(0,20,60,0.6)';
    ctx.fillRect(cx,cy,cardW,cardH);
    // Border
    ctx.strokeStyle=sel?'#FFD700':'#446';
    ctx.lineWidth=sel?3:1;
    ctx.strokeRect(cx,cy,cardW,cardH);
    ctx.lineWidth=1;
    if(sel){
      ctx.strokeStyle='rgba(255,215,0,0.3)';
      ctx.strokeRect(cx+3,cy+3,cardW-6,cardH-6);
    }

    // Icon area
    ctx.save();
    ctx.translate(cx+cardW/2, cy+60);
    icons[i](sel);
    ctx.restore();

    // Label (split by \n)
    ctx.fillStyle=sel?'#FFD700':'#AAA';
    ctx.font=(sel?'11':'10')+'px "Press Start 2P"';
    const lines=labels[i].split('\n');
    for(let l=0;l<lines.length;l++){
      ctx.fillText(lines[l], cx+cardW/2, cy+120+l*20);
    }

    // Description
    ctx.fillStyle=sel?'#CCC':'#777';
    ctx.font='6px "Press Start 2P"';
    const dlines=descs[i].split('\n');
    for(let l=0;l<dlines.length;l++){
      ctx.fillText(dlines[l], cx+cardW/2, cy+170+l*14);
    }
  }

  // Prompt
  if((time/500|0)%2){
    ctx.fillStyle='#FFF'; ctx.font='9px "Press Start 2P"';
    ctx.fillText(isTouchDevice?'TAP LEFT/RIGHT = SELECT  CENTER = START':'ARROWS = SELECT    ENTER = START', W/2, 400);
  }
  if(!isTouchDevice){ ctx.fillStyle='#666'; ctx.font='7px "Press Start 2P"'; ctx.fillText('ESC = BACK', W/2, 430); }
  drawSoundIndicator();
}

function drawPhaseIconMonopile(sel){
  // Simple monopile icon
  ctx.fillStyle=sel?'#FFD700':'#888';
  ctx.fillRect(-4,-30,8,60);  // pile
  ctx.fillStyle=sel?'#FF6600':'#666';
  ctx.fillRect(-12,-35,24,8); // transition piece
  ctx.fillStyle=sel?'#AAA':'#555';
  ctx.beginPath(); ctx.arc(0,-42,6,0,Math.PI*2); ctx.fill(); // nacelle
}

function drawPhaseIconCable(sel){
  // Wavy cable line
  ctx.strokeStyle=sel?'#FFD700':'#888';
  ctx.lineWidth=3;
  ctx.beginPath();
  for(let x=-30;x<=30;x+=2){
    const y=Math.sin(x*0.15)*12;
    if(x===-30) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.lineWidth=1;
  // endpoints
  ctx.fillStyle=sel?'#FF6600':'#666';
  ctx.beginPath(); ctx.arc(-30,Math.sin(-30*0.15)*12,5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(30,Math.sin(30*0.15)*12,5,0,Math.PI*2); ctx.fill();
}

function drawPhaseIconBoth(sel){
  // Monopile + cable combined
  ctx.fillStyle=sel?'#FFD700':'#888';
  ctx.fillRect(-20,-25,6,40); // left pile
  ctx.fillRect(14,-25,6,40);  // right pile
  ctx.fillStyle=sel?'#FF6600':'#666';
  ctx.fillRect(-24,-28,14,5);
  ctx.fillRect(10,-28,14,5);
  // cable between
  ctx.strokeStyle=sel?'#4AF':'#557';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(-14,5);
  ctx.quadraticCurveTo(0,20,14,5);
  ctx.stroke();
  ctx.lineWidth=1;
}

// ═════════════════════  WIN SCREEN  ═════════════════════
function drawWinScreen(){
  const time=Date.now();
  drawWater(time);
  drawField();
  if(gameMode!=='monopile'){
    for(const seg of cableSegments){ if(seg.done) drawCompletedCable(seg); }
  }
  for(const s of sites) drawSite(s);
  if(gameMode!=='monopile') drawCableVessel();

  // overlay
  ctx.fillStyle='rgba(0,0,40,0.65)';
  ctx.fillRect(0,0,W,H);

  // panel
  const pw=440, ph=320, px2=W/2-pw/2, py2=H/2-ph/2;
  ctx.fillStyle='#000060';
  ctx.fillRect(px2,py2,pw,ph);
  // gold border
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=3;
  ctx.strokeRect(px2,py2,pw,ph);
  ctx.lineWidth=1;
  // inner border
  ctx.strokeStyle='rgba(255,215,0,0.3)';
  ctx.strokeRect(px2+4,py2+4,pw-8,ph-8);

  ctx.textAlign='center'; ctx.textBaseline='middle';

  // Title
  ctx.fillStyle='#FFD700'; ctx.font='18px "Press Start 2P"';
  ctx.fillText('CONGRATULATIONS!', W/2, py2+40);

  // Sub
  ctx.fillStyle='#CCC'; ctx.font='8px "Press Start 2P"';
  const winSub = gameMode==='monopile'?'MONOPILES INSTALLED!':gameMode==='cable'?'CABLES LAID!':'WIND FARM COMPLETE!';
  ctx.fillText(winSub, W/2, py2+65);

  // Phase 1 time
  if(gameMode!=='cable'){
    const pm=(monopileTime/60|0), ps=(monopileTime%60|0);
    ctx.fillStyle='#AAA'; ctx.font='7px "Press Start 2P"';
    ctx.fillText('PHASE 1 (MONOPILES): '+pm+':'+(''+ps).padStart(2,'0'), W/2, py2+90);
  }
  // Phase 2 time
  if(gameMode!=='monopile'){
    const cableT=gameMode==='cable'?gameTime:gameTime-monopileTime;
    const cm=(cableT/60|0), cs=(cableT%60|0);
    ctx.fillStyle='#AAA'; ctx.font='7px "Press Start 2P"';
    ctx.fillText('PHASE 2 (CABLES):    '+cm+':'+(''+cs).padStart(2,'0'), W/2, py2+106);
  }
  // Vessels
  ctx.fillStyle='#FF6600'; ctx.font='6px "Press Start 2P"';
  if(gameMode==='both') ctx.fillText(activeVessel.name+' + '+activeCableVessel.name, W/2, py2+122);
  else if(gameMode==='monopile') ctx.fillText(activeVessel.name, W/2, py2+122);
  else ctx.fillText(activeCableVessel.name, W/2, py2+122);

  // Time
  const m=(gameTime/60|0), s2=(gameTime%60|0);
  ctx.fillStyle='#FFF'; ctx.font='14px "Press Start 2P"';
  ctx.fillText('TOTAL: '+m+':'+(''+s2).padStart(2,'0'), W/2, py2+148);

  // Stars (adjusted for combined game)
  const stars = gameTime<150 ? 3 : gameTime<220 ? 2 : 1;
  const starSize=16;
  for(let i=0;i<3;i++){
    const sx3 = W/2 + (i-1)*45;
    const sy3 = py2+185;
    const filled = i<stars;
    // star shape (diamond with extras)
    ctx.fillStyle=filled?'#FFD700':'#333';
    // simplified 5-point star via triangles
    ctx.beginPath();
    for(let p2=0;p2<5;p2++){
      const ang = -Math.PI/2 + p2 * Math.PI*2/5;
      const ang2= ang + Math.PI*2/10;
      const ox=filled?starSize:starSize-2;
      const ix=ox*0.4;
      ctx.lineTo(sx3+Math.cos(ang)*ox, sy3+Math.sin(ang)*ox);
      ctx.lineTo(sx3+Math.cos(ang2)*ix, sy3+Math.sin(ang2)*ix);
    }
    ctx.closePath(); ctx.fill();
  }

  // Rating
  const ratings=['','GOOD!','GREAT!','AMAZING!'];
  ctx.fillStyle='#FF0'; ctx.font='12px "Press Start 2P"';
  ctx.fillText(ratings[stars], W/2, py2+225);

  // Best
  if(bestTime){
    ctx.fillStyle='#FFD700'; ctx.font='8px "Press Start 2P"';
    const bm=(bestTime/60|0), bs2=(bestTime%60|0);
    ctx.fillText('BEST: '+bm+':'+(''+bs2).padStart(2,'0'), W/2, py2+255);
  }

  // Blink
  if((time/500|0)%2){
    ctx.fillStyle='#FFF'; ctx.font='10px "Press Start 2P"';
    ctx.fillText(isTouchDevice?'TAP TO CONTINUE':'PRESS SPACE', W/2, py2+290);
  }
}

// ═════════════════════  STORM VISUALS  ═════════════════════
function drawStormOverlay(){
  const isWarning = storm.warning;
  const isActive  = storm.active;
  if(!isWarning && !isActive) return;

  // darkening overlay
  if(isWarning){
    const t2 = 1 - storm.timer / STORM_WARNING_SEC;
    ctx.fillStyle = `rgba(20,20,40,${0.05 + t2*0.2})`;
    ctx.fillRect(0,0,W,H);
  }
  if(isActive){
    ctx.fillStyle = 'rgba(15,15,35,0.35)';
    ctx.fillRect(0,0,W,H);

    // rain streaks
    ctx.strokeStyle = 'rgba(180,200,220,0.25)';
    ctx.lineWidth = 1;
    for(let i=0; i<40; i++){
      const rx = ((frame*7 + i*53) % (W+40)) - 20;
      const ry = ((frame*11 + i*37) % (H+60)) - 30;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx-4, ry+16);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // occasional lightning flash
    if(Math.random() < 0.008){
      ctx.fillStyle = 'rgba(200,210,255,0.15)';
      ctx.fillRect(0,0,W,H);
    }

    // wind indicator (streaks)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for(let i=0; i<8; i++){
      const wx = ((frame*4 + i*120) % (W+200)) - 100;
      const wy = 60 + i*55;
      ctx.fillRect(wx, wy, 40+Math.random()*30, 1);
    }
  }
}

// ═════════════════════  SIDE-VIEW CUTSCENE  ═════════════════════
function drawSideView(){
  const loadA  = anims.find(a=>a.type==='load');
  const instA  = anims.find(a=>a.type==='install');
  if(!loadA && !instA) return;

  const isLoad = !!loadA;
  const anim   = loadA || instA;
  const prog   = 1 - anim.timer / anim.maxT;
  const t      = TYPES[anim.pType];

  // ── Panel dimensions ──
  const pw=360, ph=200;
  const px = W/2 - pw/2, py = H - ph - 36;

  // fade in/out
  const fadeIn  = Math.min(1, prog*5);
  const fadeOut = Math.min(1, (1-prog)*5);
  const alpha   = Math.min(fadeIn, fadeOut);
  ctx.save();
  ctx.globalAlpha = alpha;

  // ── Background ──
  ctx.fillStyle='#0a1428';
  ctx.fillRect(px, py, pw, ph);
  // border (gold Mario-style)
  ctx.strokeStyle='#C8A000'; ctx.lineWidth=3;
  ctx.strokeRect(px, py, pw, ph);
  ctx.lineWidth=1;
  // inner border
  ctx.strokeStyle='rgba(200,160,0,0.3)';
  ctx.strokeRect(px+3, py+3, pw-6, ph-6);

  // ── Sky gradient ──
  const skyH = ph * 0.35;
  ctx.fillStyle='#1a2a4a';
  ctx.fillRect(px+4, py+4, pw-8, skyH);
  // horizon glow
  ctx.fillStyle='#1e3860';
  ctx.fillRect(px+4, py+4+skyH-10, pw-8, 10);

  // ── Sea ──
  const seaTop = py + 4 + skyH;
  const seaH   = ph - skyH - 8;
  ctx.fillStyle='#0f3d7a';
  ctx.fillRect(px+4, seaTop, pw-8, seaH);
  // darker seabed
  ctx.fillStyle='#0a2a5a';
  ctx.fillRect(px+4, seaTop + seaH*0.65, pw-8, seaH*0.35);
  // seabed
  ctx.fillStyle='#3a2a10';
  ctx.fillRect(px+4, py+ph-12, pw-8, 8);
  // sand texture
  ctx.fillStyle='#4a3a18';
  for(let i=0;i<12;i++){
    ctx.fillRect(px+10+i*28+(i%2)*8, py+ph-11, 12, 2);
  }

  // ── Water surface line ──
  ctx.fillStyle='rgba(100,180,255,0.3)';
  ctx.fillRect(px+4, seaTop-1, pw-8, 2);

  // ── Vessel (side view — dynamic per activeVessel) ──
  const av = activeVessel;
  const vx = px + pw*0.35;
  const vy = seaTop - 4;  // waterline

  // Hull
  ctx.fillStyle=av.hull;
  ctx.fillRect(vx-60, vy-18, 120, 24);
  // bow
  if(av.id==='bokalift2'){
    // sharper drillship bow
    ctx.beginPath(); ctx.moveTo(vx+60,vy-16); ctx.lineTo(vx+74,vy-4); ctx.lineTo(vx+74,vy+2); ctx.lineTo(vx+60,vy+4);
    ctx.fillStyle=av.hull; ctx.fill();
  } else if(av.id==='alizés'){
    // broad bow
    ctx.beginPath(); ctx.moveTo(vx+60,vy-16); ctx.lineTo(vx+72,vy-6); ctx.lineTo(vx+72,vy+4); ctx.lineTo(vx+60,vy+6);
    ctx.fillStyle=av.hull; ctx.fill();
  } else {
    // blunt barge-like bow
    ctx.beginPath(); ctx.moveTo(vx+60,vy-16); ctx.lineTo(vx+70,vy-10); ctx.lineTo(vx+70,vy+2); ctx.lineTo(vx+60,vy+4);
    ctx.fillStyle=av.hull; ctx.fill();
  }
  ctx.fillStyle=av.antifoul; ctx.fillRect(vx-60, vy+2, 134, 6);
  ctx.fillStyle=av.hullDk; ctx.fillRect(vx-60, vy-18, 134, 3);
  if(av.id==='bokalift2'){ ctx.fillStyle='#FF6600'; ctx.fillRect(vx-60, vy-15, 134, 2); }
  if(av.id==='alizés'){ ctx.fillStyle='#2468B0'; ctx.fillRect(vx-60, vy-15, 134, 2); }
  ctx.fillStyle=av.deck; ctx.fillRect(vx-55, vy-22, 115, 6);

  // Bridge at stern
  ctx.fillStyle=av.bridge;
  ctx.fillRect(vx-55, vy-48, 30, 26);
  ctx.fillStyle='#5DADEC';
  ctx.fillRect(vx-50, vy-44, 8, 10);
  ctx.fillRect(vx-40, vy-44, 8, 10);
  ctx.fillStyle='#4A9AD9'; ctx.fillRect(vx-50, vy-39, 18, 1);
  // funnel
  if(av.id==='alizés'){
    ctx.fillStyle=av.funnel; ctx.fillRect(vx-48, vy-56, 10, 10);
    ctx.fillStyle='#FFD700'; ctx.fillRect(vx-48, vy-56, 10, 2);
  } else {
    ctx.fillStyle='#555'; ctx.fillRect(vx-48, vy-56, 10, 10);
    ctx.fillStyle='#FF6600'; ctx.fillRect(vx-48, vy-52, 10, 4);
  }
  // Helideck (Bokalift 1 only)
  if(av.id==='bokalift1'){
    ctx.fillStyle='#556B2F'; ctx.fillRect(vx-60, vy-24, 14, 3);
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=0.5; ctx.strokeRect(vx-59, vy-24, 12, 3); ctx.lineWidth=1;
  }
  // Vessel name on hull
  ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='5px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(av.name, vx+20, vy-8);

  // ── Crane tower ──
  const craneBaseX = vx + 10;
  const craneBaseY = vy - 22;
  const towerH = 55;
  if(av.id==='bokalift1'){
    // White pedestal
    ctx.fillStyle='#E8E8E8'; ctx.fillRect(craneBaseX-6, craneBaseY-towerH, 12, towerH);
    ctx.fillStyle='#D0D0D0'; ctx.fillRect(craneBaseX+4, craneBaseY-towerH, 2, towerH);
    ctx.fillStyle='#F5F5F5'; ctx.fillRect(craneBaseX-6, craneBaseY-towerH, 2, towerH);
    ctx.fillStyle='#C8C8C8'; ctx.fillRect(craneBaseX-8, craneBaseY-towerH-3, 16, 5);
    ctx.fillStyle='rgba(255,100,0,0.5)'; ctx.font='4px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Boskalis', craneBaseX, craneBaseY-towerH/2);
  } else if(av.id==='bokalift2'){
    // Yellow lattice crane tower
    ctx.fillStyle='#FFD700'; ctx.fillRect(craneBaseX-5, craneBaseY-towerH, 10, towerH);
    ctx.fillStyle='#DAB800'; for(let i=0;i<towerH;i+=5) ctx.fillRect(craneBaseX-4, craneBaseY-towerH+i, 8, 1);
    ctx.fillStyle='#E8C800'; ctx.fillRect(craneBaseX-7, craneBaseY-towerH-3, 14, 5);
  } else {
    // White/light tower (Les Alizés)
    ctx.fillStyle='#F0F0F0'; ctx.fillRect(craneBaseX-7, craneBaseY-towerH, 14, towerH);
    ctx.fillStyle='#D8D8D8'; ctx.fillRect(craneBaseX+5, craneBaseY-towerH, 2, towerH);
    ctx.fillStyle='#FAFAFA'; ctx.fillRect(craneBaseX-7, craneBaseY-towerH, 2, towerH);
    ctx.fillStyle='#DDD'; ctx.fillRect(craneBaseX-9, craneBaseY-towerH-3, 18, 5);
  }

  // ── Crane boom ──
  const boomLen = 80;
  const boomTipX = craneBaseX + boomLen;
  const boomY = craneBaseY - towerH;
  ctx.fillStyle=av.boom;
  ctx.fillRect(craneBaseX, boomY, boomLen, 4);
  // boom lattice
  ctx.fillStyle='rgba(0,0,0,0.15)';
  ctx.fillRect(craneBaseX, boomY+2, boomLen, 1);

  // ── Cable + hook + monopile ──
  let cableBottom;
  let mpDrawY;  // monopile Y position
  const mpW = t.r * 1.2;     // visual width
  const mpH = t.r * 3 + 10;  // visual height
  const hookX = boomTipX - 5;

  if(isLoad){
    // ONE-BY-ONE loading: divide animation into sub-cycles per pile
    const totalPiles = getTypeCap(anim.pType);
    const cycleProg = prog * totalPiles;        // 0..totalPiles
    const pileIndex = Math.min(Math.floor(cycleProg), totalPiles - 1); // which pile (0-based)
    const subProg = cycleProg - pileIndex;       // 0..1 within this pile's cycle

    // LOAD single-pile phases:
    // 0.0–0.2: cable descends to dock
    // 0.2–0.4: attach & pick up
    // 0.4–0.7: lifting up
    // 0.7–1.0: swing to deck, place

    const dockTop = seaTop - 20;
    const deckTop = vy - 20;
    const liftTop = boomY + 8;

    if(subProg < 0.2){
      const p2 = subProg / 0.2;
      cableBottom = boomY + 6 + p2 * (dockTop - boomY - 6);
    } else if(subProg < 0.4){
      cableBottom = dockTop;
    } else if(subProg < 0.7){
      const p2 = (subProg - 0.4) / 0.3;
      cableBottom = dockTop - p2 * (dockTop - liftTop);
    } else {
      cableBottom = liftTop;
    }

    // cable
    ctx.fillStyle='#333';
    ctx.fillRect(hookX, boomY+4, 1, cableBottom - boomY - 4);
    // hook
    ctx.fillStyle='#666';
    ctx.fillRect(hookX-2, cableBottom-2, 5, 4);
    ctx.fillRect(hookX-1, cableBottom+2, 3, 2);

    // monopile on hook (visible after 0.2 of sub-cycle)
    if(subProg > 0.2){
      const mpX = hookX - mpW/2;
      let mpY2 = cableBottom + 4;
      // if in swing-to-deck phase, blend X toward deck
      if(subProg > 0.7){
        // don't draw on hook once placed (>0.95)
        if(subProg < 0.95){
          ctx.fillStyle = t.col;
          ctx.fillRect(mpX, mpY2, mpW, mpH);
          ctx.fillRect(mpX-2, mpY2, mpW+4, 4);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(mpX+1, mpY2+4, 2, mpH-4);
          ctx.fillStyle = t.dk;
          ctx.fillRect(mpX+mpW-2, mpY2+4, 2, mpH-4);
        }
      } else {
        ctx.fillStyle = t.col;
        ctx.fillRect(mpX, mpY2, mpW, mpH);
        ctx.fillRect(mpX-2, mpY2, mpW+4, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(mpX+1, mpY2+4, 2, mpH-4);
        ctx.fillStyle = t.dk;
        ctx.fillRect(mpX+mpW-2, mpY2+4, 2, mpH-4);
        ctx.fillRect(mpX-2, mpY2, mpW+4, 1);
      }
    }

    // sparks when attaching (0.2–0.35 of sub-cycle)
    if(subProg > 0.18 && subProg < 0.38 && frame%2===0){
      ctx.fillStyle='#FFD700';
      const sx2 = hookX + (Math.random()-0.5)*10;
      const sy2 = cableBottom + (Math.random()-0.5)*6;
      ctx.fillRect(sx2, sy2, 2, 2);
    }

    // Piles already loaded on deck
    for(let i=0; i<pileIndex; i++){
      const deckPileX = vx - 10 + i * (mpW + 4);
      const deckPileY = vy - 22 - mpH;
      ctx.fillStyle = t.col;
      ctx.fillRect(deckPileX, deckPileY, mpW, mpH);
      ctx.fillRect(deckPileX-1, deckPileY, mpW+2, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(deckPileX+1, deckPileY+3, 2, mpH-3);
    }
    // Current pile placed on deck (when sub-cycle >0.95)
    if(subProg > 0.95){
      const deckPileX = vx - 10 + pileIndex * (mpW + 4);
      const deckPileY = vy - 22 - mpH;
      ctx.fillStyle = t.col;
      ctx.fillRect(deckPileX, deckPileY, mpW, mpH);
      ctx.fillRect(deckPileX-1, deckPileY, mpW+2, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(deckPileX+1, deckPileY+3, 2, mpH-3);
    }

    // Beep on each pile pickup (at 0.4 of sub-cycle)
    if(subProg > 0.39 && subProg < 0.42){
      // Use frame mod to avoid repeated beeps
      if(frame%4===0) beep(523 + pileIndex*100, .08);
    }

  } else {
    // INSTALL phases: lift from deck → swing out → lower → splash → release
    // Phase 0.0–0.15: lift from deck
    // Phase 0.15–0.35: at top
    // Phase 0.35–0.75: lower into water
    // Phase 0.75–1.0: release & retract

    const liftTop   = boomY + 8;
    const waterLine = seaTop;
    const seabedY   = py + ph - 16;
    // monopile extends from seabed to above water
    const installedH = seabedY - waterLine + 20;  // total height: seabed to above water
    const installedTop = seabedY - installedH;     // top of installed pile

    if(prog < 0.15){
      const p2 = prog / 0.15;
      cableBottom = liftTop + (1-p2) * 30;
    } else if(prog < 0.35){
      cableBottom = liftTop;
    } else if(prog < 0.75){
      const p2 = (prog - 0.35) / 0.4;
      cableBottom = liftTop + p2 * (installedTop - 4 - liftTop);
    } else {
      // retract cable
      const p2 = (prog - 0.75) / 0.25;
      cableBottom = (installedTop - 4) - p2 * (installedTop - 4 - liftTop);
    }

    // cable
    ctx.fillStyle='#333';
    ctx.fillRect(hookX, boomY+4, 1, cableBottom - boomY - 4);
    // hook
    ctx.fillStyle='#666';
    ctx.fillRect(hookX-2, cableBottom-2, 5, 4);
    ctx.fillRect(hookX-1, cableBottom+2, 3, 2);

    // monopile (visible until 0.75)
    if(prog < 0.75){
      const mpX = hookX - mpW/2;
      let mpY2 = cableBottom + 4;
      // clamp bottom to seabed
      if(mpY2 + installedH > seabedY) mpY2 = seabedY - installedH;

      ctx.fillStyle = t.col;
      ctx.fillRect(mpX, mpY2, mpW, installedH);
      ctx.fillRect(mpX-2, mpY2, mpW+4, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(mpX+1, mpY2+4, 2, installedH-4);
      ctx.fillStyle = t.dk;
      ctx.fillRect(mpX+mpW-2, mpY2+4, 2, installedH-4);
      ctx.fillRect(mpX-2, mpY2, mpW+4, 1);

      // entering water effect
      if(mpY2 + installedH > waterLine && prog < 0.75){
        // splash drops
        ctx.fillStyle='rgba(140,200,255,0.6)';
        const splY = waterLine;
        ctx.fillRect(hookX-8, splY-4-Math.random()*6, 3, 3);
        ctx.fillRect(hookX+6, splY-3-Math.random()*5, 2, 2);
        ctx.fillRect(hookX-12, splY-2-Math.random()*4, 2, 2);
        ctx.fillRect(hookX+10, splY-5-Math.random()*3, 3, 2);
      }
    } else {
      // installed monopile — sits on seabed, sticks up above water
      const mpX = hookX - mpW/2;
      const fullH = mpH + (waterLine - seabedY + mpH) * 0.5 + 15; // taller to stick above water
      const mpY2 = seabedY - fullH + 4;
      ctx.fillStyle = t.col;
      ctx.fillRect(mpX, mpY2, mpW, fullH);
      ctx.fillRect(mpX-2, mpY2, mpW+4, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(mpX+1, mpY2+4, 2, fullH-4);
      ctx.fillStyle = t.dk;
      ctx.fillRect(mpX+mpW-2, mpY2+4, 2, fullH-4);
      // waterline mark on pile
      ctx.fillStyle = 'rgba(100,180,255,0.3)';
      ctx.fillRect(mpX-1, waterLine-1, mpW+2, 3);
    }

    // bubbles underwater
    if(prog > 0.4 && prog < 0.8 && frame%3===0){
      ctx.fillStyle='rgba(180,220,255,0.5)';
      const bx = hookX + (Math.random()-0.5)*20;
      const by = waterLine + Math.random()*(seabedY-waterLine)*0.6;
      ctx.beginPath();
      ctx.arc(bx, by, 1+Math.random()*2, 0, Math.PI*2);
      ctx.fill();
    }

    // splash ring when hitting water (0.5–0.6)
    if(prog > 0.48 && prog < 0.62){
      const sp = (prog-0.48)/0.14;
      ctx.globalAlpha = alpha * (1-sp)*0.7;
      ctx.strokeStyle='#AADDFF'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.ellipse(hookX, waterLine, 8+sp*25, 2+sp*4, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.lineWidth=1;
      ctx.globalAlpha = alpha;
    }
  }

  // ── Dock / port structure (for LOAD) ──
  if(isLoad){
    const dockX = px + pw - 80;
    const dockW = 70;
    const dockTop2 = seaTop - 20;
    // dock platform
    drawBrick(dockX, dockTop2, dockW, seaTop - dockTop2 + 20);
    // dock pillars underwater
    ctx.fillStyle='#5C3A0A';
    ctx.fillRect(dockX+5, seaTop, 6, seaH - 8);
    ctx.fillRect(dockX+dockW-11, seaTop, 6, seaH - 8);
    // remaining monopiles on dock (decreases as piles are loaded one by one)
    const capNow = getTypeCap(anim.pType);
    const cycleProg2 = prog * capNow;
    const pilesPickedUp = Math.min(Math.floor(cycleProg2), capNow);
    const remaining = Math.max(0, capNow - pilesPickedUp - 1);
    for(let i=0;i<remaining && i<3;i++){
      drawPipe(dockX+15+i*18, dockTop2-t.r*2-2, t.r*0.7, t.r*2, t.col, t.dk);
    }
  }

  // ── Label ──
  ctx.fillStyle='#FFF'; ctx.font='8px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='top';
  const label = isLoad
    ? 'LOADING '+t.name+': '+(Math.min(Math.floor(prog*getTypeCap(anim.pType))+1, getTypeCap(anim.pType)))+'/'+getTypeCap(anim.pType)
    : 'INSTALLING: '+t.name+' ('+t.label+')';
  ctx.fillText(label, px+pw/2, py+6);

  // ── Progress bar ──
  const barW = pw - 40, barH = 6;
  const barX = px + 20, barY = py + ph - 20;
  ctx.fillStyle='#222';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = isLoad ? '#FFD700' : '#00CC00';
  ctx.fillRect(barX, barY, barW * prog, barH);
  ctx.strokeStyle='#555';
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════
//  PHASE 2: CABLE LAYING
// ═══════════════════════════════════════════════════════

/* ── Cable route generation ── */
function genCableRoute(){
  // Connections based on site grid positions:
  // 0:(0,0) 1:(0,1) 2:(0,2) 3:(1,0) 4:(1,2) 5:(2,0) 6:(2,1)
  const connections = [[0,1],[1,2],[0,3],[2,4],[3,5],[5,6]];
  cableSegments = connections.map(([a,b])=>({
    fromIdx:a, toIdx:b,
    from:{x:sites[a].x, y:sites[a].y},
    to:{x:sites[b].x, y:sites[b].y},
    done:false
  }));

  // Generate UXOs along cable routes
  uxos = [];
  const cw = activeCableVessel.corridorWidth;
  for(const seg of cableSegments){
    const dx2=seg.to.x-seg.from.x, dy2=seg.to.y-seg.from.y;
    const numU = 1; // exactly 1 per segment
    for(let i=0;i<numU;i++){
      const t=0.2+Math.random()*0.6;
      const perpAng=Math.atan2(dy2,dx2)+Math.PI/2;
      const off=(Math.random()-0.5)*cw*0.5;
      uxos.push({
        x:seg.from.x+dx2*t+Math.cos(perpAng)*off,
        y:seg.from.y+dy2*t+Math.sin(perpAng)*off,
        hit:false
      });
    }
  }
  activeCable=null;
  cableOutsideTimer=0;
}

function initCablePhase(){
  activeCableVessel=CABLE_VESSELS[selectedCableVessel];
  vessel.hold=[0,0,0]; vessel.busy=false; vessel.bTimer=0;
  storm.active=false; storm.warning=false;
  engine.broken=false;
  particles=[]; floats=[]; anims=[];
  msg=''; msgTimer=0;
  cableZoom=1.0;
  cableLoaded=0; cableLoadCount=0;
  cableLoadProgress=0; cableLoadSpinSpeed=0; cableLoadAngle=0; cableLoadLastKey='';
  // For standalone cable mode, generate sites and mark all done
  if(gameMode==='cable'){
    gameTime=0; frame=0; monopileTime=0;
    genSites();
    for(const s of sites) s.done=true;
    vessel.x=CABLE_PORT.x+100; vessel.y=CABLE_PORT.y;
    vessel.ang=0; vessel.spd=0;
  }
  genCableRoute();
}

/* ── Point to segment distance ── */
function pointToSegDist(px,py,ax,ay,bx,by){
  const dx2=bx-ax, dy2=by-ay, len2=dx2*dx2+dy2*dy2;
  if(len2===0) return Math.hypot(px-ax,py-ay);
  let t=((px-ax)*dx2+(py-ay)*dy2)/len2;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx2),py-(ay+t*dy2));
}

/* ── Cable action (Space key) ── */
function doCableAction(){
  if(activeCable!==null) return;
  // Port interaction — start loading minigame
  if(cableLoaded<=0 && dist(vessel,CABLE_PORT)<100){
    if(cableLoadCount>=CABLE_MAX_LOADS){ setMsg('NO MORE CABLE LOADS!'); sfxErr(); return; }
    state='CABLE_LOADING';
    cableLoadProgress=0; cableLoadSpinSpeed=0; cableLoadAngle=0; cableLoadLastKey='';
    vessel.spd=0;
    setMsg('LOADING CABLE...'); return;
  }
  if(cableLoaded<=0){ setMsg('NO CABLE! GO TO PORT'); sfxErr(); return; }
  for(let i=0;i<cableSegments.length;i++){
    const seg=cableSegments[i];
    if(seg.done) continue;
    if(dist(vessel,seg.from)<60){
      activeCable={segIdx:i, trail:[{x:vessel.x,y:vessel.y}]};
      setMsg('CABLE LAYING STARTED!'); sfxLoad(); return;
    }
    if(dist(vessel,seg.to)<60){
      const tmp=seg.from; seg.from=seg.to; seg.to=tmp;
      activeCable={segIdx:i, trail:[{x:vessel.x,y:vessel.y}]};
      setMsg('CABLE LAYING STARTED!'); sfxLoad(); return;
    }
  }
}

/* ── Cable loading minigame update ── */
function updateCableLoading(dt){
  gameTime+=dt;
  frame++;
  // Spin decays
  cableLoadSpinSpeed*=0.97;
  if(cableLoadSpinSpeed<0.005) cableLoadSpinSpeed=0;
  // Rotate carousels
  cableLoadAngle+=cableLoadSpinSpeed*0.3;
  // Progress increases with spin speed
  if(cableLoadSpinSpeed>0.05){
    cableLoadProgress+=cableLoadSpinSpeed*dt*0.5;
  }
  if(cableLoadProgress>=1){
    cableLoadProgress=1;
    cableLoaded=CABLE_PER_LOAD;
    cableLoadCount++;
    state='CABLE_LAYING';
    setMsg('CABLE LOADED!');
    sfxInstall();
  }
}

/* ── Cable loading minigame draw ── */
function drawCableLoading(){
  const time=Date.now();
  // Background: water + vessel at port
  drawWater(time); drawClouds(time);

  // Dark overlay
  ctx.fillStyle='rgba(0,0,20,0.75)';
  ctx.fillRect(0,0,W,H);

  ctx.textAlign='center'; ctx.textBaseline='middle';

  // Title
  ctx.fillStyle='#5DADEC'; ctx.font='14px "Press Start 2P"';
  ctx.fillText('LOADING CABLE',W/2,45);
  ctx.fillStyle='#AAA'; ctx.font='7px "Press Start 2P"';
  ctx.fillText(isTouchDevice?'SWIPE UP & DOWN TO SPIN!':'MASH UP & DOWN TO SPIN CAROUSELS!',W/2,70);

  // Two carousels side by side
  const lx=W/2-130, rx=W/2+130, cy=220;
  const cRadius=70;

  // Port carousel (left)
  drawCarousel(lx,cy,cRadius,cableLoadAngle,'PORT','#887766',1-cableLoadProgress);
  // Vessel carousel (right)
  drawCarousel(rx,cy,cRadius,-cableLoadAngle,'VESSEL','#4A6080',cableLoadProgress);

  // Cable transfer animation between carousels
  ctx.strokeStyle='#444'; ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(lx+cRadius+5,cy);
  const mid=W/2;
  const sag=10+Math.sin(time/200)*3;
  ctx.quadraticCurveTo(mid,cy+sag,rx-cRadius-5,cy);
  ctx.stroke();
  ctx.lineWidth=1;
  // Moving cable segments on the transfer line
  ctx.fillStyle='#222';
  if(cableLoadSpinSpeed>0.05){
    for(let i=0;i<5;i++){
      const t=((time/300+i*0.2)%1);
      const px=lx+cRadius+5+(rx-cRadius-5-lx-cRadius-5)*t;
      const py=cy+sag*4*t*(1-t);
      ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2); ctx.fill();
    }
  }

  // Labels
  ctx.fillStyle='#AAA'; ctx.font='8px "Press Start 2P"';
  ctx.fillText('ONSHORE',lx,cy+cRadius+25);
  ctx.fillText(activeCableVessel.name,rx,cy+cRadius+25);

  // Progress bar
  const barW=300, barH=20, barX=W/2-barW/2, barY=360;
  ctx.fillStyle='#222'; ctx.fillRect(barX,barY,barW,barH);
  ctx.strokeStyle='#555'; ctx.strokeRect(barX,barY,barW,barH);
  const fillW=barW*cableLoadProgress;
  const barGrad=ctx.createLinearGradient(barX,0,barX+barW,0);
  barGrad.addColorStop(0,'#FF6600');
  barGrad.addColorStop(1,'#FFD700');
  ctx.fillStyle=barGrad;
  ctx.fillRect(barX,barY,fillW,barH);
  ctx.fillStyle='#FFF'; ctx.font='8px "Press Start 2P"';
  ctx.fillText(Math.floor(cableLoadProgress*100)+'%',W/2,barY+barH/2);

  // Spin speed indicator
  const speedH=120, speedW=16, speedX=W-50, speedY=140;
  ctx.fillStyle='#222'; ctx.fillRect(speedX,speedY,speedW,speedH);
  ctx.strokeStyle='#555'; ctx.strokeRect(speedX,speedY,speedW,speedH);
  const speedFill=speedH*cableLoadSpinSpeed;
  ctx.fillStyle=cableLoadSpinSpeed>0.5?'#0C0':cableLoadSpinSpeed>0.2?'#FF0':'#F44';
  ctx.fillRect(speedX,speedY+speedH-speedFill,speedW,speedFill);
  ctx.fillStyle='#AAA'; ctx.font='6px "Press Start 2P"';
  ctx.save(); ctx.translate(speedX+speedW+12,speedY+speedH/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('SPIN',0,0);
  ctx.restore();

  // Key prompts
  const upActive=cableLoadLastKey!=='up';
  const downActive=cableLoadLastKey!=='down';
  if((time/300|0)%2){
    ctx.fillStyle=upActive?'#FFF':'#555'; ctx.font='12px "Press Start 2P"';
    ctx.fillText('\u25B2',W/2,420);
  } else {
    ctx.fillStyle=downActive?'#FFF':'#555'; ctx.font='12px "Press Start 2P"';
    ctx.fillText('\u25BC',W/2,420);
  }
  ctx.fillStyle='#888'; ctx.font='7px "Press Start 2P"';
  ctx.fillText(isTouchDevice?'SWIPE UP & DOWN':'ALTERNATE UP & DOWN',W/2,450);

  drawSoundIndicator();
}

function drawCarousel(cx,cy,r,angle,label,color,fillLevel){
  const time=Date.now();
  // Outer ring
  ctx.strokeStyle='#888'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.lineWidth=1;

  // Inner drum
  ctx.fillStyle=color; ctx.beginPath(); ctx.arc(cx,cy,r-5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(cx,cy,r-5,0,Math.PI*2); ctx.fill();

  // Cable wound on drum (represents fill level)
  if(fillLevel>0.01){
    const innerR=r*0.3;
    const outerR=innerR+(r-10-innerR)*fillLevel;
    ctx.fillStyle='#333';
    ctx.beginPath(); ctx.arc(cx,cy,outerR,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#444';
    ctx.beginPath(); ctx.arc(cx,cy,outerR-3,0,Math.PI*2); ctx.fill();
    // Cable line rings
    ctx.strokeStyle='#555'; ctx.lineWidth=0.5;
    for(let cr=innerR+2;cr<outerR;cr+=3){
      ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.stroke();
    }
    ctx.lineWidth=1;
  }

  // Spokes (rotating)
  const nSpokes=8;
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
  for(let i=0;i<nSpokes;i++){
    const a=angle+i*Math.PI*2/nSpokes;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*10,cy+Math.sin(a)*10);
    ctx.lineTo(cx+Math.cos(a)*(r-8),cy+Math.sin(a)*(r-8));
    ctx.stroke();
  }

  // Hub
  ctx.fillStyle='#666'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2); ctx.fill();

  // Hub bolt marks (rotating)
  ctx.fillStyle='#444';
  for(let i=0;i<4;i++){
    const a=angle+i*Math.PI/2;
    ctx.beginPath(); ctx.arc(cx+Math.cos(a)*6,cy+Math.sin(a)*6,1.5,0,Math.PI*2); ctx.fill();
  }

  // Outer bolts
  ctx.fillStyle='#999';
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    ctx.beginPath(); ctx.arc(cx+Math.cos(a)*(r-1),cy+Math.sin(a)*(r-1),1.5,0,Math.PI*2); ctx.fill();
  }
}

/* ── Cable laying update ── */
function updateCableLaying(dt){
  frame++;
  gameTime+=dt;
  if(msgTimer>0) msgTimer--;

  // Movement – ship steering: Left/Right rotate, Up = throttle, Down = brake
  applyTouchSteering();
  let turning2=0, throttle2=false, braking2=false;
  if(keys['ArrowLeft']||keys['KeyA'])  turning2--;
  if(keys['ArrowRight']||keys['KeyD']) turning2++;
  if(keys['ArrowUp']||keys['KeyW'])    throttle2=true;
  if(keys['ArrowDown']||keys['KeyS'])  braking2=true;

  const cSpd=activeCableVessel.speed*(activeCable!==null?CABLE_LAYING_SPEED_MULT:1);
  vessel.ang += turning2 * V_TURN * (0.5 + Math.min(vessel.spd / cSpd, 1) * 0.5);
  if(throttle2){
    vessel.spd = Math.min(vessel.spd + cSpd * 0.03, cSpd);
  } else if(braking2){
    vessel.spd *= 0.90;
  } else {
    vessel.spd *= 0.97;
  }
  if(vessel.spd>0.08){
    vessel.x+=Math.cos(vessel.ang)*vessel.spd;
    vessel.y+=Math.sin(vessel.ang)*vessel.spd;
    if(frame%2===0) particles.push({
      x:vessel.x-Math.cos(vessel.ang)*32,
      y:vessel.y-Math.sin(vessel.ang)*32,
      vx:(Math.random()-.5)*.5, vy:(Math.random()-.5)*.5,
      life:40, col:'rgba(200,230,255,0.5)', sz:3
    });
    // Cable laying trail particle (dark cable on seabed)
    if(activeCable && frame%3===0){
      particles.push({x:vessel.x-Math.cos(vessel.ang)*36,
        y:vessel.y-Math.sin(vessel.ang)*36,
        vx:0, vy:0, life:999, col:'#222', sz:2});
    }
  } else if(!throttle2) vessel.spd=0;

  vessel.x=clamp(vessel.x,30,WORLD_W-30);
  vessel.y=clamp(vessel.y,30,WORLD_H-30);

  // Zoom transition
  const targetZoom=activeCable!==null?CABLE_ZOOM_LAYING:1.0;
  cableZoom+=(targetZoom-cableZoom)*0.04;

  // Camera – always target vessel at screen centre; zoom scales around (W/2,H/2)
  cam.x+=(vessel.x-W/2-cam.x)*0.08;
  cam.y+=(vessel.y-H/2-cam.y)*0.08;
  cam.x=clamp(cam.x,0,Math.max(0,WORLD_W-W));
  cam.y=clamp(cam.y,0,Math.max(0,WORLD_H-H));

  // Active cable segment logic
  if(activeCable!==null){
    const seg=cableSegments[activeCable.segIdx];
    const cw=activeCableVessel.corridorWidth;
    // Trail
    if(activeCable.trail.length===0||dist(vessel,activeCable.trail[activeCable.trail.length-1])>8)
      activeCable.trail.push({x:vessel.x,y:vessel.y});
    // Corridor check
    const dts=pointToSegDist(vessel.x,vessel.y,seg.from.x,seg.from.y,seg.to.x,seg.to.y);
    if(dts>cw/2){
      cableOutsideTimer+=dt;
      if(cableOutsideTimer>CORRIDOR_GRACE){
        const prev=Math.floor((cableOutsideTimer-CORRIDOR_GRACE-dt)/CORRIDOR_PENALTY_TIME);
        const curr=Math.floor((cableOutsideTimer-CORRIDOR_GRACE)/CORRIDOR_PENALTY_TIME);
        if(curr>prev){
          gameTime+=CORRIDOR_PENALTY_TIME;
          setMsg('OUTSIDE CORRIDOR! +'+CORRIDOR_PENALTY_TIME+'s');
          sfxErr(); burst(vessel.x,vessel.y,5,'#F44');
        }
      }
    } else { cableOutsideTimer=0; }
    // Cable connected? Trail must reach the destination monopile
    const trailEnd=activeCable.trail[activeCable.trail.length-1];
    const trailStart=activeCable.trail[0];
    if(dist(trailEnd,seg.to)<40 && dist(trailStart,seg.from)<60){
      seg.done=true; activeCable=null; cableOutsideTimer=0;
      cableLoaded--;
      addFloat(seg.to.x,seg.to.y-30,'CABLE CONNECTED!','#0F0');
      sfxInstall(); setMsg('CABLE SEGMENT COMPLETE!');
      if(cableSegments.every(s=>s.done)){
        state='WIN';
        if(!bestTime||gameTime<bestTime){ bestTime=gameTime; saveBest(); }
        sfxWin();
      }
    }
  }

  // UXO – only triggers when the laid cable crosses it
  if(activeCable!==null && activeCable.trail.length>=2){
    const last=activeCable.trail[activeCable.trail.length-1];
    for(const uxo of uxos){
      if(!uxo.hit && dist(last,uxo)<UXO_RADIUS+10){
        uxo.hit=true; gameTime+=UXO_PENALTY;
        setMsg('CABLE HIT UXO! +'+UXO_PENALTY+'s PENALTY');
        beep(150,.4,'sawtooth');
        setTimeout(()=>beep(80,.6,'sawtooth'),100);
        setTimeout(()=>beep(50,.8,'sawtooth'),250);
        spawnExplosion(uxo.x,uxo.y);
        screenShake = 60;
      }
    }
  }

  // Context hint
  contextHint='';
  if(activeCable!==null){
    const seg=cableSegments[activeCable.segIdx];
    const de=(dist(vessel,seg.to)|0);
    const dts2=pointToSegDist(vessel.x,vessel.y,seg.from.x,seg.from.y,seg.to.x,seg.to.y);
    if(dts2>activeCableVessel.corridorWidth/2) contextHint='OUTSIDE CORRIDOR! RETURN TO ROUTE';
    else contextHint='LAYING CABLE... '+de+'m TO DESTINATION';
  } else {
    if(cableLoaded<=0){
      if(cableLoadCount>=CABLE_MAX_LOADS) contextHint='NO MORE CABLE - LAY REMAINING';
      else if(dist(vessel,CABLE_PORT)<100) contextHint=(isTouchDevice?'TAP':'SPACE')+' = LOAD CABLE ('+cableLoadCount+'/'+CABLE_MAX_LOADS+')';
      else contextHint='SAIL TO PORT TO LOAD CABLE';
    } else {
      for(let i=0;i<cableSegments.length;i++){
        const seg=cableSegments[i]; if(seg.done) continue;
        if(dist(vessel,seg.from)<60||dist(vessel,seg.to)<60){ contextHint=(isTouchDevice?'TAP':'SPACE')+' = START LAYING CABLE'; break; }
      }
      if(!contextHint){
        const rem=cableSegments.filter(s=>!s.done).length;
        contextHint=rem+' CABLE SEGMENT'+(rem!==1?'S':'')+' REMAINING';
      }
    }
  }

  // Particles & floats
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
  for(let i=floats.length-1;i>=0;i--){
    const f=floats[i]; f.y-=0.7; f.life--;
    if(f.life<=0) floats.splice(i,1);
  }
}

/* ── Draw: Cable corridor ── */
function drawCableCorridor(seg,idx){
  const w=activeCableVessel.corridorWidth;
  const fx=seg.from.x-cam.x, fy=seg.from.y-cam.y;
  const tx=seg.to.x-cam.x, ty=seg.to.y-cam.y;
  const ang=Math.atan2(seg.to.y-seg.from.y,seg.to.x-seg.from.x);
  const px=Math.cos(ang+Math.PI/2)*w/2, py=Math.sin(ang+Math.PI/2)*w/2;

  // Determine if this is the next corridor to lay
  const isActive=(activeCable&&activeCable.segIdx===idx);
  const nextIdx=cableSegments.findIndex(s=>!s.done);
  const isNext=(!activeCable && idx===nextIdx);
  const pulse=isNext?0.7+Math.sin(Date.now()/300)*0.3:1;

  // Fill color: done=green, active=yellow, next=bright highlight, other=dim
  if(seg.done) ctx.fillStyle='rgba(0,180,0,0.12)';
  else if(isActive) ctx.fillStyle='rgba(255,200,0,0.18)';
  else if(isNext) ctx.fillStyle=`rgba(100,200,255,${0.15*pulse})`;
  else ctx.fillStyle='rgba(255,255,255,0.05)';

  ctx.beginPath();
  ctx.moveTo(fx+px,fy+py); ctx.lineTo(tx+px,ty+py);
  ctx.lineTo(tx-px,ty-py); ctx.lineTo(fx-px,fy-py);
  ctx.closePath(); ctx.fill();

  // Border dashes
  ctx.setLineDash([6,4]);
  if(seg.done) ctx.strokeStyle='rgba(0,180,0,0.4)';
  else if(isNext||isActive) ctx.strokeStyle=`rgba(100,200,255,${0.5*pulse})`;
  else ctx.strokeStyle='rgba(255,200,0,0.15)';
  ctx.beginPath(); ctx.moveTo(fx+px,fy+py); ctx.lineTo(tx+px,ty+py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx-px,fy-py); ctx.lineTo(tx-px,ty-py); ctx.stroke();
  ctx.setLineDash([]);

  // Label
  if(!seg.done){
    const labelAlpha=isNext?0.7:isActive?0.5:0.15;
    ctx.fillStyle=`rgba(255,255,255,${labelAlpha})`; ctx.font='7px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('CABLE '+(idx+1),(fx+tx)/2,(fy+ty)/2-12);
  }

  // Direction arrows along the next corridor
  if((isNext||isActive) && !seg.done){
    const dx=tx-fx, dy=ty-fy;
    const len=Math.hypot(dx,dy);
    const steps=Math.floor(len/50);
    const arrowAlpha=isActive?0.5:0.4*pulse;
    ctx.fillStyle=`rgba(100,220,255,${arrowAlpha})`;
    for(let s=1;s<=steps;s++){
      const t=s/(steps+1);
      const ax=fx+dx*t, ay=fy+dy*t;
      ctx.save();
      ctx.translate(ax,ay);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(8,0); ctx.lineTo(-4,-5); ctx.lineTo(-4,5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

/* ── Draw: Completed cable line ── */
function drawCompletedCable(seg){
  ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(seg.from.x-cam.x,seg.from.y-cam.y);
  ctx.lineTo(seg.to.x-cam.x,seg.to.y-cam.y);
  ctx.stroke();
  ctx.strokeStyle='#333'; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(seg.from.x-cam.x,seg.from.y-cam.y);
  ctx.lineTo(seg.to.x-cam.x,seg.to.y-cam.y);
  ctx.stroke();
  ctx.lineWidth=1;
}

/* ── Draw: Active cable trail ── */
function drawCableTrail(ac){
  if(ac.trail.length<2) return;
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(ac.trail[0].x-cam.x,ac.trail[0].y-cam.y);
  for(let i=1;i<ac.trail.length;i++)
    ctx.lineTo(ac.trail[i].x-cam.x,ac.trail[i].y-cam.y);
  ctx.lineTo(vessel.x-cam.x,vessel.y-cam.y);
  ctx.stroke(); ctx.lineWidth=1;
}

/* ── Draw: UXO ── */
function drawUXO(uxo){
  const sx=uxo.x-cam.x, sy=uxo.y-cam.y;
  if(sx<-40||sx>W+40||sy<-40||sy>H+40) return;
  if(uxo.hit){
    ctx.fillStyle='rgba(100,50,0,0.3)';
    ctx.beginPath(); ctx.arc(sx,sy,UXO_RADIUS,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,0,0,0.3)'; ctx.font='6px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('UXO',sx,sy); return;
  }
  // Danger glow
  const pulse=Math.sin(frame*0.05)*0.3+0.7;
  ctx.fillStyle=`rgba(180,50,0,${0.08*pulse})`;
  ctx.beginPath(); ctx.arc(sx,sy,UXO_RADIUS+12,0,Math.PI*2); ctx.fill();
  // Mine body
  ctx.fillStyle='#5A3000';
  ctx.beginPath(); ctx.arc(sx,sy,UXO_RADIUS,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#3A1800';
  ctx.beginPath(); ctx.arc(sx,sy,UXO_RADIUS-3,0,Math.PI*2); ctx.fill();
  // Spikes
  ctx.fillStyle='#7A4400';
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    const hx=sx+Math.cos(a)*(UXO_RADIUS+2), hy=sy+Math.sin(a)*(UXO_RADIUS+2);
    ctx.beginPath(); ctx.arc(hx,hy,2,0,Math.PI*2); ctx.fill();
  }
  // Warning
  ctx.fillStyle='#FF4400'; ctx.font='8px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('!',sx,sy+1);
  ctx.fillStyle='rgba(255,68,0,0.6)'; ctx.font='5px "Press Start 2P"';
  ctx.fillText('UXO',sx,sy-UXO_RADIUS-8);
}

/* ── Draw: Cable vessel (top-down) ── */
function drawCableVessel(){
  const sx=vessel.x-cam.x, sy=vessel.y-cam.y;
  ctx.save(); ctx.translate(sx,sy); ctx.rotate(vessel.ang);
  const av=activeCableVessel;
  const time=Date.now();

  // Wake spray
  if(vessel.spd>0.3){
    const wAlpha=Math.min(vessel.spd/activeCableVessel.speed,1)*0.15;
    ctx.fillStyle=`rgba(200,230,255,${wAlpha})`;
    for(let i=0;i<3;i++){
      const wo=Math.sin(time/200+i*2)*3;
      ctx.beginPath(); ctx.arc(-38-i*5,wo,2+i*2,0,Math.PI*2); ctx.fill();
    }
  }

  // Hull shadow
  ctx.fillStyle='rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(0,2,40,18,0,0,Math.PI*2); ctx.fill();

  if(av.id==='ndurance'){
    // ── Ndurance: sleek cable lay vessel ──
    // Hull with curved bow
    ctx.fillStyle=av.hull;
    ctx.beginPath();
    ctx.moveTo(-36,-14); ctx.lineTo(32,-14); ctx.quadraticCurveTo(46,-12,46,-2);
    ctx.lineTo(46,2); ctx.quadraticCurveTo(46,12,32,14); ctx.lineTo(-36,14);
    ctx.closePath(); ctx.fill();
    // Anti-fouling
    ctx.fillStyle=av.antifoul; ctx.fillRect(-36,11,80,3);
    // Waterline
    ctx.fillStyle=av.hullDk; ctx.fillRect(-36,-14,80,2);
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(-36,-12,80,3);
    // Orange stripe
    ctx.fillStyle='#FF6600'; ctx.fillRect(-36,-5,80,1.5);
    // Deck
    ctx.fillStyle=av.deck; ctx.fillRect(-30,-10,64,20);
    ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=0.5;
    for(let gx=-26;gx<34;gx+=8){ ctx.beginPath(); ctx.moveTo(gx,-10); ctx.lineTo(gx,10); ctx.stroke(); }
    ctx.lineWidth=1;
    // Bridge superstructure
    ctx.fillStyle=av.bridge; ctx.fillRect(14,-10,20,20);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.strokeRect(14,-10,20,20);
    ctx.fillStyle='#FFF'; ctx.fillRect(16,-8,16,16);
    // Windows
    ctx.fillStyle='#5DADEC'; ctx.fillRect(17,-7,5,6); ctx.fillRect(24,-7,5,6);
    ctx.fillStyle='#4A9AD9'; ctx.fillRect(17,-3,12,1);
    // Side windows
    ctx.fillStyle='#5DADEC'; ctx.fillRect(17,3,5,4); ctx.fillRect(24,3,5,4);
    // Bridge wings
    ctx.fillStyle='#CCC'; ctx.fillRect(14,-6,2,12);
    ctx.fillRect(33,-6,2,12);
    // Radar mast
    ctx.fillStyle='#DDD'; ctx.fillRect(18,-13,12,4);
    ctx.fillStyle='#555'; ctx.fillRect(23,-17,2,5);
    ctx.fillStyle='#888'; ctx.fillRect(20,-16,8,1);
    ctx.fillStyle='#AAA'; ctx.beginPath(); ctx.arc(24,-17,1.5,0,Math.PI*2); ctx.fill();
    // Cable carousel (main feature)
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(-4,0,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(-4,0,7,0,Math.PI*2); ctx.fill();
    // Cable wound on carousel
    ctx.strokeStyle='#777'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(-4,0,8.5,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#666'; ctx.beginPath(); ctx.arc(-4,0,6,0,Math.PI*2); ctx.stroke();
    // Carousel hub
    ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(-4,0,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(-4,0,2,0,Math.PI*2); ctx.fill();
    // Carousel spokes
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=0.5;
    for(let sp=0;sp<6;sp++){
      const sa=sp*Math.PI/3+time/2000;
      ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-4+Math.cos(sa)*7,Math.sin(sa)*7); ctx.stroke();
    }
    ctx.lineWidth=1;
    // A-frame at stern
    ctx.fillStyle='#999';
    ctx.beginPath(); ctx.moveTo(-34,-9); ctx.lineTo(-30,-14); ctx.lineTo(-30,-9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-34,9); ctx.lineTo(-30,14); ctx.lineTo(-30,9); ctx.fill();
    ctx.fillStyle='#888'; ctx.fillRect(-34,-9,4,18);
    ctx.fillStyle='#777'; ctx.fillRect(-30,-3,5,6);
    // Tensioner
    ctx.fillStyle='#666'; ctx.fillRect(-28,-2,4,4);
    // Funnel
    ctx.fillStyle='#555'; ctx.fillRect(10,-14,6,5);
    ctx.fillStyle='#FF6600'; ctx.fillRect(10,-12,6,2);
    // Exhaust
    ctx.fillStyle='rgba(150,150,150,0.1)';
    ctx.beginPath(); ctx.arc(13,-16,2+Math.sin(time/300)*0.5,0,Math.PI*2); ctx.fill();
    // Portholes
    ctx.fillStyle='rgba(200,220,255,0.25)';
    for(let px2=-20;px2<15;px2+=8){ ctx.beginPath(); ctx.arc(px2,-12,1.2,0,Math.PI*2); ctx.fill(); }
    // Bollards & railing
    ctx.fillStyle='#444';
    for(let bx=-20;bx<30;bx+=10){ ctx.fillRect(bx,-11,1.5,1); ctx.fillRect(bx,10,1.5,1); }
    ctx.strokeStyle='rgba(100,100,100,0.25)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(-28,-11); ctx.lineTo(32,-11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28,11); ctx.lineTo(32,11); ctx.stroke();
    ctx.lineWidth=1;

  } else {
    // ── Boka Ocean: large subsea construction vessel ──
    // Hull
    ctx.fillStyle=av.hull;
    ctx.beginPath();
    ctx.moveTo(-40,-16); ctx.lineTo(38,-16); ctx.quadraticCurveTo(52,-14,52,-4);
    ctx.lineTo(52,4); ctx.quadraticCurveTo(52,14,38,16); ctx.lineTo(-40,16);
    ctx.closePath(); ctx.fill();
    // Anti-fouling
    ctx.fillStyle=av.antifoul; ctx.fillRect(-40,13,90,3);
    // Waterline
    ctx.fillStyle=av.hullDk; ctx.fillRect(-40,-16,90,2);
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(-40,-14,90,3);
    // Orange stripe
    ctx.fillStyle='#FF6600'; ctx.fillRect(-40,-6,90,1.5);
    // Deck
    ctx.fillStyle=av.deck; ctx.fillRect(-34,-12,74,24);
    ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=0.5;
    for(let gx=-30;gx<40;gx+=8){ ctx.beginPath(); ctx.moveTo(gx,-12); ctx.lineTo(gx,12); ctx.stroke(); }
    ctx.lineWidth=1;
    // Bridge
    ctx.fillStyle=av.bridge; ctx.fillRect(16,-12,22,24);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.strokeRect(16,-12,22,24);
    ctx.fillStyle='#FFF'; ctx.fillRect(18,-10,18,20);
    ctx.fillStyle='#5DADEC'; ctx.fillRect(19,-9,5,6); ctx.fillRect(26,-9,5,6);
    ctx.fillStyle='#4A9AD9'; ctx.fillRect(19,-5,12,1);
    ctx.fillStyle='#5DADEC'; ctx.fillRect(19,3,5,5); ctx.fillRect(26,3,5,5);
    // Bridge wings
    ctx.fillStyle='#DDD'; ctx.fillRect(16,-7,2,14);
    ctx.fillRect(37,-7,2,14);
    // Radar mast
    ctx.fillStyle='#EEE'; ctx.fillRect(20,-16,14,5);
    ctx.fillStyle='#555'; ctx.fillRect(26,-20,2,6);
    ctx.fillStyle='#888'; ctx.fillRect(23,-19,8,1);
    ctx.fillStyle='#AAA'; ctx.beginPath(); ctx.arc(27,-20,2,0,Math.PI*2); ctx.fill();
    // Large cable carousel
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(-6,0,13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(-6,0,9,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#777'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(-6,0,11,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#666'; ctx.beginPath(); ctx.arc(-6,0,7.5,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(-6,0,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(-6,0,3,0,Math.PI*2); ctx.fill();
    // Carousel spokes
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.5;
    for(let sp=0;sp<8;sp++){
      const sa=sp*Math.PI/4+time/2000;
      ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(-6+Math.cos(sa)*9,Math.sin(sa)*9); ctx.stroke();
    }
    ctx.lineWidth=1;
    // ROV bay (port & starboard)
    ctx.fillStyle='#8899AA'; ctx.fillRect(-20,-10,12,8);
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.strokeRect(-20,-10,12,8);
    ctx.fillStyle='#FFAA00'; ctx.fillRect(-18,-8,3,4); // ROV
    ctx.fillStyle='#6A7A8A'; ctx.fillRect(-20,2,12,8);
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.strokeRect(-20,2,12,8);
    ctx.fillStyle='#FFAA00'; ctx.fillRect(-18,4,3,4); // ROV
    // A-frame at stern
    ctx.fillStyle='#999';
    ctx.beginPath(); ctx.moveTo(-38,-11); ctx.lineTo(-33,-17); ctx.lineTo(-33,-11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-38,11); ctx.lineTo(-33,17); ctx.lineTo(-33,11); ctx.fill();
    ctx.fillStyle='#888'; ctx.fillRect(-38,-11,4,22);
    ctx.fillStyle='#777'; ctx.fillRect(-34,-4,6,8);
    // Tensioner
    ctx.fillStyle='#666'; ctx.fillRect(-32,-3,4,6);
    ctx.fillStyle='#555'; ctx.fillRect(-31,-1,2,2);
    // Funnel
    ctx.fillStyle='#555'; ctx.fillRect(12,-16,8,6);
    ctx.fillStyle='#FF6600'; ctx.fillRect(12,-14,8,2);
    ctx.fillStyle='rgba(150,150,150,0.1)';
    ctx.beginPath(); ctx.arc(16,-18,3+Math.sin(time/300)*0.5,0,Math.PI*2); ctx.fill();
    // DP thrusters
    ctx.fillStyle=av.hullDk;
    ctx.beginPath(); ctx.arc(-38,10,3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-38,-10,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(-38,10,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-38,-10,1.5,0,Math.PI*2); ctx.fill();
    // Portholes
    ctx.fillStyle='rgba(200,220,255,0.25)';
    for(let px2=-26;px2<20;px2+=8){ ctx.beginPath(); ctx.arc(px2,-14,1.5,0,Math.PI*2); ctx.fill(); }
    // Bollards & railing
    ctx.fillStyle='#444';
    for(let bx=-22;bx<36;bx+=10){ ctx.fillRect(bx,-13,1.5,1); ctx.fillRect(bx,12,1.5,1); }
    ctx.strokeStyle='rgba(100,100,100,0.25)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(-32,-13); ctx.lineTo(36,-13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-32,13); ctx.lineTo(36,13); ctx.stroke();
    ctx.lineWidth=1;
  }

  // Bow wave
  if(vessel.spd>0.3){
    const bwA=Math.min(vessel.spd/activeCableVessel.speed,1)*0.2;
    ctx.strokeStyle=`rgba(255,255,255,${bwA})`; ctx.lineWidth=1;
    const bowX=av.id==='ndurance'?46:52;
    ctx.beginPath();
    ctx.moveTo(bowX,-8); ctx.quadraticCurveTo(bowX+6,-3,bowX+10,0);
    ctx.quadraticCurveTo(bowX+6,3,bowX,8);
    ctx.stroke(); ctx.lineWidth=1;
  }

  // Cable exit from stern
  if(activeCable&&activeCable.trail.length>1){
    ctx.fillStyle='#444'; ctx.fillRect(-38,-1.5,8,3);
    ctx.fillStyle='#222'; ctx.fillRect(-38,-0.5,8,1);
  }
  // Name
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='3px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(av.name,8,8);
  ctx.restore();
}

/* ── Draw: Cable laying HUD ── */
function drawCableHUD(){
  ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,W,42);
  ctx.fillStyle='#444'; ctx.fillRect(0,42,W,1);
  drawSoundIndicator();
  ctx.font='10px "Press Start 2P"'; ctx.textBaseline='top';
  // Timer
  ctx.textAlign='left'; ctx.fillStyle='#AAA'; ctx.fillText('TIME',12,4);
  const m=(gameTime/60|0), s=(gameTime%60|0);
  ctx.fillStyle='#FFF'; ctx.fillText(m+':'+(''+s).padStart(2,'0'),12,22);
  // Phase
  ctx.textAlign='center'; ctx.fillStyle='#5DADEC'; ctx.fillText('CABLE LAYING',W/2,4);
  ctx.fillStyle='#AAA'; ctx.font='7px "Press Start 2P"';
  ctx.fillText(activeCableVessel.name,W/2,22);
  // Cables laid
  const doneCables=cableSegments.filter(s=>s.done).length;
  ctx.font='10px "Press Start 2P"';
  ctx.textAlign='right'; ctx.fillStyle='#AAA'; ctx.fillText('CABLES',W-12,4);
  ctx.fillStyle=doneCables===cableSegments.length?'#0F0':'#FFF';
  ctx.fillText(doneCables+'/'+cableSegments.length,W-12,22);
  // Cable loaded indicator
  ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillStyle=cableLoaded>0?'#0F0':'#F44';
  ctx.fillText(cableLoaded>0?'CABLE: '+cableLoaded+' LEFT':'NO CABLE',W/2,35);
  // Speed bar
  const curSpd=vessel.spd, maxSpd=activeCableVessel.speed;
  const smX=8, smY=H-60;
  ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(smX,smY,100,28);
  ctx.strokeStyle='#444'; ctx.strokeRect(smX,smY,100,28);
  ctx.fillStyle='#222'; ctx.fillRect(smX+4,smY+16,92,8);
  ctx.fillStyle='#0C0'; ctx.fillRect(smX+4,smY+16,92*Math.min(1,curSpd/maxSpd),8);
  ctx.strokeStyle='#555'; ctx.strokeRect(smX+4,smY+16,92,8);
  ctx.font='7px "Press Start 2P"'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle='#8F8'; ctx.fillText('SPEED',smX+4,smY+3);
  // Outside corridor warning
  if(activeCable&&cableOutsideTimer>0){
    const blink=(frame%10)<5;
    ctx.fillStyle=blink?'rgba(255,0,0,0.2)':'rgba(255,0,0,0.08)';
    ctx.fillRect(0,42,W,12);
    ctx.fillStyle='#F44'; ctx.font='10px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('OUTSIDE CORRIDOR!',W/2,44);
  }
  // Context hint
  if(contextHint){
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,H-26,W,26);
    ctx.fillStyle='#FF0'; ctx.font='8px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(contextHint,W/2,H-13);
  }
  // Center message
  if(msgTimer>0){
    const a=Math.min(1,msgTimer/20);
    ctx.globalAlpha=a;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(W/2-160,H/2-20,320,40);
    ctx.fillStyle='#FFF'; ctx.font='12px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(msg,W/2,H/2);
    ctx.globalAlpha=1;
  }
}

/* ── Draw: Cable nav arrow ── */
function drawCableNavArrow(){
  let target=null;
  if(activeCable){
    target=cableSegments[activeCable.segIdx].to;
  } else {
    let md=Infinity;
    for(const seg of cableSegments){
      if(seg.done) continue;
      const d1=dist(vessel,seg.from), d2=dist(vessel,seg.to);
      const mn=Math.min(d1,d2);
      if(mn<md){ md=mn; target=d1<d2?seg.from:seg.to; }
    }
  }
  if(!target) return;
  const tsx=target.x-cam.x, tsy=target.y-cam.y;
  if(tsx>50&&tsx<W-50&&tsy>55&&tsy<H-35) return;
  const ang=Math.atan2(target.y-vessel.y,target.x-vessel.x);
  let ax=W/2+Math.cos(ang)*Math.min(280,W/2-40);
  let ay=H/2+Math.sin(ang)*Math.min(180,H/2-40);
  ax=clamp(ax,30,W-30); ay=clamp(ay,55,H-30);
  ctx.save(); ctx.translate(ax,ay); ctx.rotate(ang);
  const pulse=0.6+Math.sin(frame*0.12)*0.4;
  ctx.globalAlpha=pulse;
  ctx.fillStyle=activeCable?'#FFD700':'#FFF';
  ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-7,-9); ctx.lineTo(-7,9); ctx.fill();
  ctx.globalAlpha=1;
  ctx.rotate(-ang);
  ctx.fillStyle='#FFF'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText((dist(vessel,target)|0)+'m',0,-16);
  ctx.restore();
}

/* ── Draw: Cable minimap ── */
function drawCableMinimap(){
  const mw=130, mh=50, mx=W-mw-8, my=H-mh-30;
  const sx2=WORLD_W/mw, sy2=WORLD_H/mh;
  ctx.fillStyle='rgba(0,0,30,0.75)'; ctx.fillRect(mx-1,my-1,mw+2,mh+2);
  ctx.fillStyle='#0D3B6E'; ctx.fillRect(mx,my,mw,mh);
  // Cable segments
  for(const seg of cableSegments){
    ctx.strokeStyle=seg.done?'#0A0':'rgba(255,200,0,0.3)'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(mx+seg.from.x/sx2,my+seg.from.y/sy2);
    ctx.lineTo(mx+seg.to.x/sx2,my+seg.to.y/sy2);
    ctx.stroke();
  }
  // Sites
  for(const s of sites){
    ctx.fillStyle=TYPES[s.type].col;
    ctx.fillRect(mx+s.x/sx2-1,my+s.y/sy2-1,2,2);
  }
  // UXOs
  for(const u of uxos){
    if(!u.hit){ ctx.fillStyle='#F44'; ctx.fillRect(mx+u.x/sx2-1,my+u.y/sy2-1,2,2); }
  }
  // Cable port
  ctx.fillStyle=cableLoaded>0?'#888':'#FF0';
  ctx.fillRect(mx+CABLE_PORT.x/sx2-2,my+CABLE_PORT.y/sy2-2,4,4);
  // Vessel
  ctx.fillStyle='#FFF'; ctx.fillRect(mx+vessel.x/sx2-2,my+vessel.y/sy2-1,4,3);
  ctx.strokeStyle='rgba(255,255,255,0.35)';
  ctx.strokeRect(mx+cam.x/sx2,my+cam.y/sy2,W/sx2,H/sy2);
  ctx.strokeStyle='#446'; ctx.strokeRect(mx-1,my-1,mw+2,mh+2);
}

/* ── Draw full cable laying scene ── */
/* ── Cable port on world map ── */
function drawCablePort(){
  const sx=CABLE_PORT.x-cam.x, sy=CABLE_PORT.y-cam.y;
  if(sx<-200||sx>W+200||sy<-200||sy>H+200) return;
  const time=Date.now();
  const pw=150, ph=90;
  const qx=sx-pw/2, qy=sy-ph/2;

  // Water edge / waves
  ctx.fillStyle='rgba(60,140,200,0.15)';
  ctx.beginPath(); ctx.ellipse(sx,sy+ph/2+5,pw/2+20,12,0,0,Math.PI*2); ctx.fill();
  for(let i=0;i<5;i++){
    const wx=qx-10+i*(pw+20)/4;
    const wy=sy+ph/2+2+Math.sin(time/500+i*1.5)*3;
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(wx,wy); ctx.quadraticCurveTo(wx+12,wy-3,wx+24,wy); ctx.stroke();
  }

  // Concrete quay
  ctx.fillStyle='#8A8A8A'; ctx.fillRect(qx,qy,pw,ph);
  ctx.fillStyle='#9A9A9A'; ctx.fillRect(qx,qy,pw,4);
  ctx.fillStyle='#6A6A6A'; ctx.fillRect(qx,qy+ph-3,pw,3);
  ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1;
  for(let i=1;i<3;i++){ ctx.beginPath(); ctx.moveTo(qx,qy+i*ph/3); ctx.lineTo(qx+pw,qy+i*ph/3); ctx.stroke(); }
  ctx.strokeStyle='#666'; ctx.strokeRect(qx,qy,pw,ph);

  // Wooden fenders
  ctx.fillStyle='#6B4226';
  ctx.fillRect(qx-6,qy+10,6,ph-20);
  ctx.fillRect(qx+pw,qy+10,6,ph-20);
  ctx.fillStyle='#444';
  for(let i=0;i<3;i++){
    ctx.fillRect(qx-5,qy+15+i*25,4,4);
    ctx.fillRect(qx+pw+1,qy+15+i*25,4,4);
  }

  // Bollards
  for(let i=0;i<2;i++){
    const bx=qx+18+i*(pw-36);
    ctx.fillStyle='#333'; ctx.fillRect(bx-3,qy-6,6,8);
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(bx,qy-6,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(bx,qy-6,2,0,Math.PI*2); ctx.fill();
  }

  // Main carousel turntable
  const cAng=time/2000;
  ctx.fillStyle='#666'; ctx.beginPath(); ctx.arc(sx+15,sy,26,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(sx+15,sy,20,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(sx+15,sy,13,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#777'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(sx+15,sy,23,0,Math.PI*2); ctx.stroke();
  // Carousel spokes
  ctx.strokeStyle='#888'; ctx.lineWidth=2;
  for(let i=0;i<6;i++){
    const a=cAng+i*Math.PI/3;
    ctx.beginPath(); ctx.moveTo(sx+15,sy);
    ctx.lineTo(sx+15+Math.cos(a)*20,sy+Math.sin(a)*20); ctx.stroke();
  }
  ctx.lineWidth=1;
  // Center hub
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(sx+15,sy,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(sx+15,sy,3,0,Math.PI*2); ctx.fill();

  // Cable coils on dock (with wrapping detail)
  for(let ci=0;ci<2;ci++){
    const cx2=sx-40, cy2=sy-14+ci*28;
    ctx.fillStyle='#2A2A2A'; ctx.beginPath(); ctx.arc(cx2,cy2,11,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#3A3A3A'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx2,cy2,8,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx2,cy2,5,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(cx2,cy2,3,0,Math.PI*2); ctx.fill();
    ctx.lineWidth=1;
  }

  // Cable reel guide structure
  ctx.fillStyle='#777'; ctx.fillRect(sx-8,qy+12,6,ph-24);
  ctx.fillStyle='#888'; ctx.fillRect(sx-10,qy+10,10,4);
  ctx.fillStyle='#888'; ctx.fillRect(sx-10,qy+ph-16,10,4);

  // Safety striping along edge
  for(let i=0;i<pw;i+=8){
    ctx.fillStyle=(i/8|0)%2===0?'#E8C800':'#222';
    ctx.fillRect(qx+i,qy+ph-6,Math.min(8,pw-i),3);
  }

  // Sign board
  const sw=110, sh=26;
  const signX=sx-sw/2, signY=qy-sh-12;
  ctx.fillStyle='#666'; ctx.fillRect(signX+10,signY+sh,3,12);
  ctx.fillStyle='#666'; ctx.fillRect(signX+sw-13,signY+sh,3,12);
  ctx.fillStyle='#1A3A5C'; ctx.fillRect(signX,signY,sw,sh);
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.fillRect(signX+2,signY+2,sw-4,sh/2-2);
  ctx.strokeStyle='#FFF'; ctx.lineWidth=2;
  ctx.strokeRect(signX+3,signY+3,sw-6,sh-6);
  ctx.lineWidth=1;
  ctx.strokeStyle='#0D2440'; ctx.strokeRect(signX,signY,sw,sh);
  ctx.fillStyle='#FFF'; ctx.font='7px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('CABLE PORT',sx,signY+sh/2);
  // Blinking light
  const blink=Math.sin(time/400)>0;
  ctx.fillStyle=blink?'#0F0':'#040';
  ctx.beginPath(); ctx.arc(signX+sw-10,signY+5,2,0,Math.PI*2); ctx.fill();

  // Interaction ring when close
  if(state==='CABLE_LAYING' && cableLoaded<=0 && cableLoadCount<CABLE_MAX_LOADS && dist(vessel,CABLE_PORT)<120){
    const pulse=0.4+Math.sin(time/200)*0.3;
    ctx.strokeStyle=`rgba(255,255,0,${pulse})`;
    ctx.lineWidth=2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(sx,sy,80,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth=1;
  }
}

function drawCableScene(){
  const time=Date.now();
  drawWater(time); drawClouds(time);

  // Apply zoom for world-space drawing
  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.scale(cableZoom, cableZoom);
  ctx.translate(-W/2, -H/2);

  drawCablePort();
  for(let i=0;i<cableSegments.length;i++) drawCableCorridor(cableSegments[i],i);
  for(const seg of cableSegments){ if(seg.done) drawCompletedCable(seg); }
  for(const s of sites) drawSite(s);
  for(const u of uxos) drawUXO(u);
  if(activeCable) drawCableTrail(activeCable);
  drawParticles();
  drawExplosions();
  drawCableVessel();
  drawFloats();

  ctx.restore(); // back to 1:1 for HUD
  drawCableHUD();
  drawCableNavArrow();
  drawCableMinimap();
}

/* ── Cable vessel selection screen ── */
function drawCableSelectScreen(){
  const time=Date.now();
  cam.x=0; cam.y=200;
  drawWater(time); drawClouds(time);
  ctx.fillStyle='rgba(0,0,40,0.65)'; ctx.fillRect(0,0,W,H);

  // Phase banner
  if(gameMode==='both'){
    ctx.fillStyle='#0F0'; ctx.font='10px "Press Start 2P"';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('PHASE 1 COMPLETE!',W/2,25);
    const mt=(monopileTime/60|0), ms=(monopileTime%60|0);
    ctx.fillStyle='#AAA'; ctx.font='7px "Press Start 2P"';
    ctx.fillText('MONOPILE TIME: '+mt+':'+(''+ms).padStart(2,'0'),W/2,42);
    ctx.fillStyle='#5DADEC'; ctx.font='14px "Press Start 2P"';
    ctx.fillText('PHASE 2: CABLE LAYING',W/2,70);
  } else {
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#5DADEC'; ctx.font='14px "Press Start 2P"';
    ctx.fillText('CABLE LAYING',W/2,40);
  }
  ctx.fillStyle='#AAA'; ctx.font='7px "Press Start 2P"';
  ctx.fillText('SELECT YOUR CABLE VESSEL',W/2,90);

  // Two vessel cards
  const cardW=300, cardH=260, gap=20;
  const totalCW=2*cardW+gap;
  const startCX=W/2-totalCW/2+cardW/2;

  for(let i=0;i<2;i++){
    const v=CABLE_VESSELS[i];
    const cx=startCX+i*(cardW+gap);
    const topY=105;
    const sel=(i===selectedCableVessel);
    ctx.fillStyle=sel?'rgba(40,40,80,0.9)':'rgba(10,10,30,0.8)';
    ctx.fillRect(cx-cardW/2,topY,cardW,cardH);
    ctx.strokeStyle=sel?'#FFD700':'#334'; ctx.lineWidth=sel?3:1;
    ctx.strokeRect(cx-cardW/2,topY,cardW,cardH); ctx.lineWidth=1;
    if(sel){
      const pulse=0.7+Math.sin(time/200)*0.3;
      ctx.fillStyle=`rgba(255,215,0,${pulse*0.08})`;
      ctx.fillRect(cx-cardW/2+2,topY+2,cardW-4,cardH-4);
      ctx.fillStyle='#FFD700';
      ctx.beginPath(); ctx.moveTo(cx,topY-8); ctx.lineTo(cx-8,topY); ctx.lineTo(cx+8,topY); ctx.fill();
    }

    // Draw cable vessel silhouette
    ctx.save(); ctx.translate(cx,topY+55);
    const sc=sel?1.0:0.7; ctx.scale(sc,sc);
    if(sel){ ctx.shadowColor='#FFD700'; ctx.shadowBlur=15; }
    if(v.id==='ndurance'){
      ctx.fillStyle=v.hull; ctx.fillRect(-50,-6,100,16);
      ctx.beginPath(); ctx.moveTo(50,-4); ctx.lineTo(58,0); ctx.lineTo(58,6); ctx.lineTo(50,10); ctx.fill();
      ctx.fillStyle=v.antifoul; ctx.fillRect(-50,6,108,4);
      ctx.fillStyle=v.hullDk; ctx.fillRect(-50,-6,108,2);
      ctx.fillStyle=v.deck; ctx.fillRect(-45,-10,95,6);
      ctx.fillStyle=v.bridge; ctx.fillRect(20,-28,22,18);
      ctx.fillStyle='#5DADEC'; ctx.fillRect(22,-24,6,8); ctx.fillRect(30,-24,6,8);
      ctx.fillStyle='#555'; ctx.fillRect(24,-34,8,8); ctx.fillStyle='#FF6600'; ctx.fillRect(24,-30,8,3);
      // Cable carousel
      ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(-10,-6,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(-10,-6,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(-10,-6,4,0,Math.PI*2); ctx.fill();
      // A-frame
      ctx.fillStyle='#888'; ctx.fillRect(-48,-12,6,3);
      ctx.fillRect(-50,-18,2,10); ctx.fillRect(-44,-18,2,10);
      ctx.fillRect(-50,-18,8,2);
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='4px sans-serif'; ctx.textAlign='center';
      ctx.fillText('NDURANCE',10,2);
    } else {
      ctx.fillStyle=v.hull; ctx.fillRect(-55,-6,110,18);
      ctx.beginPath(); ctx.moveTo(55,-4); ctx.lineTo(66,-1); ctx.lineTo(66,8); ctx.lineTo(55,12); ctx.fill();
      ctx.fillStyle=v.antifoul; ctx.fillRect(-55,8,121,4);
      ctx.fillStyle=v.hullDk; ctx.fillRect(-55,-6,121,2);
      ctx.fillStyle=v.deck; ctx.fillRect(-50,-10,105,6);
      ctx.fillStyle=v.bridge; ctx.fillRect(24,-32,24,22);
      ctx.fillStyle='#5DADEC'; ctx.fillRect(26,-28,6,8); ctx.fillRect(34,-28,6,8);
      ctx.fillStyle='#555'; ctx.fillRect(28,-38,10,8); ctx.fillStyle='#FF6600'; ctx.fillRect(28,-34,10,3);
      // Large cable carousel
      ctx.fillStyle='#444'; ctx.beginPath(); ctx.arc(-8,-6,13,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(-8,-6,9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(-8,-6,5,0,Math.PI*2); ctx.fill();
      // ROV bay
      ctx.fillStyle='#8899AA'; ctx.fillRect(5,-10,10,6);
      // A-frame
      ctx.fillStyle='#888'; ctx.fillRect(-53,-14,6,4);
      ctx.fillRect(-55,-22,2,12); ctx.fillRect(-49,-22,2,12);
      ctx.fillRect(-55,-22,8,2);
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='4px sans-serif'; ctx.textAlign='center';
      ctx.fillText('BOKA OCEAN',10,3);
    }
    ctx.shadowBlur=0; ctx.restore();

    // Name
    ctx.fillStyle=sel?'#FFD700':'#AAA'; ctx.font='10px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(v.name,cx,topY+110);
    ctx.fillStyle='#FF6600'; ctx.font='7px "Press Start 2P"';
    ctx.fillText(v.company,cx,topY+128);

    // Stats
    const statsY=topY+148, lx=cx-cardW/2+14, rw=cardW-28;
    drawStatBar(lx,statsY,rw,'SPEED',v.speed,4.0,sel?'#0C0':'#060',sel);
    drawStatBar(lx,statsY+28,rw,'CORRIDOR WIDTH',v.corridorWidth,80,sel?'#5DADEC':'#2A5A7A',sel);
    ctx.fillStyle=sel?'#FFF':'#777'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(v.desc,cx,statsY+60);
    ctx.fillStyle=sel?'#AAA':'#555'; ctx.fillText(v.detail,cx,statsY+74);
  }

  // UXO warning
  ctx.fillStyle='#FF4400'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
  ctx.fillText('WARNING: UXO (UNEXPLODED ORDNANCE) ON SEABED!',W/2,400);
  ctx.fillStyle='#AAA'; ctx.font='6px "Press Start 2P"';
  ctx.fillText('WWII MUNITIONS - AVOID OR SUFFER TIME PENALTY',W/2,416);

  // Controls
  if((time/500|0)%2){
    ctx.fillStyle='#FFF'; ctx.font='10px "Press Start 2P"';
    ctx.fillText(isTouchDevice?'TAP TO SELECT':'SPACE = SELECT',W/2,445);
  }
  ctx.fillStyle='#888'; ctx.font='7px "Press Start 2P"';
  ctx.fillText(isTouchDevice?'TAP LEFT/RIGHT':'\u25C4  ARROWS  \u25BA',W/2,467);
}

// ═════════════════════  RENDER  ═════════════════════
function render(){
  ctx.save();
  let sx=0, sy=0;
  if(screenShake>0){
    const intensity=screenShake/60*12;
    sx=(Math.random()-0.5)*intensity*2;
    sy=(Math.random()-0.5)*intensity*2;
    screenShake--;
  }
  ctx.setTransform(RES_SCALE,0,0,RES_SCALE,sx,sy);
  ctx.clearRect(-20,-20,W+40,H+40);
  renderInner();
  ctx.restore();
}
function renderInner(){

  if(state==='TITLE'){
    drawTitle();
    return;
  }
  if(state==='PHASE_SELECT'){
    drawPhaseSelect();
    return;
  }
  if(state==='SELECT'){
    drawSelectScreen();
    return;
  }
  if(state==='CABLE_SELECT'){
    drawCableSelectScreen();
    return;
  }
  if(state==='CABLE_LAYING'){
    drawCableScene();
    return;
  }
  if(state==='CABLE_LOADING'){
    drawCableLoading();
    return;
  }
  if(state==='WIN'){
    drawWinScreen();
    return;
  }

  // ── PLAYING ──
  const time=Date.now();
  drawWater(time);
  drawClouds(time);
  drawField();

  // Draw distance labels between ports and field
  ctx.font='7px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,0.2)';
  for(const p of PORTS){
    const d3=((FX+FCOLS*FDX/2)-p.x)|0;
    const midx=(p.x+(FX+FCOLS*FDX/2))/2 - cam.x;
    const midy=p.y-cam.y-40;
    ctx.fillText(d3+'m', midx, midy);
  }

  // Sites
  for(const s of sites) drawSite(s);
  // Ports
  for(const p of PORTS) drawPort(p);
  // Particles
  drawParticles();
  // Vessel
  drawVessel();
  // Animations
  drawLoadAnims();
  drawInstallAnims();
  drawSplashAnims();
  // Storm overlay
  drawStormOverlay();
  // Floats
  drawFloats();
  // Side-view cutscene overlay
  drawSideView();
  // HUD
  drawHUD();
  drawNavArrow();
  drawMinimap();
}

// ═════════════════════  LOOP  ═════════════════════
let lastT=performance.now();
function loop(){
  const now=performance.now();
  const dt=Math.min((now-lastT)/1000, 0.05);
  lastT=now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ═════════════════════  RESIZE  ═════════════════════
function resize(){
  const maxW=window.innerWidth, maxH=window.innerHeight;
  const scale=Math.min(maxW/W, maxH/H);
  canvas.style.width  = (W*scale)+'px';
  canvas.style.height = (H*scale)+'px';
}
window.addEventListener('resize', resize);
resize();

// ═════════════════════  START  ═════════════════════
// Start immediately; don't block on font loading (may fail on file://)
const fontTimeout = setTimeout(()=>{ requestAnimationFrame(loop); }, 300);
document.fonts.ready.then(()=>{ clearTimeout(fontTimeout); requestAnimationFrame(loop); }).catch(()=>{});
