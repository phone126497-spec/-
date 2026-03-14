import { createClient } from '@supabase/supabase-js';

// 사용자가 제공한 Supabase 설정 정보 (직접 기입)
const supabaseUrl = 'https://jvtxkzmcmgrgznblefdu.supabase.co';
const supabaseAnonKey = 'sb_publishable_qMqAK5ptwk9mKczuv83Xuw_fBU8jlpM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
