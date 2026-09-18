import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * সুপাবেজ ক্লায়েন্ট — শুধু তখনই তৈরি হয় যখন এনভায়রনমেন্ট ভেরিয়েবল সেট করা থাকে।
 * ভেরিয়েবল না থাকলে `null` (ক্লায়েন্ট তৈরি করতে গেলে আগে রানটাইম ক্র্যাশ করত)।
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isSupabaseConfigured = supabase !== null
