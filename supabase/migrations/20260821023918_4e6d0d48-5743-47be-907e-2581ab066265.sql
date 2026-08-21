CREATE TABLE public.user_browserstack_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username_ciphertext text NOT NULL,
  access_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT ALL ON public.user_browserstack_credentials TO service_role;
ALTER TABLE public.user_browserstack_credentials ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_browserstack_credentials_updated_at
  BEFORE UPDATE ON public.user_browserstack_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();