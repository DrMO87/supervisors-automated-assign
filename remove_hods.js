require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const hods = [
  "msalim@horus.edu.eg",
  "agamal@horus.edu.eg",
  "ahassan@horus.edu.eg",
  "aelgaml@horus.edu.eg",
  "helewa@horus.edu.eg",
  "afares@horus.edu.eg"
];

async function removeHODs() {
  const { error } = await supabase.from('staff').delete().in('email', hods);
  if (error) {
    console.error('Error removing HODs from staff table:', error);
  } else {
    console.log('Successfully removed HODs from staff table.');
  }
}

removeHODs();
