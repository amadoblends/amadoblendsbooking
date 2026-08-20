import { NextResponse, type NextRequest } from "next/server";
import { runDueReminders } from "@/lib/notifications/reminders";

/*
 * Nothing here may be cached or pre-rendered: it has side effects and must
 * run at the moment it is called.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The scheduled tick that sends whatever reminders have come due.
 *
 * ── Why it's authenticated ───────────────────────────────────────────────
 * This URL is public by nature. Left open, anyone could hammer it — not to
 * send anything they choose (the content comes from the database), but to
 * drain the queue at the wrong moment or run up the email bill. The shared
 * secret makes it callable only by the scheduler.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
 *
 * Timing is deliberately not exact: a reminder is *due* from its send_at
 * onwards, so a tick every few minutes delivers everything that has come due
 * since the last one. Nothing is lost if a run is missed, and nothing is sent
 * twice if two overlap — the claim is atomic.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Refusing is safer than running an unprotected endpoint in production
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const result = await runDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

// Vercel Cron uses GET; POST is here for manual triggering during setup
export async function POST(request: NextRequest) {
  return handle(request);
}
