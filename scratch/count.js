const https = require('https');

const options = {
  hostname: 'chauqwnfzjskbucoppwb.supabase.co',
  path: '/rest/v1/assignments?select=id',
  method: 'GET',
  headers: {
    'apikey': 'sb_publishable_tIiXKR2izJukHfR8YF_XFg_lEFi3aw-',
    'Authorization': 'Bearer sb_publishable_tIiXKR2izJukHfR8YF_XFg_lEFi3aw-',
    'Prefer': 'count=exact'
  }
};

const req = https.request(options, (res) => {
  console.log('Count:', res.headers['content-range']);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Length:', JSON.parse(data).length));
});

req.on('error', error => console.error(error));
req.end();
