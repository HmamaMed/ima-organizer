import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Storage client for direct-to-bucket media uploads (photos, audio).
 *
 * Config comes from Vite env vars (VITE_SUPABASE_*). If they're not set, the
 * module degrades gracefully — uploads will throw a clear error rather than
 * crashing the app.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = 'media';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

/**
 * Uploads a Blob to the "media" Supabase Storage bucket under the given path
 * and returns its public URL.
 */
export async function uploadToStorage(path: string, blob: Blob): Promise<string> {
  const supabase = getClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
