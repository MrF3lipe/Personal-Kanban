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

### Frontend (GitHub Pages)

1. Crea un repo en GitHub y sube el código
2. Ve a Settings → Pages → Source: GitHub Actions
3. Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: mkdir -p public && cp -r public/* .
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

### Backend (Render / Railway)

El backend necesita Node.js. Despliega `server.js` en:

- **[Render](https://render.com)** — servicio Web con `node server.js`
- **[Railway](https://railway.app)** — comando `node server.js`
- **[Fly.io](https://fly.io)** — `fly launch` con `cmd = "node server.js"`

Configura `public/config.js` apuntando al backend desplegado.

## 🗂️ Estructura

```
kanban/
├── server.js              # Backend Express + Socket.IO
├── package.json
├── data/
│   └── db.json            # Base de datos (JSON)
├── public/
│   ├── index.html         # SPA con templates
│   ├── style.css          # Tema oscuro/claro
│   ├── app.js             # Lógica frontend
│   └── config.js          # BACKEND_URL (para GitHub Pages)
└── README.md
```

## 📄 Licencia

MIT
