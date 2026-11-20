import "server-only";

export const env = {
  projectId: process.env.BIGQUERY_PROJECT_ID || "civil-datalake",
  windsorDataset: process.env.BIGQUERY_DATASET || "windsor_gbq_civil",
  curatedDataset: process.env.BIGQUERY_CURATED_DATASET || "civil_curated_views",
  location: process.env.BIGQUERY_LOCATION || "US",
  credentialsPath: process.env.BIGQUERY_CREDENTIALS_PATH || "",
  clientEmail: process.env.GCP_CLIENT_EMAIL || "",
  privateKey: (process.env.GCP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  cacheMinutes: Math.max(1, Number(process.env.SPEND_CACHE_MINUTES || 60) || 60),
};
