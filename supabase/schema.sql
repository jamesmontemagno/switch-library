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

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Public can view profiles of users with enabled share profiles (for sharing feature)
create policy "Anyone can view profiles of shared users"
  on public.profiles for select
  using (
    exists (
      select 1 from public.share_profiles
      where share_profiles.user_id = profiles.id
      and share_profiles.enabled = true
    )
  );

-- Games policies
create policy "Users can view their own games"
  on public.games for select
  using (auth.uid() = user_id);

create policy "Users can insert their own games"
  on public.games for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own games"
  on public.games for update
  using (auth.uid() = user_id);

create policy "Users can delete their own games"
  on public.games for delete
  using (auth.uid() = user_id);

-- Share profiles policies
create policy "Users can view their own share profile"
  on public.share_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own share profile"
  on public.share_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own share profile"
  on public.share_profiles for update
  using (auth.uid() = user_id);

-- Public can view enabled share profiles (for sharing feature)
create policy "Anyone can view enabled share profiles"
  on public.share_profiles for select
  using (enabled = true);

-- Public can view games of users with enabled share profiles (for sharing feature)
create policy "Anyone can view games of shared profiles"
  on public.games for select
  using (
    exists (
      select 1 from public.share_profiles
      where share_profiles.user_id = games.user_id
      and share_profiles.enabled = true
    )
  );

-- API usage policies
create policy "Users can view their own API usage"
  on public.api_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert their own API usage"
  on public.api_usage for insert
  with check (auth.uid() = user_id);

-- Friend lists policies
create policy "Users can view their own following list"
  on public.friend_lists for select
  using (auth.uid() = user_id);

-- Users can view who is following them (for Followers tab)
create policy "Users can view their followers"
  on public.friend_lists for select
  using (
    exists (
      select 1 from public.share_profiles
      where share_profiles.share_id = friend_lists.friend_share_id
      and share_profiles.user_id = auth.uid()
    )
  );

create policy "Users can add to their following list"
  on public.friend_lists for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own following"
  on public.friend_lists for update
  using (auth.uid() = user_id);

create policy "Users can unfollow"
  on public.friend_lists for delete
  using (auth.uid() = user_id);

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
