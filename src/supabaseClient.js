import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uohiirghjrsybgzheila.supabase.co'; // Thay URL của bạn
const supabaseAnonKey = 
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaGlpcmdoanJzeWJnemhlaWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDM0NjQsImV4cCI6MjA5MjcxOTQ2NH0.GtaIEQroQZSL9F1G0zIEOKSXC8iqlr6sJPAPzPLZ5Uw';                   // Thay Anon Key của bạn

export const supabase = createClient(supabaseUrl, supabaseAnonKey);