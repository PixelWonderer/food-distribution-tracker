-- Migration: Ops Hub tables (volunteers, shifts, handoffs, knowledge base, sync metadata)
-- These tables back the Ops Hub / portal views (src/services/opsState.ts) and were
-- previously only created implicitly in the original deployment. Idempotent.
-- Requires: update_updated_at_column() from schema.sql.

-- ============================================
-- Volunteers and shifts
-- ============================================
CREATE TABLE IF NOT EXISTS volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR NOT NULL UNIQUE,
  display_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  shift_type VARCHAR NOT NULL,
  time_slot VARCHAR,
  notes TEXT,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (volunteer_id, week_date, shift_type)
);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_volunteer ON shift_assignments(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_week ON shift_assignments(week_date);

CREATE TABLE IF NOT EXISTS shift_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shift_assignments(id) ON DELETE SET NULL,
  week_date DATE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'confirmed', 'unconfirmed', 'transferred', 'copied')),
  previous_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  previous_volunteer_name TEXT,
  new_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  new_volunteer_name TEXT,
  shift_type TEXT,
  time_slot TEXT,
  changed_by_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE shift_change_log IS 'Audit trail for all shift assignment changes';
CREATE INDEX IF NOT EXISTS idx_shift_change_log_week ON shift_change_log(week_date);
CREATE INDEX IF NOT EXISTS idx_shift_change_log_created_at ON shift_change_log(created_at DESC);

CREATE TABLE IF NOT EXISTS shift_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  content TEXT,
  timeline JSONB DEFAULT '[]'::jsonb,
  checklist JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  location_url TEXT,
  icon TEXT,
  color TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Handoffs, coverage scenarios, action items
-- ============================================
CREATE TABLE IF NOT EXISTS handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_date TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  from_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  to_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  from_shift_type TEXT,
  to_shift_type TEXT,
  handoff_time TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_handoffs_week ON handoffs(week_date);

CREATE TABLE IF NOT EXISTS coverage_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unavailable_volunteers JSONB DEFAULT '[]'::jsonb,
  backup_decision_maker UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  week_date DATE,
  assigned_to UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_action_items_week ON action_items(week_date);

-- ============================================
-- Knowledge base
-- ============================================
CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR NOT NULL UNIQUE,
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR,
  display_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category);

-- ============================================
-- Per-shift task checklist (Pickup tab)
-- ============================================
CREATE TABLE IF NOT EXISTS shift_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '📋',
  timing TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_timing ON shift_tasks(timing) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS shift_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES shift_tasks(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE (task_id, week_date)
);
CREATE INDEX IF NOT EXISTS idx_shift_task_completions_week ON shift_task_completions(week_date);

CREATE OR REPLACE FUNCTION get_shift_tasks_with_status(p_week_date DATE)
RETURNS TABLE(
  task_id UUID, title TEXT, description TEXT, emoji TEXT, timing TEXT, display_order INTEGER,
  is_completed BOOLEAN, completed_by TEXT, completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT st.id AS task_id, st.title, st.description, st.emoji, st.timing, st.display_order,
         COALESCE(stc.is_completed, false) AS is_completed, stc.completed_by, stc.completed_at
  FROM shift_tasks st
  LEFT JOIN shift_task_completions stc ON st.id = stc.task_id AND stc.week_date = p_week_date
  WHERE st.is_active = true
  ORDER BY st.timing, st.display_order;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION toggle_shift_task(p_task_id UUID, p_week_date DATE, p_completed_by TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  current_status BOOLEAN;
  new_status BOOLEAN;
BEGIN
  SELECT is_completed INTO current_status
  FROM shift_task_completions
  WHERE task_id = p_task_id AND week_date = p_week_date;

  new_status := NOT COALESCE(current_status, false);

  INSERT INTO shift_task_completions (task_id, week_date, is_completed, completed_by, completed_at)
  VALUES (
    p_task_id, p_week_date, new_status,
    CASE WHEN new_status THEN p_completed_by ELSE NULL END,
    CASE WHEN new_status THEN now() ELSE NULL END
  )
  ON CONFLICT (task_id, week_date) DO UPDATE SET
    is_completed = new_status,
    completed_by = CASE WHEN new_status THEN p_completed_by ELSE NULL END,
    completed_at = CASE WHEN new_status THEN now() ELSE NULL END;

  RETURN new_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Sync metadata (single "last modified" row read by the sync indicator)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_by TEXT,
  change_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sync_metadata (modified_by, change_count)
SELECT 'system', 0 WHERE NOT EXISTS (SELECT 1 FROM sync_metadata);

-- ============================================
-- updated_at triggers
-- ============================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['volunteers', 'shift_assignments', 'action_items', 'kb_articles'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_' || t || '_updated_at' AND tgrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
                     'update_' || t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- Realtime for the tables the Ops Hub subscribes to
-- ============================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['handoffs', 'shift_assignments', 'action_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
