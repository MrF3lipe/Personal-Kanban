const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, "data", "tasks.json");
const PORT = 3000;

function readTasks() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// REST API
app.get("/api/tasks", (req, res) => {
  res.json(readTasks());
});

app.post("/api/tasks", (req, res) => {
  const tasks = readTasks();
  const maxId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
  const task = {
    id: maxId + 1,
    title: req.body.title,
    description: req.body.description || "",
    status: req.body.status || "pending",
    createdBy: req.body.createdBy || "Anónimo",
    lastModifiedBy: req.body.createdBy || "Anónimo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(task);
  writeTasks(tasks);
  io.emit("tasks:updated", tasks);
  res.status(201).json(task);
});

app.put("/api/tasks/:id", (req, res) => {
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Task not found" });
  tasks[idx] = { ...tasks[idx], ...req.body, id: tasks[idx].id, updatedAt: new Date().toISOString() };
  if (req.body.lastModifiedBy) tasks[idx].lastModifiedBy = req.body.lastModifiedBy;
  writeTasks(tasks);
  io.emit("tasks:updated", tasks);
  res.json(tasks[idx]);
});

app.delete("/api/tasks/:id", (req, res) => {
  let tasks = readTasks();
  tasks = tasks.filter((t) => t.id !== parseInt(req.params.id));
  writeTasks(tasks);
  io.emit("tasks:updated", tasks);
  res.json({ ok: true });
});

// Socket.IO
io.on("connection", (socket) => {
  socket.emit("tasks:updated", readTasks());
  socket.on("task:move", ({ id, newStatus, username }) => {
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.status = newStatus;
      task.lastModifiedBy = username || "Anónimo";
      task.updatedAt = new Date().toISOString();
      writeTasks(tasks);
      io.emit("tasks:updated", tasks);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  let ip = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ip = net.address;
        break;
      }
    }
  }
  console.log(`\n  ✓ Kanban corriendo en:\n`);
  console.log(`     Local:   http://localhost:${PORT}`);
  console.log(`     Red:     http://${ip}:${PORT}\n`);
});
