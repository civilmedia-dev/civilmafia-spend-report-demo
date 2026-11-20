# Spend CivilMafia

Reporte general de spend de paid media de CivilMafia sobre el datalake en BigQuery (`civil-datalake`).
Muestra spend total y tendencia mensual de los últimos 12 meses, con desglose por plataforma
(Basis, Meta, Google Ads, TikTok), por seat y por cliente/cuenta, más impresiones y clics.
Es la versión app del artefacto validado en claude.ai, con la misma consulta.

- **Stack:** Next.js 15 (App Router) + TypeScript, listo para Vercel.
- **Datos:** BigQuery, consultado **solo del lado del servidor** con una service account.
  El navegador recibe filas ya agregadas, nunca credenciales ni SQL.
- **Look & feel:** Civil Mafia Design System (dark-first, azul `#2a00ff`, Komu New + Neue Haas Grotesk).

## Estructura

```
src/
  app/
    page.tsx            # página (server component): consulta BigQuery y renderiza el dashboard
    api/spend/route.ts  # GET /api/spend → filas normalizadas en JSON
    layout.tsx, globals.css
  components/           # dashboard y gráficos (client components, sin acceso a BigQuery)
  lib/                  # tipos, agregaciones y formato compartidos
  server/               # solo servidor: cliente BigQuery, variables de entorno, SQL
  middleware.ts         # Basic Auth opcional
```

## Datos y lógica

| Plataforma | Fuente | Spend | Moneda |
|---|---|---|---|
| Basis | `windsor_gbq_civil.basis_campaigns-civil114823` y `-latv115086` (seat = sufijo) | `total_spend` | se asume USD (la tabla no trae moneda) |
| Meta | `windsor_gbq_civil.facebook_ads_all` | `spend` | `account_currency` |
| TikTok | `windsor_gbq_civil.tiktokAds_campaigns_all` | `spend` | `currency` |
| Google Ads | `civil_curated_views.google_ads_native_basic_performance` (`report_grain = 'campaign'`) y, solo para cuenta-mes sin dato nativo, `windsor_gbq_civil.googleAds_campaigns_all` | `spend` | `currency_code` |

- **Sin doble conteo de Google Ads:** si una cuenta tiene dato nativo en un mes, se ignora Windsor para esa cuenta y mes (los IDs de Windsor traen guiones; se normalizan).
- **Cliente y cuenta de negocio:** primero la regla más específica de `rules_dimension_mapping` (por seat y campaña, luego `priority`); si no hay cuenta, `rules_campaign_account_mapping` (nombre exacto de campaña o token de campaña contenido en el nombre); el cliente sale de `rules_account_catalog`. Lo demás aparece como **Sin asignar**.
- **Monedas:** hay USD, ARS y COP. Nunca se suman entre sí: totales y gráficos usan la moneda elegida, las tablas separan por moneda y se muestra un aviso cuando hay más de una.
- La consulta está en `src/server/spend-query.ts`. El resultado se cachea en el servidor `SPEND_CACHE_MINUTES` minutos (60 por defecto).

## Variables de entorno

Copia `.env.example` a `.env.local` (no se sube al repo) y completa:

| Variable | Uso |
|---|---|
| `BIGQUERY_PROJECT_ID` | Proyecto de BigQuery. Default `civil-datalake`. |
| `BIGQUERY_DATASET` | Dataset Windsor. Default `windsor_gbq_civil`. |
| `BIGQUERY_CURATED_DATASET` | Dataset de vistas curadas. Default `civil_curated_views`. |
| `BIGQUERY_LOCATION` | Ubicación. Default `US`. |
| `BIGQUERY_CREDENTIALS_PATH` | Solo local: ruta a un JSON de service account (fuera del repo). |
| `GCP_CLIENT_EMAIL` / `GCP_PRIVATE_KEY` | Vercel: credenciales de la service account. |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | Opcional: si existen ambas, el sitio pide usuario y contraseña. |
| `SPEND_CACHE_MINUTES` | Opcional: minutos de cache del resultado. Default 60. |

Orden de credenciales: `GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY` → `BIGQUERY_CREDENTIALS_PATH` → Application Default Credentials (`gcloud auth application-default login`).

### Service account

Crea (o reutiliza) una service account en `civil-datalake` con los roles mínimos:

- `BigQuery Data Viewer` (`roles/bigquery.dataViewer`) sobre los datasets `windsor_gbq_civil`, `civil_curated_views` y `raw_google_ads_native` (la vista curada lee de este último).
- `BigQuery Job User` (`roles/bigquery.jobUser`) en el proyecto, para poder ejecutar consultas.

No subas nunca el JSON de la service account. El `.gitignore` ya excluye `.env*`, `*credentials*.json` y `service-account*.json`.

## Desarrollo local

Requiere Node 20 o superior.

```bash
npm install
cp .env.example .env.local   # y completa las credenciales
npm run dev                  # http://localhost:3000
```

Validación antes de subir cambios:

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploy en Vercel

1. En Vercel: **Add New → Project → Import Git Repository** y elige este repo.
2. Framework preset **Next.js**. Root directory: la raíz del repo (donde está `package.json`). Build y output por defecto.
3. En **Settings → Environment Variables** agrega, para Production (y Preview si aplica):
   - `BIGQUERY_PROJECT_ID=civil-datalake`, `BIGQUERY_DATASET=windsor_gbq_civil`, `BIGQUERY_LOCATION=US`
   - `GCP_CLIENT_EMAIL` = `client_email` del JSON de la service account
   - `GCP_PRIVATE_KEY` = `private_key` del JSON (puede pegarse con los `\n` literales)
   - Recomendado: `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD`, o activa **Deployment Protection** (Vercel Authentication) en Settings.
4. Deploy. Cada push a la rama principal redeploya; cada PR genera un preview.

El sitio se marca `noindex`, y `/api/spend` queda protegido por el mismo middleware que la página.
