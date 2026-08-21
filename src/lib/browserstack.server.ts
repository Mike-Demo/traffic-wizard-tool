const HUB = "https://hub-cloud.browserstack.com/wd/hub";

export function bsAuthHeader() {
  const user = process.env["BROWSERSTACK_USERNAME"];
  const key = process.env["BROWSERSTACK_ACCESS_KEY"];
  if (!user || !key) throw new Error("BrowserStack credentials are not configured");
  return "Basic " + Buffer.from(`${user}:${key}`).toString("base64");
}

export async function bsPlan() {
  const res = await fetch("https://api.browserstack.com/automate/plan.json", {
    headers: { Authorization: bsAuthHeader() },
  });
  if (!res.ok) throw new Error(`BrowserStack plan check failed (${res.status})`);
  return (await res.json()) as {
    automate_plan?: string;
    parallel_sessions_running?: number;
    parallel_sessions_max_allowed?: number;
  };
}

type WdResponse = { value: unknown };

async function wd(path: string, init: RequestInit): Promise<WdResponse> {
  const res = await fetch(`${HUB}${path}`, {
    ...init,
    headers: {
      Authorization: bsAuthHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({ value: null }))) as WdResponse;
  if (!res.ok) {
    const v = json.value as { message?: string } | null;
    throw new Error(v?.message ?? `WebDriver error ${res.status}`);
  }
  return json;
}

export async function createSession(opts: {
  caps: Record<string, unknown>;
  country: string | null;
  sessionName: string;
  buildName: string;
}) {
  const { browserName, browserVersion, ...rest } = opts.caps as Record<string, string>;
  const bstack: Record<string, unknown> = {
    ...rest,
    projectName: "Analytics Traffic Simulator",
    buildName: opts.buildName,
    sessionName: opts.sessionName,
    seleniumVersion: "4.0.0",
  };
  if (opts.country) bstack["geoLocation"] = opts.country;

  const body = {
    capabilities: {
      alwaysMatch: {
        browserName: browserName ?? "chrome",
        ...(browserVersion ? { browserVersion } : {}),
        "bstack:options": bstack,
      },
    },
  };
  const json = await wd("/session", { method: "POST", body: JSON.stringify(body) });
  const value = json.value as { sessionId?: string } & Record<string, unknown>;
  const sessionId = value?.sessionId ?? (json as unknown as { sessionId?: string }).sessionId;
  if (!sessionId) throw new Error("BrowserStack did not return a session id");
  return sessionId;
}

export async function navigate(sessionId: string, url: string) {
  await wd(`/session/${sessionId}/url`, { method: "POST", body: JSON.stringify({ url }) });
}

export async function getTitle(sessionId: string) {
  const json = await wd(`/session/${sessionId}/title`, { method: "GET" });
  return String(json.value ?? "");
}

export async function quitSession(sessionId: string) {
  try {
    await wd(`/session/${sessionId}`, { method: "DELETE" });
  } catch {
    /* session may already be gone */
  }
}

export function sessionUrl(sessionId: string) {
  return `https://automate.browserstack.com/dashboard/v2/search?query=${sessionId}&type=sessions`;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
