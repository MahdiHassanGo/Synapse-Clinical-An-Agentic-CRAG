import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("node_started", { node: "patient_extractor", run_id: id, timestamp: Date.now() });
      send("node_completed", { node: "patient_extractor", status: "SUCCESS", timestamp: Date.now() });

      send("node_started", { node: "crag_router", run_id: id, timestamp: Date.now() });
      send("crag_eval", { score: 0.94, grade: "RELEVANT", timestamp: Date.now() });
      send("node_completed", { node: "crag_router", status: "SUCCESS", timestamp: Date.now() });

      send("node_started", { node: "safety_gate", run_id: id, timestamp: Date.now() });
      send("hitl_triggered", { run_id: id, reason: "Severe interaction hazard", timestamp: Date.now() });
      send("run_finished", { run_id: id, status: "PAUSED_FOR_REVIEW", timestamp: Date.now() });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
