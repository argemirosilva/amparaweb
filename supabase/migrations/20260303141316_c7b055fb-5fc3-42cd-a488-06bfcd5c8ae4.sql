
-- Table for WhatsApp verification codes (generic, reusable across features)
CREATE TABLE public.support_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  attempts int NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Block all direct access — only edge functions via service role
ALTER TABLE public.support_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_direct_access_verification_codes"
  ON public.support_verification_codes
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Index for quick lookup by user
CREATE INDEX idx_support_verification_codes_user ON public.support_verification_codes(user_id, created_at DESC);
