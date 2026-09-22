/* ═══════════════════════════════════════════════════════════════
   Rock Paper Scissors – Hand Gesture Edition
   ═══════════════════════════════════════════════════════════════ */

// ── SCORE STATE ───────────────────────────────────────────────────
let userScore     = 0;
let computerScore = 0;

// ── DOM REFS ──────────────────────────────────────────────────────
const msgEl           = document.querySelector('#msg');
const userScoreEl     = document.querySelector('#userScore');
const computerScoreEl = document.querySelector('#computerScore');
const aiPanel         = document.querySelector('#aiPanel');
const playerPanel     = document.querySelector('#playerPanel');
const aiChoiceDisplay = document.querySelector('#aiChoiceDisplay');
const resultBox       = document.querySelector('#resultBox');

const camToggleBtn    = document.querySelector('#camToggleBtn');
const camStatus       = document.querySelector('#camStatus');
const camOff          = document.querySelector('#camOff');
const camWrapper      = document.querySelector('#camWrapper');
const webcamVideo     = document.querySelector('#webcamVideo');
const handCanvas      = document.querySelector('#handCanvas');
const handLabel       = document.querySelector('#handLabel');
const countdownOverlay= document.querySelector('#countdownOverlay');
const countdownNum    = document.querySelector('#countdownNum');
const ringFill        = document.querySelector('#ringFill');

// ── CONSTANTS ─────────────────────────────────────────────────────
const CHOICES     = ['rock', 'paper', 'scissors'];
const EMOJI       = { rock: '✊', paper: '✋', scissors: '✌️', unknown: '' };
const cap         = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const genCom      = () => CHOICES[Math.floor(Math.random() * 3)];

// ── GAME LOCK ─────────────────────────────────────────────────────
let gameLocked = false;

// ── AI CHOICE DISPLAY ─────────────────────────────────────────────
function showAiChoice(choice) {
  aiChoiceDisplay.innerHTML = '';
  if (!choice) {
    aiChoiceDisplay.innerHTML = '<span>?</span>';
    return;
  }
  const img = document.createElement('img');
  img.src       = `./images/${choice}.png`;
  img.alt       = cap(choice);
  img.className = 'ai-choice-img';
  aiChoiceDisplay.appendChild(img);
}

// ── PLAY GAME ─────────────────────────────────────────────────────
function playGame(userChoice) {
  if (gameLocked) return;
  gameLocked = true;

  const comChoice = genCom();
  showAiChoice(comChoice);

  if (userChoice === comChoice) {
    showResult('draw', userChoice, comChoice);
  } else {
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    showResult(beats[userChoice] === comChoice ? 'win' : 'lose', userChoice, comChoice);
  }

  setTimeout(() => { gameLocked = false; }, 1900);
}

// ── SHOW RESULT ───────────────────────────────────────────────────
function showResult(outcome, userChoice, comChoice) {
  resultBox.className = 'result-box';
  resultBox.classList.add(outcome);

  aiPanel.classList.remove('flash');
  playerPanel.classList.remove('flash');

  if (outcome === 'win') {
    userScore++;
    userScoreEl.innerText = userScore;
    bump(userScoreEl);
    playerPanel.classList.add('flash');
    msgEl.innerHTML = `YOU<br>WIN!`;
  } else if (outcome === 'lose') {
    computerScore++;
    computerScoreEl.innerText = computerScore;
    bump(computerScoreEl);
    aiPanel.classList.add('flash');
    msgEl.innerHTML = `YOU<br>LOSE`;
  } else {
    msgEl.innerHTML = `DRAW`;
  }
}

function bump(el) {
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

// ══════════════════════════════════════════════════════════════════
//  MEDIAPIPE HANDS
// ══════════════════════════════════════════════════════════════════

let cameraActive   = false;
let handsInstance  = null;
let cameraInstance = null;

// Gesture hold tracking
let heldGesture   = null;
let holdStartTime = 0;
const HOLD_MS     = 1200;
const CD_SECS     = 3;

let countdownActive = false;
let countdownStart  = null;
let animFrameId     = null;

// ── TOGGLE ────────────────────────────────────────────────────────
camToggleBtn.addEventListener('click', () => {
  cameraActive ? stopCamera() : startCamera();
});

function startCamera() {
  cameraActive = true;
  camToggleBtn.textContent = '🛑 Stop Camera';
  camToggleBtn.classList.add('active');
  camOff.hidden    = true;
  camWrapper.hidden = false;

  webcamVideo.addEventListener('loadedmetadata', resizeCanvas, { once: true });
  window.addEventListener('resize', resizeCanvas);

  camStatus.textContent = 'Initialising…';
  initMediaPipe();
}

function stopCamera() {
  cameraActive = false;
  camToggleBtn.textContent = '📷 Start Camera';
  camToggleBtn.classList.remove('active');
  camOff.hidden    = false;
  camWrapper.hidden = true;
  camStatus.textContent = '';
  handLabel.textContent = '';

  if (cameraInstance) { cameraInstance.stop(); cameraInstance = null; }
  if (animFrameId)    { cancelAnimationFrame(animFrameId); animFrameId = null; }

  countdownOverlay.hidden = true;
  resultBox.hidden        = false;
  countdownActive         = false;
  window.removeEventListener('resize', resizeCanvas);
}

// ── CANVAS SIZE ───────────────────────────────────────────────────
function resizeCanvas() {
  handCanvas.width  = webcamVideo.videoWidth  || handCanvas.offsetWidth;
  handCanvas.height = webcamVideo.videoHeight || handCanvas.offsetHeight;
}

// ── MEDIAPIPE INIT ────────────────────────────────────────────────
function initMediaPipe() {
  handsInstance = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
  });
  handsInstance.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence:  0.65,
  });
  handsInstance.onResults(onResults);

  cameraInstance = new Camera(webcamVideo, {
    onFrame: async () => {
      if (!cameraActive) return;
      await handsInstance.send({ image: webcamVideo });
    },
    width: 640, height: 480,
  });

  cameraInstance.start()
    .then(() => { camStatus.textContent = 'Show your hand ✊ ✋ ✌️'; })
    .catch((e) => { camStatus.textContent = `Camera error: ${e.message}`; });
}

// ── RESULTS ───────────────────────────────────────────────────────
function onResults(results) {
  const ctx = handCanvas.getContext('2d');
  ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  if (!results.multiHandLandmarks?.length) {
    handLabel.textContent = '';
    resetHold();
    return;
  }

  const lm = results.multiHandLandmarks[0];

  // Draw skeleton — simple white lines
  drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(255,255,255,0.5)', lineWidth: 2 });
  drawLandmarks(ctx, lm, { color: '#fff', lineWidth: 1, radius: 4 });

  const gesture = classify(lm);
  handLabel.textContent = gesture !== 'unknown' ? `${EMOJI[gesture]}  ${cap(gesture)}` : '';
  handleHold(gesture);
}

// ── CLASSIFY ─────────────────────────────────────────────────────
function classify(lm) {
  const up = (tip, pip) => lm[tip].y < lm[pip].y;
  const indexUp  = up(8,  6);
  const middleUp = up(12, 10);
  const ringUp   = up(16, 14);
  const pinkyUp  = up(20, 18);

  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'rock';
  if (indexUp && middleUp && ringUp && pinkyUp)     return 'paper';
  if (indexUp && middleUp && !ringUp && !pinkyUp)   return 'scissors';
  return 'unknown';
}

// ── HOLD LOGIC ────────────────────────────────────────────────────
function resetHold() {
  heldGesture   = null;
  holdStartTime = 0;
  if (countdownActive) abortCountdown();
}

function handleHold(gesture) {
  if (gameLocked || gesture === 'unknown') { resetHold(); return; }
  const now = Date.now();
  if (gesture !== heldGesture) {
    heldGesture   = gesture;
    holdStartTime = now;
    if (countdownActive) abortCountdown();
    return;
  }
  if (!countdownActive && now - holdStartTime >= HOLD_MS) startCountdown(gesture);
}

// ── COUNTDOWN ────────────────────────────────────────────────────
function startCountdown(gesture) {
  if (countdownActive) return;
  countdownActive = true;
  countdownStart  = Date.now();
  resultBox.hidden        = true;
  countdownOverlay.hidden = false;
  camStatus.textContent   = `Hold ${cap(gesture)}…`;

  (function tick() {
    if (!countdownActive) return;
    const progress = Math.min((Date.now() - countdownStart) / 1000 / CD_SECS, 1);
    const left     = Math.ceil(CD_SECS - progress * CD_SECS);

    // circumference = 2π×42 ≈ 264
    ringFill.style.strokeDashoffset = 264 * (1 - progress);
    countdownNum.textContent = left > 0 ? left : '▶';

    if (progress >= 1) {
      countdownOverlay.hidden = true;
      resultBox.hidden        = false;
      countdownActive         = false;
      camStatus.textContent   = 'Show your hand ✊ ✋ ✌️';
      resetHold();
      playGame(gesture);
      return;
    }
    animFrameId = requestAnimationFrame(tick);
  })();
}

function abortCountdown() {
  countdownActive         = false;
  countdownOverlay.hidden = true;
  resultBox.hidden        = false;
  ringFill.style.strokeDashoffset = 264;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  camStatus.textContent = 'Show your hand ✊ ✋ ✌️';
}