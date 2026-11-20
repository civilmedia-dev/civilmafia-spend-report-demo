import { NextResponse } from "next/server";
import { getSpend } from "@/server/spend";

export const dynamic = "force-dynamic";

/** Filas normalizadas en JSON (útil para exportar). Protegido por el mismo middleware que la página. */
export async function GET() {
  try {
    const result = await getSpend();
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[spend] error consultando BigQuery", err);
    return NextResponse.json({ error: "No se pudieron cargar los datos." }, { status: 502 });
  }
}
