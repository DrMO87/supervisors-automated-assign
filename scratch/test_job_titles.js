import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('staff').select('job_title');
  if (error) {
    console.error(error);
    return;
  }
  const titles = new Set(data.map(s => s.job_title));
  console.log(Array.from(titles));
}

check();
