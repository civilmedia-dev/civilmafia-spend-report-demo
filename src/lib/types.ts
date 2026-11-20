export const PLATFORMS = ["Basis", "Meta", "Google Ads", "TikTok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const UNASSIGNED = "Sin asignar";

/** Una fila por mes × plataforma × seat × moneda × cliente × cuenta. */
export interface SpendRow {
  month: string; // YYYY-MM
  platform: Platform;
  seat: string;
  currency: string;
  client: string;
  account: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface SpendResult {
  rows: SpendRow[];
  fetchedAt: string;
}

export interface Filters {
  from: string; // "" = sin límite
  to: string;
  platform: string; // "" = todas
  client: string; // "" = todos
  currency: string; // moneda de totales y gráficos
}

export const DEFAULT_FILTERS: Filters = { from: "", to: "", platform: "", client: "", currency: "USD" };
