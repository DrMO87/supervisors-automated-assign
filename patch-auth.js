const fs = require('fs');
const path = require('path');

const files = [
  'app/api/admin/recalculate-scores/route.ts',
  'app/api/assignments/assign-free-invigilators/route.ts',
  'app/api/assignments/auto-assign/route.ts',
  'app/api/assignments/bulk-replace/route.ts',
  'app/api/assignments/reset-week/route.ts',
  'app/api/backup/create/route.ts',
  'app/api/backup/restore/route.ts',
  'app/api/history/snapshot/route.ts',
  'app/api/history/undo/route.ts',
  'app/api/send-schedule/route.ts'
];

const importAuth = `import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';\nimport { cookies } from 'next/headers';\n`;

const authCheck = `
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!session || email !== 'melkhodary@horus.edu.eg') {
      return NextResponse.json({ error: 'Unauthorized Access. Super Administrators only.' }, { status: 403 });
    }
`;

const oldAuthCheck = `const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    const role = session?.user?.user_metadata?.role;
    if (!session || (role !== 'control' && role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized Access. Administrators or Control only.' }, { status: 403 });
    }`;

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  // Replace the exact old string
  if (content.includes(oldAuthCheck)) {
    content = content.replace(oldAuthCheck, authCheck.trim());
  } else {
    // Also try without indentation
    const oldAuthCheck2 = `const supabaseAuth = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabaseAuth.auth.getSession();
const role = session?.user?.user_metadata?.role;
if (!session || (role !== 'control' && role !== 'admin')) {
  return NextResponse.json({ error: 'Unauthorized Access. Administrators or Control only.' }, { status: 403 });
}`;
    if (content.includes(oldAuthCheck2)) {
      content = content.replace(oldAuthCheck2, authCheck.trim());
    } else {
      console.log(`Could not find old auth check in ${file}`);
    }
  }

  fs.writeFileSync(p, content, 'utf8');
}
console.log('Patched automatically.');
