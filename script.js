// ================== STATE ==================
let sessionActive = false;
let mainTimerSeconds = 0;
let mainTimerInterval = null;

let secondaryActive = false;
let secondarySeconds = 0;
let secondaryInterval = null;

let logs = [];
let logIdCounter = 1;

// DOM references
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

// ================== UTILITIES ==================
function formatTimeHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s]
    .map(v => String(v).padStart(2, "0"))
    .join(":");
}

function formatTimeMS(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
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

  submitQuestionBtn.disabled = !sessionActive || secondarySeconds === 0;

  const hasLogs = logs.length > 0;
  clearLogsBtn.disabled = !hasLogs;
  exportLogsBtn.disabled = !hasLogs;

  // merge button only if at least 2 selected
  const selectedCount = logs.filter(l => l.selected).length;
  mergeLogsBtn.disabled = selectedCount < 2;
}

function saveToLocalStorage() {
  const data = {
    sessionActive,
    mainTimerSeconds,
    secondarySeconds,
    logs,
    logIdCounter,
    activeSessionName: activeSessionNameEl.textContent || "",
  };
  localStorage.setItem("soloStudyState", JSON.stringify(data));
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem("soloStudyState");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    sessionActive = false; // always start as not active to avoid weird resume
    mainTimerSeconds = data.mainTimerSeconds || 0;
    secondarySeconds = 0;
    logs = data.logs || [];
    logIdCounter = data.logIdCounter || 1;

    activeSessionNameEl.textContent = data.activeSessionName || "None";
    sessionStatusEl.textContent = "Idle";

    updateMainTimerDisplay();
    updateSecondaryDisplay();
    renderLogs();
    updateButtonsState();
  } catch (e) {
    console.error("Failed to load saved state", e);
  }
}

// ================== MAIN TIMER LOGIC ==================
function startMainTimer(initialSeconds) {
  if (mainTimerInterval) clearInterval(mainTimerInterval);
  mainTimerSeconds = initialSeconds;
  updateMainTimerDisplay();

  mainTimerInterval = setInterval(() => {
    if (mainTimerSeconds > 0) {
      mainTimerSeconds--;
      updateMainTimerDisplay();
      saveToLocalStorage();
    } else {
      clearInterval(mainTimerInterval);
      mainTimerInterval = null;
      sessionActive = false;
      sessionStatusEl.textContent = "Main time over";
      stopSecondaryTimer();
      updateButtonsState();
      saveToLocalStorage();
    }
  }, 1000);
}

function stopMainTimer() {
  if (mainTimerInterval) {
    clearInterval(mainTimerInterval);
    mainTimerInterval = null;
  }
}

// ================== SECONDARY TIMER LOGIC ==================
function startSecondaryTimer() {
  if (secondaryInterval) clearInterval(secondaryInterval);
  secondaryActive = true;
  secondaryInterval = setInterval(() => {
    secondarySeconds++;
    updateSecondaryDisplay();
  }, 1000);
  updateButtonsState();
}

function pauseSecondaryTimer() {
  secondaryActive = false;
  if (secondaryInterval) {
    clearInterval(secondaryInterval);
    secondaryInterval = null;
  }
  updateButtonsState();
}

function stopSecondaryTimer() {
  pauseSecondaryTimer();
  secondarySeconds = 0;
  updateSecondaryDisplay();
  updateButtonsState();
}

// ================== SESSION CONTROL ==================
startSessionBtn.addEventListener("click", () => {
  const name = sessionNameInput.value.trim() || "Unnamed Session";
  let minutes = parseInt(mainMinutesInput.value, 10);
  if (Number.isNaN(minutes) || minutes <= 0) {
    alert("Please enter a valid main timer in minutes.");
    return;
  }

  const totalSeconds = minutes * 60;

  activeSessionNameEl.textContent = name;
  sessionStatusEl.textContent = "Running";
  sessionActive = true;

  startMainTimer(totalSeconds);
  stopSecondaryTimer(); // reset secondary
  saveToLocalStorage();
  updateButtonsState();
});

endSessionBtn.addEventListener("click", () => {
  if (!sessionActive && !mainTimerInterval) {
    sessionStatusEl.textContent = "Idle";
    return;
  }
  sessionActive = false;
  sessionStatusEl.textContent = "Ended";
  stopMainTimer();
  stopSecondaryTimer();
  updateButtonsState();
  saveToLocalStorage();
});

// ================== QUESTION SUBMIT ==================
submitQuestionBtn.addEventListener("click", () => {
  if (!sessionActive) return;
  if (secondarySeconds === 0) {
    alert("Start the question timer first.");
    return;
  }

  // Subtract secondarySeconds from mainTimerSeconds, but not below zero
  const timeSpent = secondarySeconds;
  mainTimerSeconds = Math.max(0, mainTimerSeconds - timeSpent);
  updateMainTimerDisplay();

  const statusVal = questionStatusSelect.value;
  let statusLabel = "Unattempted";
  if (statusVal === "correct") statusLabel = "Correct";
  else if (statusVal === "incorrect") statusLabel = "Incorrect";

  // Create log
  const logItem = {
    id: logIdCounter++,
    timeSpent: timeSpent,
    mainRemaining: mainTimerSeconds,
    status: statusVal,
    selected: false,
  };
  logs.push(logItem);

  // Reset secondary timer
  stopSecondaryTimer();

  renderLogs();
  updateButtonsState();
  saveToLocalStorage();
});

// ================== LOG RENDERING ==================
function renderLogs() {
  logsBody.innerHTML = "";
  logs.forEach((log, index) => {
    const tr = document.createElement("tr");

    // Select checkbox
    const selectTd = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = log.selected;
    cb.addEventListener("change", () => {
      log.selected = cb.checked;
      updateButtonsState();
      saveToLocalStorage();
    });
    selectTd.appendChild(cb);
    tr.appendChild(selectTd);

    // Index / ID
    const idTd = document.createElement("td");
    idTd.textContent = index + 1;
    tr.appendChild(idTd);

    // Time spent
    const timeTd = document.createElement("td");
    timeTd.textContent = formatTimeMS(log.timeSpent);
    tr.appendChild(timeTd);

    // Main remaining
    const remainingTd = document.createElement("td");
    remainingTd.textContent = formatTimeHMS(log.mainRemaining);
    tr.appendChild(remainingTd);

    // Status
    const statusTd = document.createElement("td");
    const span = document.createElement("span");
    span.classList.add("status-pill");
    if (log.status === "correct") {
      span.classList.add("status-correct");
      span.textContent = "Correct";
    } else if (log.status === "incorrect") {
      span.classList.add("status-incorrect");
      span.textContent = "Incorrect";
    } else {
      span.classList.add("status-unattempted");
      span.textContent = "Unattempted";
    }
    statusTd.appendChild(span);
    tr.appendChild(statusTd);

    // Actions
    const actionsTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "btn danger";
    delBtn.style.padding = "0.25rem 0.7rem";
    delBtn.style.fontSize = "0.75rem";
    delBtn.addEventListener("click", () => {
      logs = logs.filter(l => l.id !== log.id);
      renderLogs();
      updateButtonsState();
      saveToLocalStorage();
    });
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    logsBody.appendChild(tr);
  });

  updateButtonsState();
}

// ================== LOG MERGE ==================
mergeLogsBtn.addEventListener("click", () => {
  const selectedLogs = logs.filter(l => l.selected);
  if (selectedLogs.length < 2) {
    alert("Select at least two logs to merge.");
    return;
  }

  // Sum time spent
  const mergedTime = selectedLogs.reduce((sum, l) => sum + l.timeSpent, 0);
  // Take remaining from the *latest* selected log (by mainRemaining or by position)
  const latest = selectedLogs[selectedLogs.length - 1];
  const mergedRemaining = latest.mainRemaining;

  // Status merge rule:
  // if any incorrect -> incorrect
  // else if any correct -> correct
  // else unattempted
  let mergedStatus = "unattempted";
  if (selectedLogs.some(l => l.status === "incorrect")) mergedStatus = "incorrect";
  else if (selectedLogs.some(l => l.status === "correct")) mergedStatus = "correct";

  // Remove selected logs
  const selectedIds = new Set(selectedLogs.map(l => l.id));
  logs = logs.filter(l => !selectedIds.has(l.id));

  // Add new merged log
  const mergedLog = {
    id: logIdCounter++,
    timeSpent: mergedTime,
    mainRemaining: mergedRemaining,
    status: mergedStatus,
    selected: false,
  };
  logs.push(mergedLog);

  renderLogs();
  updateButtonsState();
  saveToLocalStorage();
});

// ================== CLEAR LOGS ==================
clearLogsBtn.addEventListener("click", () => {
  if (!logs.length) return;
  const sure = confirm("Clear all logs? This cannot be undone.");
  if (!sure) return;
  logs = [];
  logIdCounter = 1;
  renderLogs();
  updateButtonsState();
  saveToLocalStorage();
});

// ================== EXPORT LOGS ==================
exportLogsBtn.addEventListener("click", () => {
  if (!logs.length) {
    alert("No logs to export.");
    return;
  }

  // Prepare data for SheetJS
  const data = logs.map((log, index) => {
    let statusLabel = "Unattempted";
    if (log.status === "correct") statusLabel = "Correct";
    else if (log.status === "incorrect") statusLabel = "Incorrect";

    return {
      "#": index + 1,
      "Question time": formatTimeMS(log.timeSpent),
      "Main time remaining": formatTimeHMS(log.mainRemaining),
      "Status": statusLabel,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Battle Logs");

  const fileName = `study_logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
});

// ================== MANA PARTICLES ==================
(function initParticles() {
  const particleContainer = document.getElementById("particles");
  const count = 40;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = Math.random() * 4 + 2;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * -20;

    p.style.position = "absolute";
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.borderRadius = "50%";
    p.style.background = "rgba(0, 220, 255, 0.8)";
    p.style.boxShadow = "0 0 12px rgba(0, 240, 255, 0.9)";
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    p.style.opacity = "0.1";

    p.style.animation = `floatUp ${duration}s linear infinite`;
    p.style.animationDelay = `${delay}s`;

    particleContainer.appendChild(p);
  }
})();

// Add keyframes via JS (for full file portability)
const styleEl = document.createElement("style");
styleEl.textContent = `
@keyframes floatUp {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  25% {
    opacity: 0.35;
  }
  60% {
    opacity: 0.15;
  }
  100% {
    transform: translateY(-40px);
    opacity: 0;
  }
}
`;
document.head.appendChild(styleEl);

// ================== INIT ==================
window.addEventListener("load", () => {
  loadFromLocalStorage();
  updateButtonsState();
  updateMainTimerDisplay();
  updateSecondaryDisplay();
});