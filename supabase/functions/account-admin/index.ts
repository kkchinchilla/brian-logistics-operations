import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createAccountHandler } from './handler.mjs';
const key = (group: string, legacy: string) => {
 const values = JSON.parse(Deno.env.get(group) || '{}');
 return values.default || Deno.env.get(legacy) || '';
};
Deno.serve(createAccountHandler({
 createClient,
 url: Deno.env.get('SUPABASE_URL') || '',
 publicKey: key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
 secretKey: key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
 allowedOrigins: ['https://kkchinchilla.github.io', 'https://localhost']
}));
