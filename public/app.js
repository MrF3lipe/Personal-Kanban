/* ============================================================
   Kanban v2 — Frontend App
   ============================================================ */

// --- State ---
const socket = io(BACKEND_URL);
let currentUser = localStorage.getItem("kanban_user") || "";
let theme = localStorage.getItem("kanban_theme") || "dark";
let projects = [];
let tasks = [];
let comments = {};
let checklists = {};
let reactions = {};
let activity = [];
let currentProjectId = null;
let editingTaskId = null;
let onlineUsers = [];
let activeFilters = { priority: "", assignee: "", tag: "" };
let viewMode = "board"; // board | list
let usersMap = {}; // userId -> username cache

const COLORS = ["#58a6ff","#3fb950","#d29922","#bc8cff","#db61a2","#39d2c0","#f85149","#e6edf3"];

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.setAttribute("data-theme", theme);
  initLogin();
  initRouting();
  initThemeToggle();
  initKeyboard();

  if (currentUser) {
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("userBadge").textContent = currentUser;
    loadProjects();
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (currentProjectId) {
      socket.emit("leave:project", { projectId: currentProjectId });
    }
    localStorage.removeItem("kanban_user");
    currentUser = "";
    document.getElementById("app").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("loginInput").focus();
  });
});

// --- Login ---
function initLogin() {
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("loginInput").value.trim();
    if (name) {
      currentUser = name;
      localStorage.setItem("kanban_user", name);
      document.getElementById("userBadge").textContent = name;
      document.getElementById("loginScreen").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      loadProjects();
    }
  });
}

// --- Routing ---
function initRouting() {
  window.addEventListener("hashchange", handleRoute);
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || "/";
  if (hash.startsWith("/project/")) {
    const pid = hash.split("/project/")[1];
    openProject(pid);
  } else {
    showProjectsView();
  }
}

function navigate(hash) {
  window.location.hash = hash;
}

// --- Projects ---
async function loadProjects() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects`);
    projects = await res.json();
    renderProjects();
  } catch (e) {
    console.error("Error loading projects", e);
  }
}

function showProjectsView() {
  if (currentProjectId) {
    socket.emit("leave:project", { projectId: currentProjectId });
    currentProjectId = null;
  }
  document.getElementById("backBtn").classList.add("hidden");
  document.getElementById("toggleSearchBtn").classList.add("hidden");
  document.getElementById("searchWrap").classList.add("hidden");
  document.getElementById("topbarTitle").textContent = "Kanban";
  loadProjects();
}

function renderProjects() {
  const tpl = document.getElementById("projectsView");
  const main = document.getElementById("main");
  main.innerHTML = tpl.innerHTML;

  const list = document.getElementById("projectsList");
  list.innerHTML = "";

  projects.forEach((p) => {
    const card = document.getElementById("projectCard").content.cloneNode(true);
    const div = card.querySelector(".project-card");
    div.dataset.id = p.id;
    div.querySelector(".project-name").textContent = p.name;
    div.querySelector(".project-desc").textContent = p.description || "Sin descripción";
    div.querySelector(".project-id-label code").textContent = p.id;
    const taskCount = tasks.length || 0;
    div.querySelector(".project-tasks-count").textContent = `${taskCount} tareas`;

    div.querySelector(".project-card").addEventListener("click", (e) => {
      if (e.target.closest(".project-delete")) return;
      navigate(`/project/${p.id}`);
    });

    div.querySelector(".project-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar el proyecto "${p.name}"?`)) return;
      await fetch(`${BACKEND_URL}/api/projects/${p.id}`, { method: "DELETE" });
      loadProjects();
    });

    list.appendChild(card);
  });

  document.getElementById("newProjectBtn").addEventListener("click", () => {
    const name = prompt("Nombre del proyecto:");
    if (name && name.trim()) {
      fetch(`${BACKEND_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), createdBy: currentUser }),
      }).then(() => loadProjects());
    }
  });
}

// --- Project View ---
async function openProject(pid) {
  currentProjectId = pid;
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("toggleSearchBtn").classList.remove("hidden");

  const res = await fetch(`${BACKEND_URL}/api/projects/${pid}`);
  if (!res.ok) { navigate("/"); return; }
  const project = await res.json();
  document.getElementById("topbarTitle").textContent = project.name;

  // Load tasks
  const tRes = await fetch(`${BACKEND_URL}/api/projects/${pid}/tasks`);
  tasks = await tRes.json();

  // Load activity
  const aRes = await fetch(`${BACKEND_URL}/api/projects/${pid}/activity`);
  activity = await aRes.json();

  renderKanban(project);
  setupSocket(pid);
}

function setupSocket(pid) {
  socket.emit("join:project", { projectId: pid, username: currentUser });

  socket.off("tasks:updated");
  socket.on("tasks:updated", (data) => {
    tasks = data;
    renderBoard();
    renderListView();
  });

  socket.off("users:updated");
  socket.on("users:updated", (users) => {
    onlineUsers = users;
    renderUsers();
  });

  socket.off("comments:updated");
  socket.on("comments:updated", ({ taskId, comments: cmts }) => {
    comments[taskId] = cmts;
    if (editingTaskId === taskId) renderComments(taskId);
  });

  socket.off("checklist:updated");
  socket.on("checklist:updated", ({ taskId, checklist: cl }) => {
    checklists[taskId] = cl;
    if (editingTaskId === taskId) renderChecklist(taskId);
  });

  socket.off("reactions:updated");
  socket.on("reactions:updated", ({ taskId, reactions: r }) => {
    reactions[taskId] = r;
    renderReactions(taskId);
  });
}

function renderUsers() {
  const container = document.getElementById("usersOnline");
  if (!container) return;
  container.innerHTML = "";
  onlineUsers.forEach((u) => {
    const dot = document.createElement("div");
    dot.className = `user-dot ${u.online ? "online" : "offline"}`;
    const initials = u.username.substring(0, 2).toUpperCase();
    dot.textContent = initials;
    const tip = document.createElement("div");
    tip.className = "dot-tooltip";
    tip.textContent = `${u.username} (${u.online ? "en línea" : "ausente"})`;
    dot.appendChild(tip);
    container.appendChild(dot);
  });
  // Toggle own status
  if (onlineUsers.some((u) => u.username === currentUser)) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "topbar-btn";
    toggleBtn.title = "Cambiar estado";
    toggleBtn.innerHTML = onlineUsers.find((u) => u.username === currentUser)?.online ? "●" : "○";
    toggleBtn.addEventListener("click", () => {
      socket.emit("user:toggle", { projectId: currentProjectId });
    });
    container.appendChild(toggleBtn);
  }
}

// --- Kanban Render ---
function renderKanban(project) {
  const tpl = document.getElementById("kanbanView");
  const main = document.getElementById("main");
  main.innerHTML = tpl.innerHTML;

  setupKanbanToolbar(project);
  renderBoard();
  renderUsers();

  document.getElementById("addTaskBtn").addEventListener("click", () => openTaskModal(null));
  document.getElementById("editColumnsBtn").addEventListener("click", () => openColumnsModal(project));
  document.getElementById("viewListBtn").addEventListener("click", toggleView);
  document.getElementById("exportBtn").addEventListener("click", exportProject);
}

function setupKanbanToolbar(project) {
  // Assignee filter
  const assigneeSel = document.getElementById("filterAssignee");
  const allUsers = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))];
  assigneeSel.innerHTML = `<option value="">Asignado</option>${allUsers.map((u) => `<option value="${u}">${u}</option>`).join("")}`;

  // Tag filter
  const tagSel = document.getElementById("filterTag");
  const allTags = [...new Set(tasks.flatMap((t) => t.tags || []))];
  tagSel.innerHTML = `<option value="">Etiqueta</option>${allTags.map((t) => `<option value="${t}">${t}</option>`).join("")}`;

  document.getElementById("filterPriority").addEventListener("change", applyFilters);
  document.getElementById("filterAssignee").addEventListener("change", applyFilters);
  document.getElementById("filterTag").addEventListener("change", applyFilters);

  // WIP
  renderWip(project);
}

function applyFilters() {
  activeFilters.priority = document.getElementById("filterPriority").value;
  activeFilters.assignee = document.getElementById("filterAssignee").value;
  activeFilters.tag = document.getElementById("filterTag").value;
  renderBoard();
}

function getFilteredTasks() {
  let filtered = [...tasks];
  if (activeFilters.priority) filtered = filtered.filter((t) => t.priority === activeFilters.priority);
  if (activeFilters.assignee) filtered = filtered.filter((t) => t.assignee === activeFilters.assignee);
  if (activeFilters.tag) filtered = filtered.filter((t) => (t.tags || []).includes(activeFilters.tag));
  return filtered;
}

function renderWip(project) {
  const cols = project.columns || ["pending","in-progress","in-review","completed"];
  const labels = project.columnLabels || {};
  const wip = project.wipLimits || {};
  const container = document.getElementById("wipIndicator");
  if (!container) return;
  container.innerHTML = cols.map((colId) => {
    const count = tasks.filter((t) => t.status === colId).length;
    const limit = wip[colId];
    const label = labels[colId] || colId;
    if (!limit) return `<span>${label}: ${count}</span>`;
    const cls = count > limit ? "wip-over" : count >= limit * 0.8 ? "wip-warn" : "";
    return `<span class="${cls}">${label}: ${count}/${limit}</span>`;
  }).join(" ");
}

// --- Board ---
function renderBoard() {
  const board = document.getElementById("board");
  if (!board) return;
  board.innerHTML = "";

  const project = projects.find((p) => p.id === currentProjectId);
  if (!project) return;

  const cols = project.columns || ["pending","in-progress","in-review","completed"];
  const labels = project.columnLabels || { pending: "Pendientes", "in-progress": "En Proceso", "in-review": "En Revisión", completed: "Completadas" };
  const filtered = getFilteredTasks();

  cols.forEach((colId) => {
    const colTasks = filtered.filter((t) => t.status === colId);
    const colEl = document.createElement("div");
    colEl.className = `column ${colId}`;
    colEl.dataset.column = colId;

    colEl.innerHTML = `
      <div class="col-header">
        <div class="col-header-left">
          <button class="col-collapse" title="Colapsar">◀</button>
          <span class="col-header-text">${labels[colId] || colId}</span>
        </div>
        <span class="count">${colTasks.length}</span>
      </div>
      <div class="col-body"></div>
    `;

    const body = colEl.querySelector(".col-body");

    colTasks.sort((a, b) => (a.order || 0) - (b.order || 0));

    colTasks.forEach((task) => {
      body.appendChild(createCard(task));
    });

    // Drag & drop
    colEl.addEventListener("dragover", (e) => { e.preventDefault(); colEl.classList.add("drag-over"); });
    colEl.addEventListener("dragleave", () => { colEl.classList.remove("drag-over"); });
    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      colEl.classList.remove("drag-over");
      const tid = e.dataTransfer.getData("text/plain");
      const task = tasks.find((t) => t.id === tid);
      if (task && task.status !== colId) {
        socket.emit("task:move", { id: tid, newStatus: colId, username: currentUser, projectId: currentProjectId });
      }
    });

    // Collapse
    colEl.querySelector(".col-collapse").addEventListener("click", () => {
      colEl.classList.toggle("collapsed");
    });

    board.appendChild(colEl);
  });

  renderWip(project);
}

function createCard(task) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = true;
  card.dataset.id = task.id;

  const deadlineHtml = task.deadline
    ? `<div class="card-deadline ${isOverdue(task.deadline) ? "overdue" : ""}">📅 ${formatDate(task.deadline)}</div>`
    : "";

  const tagsHtml = (task.tags || []).length
    ? `<div class="card-tags">${task.tags.map((t) => `<span class="card-tag">${esc(t)}</span>`).join("")}</div>`
    : "";

  card.innerHTML = `
    <div class="card-priority ${task.priority || "p3"}">${(task.priority || "p3").toUpperCase()}</div>
    <div class="card-title">${esc(task.title)}</div>
    ${task.description ? `<div class="card-desc">${esc(task.description.substring(0, 100))}</div>` : ""}
    ${tagsHtml}
    ${deadlineHtml}
    <div class="card-meta">
      <span class="card-user">${task.createdBy ? esc(task.createdBy) : ""}</span>
      ${task.assignee ? `<span class="card-assignee">${esc(task.assignee)}</span>` : ""}
    </div>
    <div id="reactions-${task.id}" class="reactions-row"></div>
    <div class="card-actions">
      <button class="card-edit" data-id="${task.id}">✏️</button>
    </div>
  `;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));

  card.addEventListener("click", (e) => {
    if (e.target.closest(".card-edit") || e.target.closest(".reaction-btn")) return;
    openTaskModal(task);
  });

  card.querySelector(".card-edit").addEventListener("click", (e) => {
    e.stopPropagation();
    openTaskModal(task);
  });

  // Touch support
  let touchStartX, touchStartY, touchDragging = false;
  card.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  card.addEventListener("touchmove", (e) => {
    if (Math.abs(e.touches[0].clientX - touchStartX) > 20 || Math.abs(e.touches[0].clientY - touchStartY) > 20) {
      touchDragging = true;
    }
  }, { passive: true });
  card.addEventListener("touchend", (e) => {
    if (!touchDragging) {
      openTaskModal(task);
    }
    touchDragging = false;
  }, { passive: true });

  renderReactionsForCard(task.id);

  return card;
}

// --- List View ---
function toggleView() {
  const board = document.getElementById("boardWrap");
  const list = document.getElementById("listView");
  const btn = document.getElementById("viewListBtn");
  if (!board || !list) return;
  if (viewMode === "board") {
    viewMode = "list";
    board.classList.add("hidden");
    list.classList.remove("hidden");
    renderListView();
    btn.textContent = "⊞";
    btn.title = "Vista tablero";
  } else {
    viewMode = "board";
    board.classList.remove("hidden");
    list.classList.add("hidden");
    btn.textContent = "☰";
    btn.title = "Vista lista";
  }
}

function renderListView() {
  const container = document.getElementById("listView");
  if (!container || viewMode !== "list") return;
  const project = projects.find((p) => p.id === currentProjectId);
  const labels = project?.columnLabels || {};
  container.innerHTML = `<table class="list-table">
    <thead><tr>
      <th>Título</th><th>Estado</th><th>Prioridad</th><th>Asignado</th><th>Etiquetas</th><th>Fecha</th>
    </tr></thead>
    <tbody>
      ${getFilteredTasks().map((t) => `
        <tr data-id="${t.id}" style="cursor:pointer">
          <td><strong>${esc(t.title)}</strong></td>
          <td><span class="lt-status lt-${t.status === "in-progress" ? "progress" : t.status === "in-review" ? "review" : t.status === "completed" ? "done" : "pending"}">${labels[t.status] || t.status}</span></td>
          <td>${(t.priority || "p3").toUpperCase()}</td>
          <td>${t.assignee ? esc(t.assignee) : "—"}</td>
          <td>${(t.tags || []).join(", ") || "—"}</td>
          <td>${t.deadline ? formatDate(t.deadline) : "—"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;
  container.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const task = tasks.find((t) => t.id === row.dataset.id);
      if (task) openTaskModal(task);
    });
  });
}

// --- Task Modal ---
async function openTaskModal(task) {
  editingTaskId = task ? task.id : null;
  const overlay = document.getElementById("modal-overlay") || createTaskModal();
  overlay.classList.remove("hidden");

  const title = document.getElementById("modalTitle");
  const desc = document.getElementById("modalDesc");
  const priority = document.getElementById("modalPriority");
  const status = document.getElementById("modalStatus");
  const assignee = document.getElementById("modalAssignee");
  const deadline = document.getElementById("modalDeadline");
  const createdBy = document.getElementById("modalCreatedBy");
  const modifiedBy = document.getElementById("modalModifiedBy");
  const deleteBtn = document.getElementById("deleteTaskBtn");

  // Populate status
  const project = projects.find((p) => p.id === currentProjectId);
  const labels = project?.columnLabels || {};
  const cols = project?.columns || ["pending","in-progress","in-review","completed"];
  status.innerHTML = cols.map((c) => `<option value="${c}">${labels[c] || c}</option>`).join("");

  // Populate assignee
  const allUsers = [...new Set([...onlineUsers.map((u) => u.username), ...tasks.map((t) => t.assignee).filter(Boolean)])];
  assignee.innerHTML = `<option value="">Sin asignar</option>${allUsers.map((u) => `<option value="${u}">${u}</option>`).join("")}`;

  if (task) {
    title.value = task.title || "";
    desc.value = task.description || "";
    priority.value = task.priority || "p3";
    status.value = task.status || "pending";
    assignee.value = task.assignee || "";
    deadline.value = task.deadline || "";
    createdBy.textContent = `Creado por ${task.createdBy || "?"}`;
    modifiedBy.textContent = `Última modificación: ${task.lastModifiedBy || "—"}`;
    deleteBtn.classList.remove("hidden");
    renderTags(task.tags || []);
    loadComments(task.id);
    loadChecklist(task.id);
  } else {
    title.value = "";
    desc.value = "";
    priority.value = "p3";
    status.value = cols[0] || "pending";
    assignee.value = "";
    deadline.value = "";
    createdBy.textContent = "";
    modifiedBy.textContent = "";
    deleteBtn.classList.add("hidden");
    document.getElementById("modalTags").innerHTML = "";
    document.getElementById("modalComments").innerHTML = "";
    document.getElementById("modalChecklist").innerHTML = "";
  }

  title.focus();
}

function createTaskModal() {
  const tpl = document.getElementById("taskModal");
  document.body.appendChild(tpl.content.cloneNode(true));
  const overlay = document.getElementById("modal-overlay") || document.querySelector(".modal-overlay");

  document.getElementById("modalClose").addEventListener("click", () => closeTaskModal());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeTaskModal(); });

  // Save on Enter (title)
  document.getElementById("modalTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTask(); }
  });

  document.getElementById("deleteTaskBtn").addEventListener("click", () => {
    if (editingTaskId && confirm("¿Eliminar esta tarea?")) {
      fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${editingTaskId}`, { method: "DELETE" });
      closeTaskModal();
    }
  });

  // Tag add
  document.getElementById("addTagBtn").addEventListener("click", () => {
    const input = document.getElementById("tagInput");
    const tag = input.value.trim();
    if (tag) {
      const container = document.getElementById("modalTags");
      const tags = getCurrentTags();
      if (!tags.includes(tag)) {
        tags.push(tag);
        renderTags(tags);
      }
      input.value = "";
    }
  });
  document.getElementById("tagInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("addTagBtn").click(); }
  });

  // Comment form
  document.getElementById("commentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("commentInput");
    const text = input.value.trim();
    if (text && editingTaskId) {
      fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${editingTaskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, user: currentUser }),
      });
      input.value = "";
    }
  });

  // Checklist form
  document.getElementById("checklistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("checklistInput");
    const text = input.value.trim();
    if (text && editingTaskId) {
      fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${editingTaskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      input.value = "";
    }
  });

  // Auto-save on blur of title/desc
  ["modalTitle", "modalDesc", "modalPriority", "modalStatus", "modalAssignee", "modalDeadline"].forEach((id) => {
    document.getElementById(id).addEventListener("change", autoSaveTask);
    if (id === "modalTitle" || id === "modalDesc") {
      document.getElementById(id).addEventListener("blur", autoSaveTask);
    }
  });

  return overlay;
}

function getCurrentTags() {
  const container = document.getElementById("modalTags");
  return [...container.querySelectorAll(".tag-item")].map((el) => el.dataset.tag).filter(Boolean);
}

function renderTags(tags) {
  const container = document.getElementById("modalTags");
  container.innerHTML = tags.map((t) =>
    `<span class="tag-item" data-tag="${esc(t)}">${esc(t)}<span class="tag-del" data-tag="${esc(t)}">✕</span></span>`
  ).join("");
  container.querySelectorAll(".tag-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const newTags = getCurrentTags().filter((t) => t !== tag);
      renderTags(newTags);
      saveTaskSilent({ tags: newTags });
    });
  });
}

function saveTask() {
  const title = document.getElementById("modalTitle").value.trim();
  if (!title) return;
  const body = {
    title,
    description: document.getElementById("modalDesc").value.trim(),
    priority: document.getElementById("modalPriority").value,
    status: document.getElementById("modalStatus").value,
    assignee: document.getElementById("modalAssignee").value,
    deadline: document.getElementById("modalDeadline").value || null,
    tags: getCurrentTags(),
    lastModifiedBy: currentUser,
  };

  if (editingTaskId) {
    fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${editingTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    closeTaskModal();
  } else {
    body.createdBy = currentUser;
    fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    closeTaskModal();
  }
}

let autoSaveTimer = null;
function autoSaveTask() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (!editingTaskId) return;
    const title = document.getElementById("modalTitle").value.trim();
    if (!title) return;
    const body = {
      title,
      description: document.getElementById("modalDesc").value.trim(),
      priority: document.getElementById("modalPriority").value,
      status: document.getElementById("modalStatus").value,
      assignee: document.getElementById("modalAssignee").value,
      deadline: document.getElementById("modalDeadline").value || null,
      lastModifiedBy: currentUser,
    };
    fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${editingTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, 800);
}

function saveTaskSilent(extra) {
  if (!editingTaskId) return;
  const body = {
    title: document.getElementById("modalTitle").value.trim(),
    tags: getCurrentTags(),
    lastModifiedBy: currentUser,
    ...extra,
  };
  fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${editingTaskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function closeTaskModal() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.classList.add("hidden");
  editingTaskId = null;
}

// --- Comments ---
async function loadComments(taskId) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}/comments`);
    comments[taskId] = await res.json();
    renderComments(taskId);
  } catch (e) {}
}

function renderComments(taskId) {
  const container = document.getElementById("modalComments");
  if (!container) return;
  const cmts = comments[taskId] || [];
  container.innerHTML = cmts.length
    ? cmts.map((c) =>
      `<div class="comment">
        <span class="comment-user">${esc(c.user)}</span>
        <span class="comment-time">${timeAgo(c.createdAt)}</span>
        <div class="comment-text">${esc(c.text)}</div>
      </div>`
    ).join("")
    : '<div style="color:var(--text3);font-size:0.85rem">Sin comentarios</div>';
}

// --- Checklists ---
async function loadChecklist(taskId) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}/checklist`);
    checklists[taskId] = await res.json();
    renderChecklist(taskId);
  } catch (e) {}
}

function renderChecklist(taskId) {
  const container = document.getElementById("modalChecklist");
  if (!container) return;
  const items = checklists[taskId] || [];
  container.innerHTML = items.length
    ? items.map((item) =>
      `<div class="checklist-item ${item.done ? "done" : ""}">
        <input type="checkbox" ${item.done ? "checked" : ""} data-id="${item.id}" />
        <span>${esc(item.text)}</span>
        <button class="check-del" data-id="${item.id}">✕</button>
      </div>`
    ).join("")
    : "";
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}/checklist/${cb.dataset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: cb.checked }),
      });
    });
  });
  container.querySelectorAll(".check-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}/checklist/${btn.dataset.id}`, { method: "DELETE" });
    });
  });
}

// --- Reactions ---
async function renderReactionsForCard(taskId) {
  const container = document.getElementById(`reactions-${taskId}`);
  if (!container) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}`);
    const task = await res.json();
    // Get reactions from reaction endpoint
    const rRes = await fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}/reactions`, { method: "POST" });
  } catch (e) {}
}

function renderReactions(taskId) {
  const r = reactions[taskId] || {};
  const container = document.getElementById(`reactions-${taskId}`);
  if (!container) return;
  const emojis = Object.keys(r);
  container.innerHTML = emojis.map((emoji) => {
    const users = r[emoji] || [];
    const isActive = users.includes(currentUser);
    return `<button class="reaction-btn ${isActive ? "active" : ""}" data-emoji="${emoji}" data-task="${taskId}">
      ${emoji} ${users.length}
    </button>`;
  }).join("");
  container.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const emoji = btn.dataset.emoji;
      const taskId = btn.dataset.task;
      fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/tasks/${taskId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, user: currentUser }),
      });
    });
  });
}

// --- Columns Editor ---
function openColumnsModal(project) {
  const existing = document.getElementById("columnsOverlay");
  if (existing) existing.remove();

  const tpl = document.getElementById("columnsModal");
  document.body.appendChild(tpl.content.cloneNode(true));

  const overlay = document.getElementById("columnsOverlay");
  overlay.classList.remove("hidden");

  const list = document.getElementById("columnsList");
  const cols = project.columns || ["pending","in-progress","in-review","completed"];
  const labels = project.columnLabels || {};

  function renderCols() {
    list.innerHTML = cols.map((c, i) =>
      `<div class="col-edit-item">
        <span style="color:var(--text3);font-size:0.8rem">${i + 1}.</span>
        <input type="text" value="${esc(c)}" data-idx="${i}" class="col-key" placeholder="ID" />
        <input type="text" value="${esc(labels[c] || c)}" data-idx="${i}" class="col-label" placeholder="Nombre" />
        <input type="number" value="${project.wipLimits?.[c] || ""}" data-idx="${i}" class="col-wip" placeholder="WIP" style="width:60px" />
        <button class="col-del" data-idx="${i}">✕</button>
      </div>`
    ).join("");
    list.querySelectorAll(".col-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        cols.splice(parseInt(btn.dataset.idx), 1);
        delete labels[cols[parseInt(btn.dataset.idx)]];
        renderCols();
      });
    });
  }
  renderCols();

  document.getElementById("addColumnBtn").addEventListener("click", () => {
    const input = document.getElementById("newColumnInput");
    const val = input.value.trim();
    if (val) {
      const id = val.toLowerCase().replace(/\s+/g, "-");
      cols.push(id);
      labels[id] = val;
      input.value = "";
      renderCols();
    }
  });

  document.getElementById("closeColumns").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById("saveColumnsBtn").addEventListener("click", () => {
    const newCols = [];
    const newLabels = {};
    const newWip = {};
    list.querySelectorAll(".col-edit-item").forEach((item) => {
      const key = item.querySelector(".col-key").value.trim();
      const label = item.querySelector(".col-label").value.trim();
      const wip = parseInt(item.querySelector(".col-wip").value) || 0;
      if (key) {
        newCols.push(key);
        newLabels[key] = label || key;
        if (wip > 0) newWip[key] = wip;
      }
    });
    fetch(`${BACKEND_URL}/api/projects/${currentProjectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: newCols, columnLabels: newLabels, wipLimits: newWip }),
    }).then(() => {
      overlay.remove();
      openProject(currentProjectId);
    });
  });
}

// --- Export ---
async function exportProject() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects/${currentProjectId}/export`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban-${currentProjectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {}
}

// --- Search ---
document.addEventListener("click", (e) => {
  if (e.target.id === "toggleSearchBtn") {
    const wrap = document.getElementById("searchWrap");
    wrap.classList.toggle("hidden");
    if (!wrap.classList.contains("hidden")) document.getElementById("searchInput").focus();
  }
});

// Debounced search
let searchTimer;
document.addEventListener("input", (e) => {
  if (e.target.id === "searchInput") {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = e.target.value.toLowerCase();
      const cards = document.querySelectorAll(".card");
      cards.forEach((card) => {
        const title = card.querySelector(".card-title")?.textContent.toLowerCase() || "";
        const desc = card.querySelector(".card-desc")?.textContent.toLowerCase() || "";
        card.style.display = title.includes(q) || desc.includes(q) ? "" : "none";
      });
    }, 200);
  }
});

// --- Keyboard Shortcuts ---
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

    switch (e.key) {
      case "n":
      case "N":
        if (currentProjectId) { e.preventDefault(); document.getElementById("addTaskBtn")?.click(); }
        break;
      case "Escape":
        closeTaskModal();
        const act = document.getElementById("activityPanel");
        if (act) act.classList.add("hidden");
        break;
      case "b":
      case "B":
        if (currentProjectId) { e.preventDefault(); document.getElementById("viewListBtn")?.click(); }
        break;
      case "f":
      case "F":
        e.preventDefault();
        document.getElementById("toggleSearchBtn")?.click();
        break;
      case "?":
        e.preventDefault();
        showHelp();
        break;
    }
  });
}

function showHelp() {
  alert(`Atajos de teclado:\n\n  N  — Nueva tarea\n  B  — Alternar vista tablero/lista\n  F  — Buscar\n  Esc — Cerrar modal\n  ?  — Mostrar ayuda`);
}

// --- Theme ---
function initThemeToggle() {
  document.getElementById("toggleThemeBtn").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kanban_theme", theme);
  });
}

// --- Activity ---
function toggleActivity() {
  const panel = document.getElementById("activityPanel");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) renderActivity();
}

function renderActivity() {
  const container = document.getElementById("activityList");
  if (!container) return;
  container.innerHTML = activity.map((a) => {
    const typeMap = { create: "creó", move: "movió", edit: "editó" };
    const detail = a.from && a.to
      ? ` de "${a.from}" a "${a.to}"`
      : "";
    return `<div class="activity-item">
      <span class="at-user">${esc(a.user)}</span> ${typeMap[a.type] || "modificó"} "${esc(a.taskTitle)}"${detail}
      <span class="at-time">${timeAgo(a.timestamp)}</span>
    </div>`;
  }).join("");
}

// Check for activity button click
document.addEventListener("click", (e) => {
  if (e.target.closest("#activityBtn")) {
    toggleActivity();
  }
  if (e.target.id === "closeActivity") {
    document.getElementById("activityPanel")?.classList.add("hidden");
  }
});

// --- Back button ---
document.getElementById("backBtn").addEventListener("click", () => {
  socket.emit("leave:project", { projectId: currentProjectId });
  currentProjectId = null;
  navigate("/");
});

// --- Utilities ---
function esc(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}
