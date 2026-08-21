import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserStackClient } from "./browserstack.server";
import { joinUrl } from "./traffic-planner";

type AnyClient = SupabaseClient<any, any, any>;

type SessionRow = {
  id: string;
  run_id: string;
  browser_label: string;
  capabilities: Record<string, unknown>;
  country: string | null;
  planned_paths: string[];
};

async function runOne(
  supabase: AnyClient,
  row: SessionRow,
  targetUrl: string,
  dwellMin: number,
  dwellMax: number,
  buildName: string,
  credentials: { username: string; accessKey: string },
) {
  const client = createBrowserStackClient(credentials.username, credentials.accessKey);
  let bsId: string | null = null;
  try {
    bsId = await client.createSession({
      caps: row.capabilities,
      country: row.country,
      sessionName: `${row.browser_label}${row.country ? " · " + row.country : ""}`,
      buildName,
    });
    await supabase
      .from("run_sessions")
      .update({ status: "running", bs_session_id: bsId, started_at: new Date().toISOString() })
      .eq("id", row.id);

    let visited = 0;
    for (const path of row.planned_paths) {
      await client.navigate(bsId, joinUrl(targetUrl, path));
      await client.getTitle(bsId);
      visited++;
      await supabase.from("run_sessions").update({ pages_visited: visited }).eq("id", row.id);
      const dwell = dwellMin + Math.random() * Math.max(0, dwellMax - dwellMin);
      await new Promise((r) => setTimeout(r, dwell * 1000));
    }

    await client.quitSession(bsId);
    await supabase
      .from("run_sessions")
      .update({ status: "/passed", finished_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true };
  } catch (err) {
    if (bsId) await client.quitSession(bsId);
    await supabase
      .from("run_sessions")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: false };
  }
}

export async function executeBatch(
  supabase: AnyClient,
  runId: string,
  batchSize: number,
  credentials: { username: string; accessKey: string },
) {
  const { data: run, error: runErr } = await supabase
    .from("runs")
    .select("id, target_url, config, status")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error("Run not found");
  if (run.status === "stopped") return { done: true, ran: 0 };

  const { data: pending } = await supabase
    .from("run_sessions")
    .select("id, run_id, browser_label, capabilities, country, planned_paths")
    .eq("run_id", runId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  const rows = (pending ?? []) as SessionRow[];
  if (!rows.length) {
    await finalize(supabase, runId);
    return { done: true, ran: 0 };
  }

  await supabase.from("runs").update({ status: "running" }).eq("id", runId);

  const cfg = (run.config ?? {}) as { dwellMin?: number; dwellMax?: number };
  const buildName = `run-${runId.slice(0, 8)}`;
  await Promise.all(
    rows.map((r) =>
      runOne(supabase, r, run.target_url as string, cfg.dwellMin ?? 3, cfg.dwellMax ?? 6, buildName, credentials),
    ),
  );

  const remaining = await countQueued(supabase, runId);
  await refreshCounts(supabase, runId);
  if (remaining === 0) await finalize(supabase, runId);
  return { done: remaining === 0, ran: rows.length };
}

async function countQueued(supabase: AnyClient, runId: string) {
  const { count } = await supabase
    .from("run_sessions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("status", "queued");
  return count ?? 0;
}

async function refreshCounts(supabase: AnyClient, runId: string) {
  const { data } = await supabase.from("run_sessions").select("status").eq("run_id", runId);
  const rows = data ?? [];
  await supabase
    .from("runs")
    .update({
      completed_sessions: rows.filter((r: { status: string }) => r.status === "passed").length,
      failed_sessions: rows.filter((r: { status: string }) => r.status === "failed").length,
    })
    .eq("id", runId);
}

async function finalize(supabase: AnyClient, runId: string) {
  await refreshCounts(supabase, runId);
  const { data } = await supabase.from("runs").select("status").eq("id", runId).single();
  if (data?.status !== "stopped") {
    await supabase.from("runs").update({ status: "finished" }).eq("id", runId);
  }
}
