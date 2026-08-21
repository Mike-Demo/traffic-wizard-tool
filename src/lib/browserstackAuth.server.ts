import { createBrowserStackClient } from "./browserstack.server";
import {
  deleteUserBrowserStackCredentials,
  getUserBrowserStackCredentials,
  maskUsername,
  saveUserBrowserStackCredentials,
} from "./browserstackCredentials.server";

export async function loadBrowserStackCredentials(
  userId: string,
): Promise<{ username: string; accessKey: string } | null> {
  const userCreds = await getUserBrowserStackCredentials(userId);
  if (userCreds) return userCreds;
  const envUser = process.env["BROWSERSTACK_USERNAME"];
  const envKey = process.env["BROWSERSTACK_ACCESS_KEY"];
  if (envUser && envKey) return { username: envUser, accessKey: envKey };
  return null;
}

function sanitizeUsername(raw: string) {
  const username = raw.trim();
  if (/\s/.test(username) || username.includes("://") || username.includes("/")) {
    throw new Error(
      "That doesn't look like a BrowserStack username. Copy the username shown on your BrowserStack Automate settings page (not a URL or email).",
    );
  }
  return username;
}

export async function saveAndTestBrowserStackCredentials(
  userId: string,
  rawUsername: string,
  rawAccessKey: string,
) {
  const username = sanitizeUsername(rawUsername);
  const accessKey = rawAccessKey.trim();

  // Test BEFORE persisting so invalid credentials never get stored.
  const client = createBrowserStackClient(username, accessKey);
  let plan: Awaited<ReturnType<typeof client.plan>>;
  try {
    plan = await client.plan();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401")) {
      throw new Error(
        "BrowserStack rejected these credentials (401). Check the username and access key on your BrowserStack Automate settings page and try again.",
      );
    }
    throw new Error(message);
  }

  await saveUserBrowserStackCredentials(userId, username, accessKey);
  return {
    saved: true as const,
    connected: true as const,
    plan: plan.automate_plan ?? "unknown",
    running: plan.parallel_sessions_running ?? 0,
    max: plan.parallel_sessions_max_allowed ?? 1,
  };
}

export async function clearBrowserStackCredentials(userId: string) {
  await deleteUserBrowserStackCredentials(userId);
  return { cleared: true as const };
}

export { maskUsername };
