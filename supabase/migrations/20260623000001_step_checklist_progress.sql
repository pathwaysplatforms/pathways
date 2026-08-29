CREATE TABLE step_checklist_progress (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_id       uuid        NOT NULL REFERENCES pathway_steps(id) ON DELETE CASCADE,
  checked_items jsonb       NOT NULL DEFAULT '[]',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step_id)
);

ALTER TABLE step_checklist_progress ENABLE ROW LEVEL SECURITY;

-- Single policy covering all operations; WITH CHECK locks inserts/updates to own rows.
CREATE POLICY "users can manage own checklist progress"
  ON step_checklist_progress
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Assertion block: raises an exception (rolling back this transaction) if the table
-- or its RLS policy were not created successfully.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'step_checklist_progress'
  ) THEN
    RAISE EXCEPTION 'Assertion failed: table step_checklist_progress was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'step_checklist_progress'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Assertion failed: RLS is not enabled on step_checklist_progress';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'step_checklist_progress'
  ) THEN
    RAISE EXCEPTION 'Assertion failed: no RLS policies found on step_checklist_progress';
  END IF;
END $$;
