// Coefficients par défaut
const DEFAULT_COEFS = {
  "Mathématiques": 3,
  "Français": 3,
  "Anglais": 3,
  "LV2 Espagnol": 2,
  "LV2 Allemand": 2,
  "Physique-Chimie": 1,
  "SVT": 1,
  "EPS": 1,
  "Technologie": 1,
  "Arts Plastiques": 1,
  "Musique": 1,
  "Latin": 1
};

let notes = [];
let showAllHistory = false;

// DOM
const subjectSelect = document.getElementById("subjectSelect");
const noteInput = document.getElementById("noteInput");
const historyList = document.getElementById("historyList");
const globalAverage = document.getElementById("globalAverage");

// Init matières
Object.keys(DEFAULT_COEFS).forEach(subject => {
  const opt = document.createElement("option");
  opt.value = subject;
  opt.textContent = subject;
  subjectSelect.appendChild(opt);
});

// Ajout note
function addNote() {
  const value = parseFloat(noteInput.value);
  if (isNaN(value)) return;

  notes.push({
    id: Date.now(),
    subject: subjectSelect.value,
    value,
    coef: DEFAULT_COEFS[subjectSelect.value] ?? 1,
    mode: "reel"
  });

  noteInput.value = "";
  noteInput.focus();

  refresh();
}

document.getElementById("addNote").addEventListener("click", addNote);
noteInput.addEventListener("keydown", e => {
  if (e.key === "Enter") addNote();
});

// Historique
function refreshHistory() {
  historyList.innerHTML = "";

  const sorted = [...notes].reverse();
  const displayed = showAllHistory ? sorted : sorted.slice(0, 5);

  displayed.forEach(note => {
    const li = document.createElement("li");
    li.className = note.mode === "simulation" ? "ghost" : "";

    li.innerHTML = `
      <span>${note.subject} : ${note.value}/20</span>
      <div class="actions">
        <button data-id="${note.id}" data-action="edit">✏️</button>
        <button data-id="${note.id}" data-action="delete">🗑️</button>
      </div>
    `;

    historyList.appendChild(li);
  });
}

historyList.addEventListener("click", e => {
  const btn = e.target;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (!id || !action) return;

  const mode = prompt("Action sur quel mode ? (reel / simulation)");
  if (!mode) return;

  const note = notes.find(n => n.id === id && n.mode === mode);
  if (!note) return;

  if (action === "delete") {
    notes = notes.filter(n => n !== note);
  }

  if (action === "edit") {
    const newVal = prompt("Nouvelle note :", note.value);
    if (newVal !== null) note.value = parseFloat(newVal);
  }

  refresh();
});

// Toggle historique
document.getElementById("toggleHistory").addEventListener("click", () => {
  showAllHistory = !showAllHistory;
  refreshHistory();
});

// Nettoyage
document.getElementById("clearAll").addEventListener("click", () => {
  if (confirm("Tout effacer ?")) {
    notes = [];
    refresh();
  }
});

// Moyenne
function refreshAverage() {
  if (!notes.length) {
    globalAverage.textContent = "—";
    return;
  }

  const total = notes.reduce((acc, n) => acc + n.value * n.coef, 0);
  const coefs = notes.reduce((acc, n) => acc + n.coef, 0);
  globalAverage.textContent = (total / coefs).toFixed(2);
}

function refresh() {
  refreshHistory();
  refreshAverage();
}

// Modale
document.getElementById("openInfo").onclick = () =>
  document.getElementById("infoModal").classList.remove("hidden");

document.getElementById("closeInfo").onclick = () =>
  document.getElementById("infoModal").classList.add("hidden");
