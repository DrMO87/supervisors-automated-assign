const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://chauqwnfzjskbucoppwb.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_80BAZpxQpqVr6z50lv-H-Q_yxnCO97c';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debug() {
  const { data: sess } = await supabaseAdmin.from('exam_sessions').select('*').eq('id', '7a0fc27f-b31d-4ae9-a505-7e181fc75c81');
  console.log('Session for محمد:', sess);

  const { data: sess2 } = await supabaseAdmin.from('exam_sessions').select('*').eq('id', '34741fda-3c63-4185-aa02-bb630c00a7dd');
  console.log('Session for ندى:', sess2);
}
debug().catch(console.error);
