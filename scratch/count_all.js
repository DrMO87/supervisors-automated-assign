const https = require('https');

const options = {
  hostname: 'chauqwnfzjskbucoppwb.supabase.co',
  method: 'GET',
  headers: {
    'apikey': 'sb_publishable_tIiXKR2izJukHfR8YF_XFg_lEFi3aw-',
    'Authorization': 'Bearer sb_publishable_tIiXKR2izJukHfR8YF_XFg_lEFi3aw-',
    'Prefer': 'count=exact'
  }
};

const tables = ['staff', 'exam_sessions', 'assignments', 'period_free_staff'];

tables.forEach(table => {
  const req = https.request({ ...options, path: `/rest/v1/${table}?select=id` }, (res) => {
    console.log(`${table} count:`, res.headers['content-range']);
  });
  req.on('error', error => console.error(error));
  req.end();
});
