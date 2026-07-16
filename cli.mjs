#!/usr/bin/env node
/**
 * Kanban CLI — administra proyectos y tareas desde la terminal
 * 
 * Uso: node cli.mjs <comando> [opciones]
 * 
 * Comandos:
 *   projects list                    Listar proyectos
 *   projects create --name <n>       Crear proyecto
 *   projects update --id <id>        Actualizar proyecto
 *   projects delete --id <id>        Eliminar proyecto
 *   tasks list --project <id>        Listar tareas de un proyecto
 *   tasks create --project <id>      Crear tarea
 *   tasks update --id <id> --project <id>  Actualizar tarea
 *   tasks move --id <id> --project <id> --status <s>  Mover tarea
 *   tasks delete --id <id> --project <id>  Eliminar tarea
 */

const BASE = process.env.KANBAN_URL || "http://localhost:3000"
const [, , cmd, ...args] = process.argv

function die(msg) { console.error("❌", msg); process.exit(1) }

function flag(name, fallback = null) {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return fallback
  const val = args[idx + 1]
  if (val === undefined || val.startsWith("--")) return true
  args.splice(idx, 2)
  return val
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}/api${path}`, opts)
  const data = await res.json()
  if (!res.ok) die(data.error || `HTTP ${res.status}`)
  return data
}

// --- Projects ---
async function listProjects() {
  const projects = await api("GET", "/projects")
  if (!projects.length) return console.log("(no hay proyectos)")
  projects.forEach((p) => {
    console.log(`  ${p.id.padEnd(16)} ${p.name.padEnd(24)} [${p.createdBy || "?"}] ${p.description || ""}`)
  })
}

async function createProject() {
  const name = flag("name") || die("--name es requerido")
  const id = flag("id") || undefined
  const password = flag("password", "")
  const desc = flag("description", "")
  if (id) {
    try { await api("GET", `/projects/${id}`); die(`El ID "${id}" ya existe`) } catch {}
  }
  const p = await api("POST", "/projects", {
    id, name, password, description: desc,
    columns: ["pending","in-progress","in-review","completed"],
    columnLabels: { pending:"Pendientes","in-progress":"En Proceso","in-review":"En Revisión",completed:"Completadas" },
    createdBy: flag("user", "CLI"),
  })
  console.log("✅ Proyecto creado:", p.id, p.name)
}

async function updateProject() {
  const id = flag("id") || die("--id es requerido")
  const body = {}
  const name = flag("name"); if (name) body.name = name
  const password = flag("password"); if (password !== null) body.password = password
  const desc = flag("description"); if (desc !== null) body.description = desc
  if (!Object.keys(body).length) die("Nada que actualizar (usa --name, --password, --description)")
  const p = await api("PUT", `/projects/${id}`, body)
  console.log("✅ Proyecto actualizado:", p.id, p.name)
}

async function deleteProject() {
  const id = flag("id") || die("--id es requerido")
  await api("DELETE", `/projects/${id}`)
  console.log("✅ Proyecto eliminado:", id)
}

// --- Tasks ---
async function listTasks() {
  const pid = flag("project") || die("--project es requerido")
  const tasks = await api("GET", `/projects/${pid}/tasks`)
  if (!tasks.length) return console.log("(no hay tareas)")
  tasks.forEach((t) => {
    const status = (t.status || "?").padEnd(12)
    console.log(`  ${(t.id || "").padEnd(10)} ${status} ${(t.priority || "p3").toUpperCase().padEnd(4)} ${t.title}`)
  })
}

async function createTask() {
  const pid = flag("project") || die("--project es requerido")
  const title = flag("title") || die("--title es requerido")
  const status = flag("status", "pending")
  const priority = flag("priority", "p3")
  const assignee = flag("assignee", "")
  const tags = flag("tags", "")
  const desc = flag("description", "")
  const t = await api("POST", `/projects/${pid}/tasks`, {
    title, status, priority, assignee,
    tags: tags ? tags.split(",").map(s=>s.trim()) : [],
    description: desc,
    createdBy: flag("user", "CLI"),
  })
  console.log("✅ Tarea creada:", t.id, t.title)
}

async function updateTask() {
  const pid = flag("project") || die("--project es requerido")
  const tid = flag("id") || die("--id es requerido")
  const body = {}
  const title = flag("title"); if (title) body.title = title
  const status = flag("status"); if (status) body.status = status
  const priority = flag("priority"); if (priority) body.priority = priority
  const assignee = flag("assignee"); if (assignee !== null) body.assignee = assignee
  const desc = flag("description"); if (desc !== null) body.description = desc
  if (!Object.keys(body).length) die("Nada que actualizar")
  body.lastModifiedBy = flag("user", "CLI")
  const t = await api("PUT", `/projects/${pid}/tasks/${tid}`, body)
  console.log("✅ Tarea actualizada:", t.id, t.title)
}

async function moveTask() {
  const pid = flag("project") || die("--project es requerido")
  const tid = flag("id") || die("--id es requerido")
  const status = flag("status") || die("--status es requerido (p.ej. completed)")
  await api("PUT", `/projects/${pid}/tasks/${tid}`, { status, lastModifiedBy: flag("user", "CLI") })
  console.log("✅ Tarea movida a", status)
}

async function deleteTask() {
  const pid = flag("project") || die("--project es requerido")
  const tid = flag("id") || die("--id es requerido")
  await api("DELETE", `/projects/${pid}/tasks/${tid}`)
  console.log("✅ Tarea eliminada:", tid)
}

// --- Help ---
function help() {
  console.log(`
Kanban CLI — node cli.mjs <comando> [opciones]

  projects list
  projects create --name <nombre> [--id <id>] [--password <clave>] [--description <texto>] [--user <nombre>]
  projects update --id <id> [--name <n>] [--password <p>] [--description <d>]
  projects delete --id <id>

  tasks list --project <id>
  tasks create --project <id> --title <tarea> [--status <s>] [--priority p0|p1|p2|p3] [--assignee <u>] [--tags <a,b,c>] [--description <d>] [--user <n>]
  tasks update --project <id> --id <taskid> [--title <n>] [--status <s>] [--priority <p>] [--assignee <u>] [--description <d>]
  tasks move --project <id> --id <taskid> --status <columna>
  tasks delete --project <id> --id <taskid>

Variables de entorno:
  KANBAN_URL   URL del servidor (default: http://localhost:3000)
`.trim())
}

// --- Router ---
const commands = {
  projects: { list: listProjects, create: createProject, update: updateProject, delete: deleteProject },
  tasks: { list: listTasks, create: createTask, update: updateTask, move: moveTask, delete: deleteTask },
}

if (!cmd || cmd === "help") {
  help()
} else if (commands[cmd]) {
  const sub = args[0]
  if (!sub || !commands[cmd][sub]) die(`Usa: node cli.mjs ${cmd} <list|create|update|delete>`)
  args.shift() // consume subcommand
  await commands[cmd][sub]()
} else {
  die(`Comando desconocido: "${cmd}". Usa: node cli.mjs help`)
}
