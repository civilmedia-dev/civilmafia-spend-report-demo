import Dashboard from "@/components/Dashboard";
import { getSpend } from "@/server/spend";

// Siempre en el servidor y en runtime: BigQuery nunca se consulta en el build ni desde el navegador.
export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const result = await getSpend();
    return <Dashboard rows={result.rows} fetchedAt={result.fetchedAt} />;
  } catch (err) {
    console.error("[spend] error consultando BigQuery", err);
    return (
      <main className="cm-page">
        <header className="cm-head">
          <p className="cm-kicker">CivilMafia · Paid media</p>
          <h1 className="cm-title">Spend<span className="cm-dot" /></h1>
        </header>
        <div className="cm-error" role="alert">
          <strong>No se pudieron cargar los datos de BigQuery.</strong>
          <p>Revisa que las variables de entorno de la service account estén configuradas y que tenga los roles BigQuery Data Viewer y BigQuery Job User en civil-datalake. El detalle quedó en los logs del servidor.</p>
        </div>
      </main>
    );
  }
}
