import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ixtjvmdgiowayxnhviou.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4dGp2bWRnaW93YXl4bmh2aW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNzA2MDAsImV4cCI6MjA2MDk0NjYwMH0.rpixkRS6UVvaT3QViX8em49HaRIa-ZxmgPkFDH1iE5A';

// Create Supabase client with Realtime options enabled
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

export default supabase;