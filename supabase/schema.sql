create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.encyclopedia_entries (
  id text primary key,
  type text not null check (type in ('insect', 'disease')),
  name text not null,
  scientific_name text not null default '',
  genus text not null default '',
  category_code text not null default 'unknown',
  category_name text not null default '未分类',
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  season text not null default '',
  host_range text not null default '',
  summary text not null default '',
  morphology text not null default '',
  symptoms text not null default '',
  image_url text,
  control_tips jsonb not null default '[]'::jsonb,
  placement_tips jsonb not null default '[]'::jsonb,
  reference_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  markdown text,
  image_url text,
  status text not null default 'open' check (status in ('open', 'solved')),
  author_name text not null default '匿名用户',
  owner_account text,
  likes integer not null default 0,
  mentions jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_answers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_name text not null default '匿名用户',
  content text not null,
  markdown text,
  image_url text,
  role text not null default 'answer' check (role in ('answer', 'followup')),
  reply_to_floor integer,
  floor integer not null,
  annotations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, floor)
);

create index if not exists idx_encyclopedia_entries_name on public.encyclopedia_entries(name);
create index if not exists idx_encyclopedia_entries_type on public.encyclopedia_entries(type);
create index if not exists idx_community_posts_created_at on public.community_posts(created_at desc);
create index if not exists idx_community_answers_post_floor on public.community_answers(post_id, floor);

alter table public.encyclopedia_entries enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_answers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'encyclopedia_entries' and policyname = 'encyclopedia_entries_read'
  ) then
    create policy encyclopedia_entries_read on public.encyclopedia_entries for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_posts' and policyname = 'community_posts_read'
  ) then
    create policy community_posts_read on public.community_posts for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_answers' and policyname = 'community_answers_read'
  ) then
    create policy community_answers_read on public.community_answers for select using (true);
  end if;
end;
$$;

drop trigger if exists trg_encyclopedia_entries_updated_at on public.encyclopedia_entries;
create trigger trg_encyclopedia_entries_updated_at
before update on public.encyclopedia_entries
for each row
execute function public.set_updated_at();

drop trigger if exists trg_community_posts_updated_at on public.community_posts;
create trigger trg_community_posts_updated_at
before update on public.community_posts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_community_answers_updated_at on public.community_answers;
create trigger trg_community_answers_updated_at
before update on public.community_answers
for each row
execute function public.set_updated_at();

create table if not exists public.spirit_generation_jobs (
  id uuid primary key,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error text not null default '',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spirit_sessions (
  id uuid primary key default gen_random_uuid(),
  identify jsonb not null default '{}'::jsonb,
  generation jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  draft_count integer not null default 0,
  last_draft_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spirit_community_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.spirit_sessions(id) on delete cascade,
  title text not null,
  content text not null,
  markdown text not null default '',
  image_url text,
  mentions jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_post_id uuid references public.community_posts(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_spirit_generation_jobs_created_at on public.spirit_generation_jobs(created_at desc);
create index if not exists idx_spirit_generation_jobs_status on public.spirit_generation_jobs(status);
create index if not exists idx_spirit_sessions_updated_at on public.spirit_sessions(updated_at desc);
create index if not exists idx_spirit_community_drafts_status on public.spirit_community_drafts(status);
create index if not exists idx_spirit_community_drafts_created_at on public.spirit_community_drafts(created_at desc);
create index if not exists idx_spirit_community_drafts_session_id on public.spirit_community_drafts(session_id);

alter table public.spirit_generation_jobs enable row level security;
alter table public.spirit_sessions enable row level security;
alter table public.spirit_community_drafts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'spirit_generation_jobs' and policyname = 'spirit_generation_jobs_read'
  ) then
    create policy spirit_generation_jobs_read on public.spirit_generation_jobs for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'spirit_sessions' and policyname = 'spirit_sessions_read'
  ) then
    create policy spirit_sessions_read on public.spirit_sessions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'spirit_community_drafts' and policyname = 'spirit_community_drafts_read'
  ) then
    create policy spirit_community_drafts_read on public.spirit_community_drafts for select using (true);
  end if;
end;
$$;

drop trigger if exists trg_spirit_generation_jobs_updated_at on public.spirit_generation_jobs;
create trigger trg_spirit_generation_jobs_updated_at
before update on public.spirit_generation_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_spirit_sessions_updated_at on public.spirit_sessions;
create trigger trg_spirit_sessions_updated_at
before update on public.spirit_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_spirit_community_drafts_updated_at on public.spirit_community_drafts;
create trigger trg_spirit_community_drafts_updated_at
before update on public.spirit_community_drafts
for each row
execute function public.set_updated_at();

create table if not exists public.diagnosis_tasks (
  id uuid primary key,
  status text not null default 'pending' check (status in ('pending', 'queued', 'running', 'succeeded', 'failed')),
  input_payload jsonb not null default '{}'::jsonb,
  top_result jsonb not null default '{}'::jsonb,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  encyclopedia_refs jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  error text not null default '',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnosis_results (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.diagnosis_tasks(id) on delete cascade,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  provider text not null default '',
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id)
);

create table if not exists public.action_cards (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.diagnosis_tasks(id) on delete cascade,
  card_type text not null check (card_type in ('immediate', 'observe', 'encyclopedia', 'community', 'track')),
  title text not null,
  description text not null default '',
  cta_label text not null default '',
  cta_route text not null default '',
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_diagnosis_tasks_created_at on public.diagnosis_tasks(created_at desc);
create index if not exists idx_diagnosis_tasks_status on public.diagnosis_tasks(status);
create index if not exists idx_diagnosis_results_task_id on public.diagnosis_results(task_id);
create index if not exists idx_action_cards_task_id on public.action_cards(task_id);

alter table public.diagnosis_tasks enable row level security;
alter table public.diagnosis_results enable row level security;
alter table public.action_cards enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'diagnosis_tasks' and policyname = 'diagnosis_tasks_read'
  ) then
    create policy diagnosis_tasks_read on public.diagnosis_tasks for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'diagnosis_results' and policyname = 'diagnosis_results_read'
  ) then
    create policy diagnosis_results_read on public.diagnosis_results for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'action_cards' and policyname = 'action_cards_read'
  ) then
    create policy action_cards_read on public.action_cards for select using (true);
  end if;
end;
$$;

drop trigger if exists trg_diagnosis_tasks_updated_at on public.diagnosis_tasks;
create trigger trg_diagnosis_tasks_updated_at
before update on public.diagnosis_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_diagnosis_results_updated_at on public.diagnosis_results;
create trigger trg_diagnosis_results_updated_at
before update on public.diagnosis_results
for each row
execute function public.set_updated_at();

create table if not exists public.source_index_items (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null references public.encyclopedia_entries(id) on delete cascade,
  source_type text not null default 'reference' check (source_type in ('reference', 'manual', 'community', 'web')),
  source_title text not null default '',
  source_url text not null default '',
  snippet text not null default '',
  confidence_score integer not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  source_post_id uuid references public.community_posts(id) on delete set null,
  source_answer_id uuid references public.community_answers(id) on delete set null,
  backflow_candidate_id uuid,
  backflow_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatment_templates (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null unique references public.encyclopedia_entries(id) on delete cascade,
  immediate_actions jsonb not null default '[]'::jsonb,
  environment_adjustments jsonb not null default '[]'::jsonb,
  follow_up_schedule jsonb not null default '[]'::jsonb,
  caution_notes jsonb not null default '[]'::jsonb,
  source_post_id uuid references public.community_posts(id) on delete set null,
  source_answer_id uuid references public.community_answers(id) on delete set null,
  backflow_candidate_id uuid,
  backflow_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.source_index_items add column if not exists source_post_id uuid references public.community_posts(id) on delete set null;
alter table public.source_index_items add column if not exists source_answer_id uuid references public.community_answers(id) on delete set null;
alter table public.source_index_items add column if not exists backflow_candidate_id uuid;
alter table public.source_index_items add column if not exists backflow_review_id uuid;

alter table public.treatment_templates add column if not exists source_post_id uuid references public.community_posts(id) on delete set null;
alter table public.treatment_templates add column if not exists source_answer_id uuid references public.community_answers(id) on delete set null;
alter table public.treatment_templates add column if not exists backflow_candidate_id uuid;
alter table public.treatment_templates add column if not exists backflow_review_id uuid;

create index if not exists idx_source_index_items_entry_id on public.source_index_items(entry_id);
create index if not exists idx_source_index_items_confidence on public.source_index_items(confidence_score desc);
create index if not exists idx_treatment_templates_entry_id on public.treatment_templates(entry_id);

alter table public.source_index_items enable row level security;
alter table public.treatment_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'source_index_items' and policyname = 'source_index_items_read'
  ) then
    create policy source_index_items_read on public.source_index_items for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'treatment_templates' and policyname = 'treatment_templates_read'
  ) then
    create policy treatment_templates_read on public.treatment_templates for select using (true);
  end if;
end;
$$;

drop trigger if exists trg_source_index_items_updated_at on public.source_index_items;
create trigger trg_source_index_items_updated_at
before update on public.source_index_items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_treatment_templates_updated_at on public.treatment_templates;
create trigger trg_treatment_templates_updated_at
before update on public.treatment_templates
for each row
execute function public.set_updated_at();

create table if not exists public.spirit_role_packs (
  id text primary key,
  name text not null,
  version integer not null default 1,
  style text not null default '',
  persona text not null default '',
  system_prompt text not null default '',
  guardrails jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  legacy_spirit_session_id uuid references public.spirit_sessions(id) on delete set null,
  role_pack_id text references public.spirit_role_packs(id) on delete set null,
  user_account text not null default '',
  title text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  diagnosis_context jsonb not null default '{}'::jsonb,
  retrieval_context jsonb not null default '{}'::jsonb,
  memory_snapshot jsonb not null default '{}'::jsonb,
  turn_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  scope text not null default 'session' check (scope in ('session', 'cross_session')),
  kind text not null default 'fact' check (kind in ('fact', 'preference', 'constraint', 'observation', 'todo')),
  content text not null,
  source_turn integer not null default 0,
  weight numeric(4, 3) not null default 0.5 check (weight >= 0 and weight <= 1),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  summary_type text not null default 'rolling' check (summary_type in ('rolling', 'handoff', 'final')),
  summary text not null,
  window_from_turn integer not null default 0,
  window_to_turn integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_spirit_role_packs_enabled on public.spirit_role_packs(enabled);
create index if not exists idx_conversation_sessions_role_pack_id on public.conversation_sessions(role_pack_id);
create index if not exists idx_conversation_sessions_status_updated on public.conversation_sessions(status, updated_at desc);
create index if not exists idx_memory_items_session_created on public.memory_items(session_id, created_at desc);
create index if not exists idx_memory_items_scope_kind on public.memory_items(scope, kind);
create index if not exists idx_memory_summaries_session_created on public.memory_summaries(session_id, created_at desc);
create index if not exists idx_memory_summaries_type on public.memory_summaries(summary_type);

alter table public.spirit_role_packs enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.memory_items enable row level security;
alter table public.memory_summaries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'spirit_role_packs' and policyname = 'spirit_role_packs_read'
  ) then
    create policy spirit_role_packs_read on public.spirit_role_packs for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'conversation_sessions' and policyname = 'conversation_sessions_read'
  ) then
    create policy conversation_sessions_read on public.conversation_sessions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'memory_items' and policyname = 'memory_items_read'
  ) then
    create policy memory_items_read on public.memory_items for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'memory_summaries' and policyname = 'memory_summaries_read'
  ) then
    create policy memory_summaries_read on public.memory_summaries for select using (true);
  end if;
end;
$$;

drop trigger if exists trg_spirit_role_packs_updated_at on public.spirit_role_packs;
create trigger trg_spirit_role_packs_updated_at
before update on public.spirit_role_packs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_conversation_sessions_updated_at on public.conversation_sessions;
create trigger trg_conversation_sessions_updated_at
before update on public.conversation_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_memory_items_updated_at on public.memory_items;
create trigger trg_memory_items_updated_at
before update on public.memory_items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_memory_summaries_updated_at on public.memory_summaries;
create trigger trg_memory_summaries_updated_at
before update on public.memory_summaries
for each row
execute function public.set_updated_at();

create table if not exists public.knowledge_backflow_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_type text not null check (candidate_type in ('source_index', 'treatment_template')),
  source_post_id uuid references public.community_posts(id) on delete set null,
  source_answer_id uuid references public.community_answers(id) on delete set null,
  entry_hint text not null default '',
  entry_id text references public.encyclopedia_entries(id) on delete set null,
  title text not null default '',
  snippet text not null default '',
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  proposed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  lifecycle_state text not null default '',
  conflict_detail jsonb not null default '{}'::jsonb,
  approved_by text not null default '',
  approved_at timestamptz,
  review_note text not null default '',
  last_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_type, source_post_id, source_answer_id)
);

alter table public.knowledge_backflow_candidates add column if not exists lifecycle_state text not null default '';
alter table public.knowledge_backflow_candidates add column if not exists conflict_detail jsonb not null default '{}'::jsonb;
alter table public.knowledge_backflow_candidates add column if not exists last_review_at timestamptz;

create index if not exists idx_knowledge_backflow_status_quality on public.knowledge_backflow_candidates(status, quality_score desc, created_at desc);
create index if not exists idx_knowledge_backflow_candidate_type on public.knowledge_backflow_candidates(candidate_type);
create index if not exists idx_knowledge_backflow_entry_id on public.knowledge_backflow_candidates(entry_id);
create index if not exists idx_knowledge_backflow_lifecycle on public.knowledge_backflow_candidates(lifecycle_state, updated_at desc);

create table if not exists public.knowledge_backflow_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.knowledge_backflow_candidates(id) on delete cascade,
  action text not null check (action in ('approve', 'reject', 'rollback', 'conflict')),
  reviewer text not null default '',
  review_note text not null default '',
  status_before text not null default '',
  status_after text not null default '',
  review_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_backflow_reviews_candidate_created on public.knowledge_backflow_reviews(candidate_id, created_at desc);
create index if not exists idx_backflow_reviews_action_created on public.knowledge_backflow_reviews(action, created_at desc);

alter table public.knowledge_backflow_candidates enable row level security;
alter table public.knowledge_backflow_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'knowledge_backflow_candidates' and policyname = 'knowledge_backflow_candidates_read'
  ) then
    create policy knowledge_backflow_candidates_read on public.knowledge_backflow_candidates for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'knowledge_backflow_reviews' and policyname = 'knowledge_backflow_reviews_read'
  ) then
    create policy knowledge_backflow_reviews_read on public.knowledge_backflow_reviews for select using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_source_index_items_backflow_candidate'
  ) then
    alter table public.source_index_items
      add constraint fk_source_index_items_backflow_candidate
      foreign key (backflow_candidate_id) references public.knowledge_backflow_candidates(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_source_index_items_backflow_review'
  ) then
    alter table public.source_index_items
      add constraint fk_source_index_items_backflow_review
      foreign key (backflow_review_id) references public.knowledge_backflow_reviews(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_treatment_templates_backflow_candidate'
  ) then
    alter table public.treatment_templates
      add constraint fk_treatment_templates_backflow_candidate
      foreign key (backflow_candidate_id) references public.knowledge_backflow_candidates(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_treatment_templates_backflow_review'
  ) then
    alter table public.treatment_templates
      add constraint fk_treatment_templates_backflow_review
      foreign key (backflow_review_id) references public.knowledge_backflow_reviews(id) on delete set null;
  end if;
end;
$$;

drop trigger if exists trg_knowledge_backflow_candidates_updated_at on public.knowledge_backflow_candidates;
create trigger trg_knowledge_backflow_candidates_updated_at
before update on public.knowledge_backflow_candidates
for each row
execute function public.set_updated_at();

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_source text not null default 'api',
  user_account text not null default '',
  session_id text not null default '',
  trace_id text not null default '',
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in ('diagnosis_identify', 'spirit_generation', 'community_backflow')),
  task_id text not null,
  status text not null,
  attempt integer not null default 0,
  duration_ms integer not null default 0,
  error text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_created_at on public.analytics_events(created_at desc);
create index if not exists idx_analytics_events_name_created on public.analytics_events(event_name, created_at desc);
create index if not exists idx_analytics_events_source_created on public.analytics_events(event_source, created_at desc);

create index if not exists idx_task_logs_created_at on public.task_logs(created_at desc);
create index if not exists idx_task_logs_type_status_created on public.task_logs(task_type, status, created_at desc);
create index if not exists idx_task_logs_task_id_created on public.task_logs(task_id, created_at desc);

alter table public.analytics_events enable row level security;
alter table public.task_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'analytics_events' and policyname = 'analytics_events_read'
  ) then
    create policy analytics_events_read on public.analytics_events for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'task_logs' and policyname = 'task_logs_read'
  ) then
    create policy task_logs_read on public.task_logs for select using (true);
  end if;
end;
$$;
