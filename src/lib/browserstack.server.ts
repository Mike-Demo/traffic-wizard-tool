const HUB = "https://hub-cloud.browserstack.com/wd/hub";

export function bsAuthHeader(username: string, accessKey: string) {
  return "Basic " + Buffer.from(`${username}:${accessKey}`).toString("base64");
}

type WdResponse = { value: unknown };

export function createBrowserStackClient(username: string, accessKey: string) {
  const authHeader = bsAuthHeader(username, accessKey);

  async function wd(path: string, init: RequestInit): Promise<WdResponse> {
    const res = await fetch(`${HUB}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader,
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

  async function plan() {
    const res = await fetch("https://api.browserstack.com/automate/plan.json", {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) throw new Error(`BrowserStack plan check failed (${res.status})`);
    return (await res.json()) as {
      automate_plan?: string;
      parallel_sessions_running?: number;
      parallel_sessions_max_allowed?: number;
    };
  }

  async function createSession(opts: {
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

  async function navigate(sessionId: string, url: string) {
    await wd(`/session/${sessionId}/url`, { method: "POST", body: JSON.stringify({ url }) });
  }

  async function getTitle(sessionId: string) {
    const json = await wd(`/session/${sessionId}/title`, { method: "GET" });
    return String(json.value ?? "");
  }

  async function quitSession(sessionId: string) {
    try {
      await wd(`/session/${sessionId}`, { method: "DELETE" });
    } catch {
      /* session may already be gone */
    }
  }

  return { plan, createSession, navigate, getTitle, quitSession };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
