CREATE TABLE IF NOT EXISTS pathway_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pathway_slug text NOT NULL,
  step_id uuid NOT NULL REFERENCES pathway_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'current', 'complete')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, step_id)
);

ALTER TABLE pathway_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own progress"
  ON pathway_progress FOR SELECT
  USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "users can upsert own progress"
  ON pathway_progress FOR ALL
  USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));
