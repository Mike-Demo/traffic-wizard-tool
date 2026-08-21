CREATE POLICY "No direct user access to BrowserStack credentials"
ON public.user_browserstack_credentials
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);