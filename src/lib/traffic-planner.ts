import { BROWSER_PRESETS, LIMITS, presetById, type TrafficConfig } from "./traffic-presets";

export type PlannedSession = {
  browser_label: string;
  capabilities: Record<string, unknown>;
  country: string | null;
  planned_paths: string[];
};

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

export function normalizeConfig(input: TrafficConfig): TrafficConfig {
  const browsers = input.browsers.filter((b) => !!presetById(b));
  const paths = input.paths.map((p) => p.trim()).filter(Boolean).slice(0, 12);
  const dwellMin = Math.min(
    Math.max(input.dwellMin, LIMITS.minDwellSeconds),
    LIMITS.maxDwellSeconds,
  );
  const dwellMax = Math.min(Math.max(input.dwellMax, dwellMin), LIMITS.maxDwellSeconds);
  return {
    browsers: browsers.length ? browsers : [BROWSER_PRESETS[0]!.id],
    countries: input.countries,
    sessions: Math.min(Math.max(Math.round(input.sessions), 1), LIMITS.maxSessions),
    paths: paths.length ? paths : ["/"],
    pagesPerSession: Math.min(Math.max(Math.round(input.pagesPerSession), 1), LIMITS.maxPagesPerSession),
    dwellMin,
    dwellMax,
    bouncePercent: Math.min(Math.max(Math.round(input.bouncePercent), 0), 100),
  };
}

export function planSessions(config: TrafficConfig): PlannedSession[] {
  const out: PlannedSession[] = [];
  for (let i = 0; i < config.sessions; i++) {
    const preset = presetById(pick(config.browsers, i))!;
    const country = config.countries.length ? pick(config.countries, i) : null;
    const bounce = (i * 100) / config.sessions < config.bouncePercent;
    const pageCount = bounce ? 1 : config.pagesPerSession;
    const paths: string[] = [];
    for (let p = 0; p < pageCount; p++) {
      paths.push(pick(config.paths, i + p));
    }
    out.push({
      browser_label: preset.label,
      capabilities: preset.caps,
      country,
      planned_paths: paths,
    });
  }
  return out;
}

export function joinUrl(base: string, path: string) {
  try {
    return new URL(path, base).toString();
  } catch {
    return base;
  }
}
