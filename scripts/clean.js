const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function clean() {
  const {data: sessions} = await supabase.from('exam_sessions').select('*');
  const groups = new Map();
  sessions.forEach(s => {
    const period = (function(t){
      try {
        const [h,m] = t.split(':').map(Number);
        const diff = (h*60+m) - 480;
        return diff<0 ? 1 : Math.floor(diff/180)+1;
      }catch(e){return 1;}
    })(s.start_time);
    const key = s.exam_date + '_' + period;
    if(!groups.has(key)) groups.set(key, {date: s.exam_date, period, has_final: false});
    if(!s.exam_type?.toLowerCase().includes('oral')) groups.get(key).has_final = true;
  });
  
  const noFinal = Array.from(groups.values()).filter(g => !g.has_final);
  
  const {data: reserves} = await supabase.from('period_free_staff').select('*').limit(10000);
  const invalidReserves = reserves.filter(r => noFinal.some(g => g.date === r.exam_date && g.period === r.period));
  
  if (invalidReserves.length > 0) {
    const ids = invalidReserves.map(r => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      await supabase.from('period_free_staff').delete().in('id', ids.slice(i, i + 100));
    }
    console.log('Deleted invalid reserves:', invalidReserves.length);
  } else {
    console.log('No invalid reserves found.');
  }
}

clean();
