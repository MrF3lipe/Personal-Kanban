const COLUMNS = [
  { id: "pending", label: "Pendientes" },
  { id: "in-progress", label: "En Proceso" },
  { id: "in-review", label: "En Revisión" },
  { id: "completed", label: "Completadas" },
];

const socket = io();
let tasks = [];
let editingId = null;
let currentUser = localStorage.getItem("kanban_user") || "";

function getUser() {
  return currentUser;
}

function setUser(name) {
  currentUser = name;
  localStorage.setItem("kanban_user", name);
  document.getElementById("userBadge").textContent = name;
}

// Login screen
function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginInput").focus();
}

function hideLogin() {
  document.getElementById("loginScreen").classList.add("hidden");
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("loginInput").value.trim();
  if (name) {
    setUser(name);
    hideLogin();
  }
});

if (!currentUser) {
  showLogin();
} else {
  document.getElementById("userBadge").textContent = currentUser;
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("kanban_user");
  currentUser = "";
  showLogin();
});

// Cargar tareas iniciales
fetch("/api/tasks")
  .then((r) => r.json())
  .then((data) => {
    tasks = data;
    render();
  });

socket.on("tasks:updated", (data) => {
  tasks = data;
  render();
});

// --- Render ---
function render() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  COLUMNS.forEach((col) => {
    const colTasks = tasks.filter((t) => t.status === col.id);
    const colEl = document.createElement("div");
    colEl.className = `column ${col.id}`;
    colEl.dataset.column = col.id;

    colEl.innerHTML = `
      <div class="column-header">
        <span>${col.label}</span>
        <span class="count">${colTasks.length}</span>
      </div>
      <div class="column-body"></div>
    `;

    const body = colEl.querySelector(".column-body");

    colTasks.forEach((task) => {
      body.appendChild(createCard(task));
    });

    // Drag & drop events on column
    colEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      colEl.classList.add("drag-over");
    });

    colEl.addEventListener("dragleave", () => {
      colEl.classList.remove("drag-over");
    });

    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      colEl.classList.remove("drag-over");
      const id = parseInt(e.dataTransfer.getData("text/plain"));
      if (id && col.id !== tasks.find((t) => t.id === id)?.status) {
        socket.emit("task:move", { id, newStatus: col.id, username: getUser() });
      }
    });

    board.appendChild(colEl);
  });
}

function createCard(task) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = true;
  card.dataset.id = task.id;

  const userInfo = [];
  if (task.createdBy) userInfo.push(`Creado por ${escapeHtml(task.createdBy)}`);
  if (task.lastModifiedBy && task.lastModifiedBy !== task.createdBy) userInfo.push(`Último: ${escapeHtml(task.lastModifiedBy)}`);

  card.innerHTML = `
    <div class="card-title">${escapeHtml(task.title)}</div>
    ${task.description ? `<div class="card-desc">${escapeHtml(task.description)}</div>` : ""}
    ${userInfo.length ? `<div class="card-user">${userInfo.join(" · ")}</div>` : ""}
    <div class="card-actions">
      <button class="edit-btn" data-id="${task.id}">Editar</button>
    </div>
  `;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  card.querySelector(".edit-btn").addEventListener("click", () => {
    openEditModal(task);
  });

  return card;
}

// --- Modal ---
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskDescription = document.getElementById("taskDescription");
const taskStatus = document.getElementById("taskStatus");
const deleteBtn = document.getElementById("deleteTaskBtn");

document.getElementById("addTaskBtn").addEventListener("click", () => {
  editingId = null;
  modalTitle.textContent = "Nueva tarea";
  taskForm.reset();
  taskStatus.value = "pending";
  deleteBtn.classList.add("hidden");
  modal.classList.remove("hidden");
});

document.getElementById("closeModal").addEventListener("click", () => {
  modal.classList.add("hidden");
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

function openEditModal(task) {
  editingId = task.id;
  modalTitle.textContent = "Editar tarea";
  taskTitle.value = task.title;
  taskDescription.value = task.description || "";
  taskStatus.value = task.status;
  deleteBtn.classList.remove("hidden");
  modal.classList.remove("hidden");
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const body = {
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    status: taskStatus.value,
    lastModifiedBy: getUser(),
  };

  if (!body.title) return;

  if (editingId) {
    fetch(`/api/tasks/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else {
    body.createdBy = getUser();
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  modal.classList.add("hidden");
  taskForm.reset();
  editingId = null;
});

deleteBtn.addEventListener("click", () => {
  if (editingId && confirm("¿Eliminar esta tarea?")) {
    fetch(`/api/tasks/${editingId}`, { method: "DELETE" });
    modal.classList.add("hidden");
    editingId = null;
  }
});

// --- Helpers ---
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
