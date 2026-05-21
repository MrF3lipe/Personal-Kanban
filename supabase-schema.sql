-- Ejecuta esto en SQL Editor de Supabase

-- Drop existing tables (if re-running)
DROP TABLE IF EXISTS public.activity CASCADE;
DROP TABLE IF EXISTS public.reactions CASCADE;
DROP TABLE IF EXISTS public.checklists CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- Projects
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  password TEXT DEFAULT '',
  columns JSONB DEFAULT '["pending","in-progress","in-review","completed"]',
  column_labels JSONB DEFAULT '{"pending":"Pendientes","in-progress":"En Proceso","in-review":"En Revisión","completed":"Completadas"}',
  column_colors JSONB DEFAULT '{"pending":"#58a6ff","in-progress":"#d29922","in-review":"#bc8cff","completed":"#3fb950"}',
  wip_limits JSONB DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'p3',
  status TEXT DEFAULT 'pending',
  assignee TEXT DEFAULT '',
  deadline DATE,
  tags JSONB DEFAULT '[]',
  created_by TEXT DEFAULT '',
  last_modified_by TEXT DEFAULT '',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  task_id UUID NOT NULL,
  text TEXT NOT NULL,
  "user" TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklists
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  task_id UUID NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reactions (one row per user per emoji per task)
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  task_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  "user" TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, task_id, emoji, "user")
);

-- Activity log
CREATE TABLE public.activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  task_id TEXT DEFAULT '',
  task_title TEXT DEFAULT '',
  "user" TEXT DEFAULT '',
  "from" TEXT DEFAULT '',
  "to" TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_comments_task ON public.comments(project_id, task_id);
CREATE INDEX idx_checklists_task ON public.checklists(project_id, task_id);
CREATE INDEX idx_reactions_task ON public.reactions(project_id, task_id);
CREATE INDEX idx_activity_project ON public.activity(project_id);
CREATE INDEX idx_activity_timestamp ON public.activity(project_id, timestamp DESC);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity;

-- RLS: allow all operations with anon key (simple app, no real auth)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on comments" ON public.comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reactions" ON public.reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on activity" ON public.activity FOR ALL USING (true) WITH CHECK (true);
