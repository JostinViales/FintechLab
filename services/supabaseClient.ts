import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mxrtfkywaakhsgqcuaze.supabase.co';
const supabaseAnonKey = 'sb_publishable_qivlXGrllXN8BFNTrxjHZA_0wUiL50H';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
