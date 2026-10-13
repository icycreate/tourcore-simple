import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Capture before Supabase exchanges the email-link token and clears the URL fragment.
export const passwordLink =
  typeof window !== "undefined" &&
  /type=(invite|recovery)/.test(window.location.hash);
export const supabase = url && key ? createClient(url, key) : null;
export const demoEnabled =
  !supabase && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
