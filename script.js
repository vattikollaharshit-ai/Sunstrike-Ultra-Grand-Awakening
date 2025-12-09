// ======== STATE ========
let sessionActive = false;
let mainTimerSeconds = 0;       // static total time remaining
let secondarySeconds = 0;       // per-question time
let secondaryInterval = null;
let secondaryActive = false;

let logs = [];
let logIdCounter = 1;

// ======== DOM ========
const activeSessionNameEl = document.getElementById("activeSessionName");
const sessionStatusEl = document.getElementById("sessionStatus");

const mainTimerDisplay = document.getElementById("mainTimerDisplay");
const secondaryTimerDisplay = document.getElementById("secondaryTimerDisplay");

const sessionNameInput = document.getElementById("sessionName");
const mainMinutesInput = document.getElementById("mainMinutes");

const startSessionBtn = document.getElementById("startSessionBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const startSecondaryBtn = document.getElementById("startSecondaryBtn");
const pauseSecondaryBtn = document.getElementById("pauseSecondaryBtn");
const submitQuestionBtn = document.getElementById("submitQuestionBtn");
const questionStatusSelect = document.getElementById("questionStatus");

const logsBody = document.getElementById("logsBody");
const mergeLogsBtn = document.getElementById("mergeLogsBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const exportLogsBtn = document.getElementById("exportLogsBtn");

// ======== UTIL ========
function formatTimeHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function formatTimeMS(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return [m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function updateMainTimerDisplay() {
  mainTimerDisplay.textContent = formatTimeHMS(mainTimerSeconds);
}

function updateSecondaryDisplay() {
  secondaryTimerDisplay.textContent = formatTimeMS(secondarySeconds);
}

function updateButtonsState() {
  startSessionBtn.disabled = sessionActive;
  endSessionBtn.disabled = !sessionActive;

  startSecondaryBtn.disabled = !sessionActive || secondaryActive;
  pauseSecondaryBtn.disabled = !sessionActive || !secondaryActive;

  submitQuestionBtn.disabled = !sessionActive || secondarySeconds <= 0;

  const hasLogs = logs.length > 0;
  clearLogsBtn.disabled = !hasLogs;
  exportLogsBtn.disabled = !hasLogs;

  const selectedCount = logs.filter(l => l.selected).length;
  mergeLogsBtn.disabled = selectedCount < 2;
}

function saveState() {
  const data = {
    mainTimerSeconds,
    logs,
    logIdCounter,
    activeSessionName: activeSessionNameEl.textContent || "",
  };
  localStorage.setItem("soloStudyState", JSON.stringify(data));
}

function loadState() {
  const raw = localStorage.getItem("soloStudyState");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    mainTimerSeconds = data.mainTimerSeconds || 0;
    logs = data.logs || [];
    logIdCounter = data.logIdCounter || 1;
    activeSessionNameEl.textContent = data.activeSessionName || "None";
    sessionStatusEl.textContent = "Idle";

    updateMainTimerDisplay();
    updateSecondaryDisplay();
    renderLogs();
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

// ======== SECONDARY TIMER ========
function startSecondary() {
  if (secondaryInterval) clearInterval(secondaryInterval);
  secondaryActive = true;
  secondaryInterval = setInterval(() => {
    secondarySeconds++;
    updateSecondaryDisplay();
    updateButtonsState();
  }, 1000);
  updateButtonsState();
}

function pauseSecondary() {
  secondaryActive = false;
  if (secondaryInterval) {
    clearInterval(secondaryInterval);
    secondaryInterval = null;
  }
  updateButtonsState();
}

function resetSecondary() {
  pauseSecondary();
  secondarySeconds = 0;
  updateSecondaryDisplay();
  updateButtonsState();
}

// ======== SESSION CONTROL ========
startSessionBtn.addEventListener("click", () => {
  const name = sessionNameInput.value.trim() || "Unnamed Session";
  let minutes = parseInt(mainMinutesInput.value, 10);

  if (Number.isNaN(minutes) || minutes <= 0) {
    alert("Enter a valid main timer in minutes.");
    return;
  }

  mainTimerSeconds = minutes * 60;  // static total time
  sessionActive = true;

  activeSessionNameEl.textContent = name;
  sessionStatusEl.textContent = "Running";

  resetSecondary();
  updateMainTimerDisplay();
  updateButtonsState();
  saveState();
});

endSessionBtn.addEventListener("click", () => {
  if (!sessionActive) {
    sessionStatusEl.textContent = "Idle";
    return;
  }

  sessionActive = false;
  sessionStatusEl.textContent = "Ended";
  resetSecondary();
  updateButtonsState();
  saveState();
});

startSecondaryBtn.addEventListener("click", () => {
  if (!sessionActive) return;
  startSecondary();
});

pauseSecondaryBtn.addEventListener("click", () => {
  if (!sessionActive) return;
  pauseSecondary();
});

// ======== SUBMIT QUESTION ========
submitQuestionBtn.addEventListener("click", () => {
  if (!sessionActive) return;
  if (secondarySeconds <= 0) {
    alert("Run the question timer for at least 1 second before submitting.");
    return;
  }

  const timeSpent = secondarySeconds;

  // Main timer is static, only changes here
  mainTimerSeconds = Math.max(0, mainTimerSeconds - timeSpent);
  updateMainTimerDisplay();

  const statusVal = questionStatusSelect.value; // "correct" | "incorrect" | "unattempted"

  const log = {
    id: logIdCounter++,
    timeSpent,
    mainRemaining: mainTimerSeconds,
    status: statusVal,
    selected: false,
  };

  logs.push(log);
  resetSecondary();
  renderLogs();
  updateButtonsState();
  saveState();
});

// ======== LOG RENDERING ========
function renderLogs() {
  logsBody.innerHTML = "";

  logs.forEach((log, idx) => {
    const tr = document.createElement("tr");

    // select
    const selectTd = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = log.selected;
    cb.addEventListener("change", () => {
      log.selected = cb.checked;
      updateButtonsState();
      saveState();
    });
    selectTd.appendChild(cb);
    tr.appendChild(selectTd);

    // index
    const idTd = document.createElement("td");
    idTd.textContent = idx + 1;
    tr.appendChild(idTd);

    // question time
    const timeTd = document.createElement("td");
    timeTd.textContent = formatTimeMS(log.timeSpent);
    tr.appendChild(timeTd);

    // main remaining
    const mainTd = document.createElement("td");
    mainTd.textContent = formatTimeHMS(log.mainRemaining);
    tr.appendChild(mainTd);

    // status
    const statusTd = document.createElement("td");
    const pill = document.createElement("span");
    pill.classList.add("status-pill");
    if (log.status === "correct") {
      pill.classList.add("status-correct");
      pill.textContent = "Correct";
    } else if (log.status === "incorrect") {
      pill.classList.add("status-incorrect");
      pill.textContent = "Incorrect";
    } else {
      pill.classList.add("status-unattempted");
      pill.textContent = "Unattempted";
    }
    statusTd.appendChild(pill);
    tr.appendChild(statusTd);

    // actions
    const actionsTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "btn danger";
    delBtn.style.fontSize = "0.75rem";
    delBtn.style.padding = "0.2rem 0.7rem";
    delBtn.addEventListener("click", () => {
      logs = logs.filter(l => l.id !== log.id);
      renderLogs();
      updateButtonsState();
      saveState();
    });
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    logsBody.appendChild(tr);
  });

  updateButtonsState();
}

// ======== MERGE LOGS ========
mergeLogsBtn.addEventListener("click", () => {
  const selectedLogs = logs.filter(l => l.selected);
  if (selectedLogs.length < 2) {
    alert("Select at least two logs to merge.");
    return;
  }

  const mergedTime = selectedLogs.reduce((sum, l) => sum + l.timeSpent, 0);

  const selectedIds = new Set(selectedLogs.map(l => l.id));
  const inOrder = logs.filter(l => selectedIds.has(l.id));
  const latest = inOrder[inOrder.length - 1];
  const mergedRemaining = latest ? latest.mainRemaining : 0;

  let mergedStatus = "unattempted";
  if (selectedLogs.some(l => l.status === "incorrect")) mergedStatus = "incorrect";
  else if (selectedLogs.some(l => l.status === "correct")) mergedStatus = "correct";

  logs = logs.filter(l => !selectedIds.has(l.id));

  logs.push({
    id: logIdCounter++,
    timeSpent: mergedTime,
    mainRemaining: mergedRemaining,
    status: mergedStatus,
    selected: false,
  });

  renderLogs();
  updateButtonsState();
  saveState();
});

// ======== CLEAR LOGS ========
clearLogsBtn.addEventListener("click", () => {
  if (!logs.length) return;
  if (!confirm("Clear all logs? This cannot be undone.")) return;
  logs = [];
  logIdCounter = 1;
  renderLogs();
  updateButtonsState();
  saveState();
});

// ======== EXPORT LOGS ========
exportLogsBtn.addEventListener("click", () => {
  if (!logs.length) {
    alert("No logs to export.");
    return;
  }

  const data = logs.map((log, idx) => {
    let statusLabel = "Unattempted";
    if (log.status === "correct") statusLabel = "Correct";
    else if (log.status === "incorrect") statusLabel = "Incorrect";

    return {
      "#": idx + 1,
      "Question time": formatTimeMS(log.timeSpent),
      "Main time remaining": formatTimeHMS(log.mainRemaining),
      "Status": statusLabel,
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Battle Logs");

  const fileName = `study_logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
  XLSX.writeFile(wb, fileName);
});

// ======== PARTICLES ========
(function initParticles() {
  const container = document.getElementById("particles");
  if (!container) return;

  const count = 40;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = Math.random() * 4 + 2;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * -20;

    p.style.position = "absolute";
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.borderRadius = "50%`;
    p.style.background = "rgba(0, 220, 255, 0.8)";
    p.style.boxShadow = "0 0 12px rgba(0, 240, 255, 0.9)";
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    p.style.opacity = "0.1";
    p.style.animation = `floatUp ${duration}s linear infinite`;
    p.style.animationDelay = `${delay}s`;

    container.appendChild(p);
  }
})();

const styleEl = document.createElement("style");
styleEl.textContent = `
@keyframes floatUp {
  0% { transform: translateY(10px); opacity: 0; }
  25% { opacity: 0.35; }
  60% { opacity: 0.15; }
  100% { transform: translateY(-40px); opacity: 0; }
}
`;
document.head.appendChild(styleEl);

// ======== INIT ========
window.addEventListener("load", () => {
  loadState();
  updateButtonsState();
  updateMainTimerDisplay();
  updateSecondaryDisplay();
});