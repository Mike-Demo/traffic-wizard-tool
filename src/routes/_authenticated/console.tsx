import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  ExternalLink,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BROWSER_PRESETS,
  COUNTRIES,
  DEFAULT_CONFIG,
  LIMITS,
  type TrafficConfig,
} from "@/lib/traffic-presets";
import {
  checkBrowserStack,
  createRun,
  getRun,
  hasBrowserStackCredentials,
  listRuns,
  runBatch,
  saveBrowserStackCredentials,
  stopRun,
} from "@/lib/traffic.functions";

export const Route = createFileRoute("/_authenticated/console")({
  head: () => ({
    meta: [
      { title: "Traffic Console · Analytics Traffic Simulator" },
      {
        name: "description",
        content:
          "Configure browser mix, geography and session behavior, then drive real BrowserStack sessions against your own site to validate analytics.",
      },
      { property: "og:title", content: "Traffic Console · Analytics Traffic Simulator" },
      {
        property: "og:description",
        content: "Drive real browser sessions from many devices and countries at your own site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsolePage,
});

type SessionRow = {
  id: string;
  browser_label: string;
  country: string | null;
  status: string;
  bs_session_id: string | null;
  pages_visited: number;
  planned_paths: string[];
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  queued: "border-warning/40 text-warning",
  running: "border-primary/50 text-primary",
  passed: "border-primary/50 text-primary",
  failed: "border-destructive/50 text-destructive",
  cancelled: "border-border text-muted-foreground",
};

function ConsolePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [targetUrl, setTargetUrl] = useState("https://example.com");
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<TrafficConfig>(DEFAULT_CONFIG);
  const [pathsText, setPathsText] = useState(DEFAULT_CONFIG.paths.join("\n"));
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const draining = useRef(false);

  const check = useServerFn(checkBrowserStack);
  const create = useServerFn(createRun);
  const batch = useServerFn(runBatch);
  const stop = useServerFn(stopRun);
  const fetchRun = useServerFn(getRun);
  const fetchRuns = useServerFn(listRuns);

  const connection = useQuery({
    queryKey: ["bs-connection"],
    queryFn: () => check({ data: undefined }),
    refetchOnWindowFocus: false,
  });

  const runQuery = useQuery({
    queryKey: ["run", activeRunId],
    queryFn: () => fetchRun({ data: { runId: activeRunId! } }),
    enabled: !!activeRunId,
    refetchInterval: activeRunId ? 3000 : false,
  });

  const history = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns({ data: undefined }),
  });

  const parallel = Math.max(1, Math.min(5, connection.data?.connected ? connection.data.max : 1));

  // Drive batches until the run finishes.
  useEffect(() => {
    if (!activeRunId || draining.current) return;
    const run = runQuery.data?.run as { status?: string } | undefined;
    if (!run || run.status === "finished" || run.status === "stopped") return;
    draining.current = true;
    (async () => {
      try {
        let done = false;
        while (!done) {
          const res = await batch({ data: { runId: activeRunId, batchSize: parallel } });
          done = res.done;
          await queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
        }
        toast.success("Run finished");
        queryClient.invalidateQueries({ queryKey: ["runs"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Run failed");
      } finally {
        draining.current = false;
        queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
      }
    })();
  }, [activeRunId, runQuery.data, batch, parallel, queryClient]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const paths = pathsText
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
      return create({
        data: { targetUrl, authorized: true as const, config: { ...config, paths } },
      });
    },
    onSuccess: (res) => {
      setActiveRunId(res.runId);
      toast.success("Run queued");
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not start run"),
  });

  const sessions = (runQuery.data?.sessions ?? []) as unknown as SessionRow[];
  const run = runQuery.data?.run as
    | { status: string; total_sessions: number; completed_sessions: number; failed_sessions: number }
    | undefined;

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
              traffic console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="mono text-xs text-muted-foreground">
              {connection.isLoading
                ? "checking…"
                : connection.data?.connected
                  ? `BrowserStack · ${connection.data.plan} · ${connection.data.running}/${connection.data.max} parallel`
                  : "BrowserStack not connected"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => connection.refetch()}
              aria-label="Recheck connection"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
        <section className="space-y-6 rounded-lg border border-border bg-card/60 p-5">
          <div className="space-y-2">
            <Label htmlFor="target">Target site</Label>
            <Input
              id="target"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://your-site.com"
              className="mono"
            />
            <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
              <Checkbox
                checked={authorized}
                onCheckedChange={(v) => setAuthorized(v === true)}
                className="mt-0.5"
              />
              <span>
                I own this domain or am authorized to run load and analytics tests against it.
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <Label>Browsers &amp; devices</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {BROWSER_PRESETS.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 rounded border border-border/60 px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={config.browsers.includes(b.id)}
                    onCheckedChange={() =>
                      setConfig((c) => ({ ...c, browsers: toggle(c.browsers, b.id) }))
                    }
                  />
                  <span>{b.label}</span>
                  <Badge variant="outline" className="ml-auto mono text-[10px] uppercase">
                    {b.kind}
                  </Badge>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Geography</Label>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => {
                const on = config.countries.includes(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={() =>
                      setConfig((cfg) => ({ ...cfg, countries: toggle(cfg.countries, c.code) }))
                    }
                    className={`mono rounded border px-2 py-1 text-xs transition-colors ${
                      on
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paths">Paths to walk (one per line)</Label>
            <Textarea
              id="paths"
              rows={4}
              value={pathsText}
              onChange={(e) => setPathsText(e.target.value)}
              className="mono text-xs"
            />
          </div>

          <div className="space-y-5">
            <SliderRow
              label="Sessions"
              value={config.sessions}
              min={1}
              max={LIMITS.maxSessions}
              onChange={(v) => setConfig((c) => ({ ...c, sessions: v }))}
            />
            <SliderRow
              label="Pages per session"
              value={config.pagesPerSession}
              min={1}
              max={LIMITS.maxPagesPerSession}
              onChange={(v) => setConfig((c) => ({ ...c, pagesPerSession: v }))}
            />
            <SliderRow
              label="Dwell min (s)"
              value={config.dwellMin}
              min={LIMITS.minDwellSeconds}
              max={LIMITS.maxDwellSeconds}
              onChange={(v) => setConfig((c) => ({ ...c, dwellMin: v }))}
            />
            <SliderRow
              label="Dwell max (s)"
              value={config.dwellMax}
              min={LIMITS.minDwellSeconds}
              max={LIMITS.maxDwellSeconds}
              onChange={(v) => setConfig((c) => ({ ...c, dwellMax: v }))}
            />
            <SliderRow
              label="Bounce %"
              value={config.bouncePercent}
              min={0}
              max={100}
              onChange={(v) => setConfig((c) => ({ ...c, bouncePercent: v }))}
            />
          </div>

          <Button
            className="w-full"
            disabled={!authorized || startMutation.isPending || run?.status === "running"}
            onClick={() => startMutation.mutate()}
          >
            <Play className="mr-2 h-4 w-4" />
            {startMutation.isPending ? "Starting…" : "Start run"}
          </Button>
          {!connection.data?.connected && !connection.isLoading && (
            <p className="mono text-xs text-warning">
              Add your BrowserStack credentials before starting a run.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <Tabs defaultValue="live">
            <TabsList>
              <TabsTrigger value="live">Live run</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 p-4">
                <Stat label="status" value={run?.status ?? "idle"} />
                <Stat label="planned" value={String(run?.total_sessions ?? 0)} />
                <Stat label="passed" value={String(run?.completed_sessions ?? 0)} />
                <Stat label="failed" value={String(run?.failed_sessions ?? 0)} />
                <div className="ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!activeRunId || run?.status !== "running"}
                    onClick={async () => {
                      await stop({ data: { runId: activeRunId! } });
                      queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
                      toast.info("Stopping run");
                    }}
                  >
                    <Square className="mr-2 h-3.5 w-3.5" /> Stop
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/50 mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Browser</th>
                      <th className="px-3 py-2">Geo</th>
                      <th className="px-3 py-2">Pages</th>
                      <th className="px-3 py-2">Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                          No sessions yet. Configure a mix and start a run.
                        </td>
                      </tr>
                    )}
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`mono text-[10px] uppercase ${STATUS_STYLES[s.status] ?? ""}`}
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{s.browser_label}</td>
                        <td className="mono px-3 py-2 text-xs">{s.country ?? "—"}</td>
                        <td className="mono px-3 py-2 text-xs">
                          {s.pages_visited}/{s.planned_paths.length}
                        </td>
                        <td className="mono px-3 py-2 text-xs">
                          {s.bs_session_id ? (
                            <a
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              target="_blank"
                              rel="noreferrer"
                              href={`https://automate.browserstack.com/dashboard/v2/search?query=${s.bs_session_id}&type=sessions`}
                            >
                              {s.bs_session_id.slice(0, 10)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                          {s.error && (
                            <div className="mt-1 text-[11px] text-destructive">{s.error}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-2">
                {(history.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRunId(r.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 text-left hover:border-primary/50"
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="mono text-xs">{r.target_url}</span>
                    <Badge variant="outline" className="mono text-[10px] uppercase">
                      {r.status}
                    </Badge>
                    <span className="mono ml-auto text-xs text-muted-foreground">
                      {r.completed_sessions}/{r.total_sessions} ok · {r.failed_sessions} failed
                    </span>
                  </button>
                ))}
                {(history.data ?? []).length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">No runs yet.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="mono text-xs text-primary">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v ?? min)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20">
      <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mono text-lg text-foreground">{value}</div>
    </div>
  );
}
