
CREATE TABLE public.support_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  agent_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_ratings" ON public.support_ratings FOR ALL USING (false) WITH CHECK (false);
CREATE UNIQUE INDEX idx_support_ratings_session ON public.support_ratings(session_id);
