/* ============================================================
   Kanban v2 — Frontend App
   ============================================================ */

// --- State ---
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

// --- Data layer (localStorage) ---
function genId() { return Math.random().toString(36).substring(2, 10) + Date.now().toString(36); }
function now() { return new Date().toISOString(); }
function readData() {
  try { return JSON.parse(localStorage.getItem("kanban_data") || "{}"); } catch { return {}; }
}
function writeData(data) { localStorage.setItem("kanban_data", JSON.stringify(data)); }
function ensureData(pid) {
  const d = readData();
  d.projects = d.projects || {};
  d.tasks = d.tasks || {};
  d.comments = d.comments || {};
  d.checklists = d.checklists || {};
  d.reactions = d.reactions || {};
  d.activity = d.activity || {};
  if (pid) { d.tasks[pid] = d.tasks[pid] || []; d.comments[pid] = d.comments[pid] || {}; d.checklists[pid] = d.checklists[pid] || {}; d.reactions[pid] = d.reactions[pid] || {}; d.activity[pid] = d.activity[pid] || []; }
  return d;
}

function logActivity(pid, type, taskId, taskTitle, extra) {
  const d = ensureData(pid);
  d.activity[pid].unshift({ type, taskId, taskTitle, user: currentUser, timestamp: now(), ...extra });
  writeData(d);
  if (pid === currentProjectId) activity = d.activity[pid];
}

function seedDemoData() {
  if (localStorage.getItem("kanban_data")) return;
  // Auto-join demo project
  const joined = getJoined();
  if (!joined.demo1) { joined.demo1 = ""; saveJoined(joined); }
  const tasks = [
    { id: "t1", projectId: "demo1", title: "Diseñar landing page", description: "Crear prototipo en Figma", status: "completed", priority: "p1", tags: ["diseño"], deadline: null, assignee: "Ana", createdBy: "Demo", lastModifiedBy: "Demo", createdAt: "2026-05-01T10:00:00Z", updatedAt: "2026-05-01T10:00:00Z" },
    { id: "t2", projectId: "demo1", title: "Implementar navbar responsive", description: "", status: "in-progress", priority: "p1", tags: ["frontend"], deadline: "2026-05-20T00:00:00Z", assignee: "Carlos", createdBy: "Demo", lastModifiedBy: "Demo", createdAt: "2026-05-02T10:00:00Z", updatedAt: "2026-05-02T10:00:00Z" },
    { id: "t3", projectId: "demo1", title: "Configurar CI/CD", description: "GitHub Actions para deploy automático", status: "in-review", priority: "p2", tags: ["devops"], deadline: null, assignee: "", createdBy: "Demo", lastModifiedBy: "Demo", createdAt: "2026-05-03T10:00:00Z", updatedAt: "2026-05-03T10:00:00Z" },
    { id: "t4", projectId: "demo1", title: "Escribir tests unitarios", description: "Cubrir módulo de autenticación", status: "pending", priority: "p2", tags: ["testing"], deadline: "2026-05-25T00:00:00Z", assignee: "Ana", createdBy: "Demo", lastModifiedBy: "Demo", createdAt: "2026-05-04T10:00:00Z", updatedAt: "2026-05-04T10:00:00Z" },
    { id: "t5", projectId: "demo1", title: "Optimizar imágenes", description: "WebP + lazy loading", status: "pending", priority: "p3", tags: ["rendimiento"], deadline: null, assignee: "", createdBy: "Demo", lastModifiedBy: "Demo", createdAt: "2026-05-05T10:00:00Z", updatedAt: "2026-05-05T10:00:00Z" },
    { id: "t6", projectId: "demo1", title: "Bug: login no funciona en Safari", description: "Error de cookies third-party", status: "pending", priority: "p0", tags: ["bug","urgente"], deadline: "2026-05-18T00:00:00Z", assignee: "Carlos", createdBy: "Demo", lastModifiedBy: "Demo", createdAt: "2026-05-06T10:00:00Z", updatedAt: "2026-05-06T10:00:00Z" },
  ];
  const d = {
    projects: {
      demo1: {
        id: "demo1", name: "Demo Kanban", description: "Proyecto de demostración", password: "",
        columns: ["pending","in-progress","in-review","completed"],
        columnLabels: { pending: "Pendientes", "in-progress": "En Proceso", "in-review": "En Revisión", completed: "Completadas" },
        columnColors: { pending: "#58a6ff", "in-progress": "#d29922", "in-review": "#bc8cff", completed: "#3fb950" },
        wipLimits: {}, createdBy: "Demo",
      },
    },
    tasks: { demo1: tasks },
    comments: {},
    checklists: {},
    reactions: {},
    activity: {},
  };
  writeData(d);
}

const COLORS = ["#58a6ff","#3fb950","#d29922","#bc8cff","#db61a2","#39d2c0","#f85149","#e6edf3"];

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  seedDemoData();
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
    const hash = window.location.hash.slice(1);
    if (hash) handleRoute();
  } else {
    showLogin();
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("kanban_user");
    currentUser = "";
    document.getElementById("app").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("loginInput").focus();
  });
});

// --- Login ---
function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginInput").focus();
}

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
function loadProjects() {
  const d = readData();
  projects = Object.values(d.projects || {});
  renderProjects();
}

function showProjectsView() {
  if (currentProjectId) {
    currentProjectId = null;
  }
  document.getElementById("backBtn").classList.add("hidden");
  document.getElementById("toggleSearchBtn").classList.add("hidden");
  document.getElementById("searchWrap").classList.add("hidden");
  document.getElementById("topbarTitle").textContent = "Kanban";
  loadProjects();
}

function getJoined() {
  try { return JSON.parse(localStorage.getItem("kanban_joined") || "{}"); } catch { return {}; }
}
function saveJoined(joined) { localStorage.setItem("kanban_joined", JSON.stringify(joined)); }

function showConfirm(title, message, btnText) {
  return new Promise((resolve) => {
    const old = document.getElementById("confirmOverlay");
    if (old) old.remove();
    const tpl = document.getElementById("confirmDialog");
    document.body.appendChild(tpl.content.cloneNode(true));
    const overlay = document.getElementById("confirmOverlay");
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    document.getElementById("confirmOk").textContent = btnText || "Eliminar";
    overlay.classList.remove("hidden");
    document.getElementById("confirmCancel").addEventListener("click", () => { overlay.remove(); resolve(false); });
    document.getElementById("confirmOk").addEventListener("click", () => { overlay.remove(); resolve(true); });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

function renderProjects() {
  const tpl = document.getElementById("projectsView");
  const main = document.getElementById("main");
  main.innerHTML = tpl.innerHTML;

  const joined = getJoined();
  const joinedIds = new Set(Object.keys(joined));
  const allData = readData();
  const tasksByProject = allData.tasks || {};

  const list = document.getElementById("projectsList");
  list.innerHTML = "";

  const joinedSection = document.getElementById("joinedProjects");
  const joinedList = document.createElement("div");
  joinedList.className = "projects-grid";
  let hasJoined = false;

  projects.forEach((p) => {
    const card = document.getElementById("projectCard").content.cloneNode(true);
    const div = card.querySelector(".project-card");
    div.dataset.id = p.id;
    div.querySelector(".project-name").textContent = p.name;
    div.querySelector(".project-desc").textContent = p.description || "Sin descripción";
    div.querySelector(".project-id-label code").textContent = p.id;
    div.querySelector(".project-tasks-count").textContent = `${(tasksByProject[p.id] || []).length} tareas`;

    if (joinedIds.has(p.id) || p.createdBy === currentUser) {
      hasJoined = true;
      div.classList.add("joined");
      const badge = document.createElement("span");
      badge.className = "joined-badge";
      badge.textContent = "✓";
      div.querySelector(".project-card-header").appendChild(badge);
      if (!joinedIds.has(p.id)) { joined[p.id] = ""; saveJoined(joined); }
      div.addEventListener("click", (e) => {
        if (e.target.closest(".project-delete")) return;
        navigate(`/project/${p.id}`);
      });
      joinedList.appendChild(div);
    } else {
      div.addEventListener("click", (e) => {
        if (e.target.closest(".project-delete")) return;
        const d = readData();
        const proj = d.projects[p.id];
        if (proj && proj.password && proj.password !== "") {
          const pw = prompt(`Ingresa la clave del proyecto "${p.name}":`);
          if (pw === null) return;
          if (pw !== proj.password) { alert("Clave incorrecta"); return; }
        }
        joined[p.id] = "";
        saveJoined(joined);
        navigate(`/project/${p.id}`);
      });
      list.appendChild(div);
    }

    div.querySelector(".project-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      const ok = await showConfirm("Eliminar proyecto", `¿Eliminar "${p.name}" y todas sus tareas?`, "Eliminar");
      if (!ok) return;
      const d = readData();
      delete d.projects[p.id];
      delete d.tasks[p.id];
      delete d.comments[p.id];
      delete d.checklists[p.id];
      delete d.reactions[p.id];
      writeData(d);
      delete joined[p.id];
      saveJoined(joined);
      loadProjects();
    });
  });

  if (hasJoined) {
    joinedSection.innerHTML = "<h3>Mis proyectos</h3>";
    joinedSection.appendChild(joinedList);
  } else {
    joinedSection.innerHTML = "";
  }

  document.getElementById("newProjectBtn").addEventListener("click", () => {
    const name = prompt("Nombre del proyecto:");
    if (!name || !name.trim()) return;
    const password = prompt("Clave del proyecto (dejar vacío para público):") || "";
    const d = ensureData();
    const id = genId();
    d.projects[id] = {
      id, name: name.trim(), password,
      columns: ["pending","in-progress","in-review","completed"],
      columnLabels: { pending: "Pendientes", "in-progress": "En Proceso", "in-review": "En Revisión", completed: "Completadas" },
      columnColors: { pending: "#58a6ff", "in-progress": "#d29922", "in-review": "#bc8cff", completed: "#3fb950" },
      wipLimits: {},
      createdBy: currentUser,
    };
    writeData(d);
    joined[id] = password;
    saveJoined(joined);
    loadProjects();
  });

  document.getElementById("joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("joinId").value.trim();
    const password = document.getElementById("joinPassword").value;
    const errEl = document.getElementById("joinError");
    const d = readData();
    const proj = d.projects[id];
    if (proj && (!proj.password || proj.password === password)) {
      joined[id] = password;
      saveJoined(joined);
      errEl.classList.add("hidden");
      navigate(`/project/${id}`);
    } else {
      errEl.textContent = "ID o clave incorrectos";
      errEl.classList.remove("hidden");
    }
  });

  document.getElementById("importBtn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const projectsData = Array.isArray(data) ? data : [data];
        const d = ensureData();
        for (const item of projectsData) {
          const p = item.project || item;
          const id = p.id || genId();
          d.projects[id] = {
            id,
            name: p.name || p.project?.name || "Importado",
            description: p.description || p.project?.description || "",
            password: p.password || "",
            columns: p.columns || p.project?.columns || ["pending","in-progress","in-review","completed"],
            columnLabels: p.columnLabels || p.project?.columnLabels || {},
            columnColors: p.columnColors || p.project?.columnColors || {},
            wipLimits: p.wipLimits || p.project?.wipLimits || {},
            createdBy: currentUser,
          };
          if (item.tasks) d.tasks[id] = item.tasks;
          if (item.comments) d.comments[id] = item.comments;
          if (item.checklists) d.checklists[id] = item.checklists;
          if (item.reactions) d.reactions[id] = item.reactions;
        }
        writeData(d);
        alert(`${projectsData.length} proyecto(s) importado(s)`);
        loadProjects();
      } catch (err) {
        alert("Error al importar: " + err.message);
      }
    };
    input.click();
  });
}

// --- Project View ---
function openProject(pid) {
  currentProjectId = pid;
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("toggleSearchBtn").classList.remove("hidden");

  const d = readData();
  const project = d.projects[pid];
  if (!project) { showProjectsView(); return; }
  document.getElementById("topbarTitle").textContent = project.name;

  const joined = getJoined();
  if (!(pid in joined)) {
    showProjectsView();
    return;
  }

  tasks = d.tasks[pid] || [];
  activity = d.activity[pid] || [];
  onlineUsers = [{ username: currentUser, online: true }];

  renderKanban(project);
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
      // Offline: no-op
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
    if (limit === undefined || limit === null) return `<span>${label}: ${count}</span>`;
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

    const color = project.columnColors?.[colId];
    colEl.innerHTML = `
      <div class="col-header"${color ? ` style="background:${color}"` : ""}>
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
      renderReactionsForCard(task.id);
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
        const oldStatus = task.status;
        const d = ensureData(currentProjectId);
        const idx = d.tasks[currentProjectId].findIndex((t) => t.id === tid);
        if (idx !== -1) {
          d.tasks[currentProjectId][idx].status = colId;
          writeData(d);
        }
        task.status = colId;
        logActivity(currentProjectId, "move", tid, task.title, { from: oldStatus, to: colId });
        renderBoard();
        renderListView();
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
  container.innerHTML = `<div class="list-table-wrap"><table class="list-table">
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
          <td>${(t.tags || []).map(esc).join(", ") || "—"}</td>
          <td>${t.deadline ? formatDate(t.deadline) : "—"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table></div>`;
  container.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const task = tasks.find((t) => t.id === row.dataset.id);
      if (task) openTaskModal(task);
    });
  });
}

// --- Task Modal ---
function openTaskModal(task) {
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
  if (document.getElementById("modal-overlay")) return document.getElementById("modal-overlay");
  const tpl = document.getElementById("taskModal");
  document.body.appendChild(tpl.content.cloneNode(true));
  const overlay = document.getElementById("modal-overlay");

  document.getElementById("modalClose").addEventListener("click", () => closeTaskModal());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeTaskModal(); });

  // Save on Enter (title)
  document.getElementById("modalTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTask(); }
  });

  document.getElementById("deleteTaskBtn").addEventListener("click", async () => {
    if (!editingTaskId) return;
    const ok = await showConfirm("Eliminar tarea", "¿Eliminar esta tarea para siempre?", "Eliminar");
    if (!ok) return;
    const d = ensureData(currentProjectId);
    const delTask = d.tasks[currentProjectId].find((t) => t.id === editingTaskId);
    d.tasks[currentProjectId] = d.tasks[currentProjectId].filter((t) => t.id !== editingTaskId);
    delete d.comments[currentProjectId][editingTaskId];
    delete d.checklists[currentProjectId][editingTaskId];
    delete d.reactions[currentProjectId][editingTaskId];
    writeData(d);
    tasks = d.tasks[currentProjectId];
    if (delTask) logActivity(currentProjectId, "delete", editingTaskId, delTask.title);
    closeTaskModal();
    renderBoard();
    renderListView();
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
      const d = ensureData(currentProjectId);
      d.comments[currentProjectId][editingTaskId] = d.comments[currentProjectId][editingTaskId] || [];
      d.comments[currentProjectId][editingTaskId].push({ id: genId(), text, user: currentUser, createdAt: now() });
      writeData(d);
      comments[editingTaskId] = d.comments[currentProjectId][editingTaskId];
      renderComments(editingTaskId);
      input.value = "";
    }
  });

  // Checklist form
  document.getElementById("checklistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("checklistInput");
    const text = input.value.trim();
    if (text && editingTaskId) {
      const d = ensureData(currentProjectId);
      d.checklists[currentProjectId][editingTaskId] = d.checklists[currentProjectId][editingTaskId] || [];
      d.checklists[currentProjectId][editingTaskId].push({ id: genId(), text, done: false });
      writeData(d);
      checklists[editingTaskId] = d.checklists[currentProjectId][editingTaskId];
      renderChecklist(editingTaskId);
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

  const d = ensureData(currentProjectId);
  if (editingTaskId) {
    const idx = d.tasks[currentProjectId].findIndex((t) => t.id === editingTaskId);
    if (idx !== -1) Object.assign(d.tasks[currentProjectId][idx], body, { updatedAt: now() });
    writeData(d);
    tasks = d.tasks[currentProjectId];
    logActivity(currentProjectId, "edit", editingTaskId, body.title);
    closeTaskModal();
    renderBoard();
    renderListView();
  } else {
    body.createdBy = currentUser;
    body.id = genId();
    body.projectId = currentProjectId;
    body.createdAt = now();
    body.updatedAt = now();
    d.tasks[currentProjectId].push(body);
    writeData(d);
    tasks = d.tasks[currentProjectId];
    logActivity(currentProjectId, "create", body.id, body.title);
    closeTaskModal();
    renderBoard();
    renderListView();
  }
}

let autoSaveTimer = null;
function autoSaveTask() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const title = document.getElementById("modalTitle").value.trim();
    if (!title) return;
    if (!editingTaskId) { saveTask(); return; }
    const body = {
      title,
      description: document.getElementById("modalDesc").value.trim(),
      priority: document.getElementById("modalPriority").value,
      status: document.getElementById("modalStatus").value,
      assignee: document.getElementById("modalAssignee").value,
      deadline: document.getElementById("modalDeadline").value || null,
      lastModifiedBy: currentUser,
    };
    const d = ensureData(currentProjectId);
    const idx = d.tasks[currentProjectId].findIndex((t) => t.id === editingTaskId);
    if (idx !== -1) Object.assign(d.tasks[currentProjectId][idx], body, { updatedAt: now() });
    writeData(d);
    tasks = d.tasks[currentProjectId];
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
  const d = ensureData(currentProjectId);
  const idx = d.tasks[currentProjectId].findIndex((t) => t.id === editingTaskId);
    if (idx !== -1) Object.assign(d.tasks[currentProjectId][idx], body, { updatedAt: now() });
    writeData(d);
    tasks = d.tasks[currentProjectId];
    renderBoard();
    renderListView();
}

function closeTaskModal() {
  clearTimeout(autoSaveTimer);
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.classList.add("hidden");
  editingTaskId = null;
  renderBoard();
  renderListView();
}

// --- Comments ---
function loadComments(taskId) {
  const d = readData();
  comments[taskId] = d.comments[currentProjectId]?.[taskId] || [];
  renderComments(taskId);
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
function loadChecklist(taskId) {
  const d = readData();
  checklists[taskId] = d.checklists[currentProjectId]?.[taskId] || [];
  renderChecklist(taskId);
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
      const d = ensureData(currentProjectId);
      const items = d.checklists[currentProjectId]?.[taskId] || [];
      const item = items.find((i) => i.id === cb.dataset.id);
      if (item) item.done = cb.checked;
      writeData(d);
      checklists[taskId] = items;
    });
  });
  container.querySelectorAll(".check-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = ensureData(currentProjectId);
      const items = (d.checklists[currentProjectId]?.[taskId] || []).filter((i) => i.id !== btn.dataset.id);
      d.checklists[currentProjectId][taskId] = items;
      writeData(d);
      checklists[taskId] = items;
      renderChecklist(taskId);
    });
  });
}

// --- Reactions ---
function renderReactionsForCard(taskId) {
  const container = document.getElementById(`reactions-${taskId}`);
  if (!container) return;
  const d = readData();
  reactions[taskId] = d.reactions[currentProjectId]?.[taskId] || {};
  renderReactions(taskId);
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
      const d = ensureData(currentProjectId);
      d.reactions[currentProjectId][taskId] = d.reactions[currentProjectId][taskId] || {};
      const users = d.reactions[currentProjectId][taskId][emoji] || [];
      const idx = users.indexOf(currentUser);
      if (idx === -1) users.push(currentUser);
      else users.splice(idx, 1);
      if (users.length === 0) delete d.reactions[currentProjectId][taskId][emoji];
      else d.reactions[currentProjectId][taskId][emoji] = users;
      writeData(d);
      reactions[taskId] = d.reactions[currentProjectId][taskId];
      renderReactions(taskId);
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
  const colors = project.columnColors || {};
  const palette = ["#58a6ff","#d29922","#bc8cff","#3fb950","#db61a2","#39d2c0","#f0883e","#e6edf3"];

  function renderCols() {
    list.innerHTML = cols.map((c, i) =>
      `<div class="col-edit-item">
        <span class="col-color-dot" style="background:${colors[c] || palette[i % palette.length]}"></span>
        <input type="text" value="${esc(c)}" data-idx="${i}" class="col-key" placeholder="ID" />
        <input type="text" value="${esc(labels[c] || c)}" data-idx="${i}" class="col-label" placeholder="Nombre" />
        <input type="number" value="${project.wipLimits?.[c] || ""}" data-idx="${i}" class="col-wip" placeholder="WIP" style="width:60px" />
        <button class="col-del" data-idx="${i}">✕</button>
      </div>`
    ).join("");
    list.querySelectorAll(".col-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const key = cols[idx];
        delete labels[key];
        cols.splice(idx, 1);
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
    const newColors = {};
    const palette = ["#58a6ff","#d29922","#bc8cff","#3fb950","#db61a2","#39d2c0","#f0883e","#e6edf3"];
    list.querySelectorAll(".col-edit-item").forEach((item, i) => {
      const key = item.querySelector(".col-key").value.trim();
      const label = item.querySelector(".col-label").value.trim();
      const wip = parseInt(item.querySelector(".col-wip").value) || 0;
      if (key) {
        newCols.push(key);
        newLabels[key] = label || key;
        newColors[key] = palette[i % palette.length];
        if (wip > 0) newWip[key] = wip;
      }
    });
    const d = readData();
    if (d.projects[currentProjectId]) {
      Object.assign(d.projects[currentProjectId], { columns: newCols, columnLabels: newLabels, columnColors: newColors, wipLimits: newWip });
      writeData(d);
    }
    overlay.remove();
    openProject(currentProjectId);
  });
}

// --- Export ---
function exportProject() {
  const d = readData();
  const data = {
    project: d.projects[currentProjectId],
    tasks: d.tasks[currentProjectId] || [],
    comments: d.comments[currentProjectId] || {},
    checklists: d.checklists[currentProjectId] || {},
    reactions: d.reactions[currentProjectId] || {},
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kanban-${currentProjectId}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
