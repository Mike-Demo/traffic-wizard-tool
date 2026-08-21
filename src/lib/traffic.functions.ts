import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createBrowserStackClient } from "./browserstack.server";
import {
  getUserBrowserStackCredentials,
  maskUsername,
  saveUserBrowserStackCredentials,
} from "./browserstackCredentials.server";
import { normalizeConfig, planSessions } from "./traffic-planner";
import type { TrafficConfig } from "./traffic-presets";

const configSchema = z.object({
  browsers: z.array(z.string()).min(1),
  countries: z.array(z.string()),
  sessions: z.number(),
  paths: z.array(z.string()),
  pagesPerSession: z.number(),
  dwellMin: z.number(),
  dwellMax: z.number(),
  bouncePercent: z.number(),
});

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100, "Username too long"),
  accessKey: z.string().trim().min(1, "Access key is required").max(200, "Access key too long"),
});

async function loadCredentials(userId: string): Promise<{ username: string; accessKey: string } | null> {
  const userCreds = await getUserBrowserStackCredentials(userId);
  if (userCreds) return userCreds;
  const envUser = process.env["BROWSERSTACK_USERNAME"];
  const envKey = process.env["BROWSERSTACK_ACCESS_KEY"];
  if (envUser && envKey) return { username: envUser, accessKey: envKey };
  return null;
}

export const saveBrowserStackCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; accessKey: string }) => credentialsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await saveUserBrowserStackCredentials(context.userId, data.username, data.accessKey);
    const client = createBrowserStackClient(data.username, data.accessKey);
    const plan = await client.plan();
    return {
      saved: true as const,
      connected: true as const,
      plan: plan.automate_plan ?? "unknown",
      running: plan.parallel_sessions_running ?? 0,
      max: plan.parallel_sessions_max_allowed ?? 1,
    };
  });

export const hasBrowserStackCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await loadCredentials(context.userId);
    if (!creds) return { configured: false as const };
    return { configured: true as const, username: maskUsername(creds.username) };
  });

export const checkBrowserStack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await loadCredentials(context.userId);
    if (!creds) {
      return {
        connected: false as const,
        missingCredentials: true as const,
        error: "BrowserStack credentials not configured",
      };
    }
    const client = createBrowserStackClient(creds.username, creds.accessKey);
    try {
      const plan = await client.plan();
      return {
        connected: true as const,
        plan: plan.automate_plan ?? "unknown",
        running: plan.parallel_sessions_running ?? 0,
        max: plan.parallel_sessions_max_allowed ?? 1,
      };
    } catch (err) {
      return {
        connected: false as const,
        missingCredentials: false as const,
        error: err instanceof Error ? err.message : "Failed",
      };
    }
  });

export const createRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUrl: string; authorized: boolean; config: TrafficConfig }) =>
    z
      .object({
        targetUrl: z.string().url(),
        authorized: z.literal(true),
        config: configSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const config = normalizeConfig(data.config as TrafficConfig);
    const planned = planSessions(config);

    const { data: run, error } = await context.supabase
      .from("runs")
      .insert({
        user_id: context.userId,
        target_url: data.targetUrl,
        authorized: true,
        config,
        status: "queued",
        total_sessions: planned.length,
      })
      .select("id")
      .single();
    if (error || !run) throw new Error(error?.message ?? "Could not create run");

    const { error: sErr } = await context.supabase.from("run_sessions").insert(
      planned.map((p) => ({
        run_id: run.id,
        user_id: context.userId,
        browser_label: p.browser_label,
        capabilities: p.capabilities as Record<string, string>,
        country: p.country,
        planned_paths: p.planned_paths,
      })),
    );
    if (sErr) throw new Error(sErr.message);

    return { runId: run.id as string };
  });

export const runBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; batchSize: number }) =>
    z.object({ runId: z.string().uuid(), batchSize: z.number().min(1).max(5) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { executeBatch } = await import("./traffic-runner.server");
    const creds = await loadCredentials(context.userId);
    if (!creds) throw new Error("BrowserStack credentials not configured");
    return executeBatch(context.supabase, data.runId, data.batchSize, creds);
  });

export const stopRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("runs").update({ status: "stopped" }).eq("id", data.runId);
    await context.supabase
      .from("run_sessions")
      .update({ status: "cancelled" })
      .eq("run_id", data.runId)
      .eq("status", "queued");
    return { ok: true };
  });

export const getRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: run } = await context.supabase
      .from("runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    const { data: sessions } = await context.supabase
      .from("run_sessions")
      .select("*")
      .eq("run_id", data.runId)
      .order("created_at", { ascending: true });
    return { run, sessions: sessions ?? [] };
  });

export const listRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    return data ?? [];
  });
