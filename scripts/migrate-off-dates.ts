import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateDates() {
  console.log('Fetching staff...');
  const { data: staffList, error } = await supabase.from('staff').select('id, specific_off_dates, specific_standard_off_dates');
  
  if (error) {
    console.error('Error fetching staff:', error);
    process.exit(1);
  }

  console.log(`Found ${staffList.length} staff members.`);
  
  let updatedCount = 0;
  for (const staff of staffList) {
    const oldDates = staff.specific_off_dates || [];
    const standardDates = staff.specific_standard_off_dates || [];
    
    // Only migrate if they have old specific_off_dates and we haven't already migrated them
    if (oldDates.length > 0) {
      // Merge into standard off dates (to be safe against duplicates)
      const newStandardDates = Array.from(new Set([...standardDates, ...oldDates]));
      
      const { error: updateError } = await supabase
        .from('staff')
        .update({ 
          specific_standard_off_dates: newStandardDates,
          specific_off_dates: [] // Clear the old strict dates
        })
        .eq('id', staff.id);
        
      if (updateError) {
        console.error(`Failed to update staff ${staff.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Migration complete. Updated ${updatedCount} staff members.`);
}

migrateDates();
