import { webDefaults } from "@/lib/cleanup";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ ok: true, defaults: webDefaults() }, { status: 200 });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
