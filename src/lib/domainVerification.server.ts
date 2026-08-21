import { randomBytes } from "node:crypto";

export type DomainRow = {
  id: string;
  domain: string;
  token: string;
  verified_at: string | null;
  last_checked_at: string | null;
};

const TXT_PREFIX = "traffic-simulator-verify=";

/** Normalize a hostname: lowercase, strip trailing dot and leading "www.". */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      /* fall through */
    }
  }
  value = value.replace(/^www\./, "").replace(/\.$/, "").split("/")[0] ?? "";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    throw new Error("Enter a valid domain, e.g. example.com");
  }
  return value;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listDomains(userId: string): Promise<DomainRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("verified_domains")
    .select("id, domain, token, verified_at, last_checked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DomainRow[];
}

export async function addDomain(userId: string, rawDomain: string): Promise<DomainRow> {
  const domain = normalizeDomain(rawDomain);
  const db = await admin();
  const { data: existing } = await db
    .from("verified_domains")
    .select("id, domain, token, verified_at, last_checked_at")
    .eq("user_id", userId)
    .eq("domain", domain)
    .maybeSingle();
  if (existing) return existing as DomainRow;

  const token = randomBytes(16).toString("hex");
  const { data, error } = await db
    .from("verified_domains")
    .insert({ user_id: userId, domain, token })
    .select("id, domain, token, verified_at, last_checked_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add domain");
  return data as DomainRow;
}

export async function removeDomain(userId: string, rawDomain: string): Promise<void> {
  const domain = normalizeDomain(rawDomain);
  const db = await admin();
  const { error } = await db
    .from("verified_domains")
    .delete()
    .eq("user_id", userId)
    .eq("domain", domain);
  if (error) throw new Error(error.message);
}

async function dnsTxtRecords(name: string): Promise<string[]> {
  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { Answer?: Array<{ data?: string }> };
  return (json.Answer ?? [])
    .map((a) => (a.data ?? "").replace(/^"|"$/g, "").replace(/""/g, ""))
    .filter(Boolean);
}

async function wellKnownToken(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${domain}/.well-known/traffic-simulator-verify.txt`, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim().slice(0, 200);
    return text || null;
  } catch {
    return null;
  }
}

/** Check DNS TXT or a well-known file for the domain's token, then persist the result. */
export async function verifyDomain(
  userId: string,
  rawDomain: string,
): Promise<{ verified: boolean; domain: string; error?: string }> {
  const domain = normalizeDomain(rawDomain);
  const db = await admin();
  const { data: row } = await db
    .from("verified_domains")
    .select("id, token")
    .eq("user_id", userId)
    .eq("domain", domain)
    .maybeSingle();
  if (!row) throw new Error("Domain not found. Add it first.");

  const token = (row as { token: string }).token;
  const expected = `${TXT_PREFIX}${token}`;

  const txt = [
    ...(await dnsTxtRecords(domain)),
    ...(await dnsTxtRecords(`_traffic-simulator.${domain}`)),
  ];
  let verified = txt.some((t) => t.trim() === expected);
  if (!verified) {
    const file = await wellKnownToken(domain);
    verified = file === token || file === expected;
  }

  await db
    .from("verified_domains")
    .update({
      last_checked_at: new Date().toISOString(),
      ...(verified ? { verified_at: new Date().toISOString() } : {}),
    })
    .eq("id", (row as { id: string }).id);

  return verified
    ? { verified: true, domain }
    : {
        verified: false,
        domain,
        error: "Verification record not found yet. DNS changes can take a few minutes.",
      };
}

/**
 * Throws unless the signed-in user has proven control of the target URL's host.
 * This is the server-side gate that replaces the client-side "I own this" checkbox.
 */
export async function assertTargetAuthorized(userId: string, targetUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new Error("Invalid target URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Target URL must be http or https");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  const db = await admin();
  const { data, error } = await db
    .from("verified_domains")
    .select("domain")
    .eq("user_id", userId)
    .not("verified_at", "is", null);
  if (error) throw new Error(error.message);

  const owned = (data ?? []).some((d) => {
    const domain = (d as { domain: string }).domain;
    return host === domain || host.endsWith(`.${domain}`);
  });
  if (!owned) {
    throw new Error(
      `You have not verified ownership of ${host}. Add and verify the domain before running traffic against it.`,
    );
  }
  return host;
}

export const VERIFICATION_TXT_PREFIX = TXT_PREFIX;
