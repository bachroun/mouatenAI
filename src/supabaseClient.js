import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Variables Supabase manquantes : ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env (voir .env.example)."
  );
}

export const supabase = createClient(url, anonKey);
