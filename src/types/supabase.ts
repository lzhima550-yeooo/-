import type { EncyclopediaType } from './models'

export interface SupabaseSpeciesRow {
  id: string
  type: EncyclopediaType
  name: string
  scientific_name: string
  genus: string
  category_code: string
  category_name: string
  risk_level: 'low' | 'medium' | 'high'
  season: string
  host_range: string
  summary: string
  morphology: string
  symptoms: string
  control_tips: string[]
  placement_tips: string[]
  references: string[]
  created_at: string
  updated_at: string
}

export interface SupabaseSpeciesImageRow {
  id: string
  species_id: string
  url: string
  source: string
  license: string
  attribution: string
  is_primary: boolean
  created_at: string
}

export interface SupabaseUserProfileRow {
  id: string
  account: string
  nickname: string
  avatar_url: string
  campus_role: 'student' | 'teacher' | 'admin'
  created_at: string
  updated_at: string
}

export interface SupabaseCommunityPostRow {
  id: string
  author_profile_id: string
  title: string
  content: string
  image_url: string | null
  status: 'open' | 'solved'
  likes: number
  created_at: string
  updated_at: string
}

export interface SupabaseCommunityAnswerRow {
  id: string
  post_id: string
  author_profile_id: string
  content: string
  created_at: string
}

export interface SupabaseBadgeDefinitionRow {
  id: string
  title: string
  description: string
  icon: string
  metric: 'publish' | 'answer' | 'favorite' | 'identify'
  threshold: number
}

export interface SupabaseUserMetricRow {
  profile_id: string
  publish_count: number
  answer_count: number
  favorite_count: number
  identify_count: number
  updated_at: string
}
