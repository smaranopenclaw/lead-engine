-- Run this once in your Supabase SQL editor

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  place_id        text unique not null,
  name            text,
  address         text,
  phone           text,
  website         text,
  category        text,
  rating          numeric,
  maps_url        text,
  has_website     boolean default false,
  city            text default 'Hyderabad',

  -- Scoring
  score           integer,          -- 0-100, lower = worse = better prospect
  lighthouse_data jsonb,            -- raw lighthouse category scores

  -- Outputs
  demo_url        text,             -- deployed Vercel demo URL
  email_draft     text,             -- full drafted email
  email_status    text default 'pending',  -- pending | draft | sent

  created_at      timestamptz default now(),
  processed_at    timestamptz
);

-- Index for the site builder query (lowest scored, no demo yet)
create index if not exists leads_score_demo on leads (score asc) where demo_url is null;
-- Index for email drafter query
create index if not exists leads_email_draft on leads (id) where demo_url is not null and email_draft is null;
