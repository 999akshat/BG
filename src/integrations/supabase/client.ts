import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? process.env["SUPABASE_URL"];
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ??
  process.env["SUPABASE_PUBLISHABLE_KEY"];

function isOpaqueKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Newer Supabase API keys are opaque strings rather than JWTs, so they must be
 * sent as `apikey` only — a bearer Authorization header makes PostgREST reject them.
 */
function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }
    if (isOpaqueKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.",
    );
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: supabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

let instance: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop, receiver) {
    if (!instance) instance = createSupabaseClient();
    return Reflect.get(instance, prop, receiver);
  },
});
