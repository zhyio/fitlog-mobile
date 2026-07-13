type CloudSnapshot = { workouts: any[]; plans: Record<string, any[]> }

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://owqhouyafggdzgcqwlji.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_QgsSE7ZoIfcaPsJLlkfS5w_tGvRz_I6'
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

async function rpc<T>(name: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!response.ok) return null
    return await response.json() as T
  } catch { return null }
}

export async function loadCloudSnapshot() {
  return rpc<CloudSnapshot>('load_fitlog_snapshot', {})
}

export async function saveCloudSnapshot(snapshot: CloudSnapshot) {
  return (await rpc<boolean>('save_fitlog_snapshot', { snapshot })) === true
}
