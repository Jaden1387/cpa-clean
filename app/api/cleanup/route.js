import { executeCleanup } from "@/lib/cleanup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("JSON body must be an object");
    }
  } catch (error) {
    return Response.json({ ok: false, error: `invalid json: ${String(error)}` }, { status: 400 });
  }

  const logs = [];
  const addLog = (line) => {
    logs.push(line);
    if (logs.length > 5000) logs.splice(0, logs.length - 5000);
  };

  try {
    const summary = await executeCleanup(payload, addLog);
    return Response.json(
      { ok: true, status: "completed", summary, logs: logs.join("\n") },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { ok: false, status: "failed", error: String(error), logs: logs.join("\n") },
      { status: 500 }
    );
  }
}
