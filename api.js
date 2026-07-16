/* ============================================================
   API Layer — conecta con el servidor Express local
   ============================================================ */

const API = {
  _socket: null,
  _callbacks: {},

  // --- Init ---
  async init() {
    try {
      const res = await fetch("/api/ping")
      if (!res.ok) throw new Error("No server")
      console.log("[API] Conectado al servidor local")
    } catch {
      console.warn("[API] No se pudo conectar al servidor local")
    }
  },

  // --- Helpers ---
  _url(path) { return `/api${path}` },

  async _get(path) {
    const res = await fetch(this._url(path))
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
    return res.json()
  },

  async _post(path, body) {
    const res = await fetch(this._url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
    return res.json()
  },

  async _put(path, body) {
    const res = await fetch(this._url(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
    return res.json()
  },

  async _delete(path) {
    const res = await fetch(this._url(path), { method: "DELETE" })
    if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`)
    return res.json()
  },

  // --- Projects ---
  async getProjects() {
    return this._get("/projects")
  },

  async getProject(id) {
    return this._get(`/projects/${id}`)
  },

  async createProject(data) {
    return this._post("/projects", {
      id: data.id || undefined,
      name: data.name,
      description: data.description || "",
      password: data.password || "",
      columns: data.columns || ["pending", "in-progress", "in-review", "completed"],
      columnLabels: data.column_labels || {
        pending: "Pendientes", "in-progress": "En Proceso",
        "in-review": "En Revisión", completed: "Completadas",
      },
      columnColors: data.column_colors || {},
      wipLimits: data.wip_limits || {},
      createdBy: data.created_by || currentUser || "Anónimo",
    })
  },

  async updateProject(id, data) {
    return this._put(`/projects/${id}`, data)
  },

  async deleteProject(id) {
    return this._delete(`/projects/${id}`)
  },

  async verifyProject(id, password) {
    return this._post(`/projects/${id}/verify`, { password })
  },

  // --- Tasks ---
  async getTasks(projectId) {
    return this._get(`/projects/${projectId}/tasks`)
  },

  async createTask(projectId, data) {
    return this._post(`/projects/${projectId}/tasks`, {
      title: data.title,
      description: data.description || "",
      priority: data.priority || "p3",
      status: data.status || "pending",
      assignee: data.assignee || "",
      deadline: data.deadline || null,
      tags: data.tags || [],
      createdBy: data.created_by || currentUser || "Anónimo",
    })
  },

  async updateTask(projectId, taskId, data) {
    return this._put(`/projects/${projectId}/tasks/${taskId}`, {
      ...data,
      lastModifiedBy: currentUser || "Anónimo",
    })
  },

  async deleteTask(projectId, taskId) {
    return this._delete(`/projects/${projectId}/tasks/${taskId}`)
  },

  // --- Comments ---
  async getComments(projectId, taskId) {
    return this._get(`/projects/${projectId}/tasks/${taskId}/comments`)
  },

  async createComment(projectId, taskId, data) {
    return this._post(`/projects/${projectId}/tasks/${taskId}/comments`, {
      text: data.text,
      user: data.user || currentUser || "Anónimo",
    })
  },

  // --- Checklists ---
  async getChecklist(projectId, taskId) {
    return this._get(`/projects/${projectId}/tasks/${taskId}/checklist`)
  },

  async createChecklistItem(projectId, taskId, data) {
    return this._post(`/projects/${projectId}/tasks/${taskId}/checklist`, {
      text: data.text,
    })
  },

  async updateChecklistItem(projectId, taskId, itemId, data) {
    return this._put(`/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, data)
  },

  async deleteChecklistItem(projectId, taskId, itemId) {
    return this._delete(`/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`)
  },

  // --- Reactions ---
  async toggleReaction(projectId, taskId, emoji, user) {
    return this._post(`/projects/${projectId}/tasks/${taskId}/reactions`, { emoji, user })
  },

  // --- Activity ---
  async getActivity(projectId) {
    return this._get(`/projects/${projectId}/activity`)
  },

  async logActivity(projectId, type, taskId, taskTitle, extra = {}) {
    // El server.js genera activity automáticamente en create/update/delete
    // Esta función es solo para casos extra
  },

  // --- Export ---
  async exportProject(projectId) {
    return this._get(`/projects/${projectId}/export`)
  },

  // --- Realtime (Socket.IO) ---
  subscribe(projectId, callbacks = {}) {
    this.unsubscribe()
    if (typeof io === "undefined") {
      console.warn("[API] Socket.IO no disponible, sin tiempo real")
      return
    }
    this._socket = io({ query: { projectId } })
    this._callbacks = callbacks

    this._socket.emit("join:project", { projectId, username: currentUser || "Anónimo" })

    if (callbacks.onTasks) this._socket.on("tasks:updated", (data) => {
      if (callbacks.onTasks) callbacks.onTasks(data)
    })
    if (callbacks.onComments) this._socket.on("comments:updated", (data) => {
      if (callbacks.onComments) callbacks.onComments(data)
    })
    if (callbacks.onChecklist) this._socket.on("checklist:updated", (data) => {
      if (callbacks.onChecklist) callbacks.onChecklist(data)
    })
    if (callbacks.onReactions) this._socket.on("reactions:updated", (data) => {
      if (callbacks.onReactions) callbacks.onReactions(data)
    })
    if (callbacks.onUsers) this._socket.on("users:updated", (data) => {
      if (callbacks.onUsers) callbacks.onUsers(data)
    })
  },

  unsubscribe() {
    if (this._socket) {
      this._socket.emit("leave:project", { projectId: currentProjectId })
      this._socket.off()
      this._socket.disconnect()
      this._socket = null
    }
    this._callbacks = {}
  },
}
