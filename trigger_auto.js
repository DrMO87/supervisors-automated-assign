require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function trigger() {
  const response = await fetch('http://localhost:3000/api/assignments/auto-assign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // We need to bypass auth or pass auth, wait, it requires super admin
    },
    body: JSON.stringify({
      weekStart: '2026-06-05',
      assignmentScope: 'oral',
      onlyOral: true
    })
  });
  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}
trigger();
