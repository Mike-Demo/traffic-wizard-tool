import { createBrowserStackClient } from "./browserstack.server";
import {
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

export async function saveAndTestBrowserStackCredentials(
  userId: string,
  username: string,
  accessKey: string,
) {
  await saveUserBrowserStackCredentials(userId, username, accessKey);
  const client = createBrowserStackClient(username, accessKey);
  const plan = await client.plan();
  return {
    saved: true as const,
    connected: true as const,
    plan: plan.automate_plan ?? "unknown",
    running: plan.parallel_sessions_running ?? 0,
    max: plan.parallel_sessions_max_allowed ?? 1,
  };
}

export { maskUsername };
