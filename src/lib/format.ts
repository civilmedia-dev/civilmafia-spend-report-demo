const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtMonth(m: string): string {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1]} ${y.slice(2)}`;
}

export function fmtMoney(v: number | null | undefined, currency: string, digits = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${Math.round(v).toLocaleString("es-MX")}`;
  }
}

export function fmtInt(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "—" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(v);
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  return v == null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(digits)}%`;
}

export function fmtCompact(v: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}
