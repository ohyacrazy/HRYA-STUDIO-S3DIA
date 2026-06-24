declare module "jsr:@supabase/functions-js/edge-runtime.d.ts";
declare module "jsr:@supabase/supabase-js@2" {
  import type { SupabaseClient } from "@supabase/supabase-js";
  export function createClient(url: string, key: string): SupabaseClient;
}

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
  function serve(handler: (req: Request) => unknown): void;
}
