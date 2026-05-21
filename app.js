/* ============================================================
   Kanban v2 — Frontend App (Firebase Realtime)
   ============================================================ */

// --- Firebase ---
firebase.initializeApp(firebaseConfig);
const fbDb = firebase.database();
const fbAuth = firebase.auth();

// --- State ---
let currentUser = localStorage.getItem("kanban_user") || "";
let theme = localStorage.getItem("kanban_theme") || "dark";
let projects = [];
let tasks = [];
let comments = {};
let checklists = {};
let reactions = {};
let currentProjectId = null;
let editingTaskId = null;
let onlineUsers = [];
let activeFilters = { priority: "", assignee: "", tag: "" };
let viewMode = "board";

// --- Firebase listeners refs ---
let fbListeners = { tasks: null, comments: {}, checklists: {}, reactions: {}, presence: null };

function detachListeners() {
  if (fbListeners.tasks) { fbListeners.tasks.off(); fbListeners.tasks = null; }
  Object.values(fbListeners.comments).forEach(r => r.off()); fbListeners.comments = {};
  Object.values(fbListeners.checklists).forEach(r => r.off()); fbListeners.checklists = {};
  Object.values(fbListeners.reactions).forEach(r => r.off()); fbListeners.reactions = {};
  if (fbListeners.presence) { fbListeners.presence.off(); fbListeners.presence = null; }
}

function listenTasks(pid) {
  if (fbListeners.tasks) fbListeners.tasks.off();
  fbListeners.tasks = fbDb.ref(`tasks/${pid}`);
  fbListeners.tasks.on("value", snap => {
    const data = snap.val();
    tasks = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];
    renderBoard();
    renderListView();
  });
}

function listenComments(taskId) {
  if (fbListeners.comments[taskId]) fbListeners.comments[taskId].off();
  fbListeners.comments[taskId] = fbDb.ref(`comments/${currentProjectId}/${taskId}`);
  fbListeners.comments[taskId].on("value", snap => {
    const data = snap.val();
    comments[taskId] = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];
    if (editingTaskId === taskId) renderComments(taskId);
  });
}

function listenChecklist(taskId) {
  if (fbListeners.checklists[taskId]) fbListeners.checklists[taskId].off();
  fbListeners.checklists[taskId] = fbDb.ref(`checklists/${currentProjectId}/${taskId}`);
  fbListeners.checklists[taskId].on("value", snap => {
    const data = snap.val();
    checklists[taskId] = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];
    if (editingTaskId === taskId) renderChecklist(taskId);
  });
}

function listenReactions(taskId) {
  if (fbListeners.reactions[taskId]) fbListeners.reactions[taskId].off();
  fbListeners.reactions[taskId] = fbDb.ref(`reactions/${currentProjectId}/${taskId}`);
  fbListeners.reactions[taskId].on("value", snap => {
    const data = snap.val() || {};
    const converted = {};
    Object.keys(data).forEach(emoji => {
      converted[emoji] = Object.keys(data[emoji]);
    });
    reactions[taskId] = converted;
    renderReactions(taskId);
  });
}

function listenPresence(pid) {
  if (fbListeners.presence) fbListeners.presence.off();
  fbListeners.presence = fbDb.ref(`presence/${pid}`);
  fbListeners.presence.on("value", snap => {
    const data = snap.val() || {};
    onlineUsers = Object.keys(data).map(u => ({ username: u, online: true }));
    renderUsers();
  });
}

// --- Auth ---
function ensureSignedIn() {
  return new Promise(resolve => {
    if (fbAuth.currentUser) return resolve(fbAuth.currentUser);
    const unsub = fbAuth.onAuthStateChanged(user => {
      if (unsub) unsub();
      resolve(user);
    });
  });
}

// --- Helpers ---
function now() { return new Date().toISOString(); }

function logActivity(pid, type, taskId, taskTitle, extra) {
  const ref = fbDb.ref(`activity/${pid}`).push();
  ref.set({ type, taskId, taskTitle, user: currentUser, timestamp: now(), ...extra });
}

const COLORS = ["#58a6ff","#3fb950","#d29922","#bc8cff","#db61a2","#39d2c0","#f85149","#e6edf3"];

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.setAttribute("data-theme", theme);
  initLogin();
  initRouting();
  initThemeToggle();
  initKeyboard();

  fbAuth.signInAnonymously().catch(console.error);

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
    detachListeners();
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
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("loginInput").value.trim();
    if (name) {
      currentUser = name;
      localStorage.setItem("kanban_user", name);
      document.getElementById("userBadge").textContent = name;
      document.getElementById("loginScreen").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      // Ensure anonymous auth is signed in
      if (!fbAuth.currentUser) await fbAuth.signInAnonymously();
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
  fbDb.ref("projects").once("value", snap => {
    const data = snap.val() || {};
    projects = Object.keys(data).map(k => ({ id: k, ...data[k] }));
    renderProjects();
  });
}

function showProjectsView() {
  detachListeners();
  if (currentProjectId) {
    fbDb.ref(`presence/${currentProjectId}/${currentUser}`).remove();
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

  const joinedSection = document.getElementById("joinedProjects");
  const joinedList = document.createElement("div");
  joinedList.className = "projects-grid";
  let hasJoined = false;

  // Only show projects the user created or has joined
  projects.forEach((p) => {
    if (!joinedIds.has(p.id) && p.createdBy !== currentUser) return;

    hasJoined = true;
    const card = document.getElementById("projectCard").content.cloneNode(true);
    const div = card.querySelector(".project-card");
    div.dataset.id = p.id;
    div.querySelector(".project-name").textContent = p.name;
    div.querySelector(".project-desc").textContent = p.description || "Sin descripción";
    div.querySelector(".project-id-label code").textContent = p.id;

    if (!joinedIds.has(p.id)) { joined[p.id] = ""; saveJoined(joined); }

    // Copy ID button
    div.querySelector(".copy-id-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(p.id).then(() => {
        const btn = e.currentTarget;
        btn.textContent = "✓";
        setTimeout(() => { btn.textContent = "📋"; }, 1500);
      });
    });

    // Delete button: only for creator
    if (p.createdBy !== currentUser) {
      div.querySelector(".project-delete").classList.add("hidden");
    } else {
      div.querySelector(".project-delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        const ok = await showConfirm("Eliminar proyecto", `¿Eliminar "${p.name}" y todas sus tareas?`, "Eliminar");
        if (!ok) return;
        const updates = {};
        updates[`projects/${p.id}`] = null;
        updates[`tasks/${p.id}`] = null;
        updates[`comments/${p.id}`] = null;
        updates[`checklists/${p.id}`] = null;
        updates[`reactions/${p.id}`] = null;
        updates[`activity/${p.id}`] = null;
        updates[`presence/${p.id}`] = null;
        await fbDb.ref().update(updates);
        delete joined[p.id];
        saveJoined(joined);
        loadProjects();
      });
    }

    div.addEventListener("click", (e) => {
      if (e.target.closest(".project-delete") || e.target.closest(".copy-id-btn")) return;
      navigate(`/project/${p.id}`);
    });

    joinedList.appendChild(div);
  });

  if (hasJoined) {
    joinedSection.innerHTML = "<h3>Mis proyectos</h3>";
    joinedSection.appendChild(joinedList);
  } else {
    joinedSection.innerHTML = "<p class='empty-state'>No tienes proyectos aún. Crea uno nuevo o únete a uno existente.</p>";
  }

  // Create project with custom ID
  document.getElementById("newProjectBtn").addEventListener("click", async () => {
    const name = prompt("Nombre del proyecto:");
    if (!name || !name.trim()) return;
    const customId = prompt("ID del proyecto (déjalo vacío para generar uno automático):");
    let id;
    if (customId && customId.trim()) {
      id = customId.trim().toLowerCase().replace(/\s+/g, "-");
      const snap = await fbDb.ref(`projects/${id}`).once("value");
      if (snap.exists()) {
        alert(`El ID "${id}" ya existe. Usa otro o déjalo vacío para generar uno automático.`);
        return;
      }
    } else {
      id = fbDb.ref("projects").push().key;
    }
    const password = prompt("Clave del proyecto (dejar vacío para público):") || "";
    await fbDb.ref(`projects/${id}`).set({
      id, name: name.trim(), password,
      columns: ["pending","in-progress","in-review","completed"],
      columnLabels: { pending: "Pendientes", "in-progress": "En Proceso", "in-review": "En Revisión", completed: "Completadas" },
      columnColors: { pending: "#58a6ff", "in-progress": "#d29922", "in-review": "#bc8cff", completed: "#3fb950" },
      wipLimits: {},
      createdBy: currentUser,
    });
    joined[id] = password;
    saveJoined(joined);
    navigate(`/project/${id}`);
  });

  // Join form
  document.getElementById("joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("joinId").value.trim();
    const password = document.getElementById("joinPassword").value;
    const errEl = document.getElementById("joinError");
    fbDb.ref(`projects/${id}`).once("value", snap => {
      const proj = snap.val();
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
        for (const item of projectsData) {
          const p = item.project || item;
          const ref = fbDb.ref("projects").push();
          const id = ref.key;
          ref.set({
            id,
            name: p.name || p.project?.name || "Importado",
            description: p.description || p.project?.description || "",
            password: p.password || "",
            columns: p.columns || p.project?.columns || ["pending","in-progress","in-review","completed"],
            columnLabels: p.columnLabels || p.project?.columnLabels || {},
            columnColors: p.columnColors || p.project?.columnColors || {},
            wipLimits: p.wipLimits || p.project?.wipLimits || {},
            createdBy: currentUser,
          });
          if (item.tasks) fbDb.ref(`tasks/${id}`).set(item.tasks);
          if (item.comments) fbDb.ref(`comments/${id}`).set(item.comments);
          if (item.checklists) fbDb.ref(`checklists/${id}`).set(item.checklists);
          if (item.reactions) fbDb.ref(`reactions/${id}`).set(item.reactions);
        }
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

  fbDb.ref(`projects/${pid}`).once("value", snap => {
    const project = snap.val();
    if (!project) { showProjectsView(); return; }
    document.getElementById("topbarTitle").textContent = project.name;

    const joined = getJoined();
    if (!(pid in joined)) {
      showProjectsView();
      return;
    }

    // Ensure project is in local array for renderBoard
    const idx = projects.findIndex(p => p.id === pid);
    if (idx === -1) projects.push({ id: pid, ...project });
    else projects[idx] = { id: pid, ...project };

    comments = {};
    checklists = {};
    reactions = {};
    activeFilters = { priority: "", assignee: "", tag: "" };

    listenTasks(pid);
    listenPresence(pid);

    // Set presence
    fbDb.ref(`presence/${pid}/${currentUser}`).onDisconnect().remove();
    fbDb.ref(`presence/${pid}/${currentUser}`).set({ online: true, lastSeen: Date.now() });

    renderKanban(project);
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

    colTasks.forEach((task, i) => {
      const card = createCard(task);
      card.style.setProperty("--i", i);
      body.appendChild(card);
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
        fbDb.ref(`tasks/${currentProjectId}/${tid}`).update({ status: colId });
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
    deadline.value = task.deadline ? task.deadline.split("T")[0] : "";
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
    const delTask = tasks.find((t) => t.id === editingTaskId);
    const tid = editingTaskId;
    const updates = {};
    updates[`tasks/${currentProjectId}/${tid}`] = null;
    updates[`comments/${currentProjectId}/${tid}`] = null;
    updates[`checklists/${currentProjectId}/${tid}`] = null;
    updates[`reactions/${currentProjectId}/${tid}`] = null;
    await fbDb.ref().update(updates);
    if (delTask) logActivity(currentProjectId, "delete", tid, delTask.title);
    closeTaskModal();
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
        saveTaskSilent({ tags: tags });
      }
      input.value = "";
    }
  });

  // Comment form
  document.getElementById("commentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("commentInput");
    const text = input.value.trim();
    if (text && editingTaskId) {
      fbDb.ref(`comments/${currentProjectId}/${editingTaskId}`).push({ text, user: currentUser, createdAt: now() });
      input.value = "";
    }
  });

  // Checklist form
  document.getElementById("checklistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("checklistInput");
    const text = input.value.trim();
    if (text && editingTaskId) {
      fbDb.ref(`checklists/${currentProjectId}/${editingTaskId}`).push({ text, done: false });
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
    fbDb.ref(`tasks/${currentProjectId}/${editingTaskId}`).update({ ...body, updatedAt: now() });
    logActivity(currentProjectId, "edit", editingTaskId, body.title);
    closeTaskModal();
  } else {
    const ref = fbDb.ref(`tasks/${currentProjectId}`).push();
    ref.set({
      ...body,
      id: ref.key,
      createdBy: currentUser,
      projectId: currentProjectId,
      createdAt: now(),
      updatedAt: now(),
      order: tasks.length,
    });
    logActivity(currentProjectId, "create", ref.key, body.title);
    closeTaskModal();
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
      tags: getCurrentTags(),
      lastModifiedBy: currentUser,
    };
    fbDb.ref(`tasks/${currentProjectId}/${editingTaskId}`).update({ ...body, updatedAt: now() });
  }, 800);
}

function saveTaskSilent(extra) {
  if (!editingTaskId) return;
  const title = document.getElementById("modalTitle").value.trim();
  if (!title) return;
  const body = {
    title,
    tags: getCurrentTags(),
    lastModifiedBy: currentUser,
    ...extra,
  };
  fbDb.ref(`tasks/${currentProjectId}/${editingTaskId}`).update({ ...body, updatedAt: now() });
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
  listenComments(taskId);
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
  listenChecklist(taskId);
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
      const item = (checklists[taskId] || []).find((i) => i.id === cb.dataset.id);
      if (item) {
        fbDb.ref(`checklists/${currentProjectId}/${taskId}/${cb.dataset.id}`).update({ done: cb.checked });
      }
    });
  });
  container.querySelectorAll(".check-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      fbDb.ref(`checklists/${currentProjectId}/${taskId}/${btn.dataset.id}`).remove();
    });
  });
}

// --- Reactions ---
function renderReactionsForCard(taskId) {
  listenReactions(taskId);
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
      const tId = btn.dataset.task;
      const ref = fbDb.ref(`reactions/${currentProjectId}/${tId}/${emoji}/${currentUser}`);
      ref.once("value").then(snap => {
        if (snap.val()) ref.remove();
        else ref.set(true);
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

  document.getElementById("saveColumnsBtn").addEventListener("click", async () => {
    const newCols = [];
    const newLabels = {};
    const newWip = {};
    const newColors = {};
    const palette = ["#58a6ff","#d29922","#bc8cff","#3fb950","#db61a2","#39d2c0","#f0883e","#e6edf3"];
    const snap = await fbDb.ref(`projects/${currentProjectId}`).once("value");
    const proj = snap.val() || {};
    const existingColors = proj.columnColors || {};
    list.querySelectorAll(".col-edit-item").forEach((item, i) => {
      const key = item.querySelector(".col-key").value.trim();
      const label = item.querySelector(".col-label").value.trim();
      const wip = parseInt(item.querySelector(".col-wip").value) || 0;
      if (key) {
        newCols.push(key);
        newLabels[key] = label || key;
        newColors[key] = existingColors[key] || palette[i % palette.length];
        if (wip > 0) newWip[key] = wip;
      }
    });
    // Migrate orphaned tasks to first column
    const oldCols = proj.columns || [];
    const removedCols = oldCols.filter((c) => !newCols.includes(c));
    const firstCol = newCols[0] || "pending";
    if (removedCols.length > 0) {
      const taskSnap = await fbDb.ref(`tasks/${currentProjectId}`).once("value");
      const allTasks = taskSnap.val() || {};
      const taskUpdates = {};
      Object.keys(allTasks).forEach(tid => {
        if (removedCols.includes(allTasks[tid].status)) {
          taskUpdates[`tasks/${currentProjectId}/${tid}/status`] = firstCol;
        }
      });
      if (Object.keys(taskUpdates).length > 0) await fbDb.ref().update(taskUpdates);
    }
    await fbDb.ref(`projects/${currentProjectId}`).update({
      columns: newCols, columnLabels: newLabels, columnColors: newColors, wipLimits: newWip,
    });
    overlay.remove();
    openProject(currentProjectId);
  });
}

// --- Export ---
async function exportProject() {
  const snap = await fbDb.ref().once("value");
  const all = snap.val() || {};
  const data = {
    project: all.projects?.[currentProjectId],
    tasks: all.tasks?.[currentProjectId] || [],
    comments: all.comments?.[currentProjectId] || {},
    checklists: all.checklists?.[currentProjectId] || {},
    reactions: all.reactions?.[currentProjectId] || {},
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
  fbDb.ref(`activity/${currentProjectId}`).orderByChild("timestamp").limitToLast(100).once("value", snap => {
    const data = snap.val() || {};
    const items = Object.keys(data).map(k => data[k]).reverse();
    container.innerHTML = items.map((a) => {
      const typeMap = { create: "creó", move: "movió", edit: "editó" };
      const detail = a.from && a.to
        ? ` de "${a.from}" a "${a.to}"`
        : "";
      return `<div class="activity-item">
        <span class="at-user">${esc(a.user)}</span> ${typeMap[a.type] || "modificó"} "${esc(a.taskTitle)}"${detail}
        <span class="at-time">${timeAgo(a.timestamp)}</span>
      </div>`;
    }).join("");
  });
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
