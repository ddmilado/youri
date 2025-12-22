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

export type AuditSection = {
  title: string
  findings: Array<{
    problem: string
    explanation: string
    recommendation: string
    severity: 'high' | 'medium' | 'low'
  }>
}

export type Contact = {
  name: string
  title: string
  linkedin?: string
  email?: string
}

export type CompanyInfo = {
  name: string
  industry?: string
  hq_location?: string
  founded?: number
  employees?: string
  revenue?: string
  email?: string
  phone?: string
  contacts: Contact[]
}

export type JobReport = {
  overview: string
  sections: AuditSection[]
  conclusion: string
  actionList: string[]
  companyInfo?: CompanyInfo
  salesEmail?: string
  score?: number
  // keeping legacy fields optional for backward compatibility if needed
  issuesCount?: number
  issues?: Array<{
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

export type PeopleSearchResult = {
  id: string
  url: string
  title: string
  publishedDate?: string
  author?: string
  text?: string
  highlights?: string[]
  score?: number
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
          status_message: string | null
          created_at: string
          completed_at: string | null
          is_public: boolean
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          url: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          report?: JobReport | null
          screenshot_url?: string | null
          status_message?: string | null
          created_at?: string
          completed_at?: string | null
          is_public?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          url?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          report?: JobReport | null
          screenshot_url?: string | null
          status_message?: string | null
          created_at?: string
          completed_at?: string | null
          is_public?: boolean
        }
      }
      ai_lead_results: {
        Row: {
          id: string
          user_id: string
          company: string
          website: string
          industry: string | null
          hq_location: string | null
          founded: number | null
          employees: string | null
          markets: string | null
          revenue_2023_eur: string | null
          linkedin: string | null
          twitter: string | null
          contacts: Array<{
            name: string
            title: string
            linkedin: string
            email: string
          }>
          lead_quality_label: string | null
          lead_quality_score: number | null
          localization_evidence: {
            tld: string
            language_options: string
            german_content_on_main_domain: boolean
            localization_quality_on_english_page: string
          } | null
          notes: string | null
          input_query: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company: string
          website: string
          industry?: string | null
          hq_location?: string | null
          founded?: number | null
          employees?: string | null
          markets?: string | null
          revenue_2023_eur?: string | null
          linkedin?: string | null
          twitter?: string | null
          contacts?: Array<{
            name: string
            title: string
            linkedin: string
            email: string
          }>
          lead_quality_label?: string | null
          lead_quality_score?: number | null
          localization_evidence?: {
            tld: string
            language_options: string
            german_content_on_main_domain: boolean
            localization_quality_on_english_page: string
          } | null
          notes?: string | null
          input_query: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company?: string
          website?: string
          industry?: string | null
          hq_location?: string | null
          founded?: number | null
          employees?: string | null
          markets?: string | null
          revenue_2023_eur?: string | null
          linkedin?: string | null
          twitter?: string | null
          contacts?: Array<{
            name: string
            title: string
            linkedin: string
            email: string
          }>
          lead_quality_label?: string | null
          lead_quality_score?: number | null
          localization_evidence?: {
            tld: string
            language_options: string
            german_content_on_main_domain: boolean
            localization_quality_on_english_page: string
          } | null
          notes?: string | null
          input_query?: string
          created_at?: string
        }
      }
      keyword_search_results: {
        Row: {
          id: string
          user_id: string
          search_query: string
          company_name: string
          website: string
          company_description: string | null
          analyzed: boolean
          analysis_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          search_query: string
          company_name: string
          website: string
          company_description?: string | null
          analyzed?: boolean
          analysis_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          search_query?: string
          company_name?: string
          website?: string
          company_description?: string | null
          analyzed?: boolean
          analysis_id?: string | null
          created_at?: string
        }
      }
      people_searches: {
        Row: {
          id: string
          user_id: string
          query: string
          results: PeopleSearchResult[]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          query: string
          results?: PeopleSearchResult[]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          query?: string
          results?: PeopleSearchResult[]
          created_at?: string
        }
      }
    }
  }
}

export type LeadResult = Database['public']['Tables']['ai_lead_results']['Row']
export type KeywordSearchResult = Database['public']['Tables']['keyword_search_results']['Row']

/**
 * Get all lead results for a specific user
 */
export async function getLeadResults(userId: string) {
  const { data, error } = await supabase
    .from('ai_lead_results')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as LeadResult[]
}

/**
 * Get a single lead result by ID
 */
export async function getLeadResultById(id: string) {
  const { data, error } = await supabase
    .from('ai_lead_results')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as LeadResult
}

/**
 * Call the Supabase Edge Function to run the OpenAI workflow
 */
export async function runAIWorkflow(inputText: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('run-workflow', {
    body: {
      input_as_text: inputText,
      user_id: userId
    }
  })

  if (error) throw error
  return data
}

/**
 * Get all keyword search results for a specific user
 */
export async function getKeywordSearchResults(userId: string) {
  const { data, error } = await supabase
    .from('keyword_search_results')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as KeywordSearchResult[]
}

/**
 * Get keyword search results by search query
 */
export async function getKeywordResultsByQuery(userId: string, query: string) {
  const { data, error } = await supabase
    .from('keyword_search_results')
    .select('*')
    .eq('user_id', userId)
    .eq('search_query', query)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as KeywordSearchResult[]
}

/**
 * Get a single keyword search result by ID
 */
export async function getKeywordResultById(id: string) {
  const { data, error } = await supabase
    .from('keyword_search_results')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as KeywordSearchResult
}

/**
 * Run keyword search workflow
 */
export async function runKeywordSearch(keywords: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('keyword-search', {
    body: {
      input_as_text: keywords,
      user_id: userId
    }
  })

  if (error) throw error
  return data
}

/**
 * Mark a keyword result as analyzed and link to deep analysis
 */
export async function linkAnalysis(keywordResultId: string, analysisId: string) {
  const { error } = await supabase
    .from('keyword_search_results')
    .update({
      analyzed: true,
      analysis_id: analysisId
    })
    .eq('id', keywordResultId)

  if (error) throw error
}

/**
 * Call the Find People Edge Function
 */
export async function findPeople(query: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('find-people', {
    body: { query, user_id: userId }
  })

  if (error) throw error
  return data as { success: boolean; results: PeopleSearchResult[] }
}

/**
 * Get recent people searches for a user
 */
export async function getRecentPeopleSearches(userId: string) {
  const { data, error } = await supabase
    .from('people_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching people searches:', error)
    return []
  }
  return data
}

