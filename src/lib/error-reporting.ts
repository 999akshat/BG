/**
 * Minimal client-side error reporting.
 *
 * Errors caught by React error boundaries are logged with route context so they
 * show up in the browser console and in any log collector you attach later.
 * Point `sendToCollector` at your own endpoint (or Sentry/Highlight/etc.) when
 * you want persistent error tracking.
 */

export type ReportedError = {
  message: string;
  stack?: string;
  route: string;
  at: string;
  context: Record<string, unknown>;
};

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Response) {
    return { message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` };
  }
  if (error instanceof Error) {
    return { message: error.message, ...(error.stack ? { stack: error.stack } : {}) };
  }
  return { message: String(error) };
}

/** Replace the body with a fetch to your own logging endpoint if you need one. */
function sendToCollector(payload: ReportedError) {
  console.error("[app-error]", payload);
}

export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const { message, stack } = describe(error);
  sendToCollector({
    message,
    ...(stack ? { stack } : {}),
    route: window.location.pathname,
    at: new Date().toISOString(),
    context,
  });
}
