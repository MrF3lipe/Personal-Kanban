# ⊞ Kanban

Tablero Kanban con arrastrar y soltar, múltiples proyectos, **colaboración en tiempo real**, filtros, búsqueda, checklists, comentarios, reacciones, y protección por clave.

## ✨ Características

- **👥 Tiempo real** — Varios usuarios colaboran simultáneamente; los cambios se sincronizan al instante
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

## 🖥️ Diseño

Vidrio oscuro con gradientes animados de fondo, tipografía **DM Sans** + **Syne**, animaciones escalonadas, columnas con brillo degradado y una estética *cyber-glass* coherente.

## 🚀 Configuración de Supabase

Necesitas una cuenta gratuita en [supabase.com](https://supabase.com).

### 1. Crear proyecto

1. Ve a [supabase.com](https://supabase.com) e inicia sesión
2. Crea un nuevo proyecto (elige una región cercana)
3. Espera a que termine la creación de la base de datos (~2 minutos)

### 2. Ejecutar schema SQL

1. En el panel de Supabase, ve a **SQL Editor**
2. Haz clic en **New Query**
3. Copia y pega todo el contenido de [`supabase-schema.sql`](./supabase-schema.sql)
4. Haz clic en **Run** para crear las tablas

### 3. Configurar la app

1. En el panel de Supabase, ve a **Project Settings → API**
2. Copia la **Project URL** y la **anon public key**
3. Abre [`supabase-config.js`](./supabase-config.js) y reemplaza los valores:

```js
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co"
const SUPABASE_ANON_KEY = "tu-anon-key-aqui"
```

### 4. Habilitar Realtime

Ve a **Database → Replication** y asegúrate de que las tablas `projects`, `tasks`, `comments`, `checklists`, `reactions` y `activity` están publicadas en `supabase_realtime` (ya se configura automáticamente con el SQL anterior).

### 5. Abrir la app

Abre `index.html` en tu navegador o súbela a GitHub Pages. La URL de GitHub Pages accesible desde Cuba:

**https://mrf3lipe.github.io/Personal-Kanban/**

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

Súbela a GitHub Pages, Netlify, Vercel, o cualquier hosting estático:

1. Sube el código a un repo de GitHub
2. **Settings → Pages → Source**: "Deploy from a branch"
3. Branch: `main`, folder: `/ (root)`
4. Listo

## 🗂️ Estructura

```
kanban/
├── index.html              # SPA completo con templates HTML
├── style.css               # Tema cyber-glass (oscuro/claro)
├── app.js                  # Toda la lógica (cliente Supabase)
├── supabase-config.js      # Configuración de Supabase
├── supabase-schema.sql     # Schema SQL para ejecutar en Supabase
└── README.md
```

## 🔧 Stack

| Capa       | Tecnología                          |
|------------|-------------------------------------|
| Frontend   | HTML5 + CSS3 + JavaScript (ES2024)  |
| Base de datos | Supabase (PostgreSQL)            |
| Tiempo real | Supabase Realtime + Presence       |
| Hosting    | GitHub Pages (o cualquier estático) |
