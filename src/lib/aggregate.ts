import { PLATFORMS, UNASSIGNED, type Filters, type SpendRow } from "./types";

const sum = (rows: SpendRow[], f: (r: SpendRow) => number) => rows.reduce((a, r) => a + f(r), 0);
const ratio = (a: number, b: number) => (b ? a / b : null);

/** Filtra por meses, plataforma y cliente (no por moneda). */
export function applyFilters(rows: SpendRow[], f: Filters): SpendRow[] {
  return rows.filter(
    (r) =>
      (!f.from || r.month >= f.from) &&
      (!f.to || r.month <= f.to) &&
      (!f.platform || r.platform === f.platform) &&
      (!f.client || r.client === f.client),
  );
}

export function currenciesOf(rows: SpendRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.currency))).sort((a, b) =>
    a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b),
  );
}

export function byCurrency(rows: SpendRow[]) {
  return currenciesOf(rows).map((currency) => {
    const v = rows.filter((r) => r.currency === currency);
    const spend = sum(v, (r) => r.spend);
    const impressions = sum(v, (r) => r.impressions);
    return { currency, spend, impressions, clicks: sum(v, (r) => r.clicks), cpm: impressions ? (spend / impressions) * 1000 : null };
  });
}

/** Spend y CPM en una moneda; impresiones, clics y CTR de todas las monedas. */
export function kpis(rows: SpendRow[], currency: string) {
  const inCur = rows.filter((r) => r.currency === currency);
  const spend = sum(inCur, (r) => r.spend);
  const impCur = sum(inCur, (r) => r.impressions);
  const impressions = sum(rows, (r) => r.impressions);
  const clicks = sum(rows, (r) => r.clicks);
  const unassigned = sum(inCur.filter((r) => r.client === UNASSIGNED), (r) => r.spend);
  return {
    currency,
    spend,
    impressions,
    clicks,
    ctr: ratio(clicks, impressions),
    cpm: impCur ? (spend / impCur) * 1000 : null,
    unassignedShare: ratio(unassigned, spend),
  };
}

export type MonthlyRow = { month: string; spend: number; impressions: number; clicks: number } & Record<(typeof PLATFORMS)[number], number>;

/** Meses del rango (aunque no tengan spend en la moneda elegida). */
export function monthly(allRows: SpendRow[], filtered: SpendRow[], f: Filters): MonthlyRow[] {
  const months = Array.from(new Set(allRows.map((r) => r.month)))
    .sort()
    .filter((m) => (!f.from || m >= f.from) && (!f.to || m <= f.to));
  return months.map((month) => {
    const mr = filtered.filter((r) => r.month === month);
    const o = { month, impressions: sum(mr, (r) => r.impressions), clicks: sum(mr, (r) => r.clicks) } as MonthlyRow;
    let total = 0;
    for (const p of PLATFORMS) {
      o[p] = sum(mr.filter((r) => r.platform === p && r.currency === f.currency), (r) => r.spend);
      total += o[p];
    }
    o.spend = total;
    return o;
  });
}

/** Último mes completo (excluye el mes en curso) frente al anterior. */
export function monthOverMonth(rows: MonthlyRow[], now = new Date()) {
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const full = rows.filter((r) => r.month < cur);
  if (full.length < 2) return null;
  const a = full[full.length - 1];
  const b = full[full.length - 2];
  return { month: a.month, spend: a.spend, prevMonth: b.month, prevSpend: b.spend, change: ratio(a.spend, b.spend) === null ? null : a.spend / b.spend - 1 };
}

export function byPlatform(rows: SpendRow[], currency: string) {
  const inCur = rows.filter((r) => r.currency === currency);
  const total = sum(inCur, (r) => r.spend);
  return PLATFORMS.map((platform) => {
    const v = inCur.filter((r) => r.platform === platform);
    const spend = sum(v, (r) => r.spend);
    return { platform, spend, share: ratio(spend, total) };
  }).sort((a, b) => b.spend - a.spend);
}

function groupBy<K extends string>(rows: SpendRow[], keys: (r: SpendRow) => Record<K, string>) {
  const m = new Map<string, { dims: Record<K, string>; rows: SpendRow[] }>();
  for (const r of rows) {
    const dims = keys(r);
    const k = Object.values(dims).join(" | ");
    const e = m.get(k) ?? { dims, rows: [] };
    e.rows.push(r);
    m.set(k, e);
  }
  return Array.from(m.entries()).map(([key, e]) => ({
    key,
    ...e.dims,
    spend: sum(e.rows, (r) => r.spend),
    impressions: sum(e.rows, (r) => r.impressions),
    clicks: sum(e.rows, (r) => r.clicks),
    platforms: Array.from(new Set(e.rows.map((r) => r.platform))).sort().join(", "),
  }));
}

export function bySeat(rows: SpendRow[], currency: string) {
  return groupBy(rows, (r) => ({ platform: r.platform as string, seat: r.seat, currency: r.currency }))
    .map((g) => ({ ...g, ctr: ratio(g.clicks, g.impressions) }))
    .sort((a, b) => Number(b.currency === currency) - Number(a.currency === currency) || a.currency.localeCompare(b.currency) || b.spend - a.spend);
}

export function byClient(rows: SpendRow[], currency: string) {
  return groupBy(rows, (r) => ({ client: r.client, account: r.account, currency: r.currency })).sort(
    (a, b) =>
      Number(b.currency === currency) - Number(a.currency === currency) ||
      a.currency.localeCompare(b.currency) ||
      Number(a.client === UNASSIGNED) - Number(b.client === UNASSIGNED) ||
      b.spend - a.spend,
  );
}
