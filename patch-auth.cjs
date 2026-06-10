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
  'app/api/send-schedule/route.ts',
  'app/api/assignments/approve-swap/route.ts'
];

const importAuth = "import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';\nimport { cookies } from 'next/headers';\n";

const authCheck = `
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session || session.user.user_metadata?.role !== 'control') {
      return NextResponse.json({ error: 'Unauthorized Access. Administrators only.' }, { status: 403 });
    }
`;

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  // Skip if already patched
  if (content.includes("Unauthorized Access. Administrators only.")) continue;

  // Add imports if missing
  if (!content.includes('createRouteHandlerClient')) {
    content = importAuth + content;
  }

  // Find the start of the function and inject the auth check
  const tryMatch = content.match(/export async function (POST|GET)\([^)]*\) \{[\s\n]*try \{/);
  
  if (tryMatch) {
    const insertPos = tryMatch.index + tryMatch[0].length;
    content = content.slice(0, insertPos) + authCheck + content.slice(insertPos);
  } else {
    const funcMatch = content.match(/export async function (POST|GET)\([^)]*\) \{/);
    if (funcMatch) {
      const insertPos = funcMatch.index + funcMatch[0].length;
      content = content.slice(0, insertPos) + authCheck + content.slice(insertPos);
    }
  }

  fs.writeFileSync(p, content, 'utf8');
}
console.log('Patched automatically.');
