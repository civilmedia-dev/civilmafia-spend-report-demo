import "server-only";
import { BigQuery } from "@google-cloud/bigquery";
import { env } from "./env";

let client: BigQuery | null = null;

/**
 * Cliente de BigQuery solo para el servidor.
 * Orden de credenciales: GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY (Vercel) →
 * BIGQUERY_CREDENTIALS_PATH (local) → Application Default Credentials.
 */
export function getBigQuery(): BigQuery {
  if (client) return client;
  if (env.clientEmail && env.privateKey) {
    client = new BigQuery({
      projectId: env.projectId,
      location: env.location,
      credentials: { client_email: env.clientEmail, private_key: env.privateKey },
    });
  } else if (env.credentialsPath) {
    client = new BigQuery({ projectId: env.projectId, location: env.location, keyFilename: env.credentialsPath });
  } else {
    client = new BigQuery({ projectId: env.projectId, location: env.location });
  }
  return client;
}
