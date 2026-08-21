CREATE TABLE public.verified_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  token TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

GRANT SELECT ON public.verified_domains TO authenticated;
GRANT ALL ON public.verified_domains TO service_role;

ALTER TABLE public.verified_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own domains"
ON public.verified_domains FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_verified_domains_user ON public.verified_domains(user_id);