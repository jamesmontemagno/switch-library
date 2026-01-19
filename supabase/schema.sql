-- Supabase Schema for My Switch Library
-- Run this in your Supabase SQL Editor to set up the database
-- NOTE: JWT secret is managed by Supabase automatically - do not set manually

-- Users table (managed by Supabase Auth, but we store additional info)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  github_id bigint,
  login text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Games table
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  platform text not null check (platform in ('Nintendo Switch', 'Nintendo Switch 2')),
  format text not null default 'Physical' check (format in ('Physical', 'Digital')),
  status text not null default 'Owned' check (status in ('Owned', 'Wishlist', 'Borrowed', 'Lent', 'Sold')),
  condition text check (condition in ('New', 'Like New', 'Good', 'Fair', 'Poor')),
  notes text,
  thegamesdb_id integer,
  cover_url text,
  purchase_date date,
  completed boolean default false,
  completed_date date,
  favorite boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Share profiles table
create table if not exists public.share_profiles (
  share_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  enabled boolean default false,
  show_display_name boolean default true,
  show_avatar boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  revoked_at timestamp with time zone
);

-- API usage tracking table
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  search_query text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Follow lists table (Following/Followers)
-- When you follow someone, an entry is created with your user_id pointing to their share_id
-- status is always 'accepted' for active follows
create table if not exists public.friend_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  friend_share_id uuid references public.share_profiles(share_id) on delete cascade not null,
  nickname text not null check (length(nickname) <= 50),
  status text not null default 'accepted' check (status in ('accepted')),
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_share_id)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.share_profiles enable row level security;
alter table public.api_usage enable row level security;
alter table public.friend_lists enable row level security;

-- Profiles policies (optimized: using (select auth.uid()) for better performance)
-- Combined SELECT policy handles both own profile and shared profiles
create policy "Select own or shared profiles"
  on public.profiles for select
  using (
    id = (select auth.uid())
    OR id IN (
      SELECT user_id FROM public.share_profiles WHERE enabled = true
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

-- Games policies (optimized: using (select auth.uid()) for better performance)
-- Combined SELECT policy handles both own games and shared games
create policy "Select own or shared games"
  on public.games for select
  using (
    user_id = (select auth.uid())
    OR user_id IN (
      SELECT user_id FROM public.share_profiles WHERE enabled = true
    )
  );

create policy "Users can insert their own games"
  on public.games for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own games"
  on public.games for update
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own games"
  on public.games for delete
  using ((select auth.uid()) = user_id);

-- Share profiles policies (optimized: using (select auth.uid()) for better performance)
-- Combined SELECT policy handles both own share profile and public enabled profiles
create policy "Select own or enabled share profiles"
  on public.share_profiles for select
  using (
    user_id = (select auth.uid())
    OR enabled = true
  );

create policy "Users can insert their own share profile"
  on public.share_profiles for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own share profile"
  on public.share_profiles for update
  using ((select auth.uid()) = user_id);

-- API usage policies (optimized: using (select auth.uid()) for better performance)
create policy "Users can view their own API usage"
  on public.api_usage for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own API usage"
  on public.api_usage for insert
  with check ((select auth.uid()) = user_id);

-- Friend lists policies (optimized: using (select auth.uid()) for better performance)
-- Combined SELECT policy handles both own following list and followers
create policy "Select own friends or followers"
  on public.friend_lists for select
  using (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.share_profiles
      WHERE share_profiles.share_id = friend_lists.friend_share_id
        AND share_profiles.user_id = (select auth.uid())
    )
  );

create policy "Users can add to their following list"
  on public.friend_lists for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own following"
  on public.friend_lists for update
  using ((select auth.uid()) = user_id);

create policy "Users can unfollow"
  on public.friend_lists for delete
  using ((select auth.uid()) = user_id);

-- Function to automatically update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql
set search_path = '';

-- Triggers for updated_at
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_games_updated
  before update on public.games
  for each row execute procedure public.handle_updated_at();

-- Function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, github_id, login, display_name, avatar_url)
  values (
    new.id,
    (new.raw_user_meta_data->>'provider_id')::bigint,
    coalesce(
      new.raw_user_meta_data->>'user_name', 
      new.raw_user_meta_data->>'preferred_username',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'full_name', 
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      -- Fallback avatar for email/password users
      'https://ui-avatars.com/api/?name=' || split_part(new.email, '@', 1) || '&background=e60012&color=fff'
    )
  );
  return new;
end;
$$;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes for better query performance
create index if not exists games_user_id_idx on public.games(user_id);
create index if not exists games_title_idx on public.games(title);
create index if not exists games_platform_idx on public.games(platform);
create index if not exists share_profiles_user_id_idx on public.share_profiles(user_id);
create index if not exists share_profiles_enabled_idx on public.share_profiles(enabled) where enabled = true;
create index if not exists api_usage_user_id_idx on public.api_usage(user_id);
create index if not exists api_usage_timestamp_idx on public.api_usage(timestamp);
create index if not exists friend_lists_user_id_idx on public.friend_lists(user_id);
create index if not exists friend_lists_friend_share_id_idx on public.friend_lists(friend_share_id);

-- =============================================
-- Game Additions Table (for Trending feature)
-- =============================================
-- Anonymous table tracking when games are added to the community
-- No user_id column = no RLS needed, fully anonymous aggregate data
-- Duplicates are allowed (same game can be added multiple times by different users)

create table if not exists public.game_additions (
  id uuid primary key default gen_random_uuid(),
  thegamesdb_id integer not null,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for trending queries
create index if not exists idx_game_additions_thegamesdb_id on public.game_additions(thegamesdb_id);
create index if not exists idx_game_additions_added_at on public.game_additions(added_at desc);
create index if not exists idx_game_additions_composite on public.game_additions(thegamesdb_id, added_at desc);

-- Comment for documentation
comment on table public.game_additions is 'Anonymous tracking of game additions for trending feature. No user data stored.';

-- No RLS on game_additions - it's fully anonymous public data
-- Anyone can read/write to track community trends

-- Manual data pruning (run periodically if needed):
-- DELETE FROM public.game_additions WHERE added_at < NOW() - INTERVAL '1 year';
