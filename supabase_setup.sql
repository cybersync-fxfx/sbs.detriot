-- 1. Create the user_profiles table
create table public.user_profiles (
  id uuid references auth.users not null primary key,
  username text unique not null,
  api_key text unique not null,
  agent_id text unique not null
);

-- 2. Enable RLS
alter table public.user_profiles enable row level security;

-- 3. Policy: Users can only read their own profile
create policy "Users can read own profile" 
on public.user_profiles 
for select 
using (auth.uid() = id);

create policy "Users can update own profile" 
on public.user_profiles 
for update 
using (auth.uid() = id);

-- 4. Trigger to automatically create a profile when a user registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_profiles (id, username, api_key, agent_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    'sbs_' || md5(random()::text || clock_timestamp()::text),
    'agent_' || substring(md5(random()::text) from 1 for 12)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RPC function to allow the backend server to verify an agent via API key securely
create or replace function verify_agent(p_agent_id text, p_api_key text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from public.user_profiles where agent_id = p_agent_id and api_key = p_api_key;
  return v_user_id;
end;
$$;
