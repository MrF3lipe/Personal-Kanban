# ⊞ Kanban Collab

Tablero Kanban colaborativo en tiempo real con soporte multiusuario, arrastrar y soltar, y protección por clave de proyecto.

## ✨ Características

- **Tiempo real** — Socket.IO sincroniza cambios entre todos los usuarios al instante
- **Arrastrar y soltar** — Mueve tareas entre columnas con drag & drop (ratón y táctil)
- **Múltiples proyectos** — Crea todos los proyectos que necesites, cada uno con su propio tablero
- **Protección por clave** — Cada proyecto tiene una clave opcional; comparte el ID + clave con quien quieras colaborar
- **Vista tablero y lista** — Alterna entre columnas kanban y tabla resumen con un clic
- **Filtros** — Filtra tareas por prioridad (P0–P3), persona asignada y etiquetas
- **Búsqueda** — Busca tareas por título y descripción en tiempo real
- **Tema oscuro/claro** — Alterna entre ambos temas; tu elección se guarda
- **Comentarios y checklists** — Discute y desglosa tareas dentro del modal de cada tarjeta
- **WIP Limits** — Define límites de tareas en progreso por columna
- **Columnas personalizables** — Crea, renombra y reordena columnas en cada proyecto
- **Reacciones** — Añade emojis a las tarjetas 👍 ❤️ 🎉
- **Exportar/Importar** — Descarga proyectos como JSON o impórtalos desde archivo
- **Usuarios online** — Panel con indicador visual de quién está conectado
- **Atajos de teclado** — `N` nueva tarea, `B` cambiar vista, `F` buscar, `Esc` cerrar, `?` ayuda
- **Responsive** — Funciona en escritorio, tablet y móvil

## 🚀 Inicio rápido

### Requisitos

- [Node.js](https://nodejs.org/) 18+

### Instalación

```bash
cd kanban
npm install
node server.js
```

Abre http://localhost:3000 en tu navegador.

### Crear un proyecto

1. Escribe tu nombre y haz clic en **Entrar al tablero**
2. Haz clic en **+ Nuevo proyecto**
3. Ponle nombre y una clave (opcional)
4. Comparte el **ID del proyecto** y la **clave** con quien quieras colaborar

### Unirse a un proyecto

1. Inicia sesión con tu nombre
2. En la sección **Unirse a un proyecto**, escribe el ID y la clave
3. Haz clic en **Unirse** — el proyecto aparecerá en tu lista

## ☁️ Desplegar

### GitHub Pages (sin backend)

1. Crea un repo en GitHub y sube el código
2. Ve a **Settings → Pages → Source**: "Deploy from a branch"
3. Branch: `main`, folder: `/` (root)
4. Listo — la app funciona 100% offline con localStorage en `https://<user>.github.io/<repo>/`

No necesitas backend. Los datos se guardan localmente en el navegador.

### Inicio rápido (local)

```bash
cd kanban
npm install
node server.js
```

Abre http://localhost:3000 (o usa el archivo `index.html` directamente).

## 🗂️ Estructura

```
kanban/
├── server.js              # Backend Express + Socket.IO (opcional, sin backend usa localStorage)
├── package.json
├── data/
│   └── db.json            # Datos de ejemplo (solo para backend)
├── index.html             # SPA con templates
├── style.css              # Tema oscuro/claro
├── app.js                 # Lógica frontend (todo en localStorage)
├── config.js              # Vacío (sin backend)
└── README.md
```

## 📄 Licencia

MIT
