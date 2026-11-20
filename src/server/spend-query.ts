import "server-only";

/**
 * Consulta normalizada de spend (últimos 12 meses calendario, incluido el mes en curso).
 * - Basis: dos seats (civil114823, latv115086); spend = total_spend; moneda asumida USD (la tabla no trae moneda).
 * - Meta: facebook_ads_all · TikTok: tiktokAds_campaigns_all.
 * - Google Ads: vista curada nativa y, solo para cuenta-mes sin dato nativo, Windsor (evita doble conteo).
 * - Cliente/cuenta: rules_dimension_mapping → rules_campaign_account_mapping → rules_account_catalog.
 * Es la misma consulta que usa el artefacto de claude.ai validado.
 */
export function buildSpendQuery(opts: { projectId: string; windsorDataset: string; curatedDataset: string }): string {
  const p = opts.projectId;
  const w = opts.windsorDataset;
  const c = opts.curatedDataset;
  for (const v of [p, w, c]) {
    if (!/^[A-Za-z0-9_-]+$/.test(v)) throw new Error("Identificador de BigQuery inválido en la configuración");
  }
  return `-- CivilMafia · spend mensual normalizado (últimos 12 meses, incluye el mes en curso)
WITH win AS (
  SELECT DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH), MONTH) AS d0
),
gads_native AS (
  SELECT DATE_TRUNC(n.date, MONTH) AS m, n.account_id, n.account_name AS seat, n.currency_code AS currency,
         n.campaign_name AS platform_campaign,
         SUM(n.spend) AS spend, SUM(n.impressions) AS impressions, SUM(n.clicks) AS clicks
  FROM \`${p}.${c}.google_ads_native_basic_performance\` n, win
  WHERE n.report_grain = 'campaign' AND n.date >= win.d0
  GROUP BY m, account_id, seat, currency, platform_campaign
),
native_keys AS (SELECT DISTINCT m, account_id FROM gads_native),
facts AS (
  SELECT 'Basis' AS platform, 'civil114823' AS seat, 'USD' AS currency, DATE_TRUNC(b.date, MONTH) AS m, b.campaign AS platform_campaign,
         CAST(SUM(b.total_spend) AS FLOAT64) AS spend, CAST(SUM(b.impressions_won) AS FLOAT64) AS impressions, CAST(SUM(b.clicks) AS FLOAT64) AS clicks
  FROM \`${p}.${w}.basis_campaigns-civil114823\` b, win
  WHERE b.date >= win.d0 GROUP BY m, platform_campaign
  UNION ALL
  SELECT 'Basis', 'latv115086', 'USD', DATE_TRUNC(b.date, MONTH), b.campaign,
         CAST(SUM(b.total_spend) AS FLOAT64), CAST(SUM(b.impressions_won) AS FLOAT64), CAST(SUM(b.clicks) AS FLOAT64)
  FROM \`${p}.${w}.basis_campaigns-latv115086\` b, win
  WHERE b.date >= win.d0 GROUP BY 4, 5
  UNION ALL
  SELECT 'Meta', f.account_name, f.account_currency, DATE_TRUNC(f.date, MONTH), f.campaign,
         CAST(SUM(f.spend) AS FLOAT64), CAST(SUM(f.impressions) AS FLOAT64), CAST(SUM(f.clicks) AS FLOAT64)
  FROM \`${p}.${w}.facebook_ads_all\` f, win
  WHERE f.date >= win.d0 GROUP BY 2, 3, 4, 5
  UNION ALL
  SELECT 'TikTok', t.account_name, t.currency, DATE_TRUNC(t.date, MONTH), t.campaign,
         CAST(SUM(t.spend) AS FLOAT64), CAST(SUM(t.impressions) AS FLOAT64), CAST(SUM(t.clicks) AS FLOAT64)
  FROM \`${p}.${w}.tiktokAds_campaigns_all\` t, win
  WHERE t.date >= win.d0 GROUP BY 2, 3, 4, 5
  UNION ALL
  -- Google Ads vía Windsor solo para cuenta-mes sin dato nativo (evita doble conteo)
  SELECT 'Google Ads', g.account_name, COALESCE(g.currency_code, g.currency), DATE_TRUNC(g.date, MONTH), g.campaign,
         CAST(SUM(g.spend) AS FLOAT64), CAST(SUM(g.impressions) AS FLOAT64), CAST(SUM(g.clicks) AS FLOAT64)
  FROM \`${p}.${w}.googleAds_campaigns_all\` g, win
  WHERE g.date >= win.d0
    AND NOT EXISTS (
      SELECT 1 FROM native_keys k
      WHERE k.m = DATE_TRUNC(g.date, MONTH)
        AND k.account_id = REPLACE(CAST(g.account_id AS STRING), '-', ''))
  GROUP BY 2, 3, 4, 5
  UNION ALL
  SELECT 'Google Ads', seat, currency, m, platform_campaign,
         CAST(spend AS FLOAT64), CAST(impressions AS FLOAT64), CAST(clicks AS FLOAT64)
  FROM gads_native
),
dm AS (
  SELECT REGEXP_REPLACE(REPLACE(LOWER(platform), 'facebook', 'meta'), r'[^a-z]', '') AS p,
         seat, platform_campaign, client, account, effective_start_date, effective_end_date,
         COALESCE(priority, 0) AS priority,
         IF(seat IS NULL, 0, 1) + IF(platform_campaign IS NULL, 0, 1) AS spec
  FROM \`${p}.${w}.rules_dimension_mapping\`
  WHERE COALESCE(is_active, TRUE)
    AND platform_campaign_id IS NULL AND platform_adset_id IS NULL AND platform_adset IS NULL
),
cm AS (
  SELECT parsed_account_name, NULLIF(TRIM(campaign), '') AS bcampaign, assigned_account
  FROM \`${p}.${w}.rules_campaign_account_mapping\`
  WHERE COALESCE(is_active, TRUE)
),
ac AS (
  SELECT account, ANY_VALUE(client) AS client
  FROM \`${p}.${w}.rules_account_catalog\`
  WHERE COALESCE(is_active, TRUE) GROUP BY account
),
keys AS (SELECT DISTINCT platform, seat, m, platform_campaign FROM facts),
dm_pick AS (
  SELECT k.platform, k.seat, k.m, k.platform_campaign, d.client, d.account
  FROM keys k JOIN dm d
    ON d.p = REGEXP_REPLACE(LOWER(k.platform), r'[^a-z]', '')
   AND (d.seat IS NULL OR d.seat = k.seat)
   AND (d.platform_campaign IS NULL OR d.platform_campaign = k.platform_campaign)
   AND (d.effective_start_date IS NULL OR d.effective_start_date <= LAST_DAY(k.m))
   AND (d.effective_end_date IS NULL OR d.effective_end_date >= k.m)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY k.platform, k.seat, k.m, k.platform_campaign
                             ORDER BY d.spec DESC, d.priority DESC) = 1
),
cm_pick AS (
  SELECT k.platform, k.seat, k.m, k.platform_campaign, c.assigned_account
  FROM keys k JOIN cm c
    ON k.platform_campaign = c.parsed_account_name
    OR (c.bcampaign IS NOT NULL AND STRPOS(k.platform_campaign, c.bcampaign) > 0)
    OR (c.bcampaign IS NULL AND STRPOS(c.parsed_account_name, ' ') = 0
        AND STRPOS(k.platform_campaign, c.parsed_account_name) > 0)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY k.platform, k.seat, k.m, k.platform_campaign
                             ORDER BY IF(k.platform_campaign = c.parsed_account_name, 0, 1),
                                      LENGTH(COALESCE(c.bcampaign, c.parsed_account_name)) DESC) = 1
),
resolved AS (
  SELECT f.*,
         COALESCE(d.account, c.assigned_account) AS account,
         COALESCE(d.client, a.client) AS client
  FROM facts f
  LEFT JOIN dm_pick d USING (platform, seat, m, platform_campaign)
  LEFT JOIN cm_pick c USING (platform, seat, m, platform_campaign)
  LEFT JOIN ac a ON a.account = COALESCE(d.account, c.assigned_account)
)
SELECT FORMAT_DATE('%Y-%m', m) AS month, platform, seat, currency,
       COALESCE(client, 'Sin asignar') AS client,
       COALESCE(account, 'Sin asignar') AS account,
       ROUND(SUM(spend), 2) AS spend,
       CAST(ROUND(SUM(impressions)) AS INT64) AS impressions,
       CAST(ROUND(SUM(clicks)) AS INT64) AS clicks
FROM resolved
GROUP BY month, platform, seat, currency, client, account
HAVING spend > 0 OR impressions > 0
ORDER BY month, platform, seat, client, account
`;
}
