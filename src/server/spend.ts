import "server-only";
import { unstable_cache } from "next/cache";
import { getBigQuery } from "./bigquery";
import { env } from "./env";
import { buildSpendQuery } from "./spend-query";
import type { SpendRow, SpendResult } from "@/lib/types";

async function querySpend(): Promise<SpendResult> {
  const bq = getBigQuery();
  const query = buildSpendQuery({
    projectId: env.projectId,
    windsorDataset: env.windsorDataset,
    curatedDataset: env.curatedDataset,
  });
  const [rows] = await bq.query({
    query,
    location: env.location,
    labels: { app: "civilmafia-spend-report" },
    jobTimeoutMs: 120_000,
  });
  const data: SpendRow[] = (rows as Record<string, unknown>[]).map((r) => ({
    month: String(r.month),
    platform: String(r.platform) as SpendRow["platform"],
    seat: String(r.seat ?? ""),
    currency: String(r.currency ?? "USD"),
    client: String(r.client ?? "Sin asignar"),
    account: String(r.account ?? "Sin asignar"),
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
  }));
  return { rows: data, fetchedAt: new Date().toISOString() };
}

/** Resultado cacheado en el servidor durante SPEND_CACHE_MINUTES. */
export const getSpend = unstable_cache(querySpend, ["spend-v1"], {
  revalidate: env.cacheMinutes * 60,
  tags: ["spend"],
});
