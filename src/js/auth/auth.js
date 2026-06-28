// @hash 1d32d8b0 2026-06-28T12:33
// ════ AUTH — Supabase client ════
// Единственный файл который знает о Supabase URL и anon key.
// Все остальные auth/* импортируют _sb из этого файла.
//
// Настройка: замени SUPABASE_URL и SUPABASE_ANON_KEY
// на значения из Supabase → Settings → API

// ── Конфигурация ─────────────────────────────────────────────
const SUPABASE_URL      = '__SUPABASE_URL__';      // заменить при деплое
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__'; // заменить при деплое

// ── Клиент (глобальный синглтон) ─────────────────────────────
// Supabase JS v2 подключается через CDN в index.html:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,   // нужно для OAuth callback и invite links
  },
});

// Явный RPC fetch для GitHub Pages/Supabase CDN edge-case:
// у некоторых _sb.rpc() запросов apikey header не доходил до PostgREST.
// Этот helper всегда отправляет и apikey, и Authorization.
async function sbRpc(fn, args = {}) {
  const { data: { session } = {} } = await _sb.auth.getSession();
  const bearer = session?.access_token || SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if(!res.ok) return { data: null, error: data || { message: res.statusText, status: res.status } };
  return { data, error: null };
}

// ── Провайдеры OAuth ─────────────────────────────────────────
const AUTH_PROVIDERS = {
  google:  { provider: 'google',  label: 'Google',  icon: '🔵' },
  discord: { provider: 'discord', label: 'Discord', icon: '🟣' },
};

// ── Вспомогательные обёртки ──────────────────────────────────

// Короткий SELECT с авто-throw на ошибку
async function dbSelect(table, query = q => q) {
  const { data, error } = await query(_sb.from(table).select('*'));
  if(error) throw error;
  return data;
}

// INSERT с возвратом строки
async function dbInsert(table, row) {
  const { data, error } = await _sb.from(table).insert(row).select().single();
  if(error) throw error;
  return data;
}

// UPDATE по id
async function dbUpdate(table, id, changes) {
  const { data, error } = await _sb.from(table)
    .update(changes).eq('id', id).select().single();
  if(error) throw error;
  return data;
}

// DELETE по id
async function dbDelete(table, id) {
  const { error } = await _sb.from(table).delete().eq('id', id);
  if(error) throw error;
}

// UPSERT (INSERT OR UPDATE)
async function dbUpsert(table, row, conflictCol = 'id') {
  const { data, error } = await _sb.from(table)
    .upsert(row, { onConflict: conflictCol }).select().single();
  if(error) throw error;
  return data;
}
