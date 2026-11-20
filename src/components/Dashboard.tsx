"use client";

import { useMemo, useState } from "react";
import { DEFAULT_FILTERS, PLATFORMS, UNASSIGNED, type Filters, type SpendRow } from "@/lib/types";
import { applyFilters, byClient, byCurrency, byPlatform, bySeat, currenciesOf, kpis, monthOverMonth, monthly } from "@/lib/aggregate";
import { fmtInt, fmtMoney, fmtMonth, fmtPct } from "@/lib/format";
import { MonthlyLine, PLATFORM_COLOR, StackedMonthly } from "./charts";

export default function Dashboard({ rows, fetchedAt }: { rows: SpendRow[]; fetchedAt: string }) {
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.month))).sort(), [rows]);
  const clients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.client))).sort((a, b) => Number(a === UNASSIGNED) - Number(b === UNASSIGNED) || a.localeCompare(b)),
    [rows],
  );
  const allCurrencies = useMemo(() => currenciesOf(rows), [rows]);
  const cur = f.currency;

  const filtered = useMemo(() => applyFilters(rows, f), [rows, f]);
  const k = useMemo(() => kpis(filtered, cur), [filtered, cur]);
  const curTotals = useMemo(() => byCurrency(filtered), [filtered]);
  const mRows = useMemo(() => monthly(rows, filtered, f), [rows, filtered, f]);
  const mom = useMemo(() => monthOverMonth(mRows), [mRows]);
  const plats = useMemo(() => byPlatform(filtered, cur), [filtered, cur]);
  const seats = useMemo(() => bySeat(filtered, cur), [filtered, cur]);
  const clientRows = useMemo(() => byClient(filtered, cur), [filtered, cur]);
  const top = plats[0];
  const maxPlat = Math.max(1, ...plats.map((p) => p.spend));

  return (
    <main className="cm-page">
      <header className="cm-head cm-grid-bg">
        <p className="cm-kicker">CivilMafia · Paid media · civil-datalake</p>
        <h1 className="cm-title">Spend<span className="cm-dot" /></h1>
        <p className="cm-lede">
          En el período elegido, el spend en <b>{cur}</b> fue <b>{fmtMoney(k.spend, cur)}</b>.
          {top && top.spend > 0 && <> <b>{top.platform}</b> concentra <b>{fmtPct(top.share)}</b> de ese spend.</>}
          {mom && <> En el último mes completo (<b>{fmtMonth(mom.month)}</b>) se invirtieron <b>{fmtMoney(mom.spend, cur)}</b>
            {mom.change != null && <>, <b>{mom.change >= 0 ? "+" : "−"}{fmtPct(Math.abs(mom.change))}</b> frente a {fmtMonth(mom.prevMonth)}</>}.</>}
        </p>
      </header>

      <div className="cm-filters">
        <div className="cm-field"><label htmlFor="f-from">Desde</label>
          <select id="f-from" value={f.from} onChange={set("from")}><option value="">Primer mes</option>{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</select></div>
        <div className="cm-field"><label htmlFor="f-to">Hasta</label>
          <select id="f-to" value={f.to} onChange={set("to")}><option value="">Último mes</option>{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</select></div>
        <div className="cm-field"><label htmlFor="f-platform">Plataforma</label>
          <select id="f-platform" value={f.platform} onChange={set("platform")}><option value="">Todas</option>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
        <div className="cm-field"><label htmlFor="f-client">Cliente</label>
          <select id="f-client" value={f.client} onChange={set("client")}><option value="">Todos</option>{clients.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="cm-field"><label htmlFor="f-currency">Moneda de los gráficos</label>
          <select id="f-currency" value={f.currency} onChange={set("currency")}>{(allCurrencies.length ? allCurrencies : ["USD"]).map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <button type="button" className="cm-btn" onClick={() => setF(DEFAULT_FILTERS)}>Quitar filtros</button>
      </div>

      {curTotals.length > 1 && (
        <div className="cm-alert" role="note">
          <strong>Hay spend en más de una moneda.</strong> Las monedas no se suman entre sí: los totales y gráficos muestran solo {cur}, y las tablas separan cada fila por moneda.
          Monedas en el filtro actual: {curTotals.map((c) => `${c.currency} ${fmtMoney(c.spend, c.currency)}`).join(" · ")}.
        </div>
      )}

      <section className="cm-tiles" aria-label="Indicadores">
        <div className="cm-tile"><span className="cm-tile-label">Spend · {cur}</span><span className="cm-tile-value">{fmtMoney(k.spend, cur)}</span>
          <span className="cm-tile-note">{mRows.length ? `${fmtMonth(mRows[0].month)} – ${fmtMonth(mRows[mRows.length - 1].month)}` : "—"}</span></div>
        <div className="cm-tile"><span className="cm-tile-label">Impresiones · todas las monedas</span><span className="cm-tile-value">{fmtInt(k.impressions)}</span>
          <span className="cm-tile-note">Basis: impressions won</span></div>
        <div className="cm-tile"><span className="cm-tile-label">Clics · todas las monedas</span><span className="cm-tile-value">{fmtInt(k.clicks)}</span>
          <span className="cm-tile-note">CTR {fmtPct(k.ctr, 2)}</span></div>
        <div className="cm-tile"><span className="cm-tile-label">CPM · {cur}</span><span className="cm-tile-value">{fmtMoney(k.cpm, cur, 2)}</span>
          <span className="cm-tile-note">Spend ÷ impresiones × 1.000</span></div>
        <div className="cm-tile"><span className="cm-tile-label">Spend sin cliente asignado</span><span className="cm-tile-value">{fmtPct(k.unassignedShare)}</span>
          <span className="cm-tile-note">Sin regla en las tablas rules_*</span></div>
      </section>

      <section className="cm-section">
        <h2 className="cm-h2">Spend mensual por plataforma</h2>
        <p className="cm-sub">Barras apiladas en {cur}. El mes en curso está incompleto.</p>
        <div className="cm-legend">{PLATFORMS.map((p) => <span key={p}><i className="cm-sw" style={{ background: PLATFORM_COLOR[p] }} />{p}</span>)}</div>
        <StackedMonthly rows={mRows} currency={cur} />
      </section>

      <section className="cm-two">
        <div className="cm-section"><h2 className="cm-h2">Impresiones por mes</h2><p className="cm-sub">Todas las monedas, con los filtros de plataforma y cliente.</p>
          <MonthlyLine rows={mRows} field="impressions" label="Impresiones" /></div>
        <div className="cm-section"><h2 className="cm-h2">Clics por mes</h2><p className="cm-sub">Todas las monedas, con los filtros de plataforma y cliente.</p>
          <MonthlyLine rows={mRows} field="clicks" label="Clics" /></div>
      </section>

      <section className="cm-section">
        <h2 className="cm-h2">Spend por plataforma</h2>
        <p className="cm-sub">{cur}, período filtrado. El porcentaje es la parte del total en esa moneda.</p>
        <div className="cm-bars">
          {plats.map((p) => (
            <div className="cm-bar-row" key={p.platform}>
              <span>{p.platform}</span>
              <div className="cm-bar-track"><div className="cm-bar-fill" style={{ width: `${(p.spend / maxPlat) * 100}%`, background: PLATFORM_COLOR[p.platform] }} /></div>
              <span className="cm-bar-val">{fmtMoney(p.spend, cur)}<small>{fmtPct(p.share)}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="cm-section">
        <h2 className="cm-h2">Totales por moneda</h2>
        <p className="cm-sub">Cada moneda por separado. No hay conversión de tipo de cambio.</p>
        <div className="cm-table-wrap"><table className="cm-table">
          <thead><tr><th>Moneda</th><th className="num">Spend</th><th className="num">Impresiones</th><th className="num">Clics</th><th className="num">CPM</th></tr></thead>
          <tbody>{curTotals.map((r) => (
            <tr key={r.currency} className={r.currency !== cur ? "other" : undefined}>
              <td>{r.currency}</td><td className="num">{fmtMoney(r.spend, r.currency)}</td><td className="num">{fmtInt(r.impressions)}</td><td className="num">{fmtInt(r.clicks)}</td><td className="num">{fmtMoney(r.cpm, r.currency, 2)}</td>
            </tr>))}</tbody>
        </table></div>
      </section>

      <section className="cm-section">
        <h2 className="cm-h2">Spend por seat</h2>
        <p className="cm-sub">Seat = cuenta de la plataforma (en Basis, el sufijo de la tabla). Ordenado por moneda y spend.</p>
        <div className="cm-table-wrap"><table className="cm-table">
          <thead><tr><th>Plataforma</th><th>Seat</th><th>Moneda</th><th className="num">Spend</th><th className="num">Impresiones</th><th className="num">Clics</th><th className="num">CTR</th></tr></thead>
          <tbody>{seats.length ? seats.map((r) => (
            <tr key={r.key} className={r.currency !== cur ? "other" : undefined}>
              <td>{r.platform}</td><td>{r.seat}</td><td>{r.currency}</td><td className="num">{fmtMoney(r.spend, r.currency)}</td><td className="num">{fmtInt(r.impressions)}</td><td className="num">{fmtInt(r.clicks)}</td><td className="num">{fmtPct(r.ctr, 2)}</td>
            </tr>)) : <tr><td colSpan={7} className="cm-empty">No hay datos para estos filtros.</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="cm-section">
        <h2 className="cm-h2">Spend por cliente y cuenta</h2>
        <p className="cm-sub">Cliente y cuenta de negocio según rules_dimension_mapping, rules_campaign_account_mapping y rules_account_catalog.</p>
        <div className="cm-table-wrap"><table className="cm-table">
          <thead><tr><th>Cliente</th><th>Cuenta</th><th>Moneda</th><th className="num">Spend</th><th className="num">Impresiones</th><th className="num">Clics</th><th>Plataformas</th></tr></thead>
          <tbody>{clientRows.length ? clientRows.map((r) => (
            <tr key={r.key} className={r.currency !== cur ? "other" : undefined}>
              <td>{r.client === UNASSIGNED ? <span className="cm-pill">{UNASSIGNED}</span> : r.client}</td><td>{r.account}</td><td>{r.currency}</td>
              <td className="num">{fmtMoney(r.spend, r.currency)}</td><td className="num">{fmtInt(r.impressions)}</td><td className="num">{fmtInt(r.clicks)}</td><td>{r.platforms}</td>
            </tr>)) : <tr><td colSpan={7} className="cm-empty">No hay datos para estos filtros.</td></tr>}</tbody>
        </table></div>
      </section>

      <details className="cm-notes">
        <summary>Cómo se calcula este reporte</summary>
        <ul>
          <li>Fuentes: Basis (seats civil114823 y latv115086), Meta (facebook_ads_all) y TikTok (tiktokAds_campaigns_all) en windsor_gbq_civil; Google Ads desde la vista curada google_ads_native_basic_performance y, para cuenta-mes sin dato nativo, desde googleAds_campaigns_all (Windsor), para no contar dos veces.</li>
          <li>Spend de Basis = total_spend (media + data). La tabla de Basis no trae moneda; se asume USD.</li>
          <li>Ventana: últimos 12 meses calendario, incluido el mes en curso.</li>
          <li>Cliente y cuenta: regla más específica de rules_dimension_mapping; si no hay cuenta, rules_campaign_account_mapping; el cliente de la cuenta sale de rules_account_catalog.</li>
          <li>Las monedas (USD, ARS, COP…) no se convierten ni se suman entre sí.</li>
        </ul>
      </details>

      <footer className="cm-foot">Datos de BigQuery (civil-datalake) consultados el {new Date(fetchedAt).toLocaleString("es-MX", { timeZone: "UTC" })} UTC.</footer>
    </main>
  );
}
