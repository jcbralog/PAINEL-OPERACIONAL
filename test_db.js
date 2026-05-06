import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rszmlymdfyjcdjmviwds.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzem1seW1kZnlqY2RqbXZpd2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY3ODgsImV4cCI6MjA5MzU3Mjc4OH0.5bTijyrDgRdcQu0W23cJXek-hKhlJG1LCdMhoGfKeYU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('uploads').select('*').limit(1);
  console.log('UPLOADS:', { data, error });
  
  const { data: d2, error: e2 } = await supabase.from('wku_linhas').select('*').limit(1);
  console.log('WKU_LINHAS:', { data: d2, error: e2 });
}

test();
