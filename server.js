const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DATA_FILE = path.join(__dirname, "data", "db.json");
const PORT = process.env.PORT || 3000;

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { projects: {}, columns: {}, tasks: {}, comments: {}, checklists: {}, activity: {}, reactions: {} };
  }
}

function writeDB(db) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function genId() { return crypto.randomBytes(4).toString("hex"); }
function now() { return new Date().toISOString(); }

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: "10mb" }));
// Proteger archivos del backend (no servirlos como estáticos)
const protectedPaths = ["/server.js", "/package.json", "/package-lock.json", "/data/", "/node_modules/", "/.gitignore"];
app.use((req, res, next) => {
  if (protectedPaths.some((p) => req.path.startsWith(p))) return res.status(404).end();
  next();
});
app.use(express.static(__dirname));

// --- Health ---
app.get("/api/ping", (req, res) => res.json({ ok: true }));

// --- Projects ---
function stripPassword(p) {
  if (!p) return p;
  const { password, ...rest } = p;
  // Normalize: provide both camelCase (storage) and snake_case (frontend)
  return {
    ...rest,
    created_by: rest.createdBy,
    column_labels: rest.columnLabels,
    column_colors: rest.columnColors,
    wip_limits: rest.wipLimits,
    created_at: rest.createdAt,
  };
}

app.get("/api/projects", (req, res) => {
  const db = readDB();
  const list = Object.entries(db.projects).map(([id, p]) => ({ id, ...stripPassword(p) }));
  res.json(list);
});

app.post("/api/projects", (req, res) => {
  const db = readDB();
  const id = req.body.id || genId();
  const project = {
    name: req.body.name || "Sin nombre",
    description: req.body.description || "",
    password: req.body.password || "",
    columns: req.body.columns || ["pending", "in-progress", "in-review", "completed"],
    columnLabels: req.body.columnLabels || { pending: "Pendientes", "in-progress": "En Proceso", "in-review": "En Revisión", completed: "Completadas" },
    columnColors: req.body.columnColors || {},
    wipLimits: req.body.wipLimits || {},
    createdAt: now(),
    createdBy: req.body.createdBy || "Anónimo",
  };
  db.projects[id] = project;
  db.columns[id] = project.columns;
  db.tasks[id] = db.tasks[id] || [];
  db.comments[id] = db.comments[id] || {};
  db.checklists[id] = db.checklists[id] || {};
  db.activity[id] = db.activity[id] || [];
  db.reactions[id] = db.reactions[id] || {};
  writeDB(db);
  res.status(201).json({ id, ...stripPassword(project) });
});

app.post("/api/projects/:id/verify", (req, res) => {
  const db = readDB();
  const p = db.projects[req.params.id];
  if (!p) return res.status(404).json({ error: "Proyecto no encontrado" });
  if (p.password && p.password !== req.body.password) return res.status(403).json({ error: "Clave incorrecta" });
  res.json({ id: req.params.id, ...stripPassword(p) });
});

app.get("/api/projects/:id", (req, res) => {
  const db = readDB();
  const p = db.projects[req.params.id];
  if (!p) return res.status(404).json({ error: "Proyecto no encontrado" });
  res.json({ id: req.params.id, ...stripPassword(p) });
});

app.put("/api/projects/:id", (req, res) => {
  const db = readDB();
  if (!db.projects[req.params.id]) return res.status(404).json({ error: "Proyecto no encontrado" });
  Object.assign(db.projects[req.params.id], req.body);
  if (req.body.columns) db.columns[req.params.id] = req.body.columns;
  writeDB(db);
  res.json({ id: req.params.id, ...stripPassword(db.projects[req.params.id]) });
});

app.delete("/api/projects/:id", (req, res) => {
  const db = readDB();
  delete db.projects[req.params.id];
  delete db.columns[req.params.id];
  delete db.tasks[req.params.id];
  delete db.comments[req.params.id];
  delete db.checklists[req.params.id];
  delete db.activity[req.params.id];
  delete db.reactions[req.params.id];
  writeDB(db);
  res.json({ ok: true });
});

// --- Tasks ---
function normalizeTask(task, db, pid) {
  if (!task) return task;
  const taskReactions = db.reactions?.[pid]?.[task.id] || {};
  return {
    ...task,
    created_by: task.createdBy,
    last_modified_by: task.lastModifiedBy,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    reactions: taskReactions,
  };
}

app.get("/api/projects/:pid/tasks", (req, res) => {
  const db = readDB();
  const rawTasks = db.tasks[req.params.pid] || [];
  res.json(rawTasks.map((t) => normalizeTask(t, db, req.params.pid)));
});

function getNormalizedTasks(db, pid) {
  return (db.tasks[pid] || []).map((t) => normalizeTask(t, db, pid));
}

app.post("/api/projects/:pid/tasks", (req, res) => {
  const db = readDB();
  if (!db.projects[req.params.pid]) return res.status(404).json({ error: "Proyecto no encontrado" });
  db.tasks[req.params.pid] = db.tasks[req.params.pid] || [];
  const tid = genId();
  const tasksList = db.tasks[req.params.pid] || [];
  const task = {
    id: tid,
    projectId: req.params.pid,
    title: req.body.title,
    description: req.body.description || "",
    status: req.body.status || "pending",
    priority: req.body.priority || "p3",
    tags: req.body.tags || [],
    deadline: req.body.deadline || null,
    assignee: req.body.assignee || null,
    order: req.body.order ?? tasksList.length,
    createdBy: req.body.createdBy || req.body.created_by || "Anónimo",
    lastModifiedBy: req.body.lastModifiedBy || req.body.last_modified_by || req.body.createdBy || req.body.created_by || "Anónimo",
    createdAt: now(),
    updatedAt: now(),
  };
  db.tasks[req.params.pid].push(task);
  db.activity[req.params.pid] = db.activity[req.params.pid] || [];
  db.activity[req.params.pid].unshift({ type: "create", taskId: tid, taskTitle: task.title, user: task.createdBy, timestamp: now() });
  writeDB(db);
  io.to(req.params.pid).emit("tasks:updated", getNormalizedTasks(db, req.params.pid));
  res.status(201).json(normalizeTask(task, db, req.params.pid));
});

app.put("/api/projects/:pid/tasks/:tid", (req, res) => {
  const db = readDB();
  const tasks = db.tasks[req.params.pid] || [];
  const idx = tasks.findIndex((t) => t.id === req.params.tid);
  if (idx === -1) return res.status(404).json({ error: "Tarea no encontrada" });
  const old = { ...tasks[idx] };
  Object.assign(tasks[idx], req.body, { id: req.params.tid, updatedAt: now() });
  if (req.body.lastModifiedBy) tasks[idx].lastModifiedBy = req.body.lastModifiedBy;
  db.activity[req.params.pid] = db.activity[req.params.pid] || [];
  if (old.status !== tasks[idx].status) {
    db.activity[req.params.pid].unshift({ type: "move", taskId: tasks[idx].id, taskTitle: tasks[idx].title, from: old.status, to: tasks[idx].status, user: tasks[idx].lastModifiedBy, timestamp: now() });
  } else {
    db.activity[req.params.pid].unshift({ type: "edit", taskId: tasks[idx].id, taskTitle: tasks[idx].title, user: tasks[idx].lastModifiedBy, timestamp: now() });
  }
  writeDB(db);
  io.to(req.params.pid).emit("tasks:updated", getNormalizedTasks(db, req.params.pid));
  res.json(normalizeTask(tasks[idx], db, req.params.pid));
});

app.delete("/api/projects/:pid/tasks/:tid", (req, res) => {
  const db = readDB();
  db.tasks[req.params.pid] = (db.tasks[req.params.pid] || []).filter((t) => t.id !== req.params.tid);
  delete db.comments[req.params.pid]?.[req.params.tid];
  delete db.checklists[req.params.pid]?.[req.params.tid];
  delete db.reactions[req.params.pid]?.[req.params.tid];
  writeDB(db);
  io.to(req.params.pid).emit("tasks:updated", getNormalizedTasks(db, req.params.pid));
  res.json({ ok: true });
});

// --- Comments ---
app.get("/api/projects/:pid/tasks/:tid/comments", (req, res) => {
  const db = readDB();
  res.json(db.comments[req.params.pid]?.[req.params.tid] || []);
});

app.post("/api/projects/:pid/tasks/:tid/comments", (req, res) => {
  const db = readDB();
  db.comments[req.params.pid] = db.comments[req.params.pid] || {};
  db.comments[req.params.pid][req.params.tid] = db.comments[req.params.pid][req.params.tid] || [];
  const c = { id: genId(), text: req.body.text, user: req.body.user || "Anónimo", createdAt: now() };
  db.comments[req.params.pid][req.params.tid].push(c);
  writeDB(db);
  io.to(req.params.pid).emit("comments:updated", { taskId: req.params.tid, comments: db.comments[req.params.pid][req.params.tid] });
  res.status(201).json(c);
});

// --- Checklists ---
app.get("/api/projects/:pid/tasks/:tid/checklist", (req, res) => {
  const db = readDB();
  res.json(db.checklists[req.params.pid]?.[req.params.tid] || []);
});

app.post("/api/projects/:pid/tasks/:tid/checklist", (req, res) => {
  const db = readDB();
  db.checklists[req.params.pid] = db.checklists[req.params.pid] || {};
  db.checklists[req.params.pid][req.params.tid] = db.checklists[req.params.pid][req.params.tid] || [];
  const item = { id: genId(), text: req.body.text, done: false };
  db.checklists[req.params.pid][req.params.tid].push(item);
  writeDB(db);
  io.to(req.params.pid).emit("checklist:updated", { taskId: req.params.tid, checklist: db.checklists[req.params.pid][req.params.tid] });
  res.status(201).json(item);
});

app.put("/api/projects/:pid/tasks/:tid/checklist/:cid", (req, res) => {
  const db = readDB();
  const items = db.checklists[req.params.pid]?.[req.params.tid] || [];
  const item = items.find((i) => i.id === req.params.cid);
  if (!item) return res.status(404).json({ error: "Item no encontrado" });
  Object.assign(item, req.body);
  writeDB(db);
  io.to(req.params.pid).emit("checklist:updated", { taskId: req.params.tid, checklist: items });
  res.json(item);
});

app.delete("/api/projects/:pid/tasks/:tid/checklist/:cid", (req, res) => {
  const db = readDB();
  db.checklists[req.params.pid] = db.checklists[req.params.pid] || {};
  db.checklists[req.params.pid][req.params.tid] = (db.checklists[req.params.pid][req.params.tid] || []).filter((i) => i.id !== req.params.cid);
  writeDB(db);
  io.to(req.params.pid).emit("checklist:updated", { taskId: req.params.tid, checklist: db.checklists[req.params.pid][req.params.tid] });
  res.json({ ok: true });
});

// --- Activity ---
app.get("/api/projects/:pid/activity", (req, res) => {
  const db = readDB();
  res.json((db.activity[req.params.pid] || []).slice(0, 50));
});

// --- Reactions ---
app.post("/api/projects/:pid/tasks/:tid/reactions", (req, res) => {
  const db = readDB();
  db.reactions[req.params.pid] = db.reactions[req.params.pid] || {};
  db.reactions[req.params.pid][req.params.tid] = db.reactions[req.params.pid][req.params.tid] || {};
  const emoji = req.body.emoji;
  const user = req.body.user;
  if (!db.reactions[req.params.pid][req.params.tid][emoji]) db.reactions[req.params.pid][req.params.tid][emoji] = [];
  const idx = db.reactions[req.params.pid][req.params.tid][emoji].indexOf(user);
  if (idx > -1) db.reactions[req.params.pid][req.params.tid][emoji].splice(idx, 1);
  else db.reactions[req.params.pid][req.params.tid][emoji].push(user);
  if (db.reactions[req.params.pid][req.params.tid][emoji].length === 0) delete db.reactions[req.params.pid][req.params.tid][emoji];
  writeDB(db);
  io.to(req.params.pid).emit("reactions:updated", { taskId: req.params.tid, reactions: db.reactions[req.params.pid][req.params.tid] });
  res.json(db.reactions[req.params.pid][req.params.tid]);
});

// --- Export ---
app.get("/api/projects/:pid/export", (req, res) => {
  const db = readDB();
  const project = db.projects[req.params.pid];
  if (!project) return res.status(404).json({ error: "No encontrado" });
  res.json({ project, tasks: db.tasks[req.params.pid] || [], comments: db.comments[req.params.pid] || {} });
});

// --- Socket.IO ---
const onlineUsers = {}; // { socketId: { username, projectId, online } }

io.on("connection", (socket) => {
  socket.on("join:project", ({ projectId, username }) => {
    socket.join(projectId);
    onlineUsers[socket.id] = { username, projectId, online: true, joinedAt: now() };
    io.to(projectId).emit("users:updated", getProjectUsers(projectId));
    const db = readDB();
    socket.emit("tasks:updated", getNormalizedTasks(db, projectId));
  });

  socket.on("leave:project", ({ projectId }) => {
    socket.leave(projectId);
    delete onlineUsers[socket.id];
    if (projectId) io.to(projectId).emit("users:updated", getProjectUsers(projectId));
  });

  socket.on("user:toggle", ({ projectId }) => {
    const u = onlineUsers[socket.id];
    if (u) { u.online = !u.online; io.to(projectId).emit("users:updated", getProjectUsers(projectId)); }
  });

  socket.on("task:move", ({ id, newStatus, username, projectId }) => {
    const db = readDB();
    const tasks = db.tasks[projectId] || [];
    const task = tasks.find((t) => t.id === id);
    if (task) {
      const oldStatus = task.status;
      task.status = newStatus;
      task.lastModifiedBy = username || "Anónimo";
      task.updatedAt = now();
      db.activity[projectId] = db.activity[projectId] || [];
      db.activity[projectId].unshift({ type: "move", taskId: id, taskTitle: task.title, from: oldStatus, to: newStatus, user: username, timestamp: now() });
      writeDB(db);
      io.to(projectId).emit("tasks:updated", getNormalizedTasks(db, projectId));
    }
  });

  socket.on("task:reorder", ({ projectId, taskId, status, newIndex }) => {
    const db = readDB();
    const tasks = db.tasks[projectId] || [];
    const filtered = tasks.filter((t) => t.status === status);
    const others = tasks.filter((t) => t.status !== status);
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
      const fromIdx = filtered.findIndex((t) => t.id === taskId);
      if (fromIdx > -1) filtered.splice(fromIdx, 1);
      filtered.splice(newIndex, 0, task);
      filtered.forEach((t, i) => (t.order = i));
      db.tasks[projectId] = [...others, ...filtered];
      writeDB(db);
      io.to(projectId).emit("tasks:updated", getNormalizedTasks(db, projectId));
    }
  });

  socket.on("disconnect", () => {
    const u = onlineUsers[socket.id];
    if (u) {
      io.to(u.projectId).emit("users:updated", getProjectUsers(u.projectId));
      delete onlineUsers[socket.id];
    }
  });
});

function getProjectUsers(projectId) {
  return Object.values(onlineUsers).filter((u) => u.projectId === projectId);
}

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(__dirname, "index.html"));
});

server.listen(PORT, () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  let ip = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) { ip = net.address; break; }
    }
  }
  console.log(`\n  \x1b[36m✦ Kanban v2 corriendo\x1b[0m\n`);
  console.log(`     Local:   \x1b[1mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`     Red:     \x1b[1mhttp://${ip}:${PORT}\x1b[0m`);
  console.log(`     API:     \x1b[1mhttp://localhost:${PORT}/api/projects\x1b[0m\n`);
});
