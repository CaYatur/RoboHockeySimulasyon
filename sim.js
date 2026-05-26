/* ============================================================================
   ROBOHOKEY SİMÜLASYON — DualSense ile 2v2 antrenman (DİKEY saha)
   ----------------------------------------------------------------------------
   - Saha dikey: 160 cm geniş (x), 240 cm uzun (y). Kaleler ÜSTTE ve ALTTA.
   - Kontroller .ino ile aynı: R2 gaz, L2 geri/fren, sol çubuk direksiyon,
     ○ turbo, D-pad ↑/↓ hız limiti, OPTIONS başlat/duraklat.
   - 1 oyuncu (Mavi #1, ALT kaleyi savunur), 3 bot.
   - Disk iki robot arasında sıkışırsa yana fırlar (kilitlenmeyi önler).
   ============================================================================ */

// ---------------------------------------------------------------- ÖLÇÜLER (cm)
const FIELD_W = 160;          // genişlik (x) — kısa kenar
const FIELD_H = 240;          // uzunluk (y) — uzun kenar
const GOAL_W  = 40;           // kale genişliği
const GOAL_X0 = (FIELD_W - GOAL_W) / 2;   // 60
const GOAL_X1 = GOAL_X0 + GOAL_W;         // 100
const PUCK_R  = 5.5;          // disk yarıçapı (çap 110 mm)
const ROB_SIDE = 20;          // robot kenarı 20x20 cm
const ROB_R   = 12;           // çarpışma yarıçapı

// ---------------------------------------------------------------- FİZİK
const MAX_SPEED   = 130;      // cm/s
const BOOST_SPEED = 210;      // turbo cm/s
const MAX_OMEGA   = 4.6;      // rad/s
const ACCEL       = 380;      // cm/s^2
const BOT_FACTOR  = 0.9;      // botlar biraz daha yavaş
const WALL_E      = 0.65;     // duvar yaylanması
const PUSH_E      = 0.35;     // robot-disk yaylanması
const PUCK_FRICTION = 0.62;   // saniyede kalan hız oranı
const SQUEEZE_KICK  = 70;     // sıkışan disk kaçış hızı (cm/s)

// ---------------------------------------------------------------- ÇİZİM
const PX = 3;                 // px / cm
const OFF = 20;               // duvar payı (px)

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
const X = (cm) => OFF + cm * PX;
const Y = (cm) => OFF + cm * PX;

// ---------------------------------------------------------------- DURUM
let speedLimit = 0.75;
const LIMIT_MIN = 0.45, LIMIT_MAX = 1.0, LIMIT_STEP = 0.07;

const world = {
  puck: { x: FIELD_W / 2, y: FIELD_H / 2, vx: 0, vy: 0 },
  scoreA: 0,
  scoreB: 0,
  time: 120,
  half: 1,
  state: "ready",
  countdown: 0,
  msg: "Başlamak için ▶ Başlat / OPTIONS",
  stuckTimer: 0,
};

// Kale y-konumları. Mavi (A) ALT kaleyi (y=FIELD_H) savunur, üste atar.
const goalOf = {
  A: { defend: FIELD_H, attack: 0 },
  B: { defend: 0,       attack: FIELD_H },
};

function makeRobot(team, num, isPlayer, x, y, h) {
  return {
    team, num, isPlayer,
    x, y, heading: h,
    v: 0, omega: 0, targetV: 0, targetOmega: 0,
    actualSpeed: 0, stuckT: 0, recoverT: 0, recoverDir: 1,
    color: team === "A" ? "#2e7dff" : "#ff3b46",
  };
}

let robots = [];

// Kendi kalesinden merkeze doğru `dist` cm ileri nokta
function frontOf(defendY, dist) {
  return defendY === 0 ? defendY + dist : defendY - dist;
}

function resetFormation() {
  const aDef = goalOf.A.defend, bDef = goalOf.B.defend;
  const faceA = goalOf.A.attack === 0 ? -Math.PI / 2 : Math.PI / 2;
  const faceB = goalOf.B.attack === 0 ? -Math.PI / 2 : Math.PI / 2;

  robots = [
    makeRobot("A", 1, true,  60,  frontOf(aDef, 45), faceA),   // OYUNCU
    makeRobot("A", 2, false, 100, frontOf(aDef, 72), faceA),   // mavi bot
    makeRobot("B", 1, false, 100, frontOf(bDef, 45), faceB),
    makeRobot("B", 2, false, 60,  frontOf(bDef, 72), faceB),
  ];
  world.puck.x = FIELD_W / 2;
  world.puck.y = FIELD_H / 2;
  world.puck.vx = 0;
  world.puck.vy = 0;
  world.stuckTimer = 0;
}
resetFormation();

// ---------------------------------------------------------------- GİRİŞ
const keys = {};
addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " ") { e.preventDefault(); toggleStart(); }
  if (e.key === "[") setLimit(speedLimit - LIMIT_STEP);
  if (e.key === "]") setLimit(speedLimit + LIMIT_STEP);
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

let padIndex = null;
addEventListener("gamepadconnected", (e) => {
  padIndex = e.gamepad.index;
  document.getElementById("padName").textContent = e.gamepad.id.slice(0, 40);
});
addEventListener("gamepaddisconnected", () => {
  padIndex = null;
  document.getElementById("padName").textContent = "bağlı değil — bir tuşa bas";
});

let prevOptions = false, prevDpadUp = false, prevDpadDown = false;

function readPlayerInput() {
  let throttle = 0, brake = 0, steer = 0, boost = false;

  const gp = padIndex != null ? navigator.getGamepads()[padIndex] : null;
  if (gp) {
    throttle = gp.buttons[7] ? gp.buttons[7].value : 0;   // R2
    brake    = gp.buttons[6] ? gp.buttons[6].value : 0;   // L2
    steer    = gp.axes[0] || 0;                            // sol çubuk X
    boost    = gp.buttons[1] && gp.buttons[1].pressed;     // ○

    const opt = gp.buttons[9] && gp.buttons[9].pressed;    // OPTIONS
    if (opt && !prevOptions) toggleStart();
    prevOptions = opt;

    const du = gp.buttons[12] && gp.buttons[12].pressed;   // D-pad ↑
    const dd = gp.buttons[13] && gp.buttons[13].pressed;   // D-pad ↓
    if (du && !prevDpadUp) setLimit(speedLimit + LIMIT_STEP);
    if (dd && !prevDpadDown) setLimit(speedLimit - LIMIT_STEP);
    prevDpadUp = du; prevDpadDown = dd;
  }

  if (keys["arrowup"] || keys["w"]) throttle = 1;
  if (keys["arrowdown"] || keys["s"]) brake = 1;
  if (keys["arrowleft"] || keys["a"]) steer = -1;
  if (keys["arrowright"] || keys["d"]) steer = 1;
  if (keys["shift"]) boost = true;

  if (Math.abs(steer) < 0.12) steer = 0;
  if (throttle < 0.06) throttle = 0;
  if (brake < 0.06) brake = 0;

  return { throttle, brake, steer, boost };
}

function setLimit(v) {
  speedLimit = Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, v));
  document.getElementById("limitVal").textContent = Math.round(speedLimit * 100) + "%";
}

// ---------------------------------------------------------------- KONTROL → HEDEF
function applyPlayerControl(rob, inp) {
  const net = inp.throttle - inp.brake;
  const cap = inp.boost ? BOOST_SPEED : MAX_SPEED * speedLimit;
  rob.targetV = net * cap;
  rob.targetOmega = inp.steer * MAX_OMEGA;
}

// ---------------------------------------------------------------- BOT AI
function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function driveTo(rob, tx, ty, speedScale = 1) {
  // hedefi duvardan uzak tut (köşeye saplanmayı azaltır)
  tx = Math.max(ROB_R + 4, Math.min(FIELD_W - ROB_R - 4, tx));
  ty = Math.max(ROB_R + 4, Math.min(FIELD_H - ROB_R - 4, ty));

  const dx = tx - rob.x, dy = ty - rob.y;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const diff = wrapAngle(ang - rob.heading);

  // hedefe çok yakınsa salınmayı kes
  if (dist < 8) { rob.targetOmega = 0; rob.targetV = 0; return; }

  const adiff = Math.abs(diff) < 0.12 ? 0 : diff;     // açı ölü bölgesi
  rob.targetOmega = Math.max(-MAX_OMEGA, Math.min(MAX_OMEGA, adiff * 3.5));
  const align = Math.max(0, Math.cos(diff));
  let v = MAX_SPEED * BOT_FACTOR * speedScale * (0.3 + 0.7 * align);
  if (dist < 16) v *= dist / 16;
  rob.targetV = v;
}

// Botu sür: önce takılma kurtarma, sonra normal düşün
function botUpdate(rob, dt) {
  if (rob.recoverT > 0) {
    rob.recoverT -= dt;
    rob.targetV = -MAX_SPEED * BOT_FACTOR * 0.7;       // geri çekil
    rob.targetOmega = rob.recoverDir * MAX_OMEGA * 0.8; // dönerek kurtul
    return;
  }
  botThink(rob);
  // gerçekten ilerleyemiyorsa (duvar/robot engeli) takıldı say
  if (Math.abs(rob.targetV) > 40 && rob.actualSpeed < 14) rob.stuckT += dt;
  else rob.stuckT = 0;
  if (rob.stuckT > 0.55) {
    rob.recoverT = 0.7;
    rob.recoverDir = Math.random() < 0.5 ? -1 : 1;
    rob.stuckT = 0;
  }
}

function botThink(rob) {
  const p = world.puck;
  const g = goalOf[rob.team];
  const mate = robots.find((r) => r !== rob && r.team === rob.team);

  const myDist = Math.hypot(p.x - rob.x, p.y - rob.y);
  const mateDist = mate ? Math.hypot(p.x - mate.x, p.y - mate.y) : Infinity;
  const amAttacker = myDist <= mateDist;

  const gx = FIELD_W / 2, gy = g.attack;

  if (amAttacker) {
    // Diskin arkasına geç (kale yönünde itecek şekilde)
    let dirx = gx - p.x, diry = gy - p.y;
    const dl = Math.hypot(dirx, diry) || 1;
    dirx /= dl; diry /= dl;
    const behindX = p.x - dirx * (ROB_R + PUCK_R + 6);
    const behindY = p.y - diry * (ROB_R + PUCK_R + 6);

    const toPuck = Math.atan2(p.y - rob.y, p.x - rob.x);
    const pushAlign = Math.cos(wrapAngle(toPuck - Math.atan2(diry, dirx)));
    if (pushAlign > 0.4 && myDist < 35) {
      driveTo(rob, gx, gy, 1.0);                 // hücum: kaleye sür
    } else {
      driveTo(rob, behindX, behindY, 1.0);       // konumlan
    }
  } else {
    // Savunma: kendi kalesi ile disk arasında dur
    const dx = FIELD_W / 2, dy = g.defend;
    const tx = dx + (p.x - dx) * 0.32;
    const ty = dy + (p.y - dy) * 0.55;
    driveTo(rob, tx, ty, 0.92);
  }
}

// ---------------------------------------------------------------- FİZİK
function integrateRobot(rob, dt) {
  const px = rob.x, py = rob.y;
  const dv = rob.targetV - rob.v;
  rob.v += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, dv));
  rob.omega = rob.targetOmega;
  rob.heading += rob.omega * dt;
  rob.x += rob.v * Math.cos(rob.heading) * dt;
  rob.y += rob.v * Math.sin(rob.heading) * dt;

  rob.x = Math.max(ROB_R, Math.min(FIELD_W - ROB_R, rob.x));
  rob.y = Math.max(ROB_R, Math.min(FIELD_H - ROB_R, rob.y));

  // gerçek (engellere takılınca düşen) hız — takılma tespiti için
  rob.actualSpeed = Math.hypot(rob.x - px, rob.y - py) / (dt || 1e-3);
}

function collideRobots() {
  for (let i = 0; i < robots.length; i++) {
    for (let j = i + 1; j < robots.length; j++) {
      const a = robots[i], b = robots[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = ROB_R * 2;
      if (d < min && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        const overlap = (min - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        a.v *= 0.85; b.v *= 0.85;
      }
    }
  }
}

// Tüm robot-disk temaslarını çöz; sıkışma varsa diski yana fırlat.
function resolvePuckContacts() {
  const p = world.puck;
  const contacts = [];
  for (const rob of robots) {
    const dx = p.x - rob.x, dy = p.y - rob.y;
    const d = Math.hypot(dx, dy);
    const min = ROB_R + PUCK_R;
    if (d < min && d > 0.001) {
      const nx = dx / d, ny = dy / d;
      p.x += nx * (min - d);
      p.y += ny * (min - d);
      const rvx = rob.v * Math.cos(rob.heading);
      const rvy = rob.v * Math.sin(rob.heading);
      const relN = (p.vx - rvx) * nx + (p.vy - rvy) * ny;
      if (relN < 0) {
        const jimp = -(1 + PUSH_E) * relN;
        p.vx += jimp * nx; p.vy += jimp * ny;
      }
      const push = Math.max(0, rvx * nx + rvy * ny);
      p.vx += push * nx * 0.6; p.vy += push * ny * 0.6;
      contacts.push({ nx, ny });
    }
  }

  // Duvarları da "temas" say: robot diski duvara/köşeye sıkıştırınca da kaçsın
  const mouth = (p.x > GOAL_X0 && p.x < GOAL_X1);
  if (p.x <= PUCK_R + 1.5) contacts.push({ nx: 1, ny: 0, wall: true });
  if (p.x >= FIELD_W - PUCK_R - 1.5) contacts.push({ nx: -1, ny: 0, wall: true });
  if (p.y <= PUCK_R + 1.5 && !mouth) contacts.push({ nx: 0, ny: 1, wall: true });
  if (p.y >= FIELD_H - PUCK_R - 1.5 && !mouth) contacts.push({ nx: 0, ny: -1, wall: true });

  // En az bir robot + (başka robot veya duvar) zıt yönden bastırıyorsa → yana kaçır
  const hasRobot = contacts.some((c) => !c.wall);
  if (contacts.length >= 2 && hasRobot) {
    let sx = 0, sy = 0;
    for (const c of contacts) { sx += c.nx; sy += c.ny; }
    if (Math.hypot(sx, sy) < 1.2) {        // normaller birbirini büyük ölçüde götürüyor
      const r0 = contacts.find((c) => !c.wall);   // robot temasının tanjantı boyunca kaç
      let tx = -r0.ny, ty = r0.nx;
      const cx = FIELD_W / 2 - p.x, cy = FIELD_H / 2 - p.y;
      if (tx * cx + ty * cy < 0) { tx = -tx; ty = -ty; }
      p.vx += tx * SQUEEZE_KICK;
      p.vy += ty * SQUEEZE_KICK;
    }
  }
}

function integratePuck(dt) {
  const p = world.puck;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const f = Math.pow(PUCK_FRICTION, dt);
  p.vx *= f; p.vy *= f;

  // sol/sağ duvar (her zaman katı)
  if (p.x < PUCK_R) { p.x = PUCK_R; p.vx = -p.vx * WALL_E; }
  if (p.x > FIELD_W - PUCK_R) { p.x = FIELD_W - PUCK_R; p.vx = -p.vx * WALL_E; }

  // üst/alt: kale ağzı değilse duvar
  const inMouth = (p.x > GOAL_X0 && p.x < GOAL_X1);
  if (p.y < PUCK_R && !inMouth) { p.y = PUCK_R; p.vy = -p.vy * WALL_E; }
  if (p.y > FIELD_H - PUCK_R && !inMouth) { p.y = FIELD_H - PUCK_R; p.vy = -p.vy * WALL_E; }

  // GOL
  if (inMouth) {
    if (p.y < 0) onGoalLine(0);
    else if (p.y > FIELD_H) onGoalLine(FIELD_H);
  }

  // hareketsizlik (10 sn) → orta saha
  const speed = Math.hypot(p.vx, p.vy);
  if (world.state === "play") {
    if (speed < 4) world.stuckTimer += dt; else world.stuckTimer = 0;
    if (world.stuckTimer > 10) {
      world.stuckTimer = 0;
      startKickoff("Disk 10 sn hareketsiz — orta saha");
    }
  }
}

// Bir kaleye girildi: o kaleyi savunan takım gol yer
function onGoalLine(side) {
  const conceder = (goalOf.A.defend === side) ? "A" : "B";
  onGoal(conceder === "A" ? "B" : "A");
}

function onGoal(team) {
  if (team === "A") world.scoreA++; else world.scoreB++;
  document.getElementById("scoreA").textContent = world.scoreA;
  document.getElementById("scoreB").textContent = world.scoreB;
  startKickoff((team === "A" ? "MAVİ" : "KIRMIZI") + " GOL!");
}

function startKickoff(msg) {
  resetFormation();
  world.state = "kickoff";
  world.countdown = 1.6;
  world.msg = msg || "Hazır ol…";
}

// ---------------------------------------------------------------- OYUN AKIŞI
function toggleStart() {
  if (world.state === "ready" || world.state === "end") {
    if (world.state === "end") {
      world.scoreA = 0; world.scoreB = 0; world.half = 1; world.time = 120;
      document.getElementById("scoreA").textContent = 0;
      document.getElementById("scoreB").textContent = 0;
    }
    startKickoff("Başlıyor…");
  } else if (world.state === "pause") {
    world.state = "play";
  } else {
    world.state = "pause";
    world.msg = "Duraklatıldı";
  }
}

document.getElementById("startBtn").onclick = toggleStart;
document.getElementById("pauseBtn").onclick = () => {
  if (world.state === "play") { world.state = "pause"; world.msg = "Duraklatıldı"; }
  else if (world.state === "pause") world.state = "play";
};
document.getElementById("resetBtn").onclick = () => {
  world.scoreA = 0; world.scoreB = 0; world.half = 1; world.time = 120;
  world.state = "ready"; world.msg = "Başlamak için ▶ Başlat / OPTIONS";
  document.getElementById("scoreA").textContent = 0;
  document.getElementById("scoreB").textContent = 0;
  resetFormation();
};

function fmtClock(t) {
  t = Math.max(0, Math.ceil(t));
  const m = Math.floor(t / 60), s = t % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function tickClock(dt) {
  if (world.state !== "play") return;
  world.time -= dt;
  if (world.time <= 0) {
    world.time = 0;
    if (world.half === 1) {
      world.half = 2;
      world.time = 120;
      // kale değişimi
      [goalOf.A.attack, goalOf.B.attack] = [goalOf.B.attack, goalOf.A.attack];
      [goalOf.A.defend, goalOf.B.defend] = [goalOf.B.defend, goalOf.A.defend];
      startKickoff("Devre arası — 2. devre");
    } else {
      world.state = "end";
      let m = "Maç bitti — ";
      if (world.scoreA > world.scoreB) m += "MAVİ kazandı!";
      else if (world.scoreB > world.scoreA) m += "KIRMIZI kazandı!";
      else m += "Berabere!";
      world.msg = m + "  (Başlat = yeni maç)";
    }
  }
}

// ---------------------------------------------------------------- ANA DÖNGÜ
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (world.state === "kickoff") {
    world.countdown -= dt;
    if (world.countdown <= 0) { world.state = "play"; world.msg = ""; }
  }
  const playing = (world.state === "play");
  const inp = readPlayerInput();

  for (const rob of robots) {
    if (playing) {
      if (rob.isPlayer) applyPlayerControl(rob, inp);
      else botUpdate(rob, dt);
    } else {
      rob.targetV = 0; rob.targetOmega = 0; rob.v *= 0.8;
    }
    integrateRobot(rob, dt);
  }

  collideRobots();
  resolvePuckContacts();
  if (playing) integratePuck(dt);

  tickClock(dt);

  document.getElementById("clock").textContent = fmtClock(world.time);
  document.getElementById("period").textContent = world.half + ". DEVRE";
  let st = world.msg;
  if (world.state === "kickoff") st = world.msg + "  " + Math.ceil(world.countdown);
  document.getElementById("state").textContent = st;
}

// ---------------------------------------------------------------- ÇİZİM
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // duvar (MDF kenar)
  ctx.fillStyle = "#3a2f25";
  ctx.fillRect(X(0) - OFF + 6, Y(0) - OFF + 6, FIELD_W * PX + (OFF - 6) * 2, FIELD_H * PX + (OFF - 6) * 2);

  // zemin
  ctx.fillStyle = "#cfd8e3";
  ctx.fillRect(X(0), Y(0), FIELD_W * PX, FIELD_H * PX);

  // çizgiler
  ctx.strokeStyle = "#7d8896";
  ctx.lineWidth = 2;
  // orta çizgi (yatay)
  ctx.beginPath();
  ctx.moveTo(X(0), Y(FIELD_H / 2));
  ctx.lineTo(X(FIELD_W), Y(FIELD_H / 2));
  ctx.stroke();
  // orta daire
  ctx.beginPath();
  ctx.arc(X(FIELD_W / 2), Y(FIELD_H / 2), 25 * PX, 0, Math.PI * 2);
  ctx.stroke();
  // ceza sahaları (üst/alt)
  ctx.strokeRect(X(GOAL_X0 - 15), Y(0), (GOAL_W + 30) * PX, 35 * PX);
  ctx.strokeRect(X(GOAL_X0 - 15), Y(FIELD_H - 35), (GOAL_W + 30) * PX, 35 * PX);

  // kaleler (üst=B savunur kırmızı / alt=A savunur mavi, devre 1)
  drawGoal(0, goalOf.A.defend === 0 ? "#2e7dff" : "#ff3b46");
  drawGoal(FIELD_H, goalOf.A.defend === FIELD_H ? "#2e7dff" : "#ff3b46");

  // disk
  const p = world.puck;
  ctx.beginPath();
  ctx.arc(X(p.x), Y(p.y), PUCK_R * PX, 0, Math.PI * 2);
  ctx.fillStyle = "#11161d";
  ctx.fill();
  ctx.strokeStyle = "#f2c14e";
  ctx.lineWidth = 2;
  ctx.stroke();

  for (const rob of robots) drawRobot(rob);
}

// y = 0 (üst) veya FIELD_H (alt) kale çizgisi
function drawGoal(y, color) {
  const top = (y === 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(X(GOAL_X0), Y(y));
  ctx.lineTo(X(GOAL_X1), Y(y));
  ctx.stroke();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = color;
  const depth = 12;
  ctx.fillRect(X(GOAL_X0), Y(y) + (top ? 0 : -depth), GOAL_W * PX, depth);
  ctx.globalAlpha = 1;
}

function drawRobot(rob) {
  const cx = X(rob.x), cy = Y(rob.y);
  const half = (ROB_SIDE * PX) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rob.heading);

  ctx.fillStyle = rob.color;
  ctx.strokeStyle = rob.isPlayer ? "#ffffff" : "#00000055";
  ctx.lineWidth = rob.isPlayer ? 3 : 2;
  roundRect(-half, -half, half * 2, half * 2, 6);
  ctx.fill();
  ctx.stroke();

  // ön yön göstergesi
  ctx.fillStyle = "#ffffffcc";
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half - 10, -8);
  ctx.lineTo(half - 10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(rob.isPlayer ? "SEN" : rob.team + rob.num, cx, cy);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

setLimit(speedLimit);
requestAnimationFrame(loop);
