import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create a client even with empty credentials to prevent blank screen
// The app will show proper error messages when operations fail
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

export type JobReport = {
  issuesCount: number
  issues: Array<{
    title?: string
    severity?: string
    description?: string
    type?: string
    element?: string
    message?: string
  }>
  summary?: {
    high: number
    medium: number
    low: number
  }
}

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string
          user_id: string
          title: string
          url: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          report: JobReport | null
          screenshot_url: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          url: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          report?: JobReport | null
          screenshot_url?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          url?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          report?: JobReport | null
          screenshot_url?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
    }
  }
}
