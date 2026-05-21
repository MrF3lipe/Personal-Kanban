# ⊞ Kanban

Tablero Kanban con arrastrar y soltar, múltiples proyectos, filtros, búsqueda, checklists, comentarios, reacciones, y protección por clave.

## ✨ Características

- **📋 Arrastrar y soltar** — Mueve tareas entre columnas (ratón y táctil)
- **🔐 Proyectos con clave** — Cada proyecto tiene clave opcional; comparte ID + clave para colaborar
- **🆔 ID personalizado** — Al crear proyecto puedes elegir tu propio ID (sin duplicados)
- **📋 Copiar ID** — Botón para copiar el ID del proyecto al portapapeles
- **🗑️ Solo el creador elimina** — Solo quien creó el proyecto puede eliminarlo
- **📊 Vista tablero y lista** — Alterna entre columnas kanban y tabla resumen
- **🎯 Filtros** — Por prioridad (P0–P3), asignado y etiquetas
- **🔍 Búsqueda** — Filtra tarjetas por título/descripción en tiempo real
- **🎨 Tema oscuro/claro** — Alterna con un clic; tu preferencia se guarda
- **💬 Comentarios y checklists** — Dentro del modal de cada tarea
- **📏 Límites WIP** — Define máximos de tareas por columna
- **📐 Columnas editables** — Crea, renombra, reordena y colorea columnas
- **😄 Reacciones** — Añade emojis a las tarjetas (👍 ❤️ 🎉 etc.)
- **📦 Exportar/Importar** — Descarga proyectos como JSON o impórtalos
- **⌨️ Atajos** — `N` nueva tarea, `B` cambiar vista, `F` buscar, `Esc` cerrar, `?` ayuda
- **📱 Responsive** — Funciona en escritorio, tablet y móvil
- **💾 100% local** — Sin servidor, sin conexión externa. Todo se guarda en localStorage.

## 🖥️ Diseño

Vidrio oscuro con gradientes animados de fondo, tipografía **DM Sans** + **Syne**, animaciones escalonadas, columnas con brillo degradado y una estética *cyber-glass* coherente.

## 🚀 Inicio rápido

Abre `index.html` en tu navegador. No necesita instalación ni servidor.

O visítalo online: **https://mrf3lipe.github.io/Personal-Kanban/**

### Crear un proyecto

1. Haz clic en **+ Nuevo proyecto**
2. Escribe el nombre (ej. *Sprint 24*)
3. Opcional: escribe un ID personalizado (ej. `sprint-24`) o déjalo vacío para que se genere solo
4. Opcional: escribe una clave para que solo acceda quien la tenga
5. Comparte el **ID** (y la **clave**) con tus colaboradores

### Unirse a un proyecto

1. En la pantalla principal, escribe el ID del proyecto y la clave
2. Haz clic en **Unirse** — el proyecto aparece en tu lista
3. También puedes escribir el ID directamente en la URL: `#/project/tu-id`

## ☁️ Despliegue

La app es **100% estática**. Súbela a GitHub Pages, Netlify, Vercel, o cualquier hosting estático:

1. Sube el código a un repo de GitHub
2. **Settings → Pages → Source**: "Deploy from a branch"
3. Branch: `main`, folder: `/ (root)`
4. Listo

Todos los datos se guardan en el navegador (localStorage). Sin servidor, sin backend, sin cuenta.

## 🗂️ Estructura

```
kanban/
├── index.html          # SPA completo con templates HTML
├── style.css           # Tema cyber-glass (oscuro/claro)
├── app.js              # Toda la lógica (localStorage)
└── README.md
```

Sin dependencias externas. Sin Firebase, sin Node.js, sin build.

## 🔧 Stack

| Capa       | Tecnología                          |
|------------|-------------------------------------|
| Frontend   | HTML5 + CSS3 + JavaScript (ES2024)  |
| Datos      | localStorage                        |
| Hosting    | GitHub Pages (o cualquier estático) |

## 📄 Licencia

MIT
