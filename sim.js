const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const scenarioSelect = document.getElementById("scenarioSelect");
const bSlider = document.getElementById("bSlider");
const lSlider = document.getElementById("lSlider");
const rSlider = document.getElementById("rSlider");
const mSlider = document.getElementById("mSlider");
const u0Slider = document.getElementById("u0Slider");
const fSlider = document.getElementById("fSlider");
const aSlider = document.getElementById("aSlider");
const vectorsToggle = document.getElementById("vectorsToggle");
const basicVectorsToggle = document.getElementById("basicVectorsToggle");
const currentVectorsToggle = document.getElementById("currentVectorsToggle");
const bDirBtn = document.getElementById("bDirBtn");

const playPauseBtn = document.getElementById("playPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const slowBtn = document.getElementById("slowBtn");

const bValue = document.getElementById("bValue");
const lValue = document.getElementById("lValue");
const rValue = document.getElementById("rValue");
const mValue = document.getElementById("mValue");
const u0Value = document.getElementById("u0Value");
const u0LabelText = document.getElementById("u0LabelText");
const fValue = document.getElementById("fValue");
const aSetValue = document.getElementById("aSetValue");

const tValue = document.getElementById("tValue");
const xValue = document.getElementById("xValue");
const uSymbol = document.getElementById("uSymbol");
const uValue = document.getElementById("uValue");
const aValue = document.getElementById("aValue");
const eValue = document.getElementById("eValue");
const iValue = document.getElementById("iValue");
const eqEmfLine = document.getElementById("eqEmfLine");
const eqILine = document.getElementById("eqILine");
const rMeasValue = document.getElementById("rMeasValue");
const fmagValue = document.getElementById("fmagValue");
const fnetValue = document.getElementById("fnetValue");
const eqFLine = document.getElementById("eqFLine");
const ulimValue = document.getElementById("ulimValue");
const limitStatus = document.getElementById("limitStatus");
const TRACK_LENGTH = 60;
const VERTICAL_TRACK_LENGTH = 180;
const ZERO_F_EPS = 0.01;
const ZERO_A_EPS = 0.01;
const G = 10;

const state = {
  scenario: scenarioSelect.value,
  B: Number(bSlider.value),
  ell: Number(lSlider.value),
  R: Number(rSlider.value),
  m: Number(mSlider.value),
  u0: Number(u0Slider.value),
  Fext: Number(fSlider.value),
  aSet: Number(aSlider.value),
  showVectors: vectorsToggle.checked,
  showBasicVectors: basicVectorsToggle.checked,
  showCurrentVectors: currentVectorsToggle.checked,
  Bdir: 1,
  playing: false,
  slowMotion: false,
  timeScale: 1,
  t: 0,
  x: 0,
  u: 0,
  a: 0,
  emf: 0,
  I: 0,
  Fmag: 0,
  Fnet: 0,
  FextDynamic: Number(fSlider.value),
  lastTime: null,
  Fnet0Abs: 0
};

function dampingK() {
  return (state.B * state.B * state.ell * state.ell) / state.R;
}

function effectiveFext() {
  if (state.scenario === "with-force") {
    return state.Fext;
  }
  if (state.scenario === "constant-speed") {
    return state.FextDynamic;
  }
  if (state.scenario === "uniform-accel") {
    return state.FextDynamic;
  }
  return 0;
}

function drivingForce() {
  if (state.scenario === "vertical-gravity") {
    return state.m * G;
  }
  return effectiveFext();
}

function currentTrackLength() {
  return state.scenario === "vertical-gravity" ? VERTICAL_TRACK_LENGTH : TRACK_LENGTH;
}

function terminalVelocity() {
  if (state.scenario !== "with-force" && state.scenario !== "vertical-gravity") {
    return null;
  }
  const F = drivingForce();
  if (F <= 0) {
    return null;
  }
  return F / dampingK();
}

function hasReachedTerminal() {
  const ulim = terminalVelocity();
  if (ulim === null) {
    return false;
  }
  return Math.abs(state.Fnet) <= ZERO_F_EPS && Math.abs(state.a) <= ZERO_A_EPS;
}

function applyScenarioDefaults() {
  state.u = state.scenario === "vertical-gravity" ? 0 : state.u0;
}

function syncSlidersUI() {
  const withForce = state.scenario === "with-force";
  const uniformAccel = state.scenario === "uniform-accel";
  const verticalGravity = state.scenario === "vertical-gravity";
  fSlider.disabled = !withForce;
  aSlider.disabled = !uniformAccel;
  u0Slider.disabled = verticalGravity;
  u0LabelText.textContent = state.scenario === "constant-speed" ? "Σταθερή ταχύτητα υ" : "Αρχική ταχύτητα υ₀";

  bValue.textContent = state.B.toFixed(2);
  lValue.textContent = state.ell.toFixed(2);
  rValue.textContent = state.R.toFixed(2);
  mValue.textContent = state.m.toFixed(2);
  u0Value.textContent = state.u0.toFixed(1);
  if (verticalGravity) {
    fValue.textContent = "-";
  } else {
    fValue.textContent = effectiveFext().toFixed(2);
  }
  aSetValue.textContent = state.aSet.toFixed(2);
}

function syncPlayPauseUI() {
  playPauseBtn.textContent = state.playing ? "Pause" : "Play";
}

function currentSense() {
  const signU = Math.sign(state.u);
  if (signU === 0 || state.I < 0.0001) {
    return 0;
  }
  return -state.Bdir * signU;
}

function recalcForces() {
  state.emf = state.B * state.ell * Math.abs(state.u);
  state.I = state.emf / state.R;
  state.Fmag = dampingK() * Math.abs(state.u);
  const signU = Math.sign(state.u);
  const magneticSigned = signU === 0 ? 0 : -signU * state.Fmag;
  if (state.scenario === "uniform-accel") {
    state.Fnet = state.m * state.aSet;
    state.a = state.aSet;
    state.FextDynamic = state.Fnet - magneticSigned;
  } else if (state.scenario === "constant-speed") {
    state.a = 0;
    state.Fnet = 0;
    state.FextDynamic = -magneticSigned;
  } else {
    const F = drivingForce();
    state.Fnet = F + magneticSigned;
    state.a = state.Fnet / state.m;
    state.FextDynamic = state.scenario === "with-force" ? F : 0;
  }
}

function updateMeasurements() {
  tValue.textContent = state.t.toFixed(2);
  xValue.textContent = state.x.toFixed(2);
  uValue.textContent = state.u.toFixed(2);
  aValue.textContent = state.a.toFixed(2);
  eValue.textContent = state.emf.toFixed(2);
  iValue.textContent = state.I.toFixed(2);
  eqEmfLine.textContent = `ε = Bℓυ = ${state.B.toFixed(2)}·${state.ell.toFixed(2)}·${Math.abs(state.u).toFixed(2)} = ${state.emf.toFixed(2)} V`;
  eqILine.textContent = `I = ε/R = ${state.emf.toFixed(2)}/${state.R.toFixed(2)} = ${state.I.toFixed(2)} A`;
  rMeasValue.textContent = state.R.toFixed(2);
  fmagValue.textContent = state.Fmag.toFixed(2);
  fnetValue.textContent = state.Fnet.toFixed(2);

  if (state.scenario === "uniform-accel") {
    uSymbol.textContent = "υ";
    ulimValue.textContent = "-";
    eqFLine.textContent = `ΣF = mα = ${state.m.toFixed(2)}·${state.aSet.toFixed(2)} = ${state.Fnet.toFixed(2)} N`;
    limitStatus.textContent = "Κατάσταση: Ομαλά μεταβαλλόμενη κίνηση (ΣF = mα σταθερή).";
    return;
  }
  if (state.scenario === "constant-speed") {
    uSymbol.textContent = "υ";
    ulimValue.textContent = "-";
    eqFLine.textContent = `ΣF = Fext - F_L = ${effectiveFext().toFixed(2)} - ${state.Fmag.toFixed(2)} = ${state.Fnet.toFixed(2)} N`;
    limitStatus.textContent = "Κατάσταση: Ευθύγραμμη ομαλή κίνηση (υ σταθερή, α = 0, ΣF = 0).";
    return;
  }

  const ulim = terminalVelocity();
  if (ulim === null) {
    uSymbol.textContent = "υ";
    ulimValue.textContent = "-";
    eqFLine.textContent = `ΣF = -F_L = ${state.Fnet.toFixed(2)} N`;
    limitStatus.textContent = "Κατάσταση: F=0, η ράβδος επιβραδύνεται από τη μαγνητική δύναμη μέχρι υ≈0.";
    return;
  }

  if (state.scenario === "vertical-gravity") {
    eqFLine.textContent = `ΣF = mg - F_L = ${(state.m * G).toFixed(2)} - ${state.Fmag.toFixed(2)} = ${state.Fnet.toFixed(2)} N`;
  } else {
    eqFLine.textContent = `ΣF = Fext - F_L = ${effectiveFext().toFixed(2)} - ${state.Fmag.toFixed(2)} = ${state.Fnet.toFixed(2)} N`;
  }
  ulimValue.textContent = `${ulim.toFixed(2)} m/s`;
  const atTerminal = hasReachedTerminal();
  if (atTerminal) {
    uSymbol.innerHTML = "υ<sub>ορ</sub>";
    limitStatus.textContent = "Κατάσταση: ΣF = 0 και α = 0, άρα υορ.";
  } else if (state.Fnet > 0 && state.a > 0) {
    uSymbol.textContent = "υ";
    limitStatus.textContent = "Κατάσταση: ΣF > 0 και α > 0, η ράβδος επιταχύνεται προς υορ.";
  } else if (state.Fnet < 0 && state.a < 0) {
    uSymbol.textContent = "υ";
    limitStatus.textContent = "Κατάσταση: ΣF < 0 και α < 0, η ράβδος επιβραδύνεται προς υορ.";
  } else {
    uSymbol.textContent = "υ";
    limitStatus.textContent = "Κατάσταση: Δεν έχει μηδενιστεί ταυτόχρονα ΣF και α.";
  }
}

function vectorLength(value, pxPerUnit, minPx, maxPx) {
  const magnitude = Math.abs(value) * pxPerUnit;
  if (magnitude < 0.2) {
    return 0;
  }
  return Math.min(maxPx, Math.max(minPx, magnitude));
}

function forceAccelSharedLength(valueAbs, referenceAbs, initialPx) {
  if (referenceAbs <= 0 || valueAbs <= 0) {
    return 0;
  }
  const ratio = Math.min(1, Math.max(0, valueAbs / referenceAbs));
  const length = initialPx * ratio;
  return length < 1 ? 0 : length;
}

function drawArrow(x, y, vx, vy, color, label) {
  if (Math.hypot(vx, vy) < 1) {
    return;
  }

  const tipX = x + vx;
  const tipY = y + vy;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  const angle = Math.atan2(vy, vx);
  const head = 11;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - head * Math.cos(angle - Math.PI / 6), tipY - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tipX - head * Math.cos(angle + Math.PI / 6), tipY - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.font = "bold 13px Arial";
  ctx.fillText(label, tipX + 6, tipY - 6);
}

function drawFieldPattern(x0, y0, w, h, intoPage) {
  for (let y = y0 + 18; y < y0 + h; y += 28) {
    for (let x = x0 + 18; x < x0 + w; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      if (intoPage) {
        ctx.fillStyle = "#6a7800";
        ctx.fill();
        ctx.strokeStyle = "#f7f9d4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 3);
        ctx.lineTo(x + 3, y + 3);
        ctx.moveTo(x + 3, y - 3);
        ctx.lineTo(x - 3, y + 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#6a7800";
        ctx.fill();
        ctx.strokeStyle = "#f7f9d4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "#f7f9d4";
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawScene() {
  if (state.scenario === "vertical-gravity") {
    drawSceneVertical();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const left = 120;
  const right = 900;
  const railTop = 180;
  const railBottom = 420;

  drawFieldPattern(left + 25, railTop + 15, right - left - 50, railBottom - railTop - 30, state.Bdir > 0);

  ctx.strokeStyle = "#4e6e8e";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(left, railTop);
  ctx.lineTo(right, railTop);
  ctx.moveTo(left, railBottom);
  ctx.lineTo(right, railBottom);
  ctx.stroke();

  ctx.strokeStyle = "#324862";
  ctx.lineWidth = 5;
  const connectorMid = (railTop + railBottom) / 2;
  const resistorTop = connectorMid - 48;
  const resistorBottom = connectorMid + 48;
  ctx.beginPath();
  ctx.moveTo(left, railTop);
  ctx.lineTo(left, resistorTop);
  ctx.moveTo(left, resistorBottom);
  ctx.lineTo(left, railBottom);
  ctx.stroke();

  // Resistor symbol on the left connector cable.
  ctx.strokeStyle = "#1d3557";
  ctx.lineWidth = 4;
  const zigAmp = 13;
  const zigSteps = 11;
  const stepY = (resistorBottom - resistorTop) / zigSteps;
  ctx.beginPath();
  ctx.moveTo(left, resistorTop);
  for (let i = 1; i < zigSteps; i += 1) {
    const x = left + (i % 2 === 0 ? -zigAmp : zigAmp);
    const y = resistorTop + i * stepY;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(left, resistorBottom);
  ctx.stroke();

  const xMin = left + 30;
  const xMax = right - 30;
  const trackLen = currentTrackLength();
  const clampedX = Math.max(0, Math.min(state.x, trackLen));
  const rodX = xMin + (clampedX / trackLen) * (xMax - xMin);
  const sweptWidth = Math.max(0, rodX - xMin);

  if (sweptWidth > 0.5) {
    // Subtle highlight of area swept by the rod inside the magnetic field.
    ctx.fillStyle = "rgba(251, 133, 0, 0.15)";
    ctx.fillRect(xMin, railTop + 6, sweptWidth, railBottom - railTop - 12);
  }

  ctx.strokeStyle = "#e76f51";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(rodX, railTop + 4);
  ctx.lineTo(rodX, railBottom - 4);
  ctx.stroke();

  ctx.fillStyle = "#13233f";
  ctx.font = "bold 15px Arial";
  ctx.fillText(state.Bdir > 0 ? "B προς τα μέσα (×)" : "B προς τα έξω (•)", left + 20, railTop - 20);
  const speedLabel = hasReachedTerminal() ? "υορ" : "υ";
  ctx.fillText(`${speedLabel} = ${state.u.toFixed(2)} m/s`, rodX - 50, railBottom + 34);
  ctx.fillText(`R = ${state.R.toFixed(2)} Ω`, left - 108, connectorMid + 6);

  if (state.showCurrentVectors) {
    const sense = currentSense();
    if (sense !== 0) {
      const clockwise = sense > 0;
      const topY = railTop - 14;
      const bottomY = railBottom + 14;
      if (clockwise) {
        drawArrow(left + 12, topY, 56, 0, "#1d3557", "");
        drawArrow(rodX + 12, railTop + 12, 0, 52, "#1d3557", "");
        drawArrow(rodX - 12, bottomY, -56, 0, "#1d3557", "");
        drawArrow(left - 12, railBottom - 12, 0, -52, "#1d3557", "");
      } else {
        drawArrow(rodX - 12, topY, -56, 0, "#1d3557", "");
        drawArrow(left - 12, railTop + 12, 0, 52, "#1d3557", "");
        drawArrow(left + 12, bottomY, 56, 0, "#1d3557", "");
        drawArrow(rodX + 12, railBottom - 12, 0, -52, "#1d3557", "");
      }
      ctx.fillStyle = "#1d3557";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`I`, left - 24, railTop - 26);
    }
  }

  if (state.showVectors) {
    const centerX = rodX;
    const centerY = (railTop + railBottom) / 2;
    const basicOnly = state.showBasicVectors;

    const F = effectiveFext();
    const fmagSigned = state.u === 0 ? 0 : -Math.sign(state.u) * state.Fmag;
    const forceScale = 48;
    const fExtLen = vectorLength(F, forceScale, 34, 220);
    const fMagLen = vectorLength(fmagSigned, forceScale, 34, 220);
    let fNetLen = vectorLength(state.Fnet, forceScale, 36, 220);
    const velLen = vectorLength(state.u, 18, 34, 210);
    let accLen = vectorLength(state.a, 85, 30, 180);

    if (state.scenario !== "uniform-accel" && state.scenario !== "constant-speed") {
      const sharedInitialLen = 170;
      const referenceF = state.Fnet0Abs > 0 ? state.Fnet0Abs : Math.max(0.001, Math.abs(state.Fnet));
      const referenceA = referenceF / state.m;
      fNetLen = forceAccelSharedLength(Math.abs(state.Fnet), referenceF, sharedInitialLen);
      accLen = forceAccelSharedLength(Math.abs(state.a), referenceA, sharedInitialLen);
    }

    if (Math.abs(F) > 0.0001) {
      drawArrow(centerX, centerY - 55, Math.sign(F || 1) * fExtLen, 0, "#f28482", "Fext");
    }
    drawArrow(centerX, centerY - 20, Math.sign(fmagSigned || 1) * fMagLen, 0, "#457b9d", "Fₗ");
    if (!basicOnly) {
      drawArrow(centerX, centerY + 15, Math.sign(state.Fnet || 1) * fNetLen, 0, "#2a9d8f", "ΣF");
    }
    drawArrow(centerX, centerY + 55, Math.sign(state.u || 1) * velLen, 0, "#f77f00", "υ");
    if (!basicOnly) {
      drawArrow(centerX, centerY + 90, Math.sign(state.a || 1) * accLen, 0, "#6a4c93", "α");
    }
  }

  ctx.fillStyle = "#0f1c33";
  ctx.font = "14px Arial";
  ctx.fillText(`x = ${state.x.toFixed(2)} m`, right - 110, railTop - 20);
}

function drawSceneVertical() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const railLeft = 350;
  const railRight = 650;
  const top = 90;
  const bottom = 500;

  drawFieldPattern(railLeft + 12, top + 20, railRight - railLeft - 24, bottom - top - 40, state.Bdir > 0);

  ctx.strokeStyle = "#4e6e8e";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  const topConnectorY = top;
  const topMidX = (railLeft + railRight) / 2;
  const resistorLeft = topMidX - 58;
  const resistorRight = topMidX + 58;
  ctx.beginPath();
  ctx.moveTo(railLeft, top);
  ctx.lineTo(railLeft, bottom);
  ctx.moveTo(railRight, top);
  ctx.lineTo(railRight, bottom);
  ctx.moveTo(railLeft, topConnectorY);
  ctx.lineTo(resistorLeft, topConnectorY);
  ctx.moveTo(resistorRight, topConnectorY);
  ctx.lineTo(railRight, topConnectorY);
  ctx.stroke();

  // Resistor symbol on the top connector.
  ctx.strokeStyle = "#1d3557";
  ctx.lineWidth = 4;
  const zigAmpY = 13;
  const zigSteps = 9;
  const stepX = (resistorRight - resistorLeft) / zigSteps;
  ctx.beginPath();
  ctx.moveTo(resistorLeft, topConnectorY);
  for (let i = 1; i < zigSteps; i += 1) {
    const x = resistorLeft + i * stepX;
    const y = topConnectorY + (i % 2 === 0 ? -zigAmpY : zigAmpY);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(resistorRight, topConnectorY);
  ctx.stroke();

  const yMin = top + 20;
  const yMax = bottom - 20;
  const trackLen = currentTrackLength();
  const clampedX = Math.max(0, Math.min(state.x, trackLen));
  const rodY = yMin + (clampedX / trackLen) * (yMax - yMin);
  const sweptHeight = Math.max(0, rodY - yMin);

  if (sweptHeight > 0.5) {
    // Subtle highlight of area swept by the rod inside the magnetic field.
    ctx.fillStyle = "rgba(251, 133, 0, 0.15)";
    ctx.fillRect(railLeft + 6, yMin, railRight - railLeft - 12, sweptHeight);
  }

  ctx.strokeStyle = "#e76f51";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(railLeft + 5, rodY);
  ctx.lineTo(railRight - 5, rodY);
  ctx.stroke();

  ctx.fillStyle = "#13233f";
  ctx.font = "bold 15px Arial";
  ctx.fillText("Κατακόρυφη κίνηση ράβδου", 40, 36);
  ctx.fillText(state.Bdir > 0 ? "B προς τα μέσα (×)" : "B προς τα έξω (•)", 40, 60);
  const speedLabel = hasReachedTerminal() ? "υορ" : "υ";
  const speedY = Math.max(top + 18, Math.min(bottom - 10, rodY - 10));
  ctx.fillText(`${speedLabel} = ${state.u.toFixed(2)} m/s`, railRight + 22, speedY);
  ctx.fillText(`R = ${state.R.toFixed(2)} Ω`, topMidX - 42, topConnectorY - 24);
  ctx.fillText(`y = ${state.x.toFixed(2)} m`, 40, 108);

  if (state.showCurrentVectors) {
    const sense = currentSense();
    if (sense !== 0) {
      const clockwise = sense > 0;
      const topY = topConnectorY - 14;
      const bottomY = rodY + 14;
      if (clockwise) {
        drawArrow(railLeft + 12, topY, 58, 0, "#1d3557", "");
        drawArrow(railRight + 12, top + 12, 0, 58, "#1d3557", "");
        drawArrow(railRight - 12, bottomY, -58, 0, "#1d3557", "");
        drawArrow(railLeft - 12, rodY - 12, 0, -58, "#1d3557", "");
      } else {
        drawArrow(railRight - 12, topY, -58, 0, "#1d3557", "");
        drawArrow(railLeft - 12, top + 12, 0, 58, "#1d3557", "");
        drawArrow(railLeft + 12, bottomY, 58, 0, "#1d3557", "");
        drawArrow(railRight + 12, rodY - 12, 0, -58, "#1d3557", "");
      }
      ctx.fillStyle = "#1d3557";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`I`, railLeft - 22, top - 26);
    }
  }

  if (state.showVectors) {
    const centerX = (railLeft + railRight) / 2;
    const centerY = rodY;
    const basicOnly = state.showBasicVectors;
    const weight = state.m * G;
    const fmagSigned = state.u === 0 ? 0 : -Math.sign(state.u) * state.Fmag;
    // Use a common force scale so B, F_L, and ΣF are visually comparable.
    const forceScale = 26;
    const fWeightLen = vectorLength(weight, forceScale, 28, 190);
    const fMagLen = vectorLength(fmagSigned, forceScale, 28, 190);
    let fNetLen = vectorLength(state.Fnet, forceScale, 28, 190);
    const velLen = vectorLength(state.u, 16, 30, 200);
    let accLen = vectorLength(state.a, 80, 28, 180);

    if (state.scenario !== "uniform-accel" && state.scenario !== "constant-speed") {
      const sharedInitialLen = 150;
      const referenceF = state.Fnet0Abs > 0 ? state.Fnet0Abs : Math.max(0.001, Math.abs(state.Fnet));
      const referenceA = referenceF / state.m;
      fNetLen = forceAccelSharedLength(Math.abs(state.Fnet), referenceF, sharedInitialLen);
      accLen = forceAccelSharedLength(Math.abs(state.a), referenceA, sharedInitialLen);
    }

    drawArrow(centerX - 90, centerY, 0, fWeightLen, "#d62828", "Β");
    drawArrow(centerX - 45, centerY, 0, Math.sign(fmagSigned || 1) * fMagLen, "#457b9d", "Fₗ");
    if (!basicOnly) {
      drawArrow(centerX, centerY, 0, Math.sign(state.Fnet || 1) * fNetLen, "#2a9d8f", "ΣF");
    }
    drawArrow(centerX + 45, centerY, 0, Math.sign(state.u || 1) * velLen, "#f77f00", "υ");
    if (!basicOnly) {
      drawArrow(centerX + 90, centerY, 0, Math.sign(state.a || 1) * accLen, "#6a4c93", "α");
    }
  }
}

function integrate(dt) {
  if (state.scenario === "uniform-accel") {
    const oldU = state.u;
    state.u += state.aSet * dt;
    if (state.u < 0) {
      state.u = 0;
    }
    state.x += oldU * dt + 0.5 * state.aSet * dt * dt;
    state.t += dt;
    const trackLen = currentTrackLength();
    if (state.x > trackLen) {
      state.x = trackLen;
      if (state.u > 0) {
        state.u = 0;
      }
      state.playing = false;
    } else if (state.x < 0) {
      state.x = 0;
      if (state.u < 0) {
        state.u = 0;
      }
      state.playing = false;
    }
    recalcForces();
    return;
  }
  if (state.scenario === "constant-speed") {
    state.u = state.u0;
    state.x += state.u * dt;
    state.t += dt;
    const trackLen = currentTrackLength();
    if (state.x > trackLen) {
      state.x = trackLen;
      state.playing = false;
    } else if (state.x < 0) {
      state.x = 0;
      state.playing = false;
    }
    recalcForces();
    return;
  }

  const k = dampingK();
  const F = drivingForce();
  const tau = state.m / k;
  const uInf = F / k;
  const decay = Math.exp(-dt / tau);
  const oldU = state.u;

  // Exact step for m du/dt = F - k u (stable and smooth for all dt).
  state.u = uInf + (oldU - uInf) * decay;
  if (Math.abs(state.u) < 0.0005) {
    state.u = 0;
  }
  if (state.scenario === "with-u0" && Math.abs(state.u) < 0.02) {
    state.u = 0;
    state.playing = false;
  }

  // Exact displacement over dt from the same linear ODE solution.
  state.x += uInf * dt + (oldU - uInf) * tau * (1 - decay);
  state.t += dt;

  const trackLen = currentTrackLength();
  if (state.x > trackLen) {
    state.x = trackLen;
    if (state.u > 0) {
      state.u = 0;
    }
    state.playing = false;
  } else if (state.x < 0) {
    state.x = 0;
    if (state.u < 0) {
      state.u = 0;
    }
    state.playing = false;
  }

  recalcForces();
}

function tick(timestamp) {
  if (state.lastTime === null) {
    state.lastTime = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000) * state.timeScale;
  state.lastTime = timestamp;

  if (state.playing) {
    integrate(dt);
  } else {
    recalcForces();
  }

  syncSlidersUI();
  syncPlayPauseUI();
  updateMeasurements();
  drawScene();
  requestAnimationFrame(tick);
}

function resetSimulation() {
  state.playing = false;
  state.t = 0;
  state.x = 0;
  applyScenarioDefaults();
  recalcForces();
  state.Fnet0Abs = Math.abs(state.Fnet);
  syncPlayPauseUI();
  updateMeasurements();
  drawScene();
}

scenarioSelect.addEventListener("change", () => {
  state.scenario = scenarioSelect.value;
  resetSimulation();
});

bSlider.addEventListener("input", () => {
  state.B = Number(bSlider.value);
});

lSlider.addEventListener("input", () => {
  state.ell = Number(lSlider.value);
});

rSlider.addEventListener("input", () => {
  state.R = Number(rSlider.value);
});

mSlider.addEventListener("input", () => {
  state.m = Number(mSlider.value);
});

u0Slider.addEventListener("input", () => {
  state.u0 = Number(u0Slider.value);
  if (state.scenario === "constant-speed") {
    state.u = state.u0;
  }
  if (!state.playing || state.scenario === "constant-speed") {
    applyScenarioDefaults();
  }
});

fSlider.addEventListener("input", () => {
  state.Fext = Number(fSlider.value);
  if (!state.playing) {
    recalcForces();
  }
});

aSlider.addEventListener("input", () => {
  state.aSet = Number(aSlider.value);
  if (!state.playing) {
    recalcForces();
  }
});

vectorsToggle.addEventListener("change", () => {
  state.showVectors = vectorsToggle.checked;
});

basicVectorsToggle.addEventListener("change", () => {
  state.showBasicVectors = basicVectorsToggle.checked;
});

currentVectorsToggle.addEventListener("change", () => {
  state.showCurrentVectors = currentVectorsToggle.checked;
});

bDirBtn.addEventListener("click", () => {
  state.Bdir *= -1;
  bDirBtn.textContent = state.Bdir > 0 ? "B: προς τα μέσα (×)" : "B: προς τα έξω (•)";
});

playPauseBtn.addEventListener("click", () => {
  if (!state.playing && state.t === 0) {
    recalcForces();
    state.Fnet0Abs = Math.abs(state.Fnet);
  }
  state.playing = !state.playing;
  syncPlayPauseUI();
});

resetBtn.addEventListener("click", resetSimulation);

slowBtn.addEventListener("click", () => {
  state.slowMotion = !state.slowMotion;
  state.timeScale = state.slowMotion ? 0.35 : 1;
  slowBtn.textContent = `Slow motion: ${state.slowMotion ? "On" : "Off"}`;
  slowBtn.classList.toggle("slow-on", state.slowMotion);
});

resetSimulation();
requestAnimationFrame(tick);
