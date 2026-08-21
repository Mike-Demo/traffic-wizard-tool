import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptCredential, encryptCredential } from "./bsCredentialsCrypto.server";

export async function getUserBrowserStackCredentials(
  userId: string,
): Promise<{ username: string; accessKey: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("user_browserstack_credentials")
    .select("username_ciphertext, access_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return {
      username: decryptCredential(data.username_ciphertext),
      accessKey: decryptCredential(data.access_key_ciphertext),
    };
  } catch {
    return null;
  }
}

export async function saveUserBrowserStackCredentials(
  userId: string,
  username: string,
  accessKey: string,
) {
  const { error } = await supabaseAdmin.from("user_browserstack_credentials").upsert(
    {
      user_id: userId,
      username_ciphertext: encryptCredential(username),
      access_key_ciphertext: encryptCredential(accessKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export function maskUsername(username: string) {
  if (username.length <= 3) return "*".repeat(username.length);
  return username.slice(0, 3) + "*".repeat(username.length - 3);
}
