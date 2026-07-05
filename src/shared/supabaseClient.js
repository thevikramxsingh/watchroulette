import { createClient } from '@supabase/supabase-js'

// Vite only exposes env vars prefixed with VITE_ to client code — that
// prefix is the actual security boundary between "safe to ship in the
// browser bundle" and "build-time only." The anon key is meant to be
// public; Row Level Security policies on the tables (see schema.sql) are
// what actually control what the anon key can do, not secrecy of the key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from Project Settings > API.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
