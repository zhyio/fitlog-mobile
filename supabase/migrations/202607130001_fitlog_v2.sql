-- Fitlog v2: normalized single-user cloud schema.
drop table if exists public.fitness_data cascade;
drop table if exists public.workout_exercises cascade;
drop table if exists public.workouts cascade;
drop table if exists public.plan_exercises cascade;
drop table if exists public.training_plans cascade;

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  part text not null unique check (part in ('胸','肩','背','腿','核心','有氧')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  target_sets integer not null check (target_sets >= 0),
  reps integer not null check (reps >= 0),
  weight numeric(8,2) not null default 0 check (weight >= 0),
  bonus_sets integer not null default 0 check (bonus_sets >= 0),
  cue text not null default ''
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  workout_date date not null unique,
  duration integer not null check (duration between 0 and 1440),
  feeling integer not null check (feeling between 1 and 5),
  note text not null default '',
  selected_parts text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  part text not null check (part in ('胸','肩','背','腿','核心','有氧')),
  target_sets integer not null check (target_sets >= 0),
  completed_sets integer not null default 0 check (completed_sets >= 0),
  reps integer not null check (reps >= 0),
  weight numeric(8,2) not null default 0 check (weight >= 0),
  bonus_sets integer not null default 0 check (bonus_sets >= 0),
  cue text not null default ''
);

insert into public.training_plans(part) values ('胸'),('肩'),('背'),('腿'),('核心'),('有氧');

alter table public.training_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;

create or replace function public.load_fitlog_snapshot() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'plans', (select jsonb_object_agg(p.part, coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'sets',e.target_sets,'reps',e.reps,'weight',e.weight,'part',p.part,'cue',e.cue,'bonusSets',e.bonus_sets) order by e.position) from plan_exercises e where e.plan_id=p.id),'[]'::jsonb)) from training_plans p),
    'workouts', coalesce((select jsonb_agg(jsonb_build_object('date',w.workout_date,'duration',w.duration,'feeling',w.feeling,'note',w.note,'selectedParts',w.selected_parts,'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'sets',e.target_sets,'completedSets',e.completed_sets,'reps',e.reps,'weight',e.weight,'part',e.part,'cue',e.cue,'bonusSets',e.bonus_sets) order by e.position) from workout_exercises e where e.workout_id=w.id),'[]'::jsonb)) order by w.workout_date desc) from workouts w),'[]'::jsonb)
  );
$$;

create or replace function public.save_fitlog_snapshot(snapshot jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare part_name text; plan_items jsonb; e jsonb; w jsonb; pid uuid; wid uuid; idx integer;
begin
  delete from workout_exercises; delete from workouts; delete from plan_exercises;
  for part_name, plan_items in select key,value from jsonb_each(coalesce(snapshot->'plans','{}'::jsonb)) loop
    select id into pid from training_plans where part=part_name;
    idx:=0; for e in select * from jsonb_array_elements(plan_items) loop
      insert into plan_exercises(plan_id,position,name,target_sets,reps,weight,bonus_sets,cue) values(pid,idx,e->>'name',coalesce((e->>'sets')::int,0),coalesce((e->>'reps')::int,0),coalesce((e->>'weight')::numeric,0),coalesce((e->>'bonusSets')::int,0),coalesce(e->>'cue','')); idx:=idx+1;
    end loop;
  end loop;
  for w in select * from jsonb_array_elements(coalesce(snapshot->'workouts','[]'::jsonb)) loop
    insert into workouts(workout_date,duration,feeling,note,selected_parts) values((w->>'date')::date,(w->>'duration')::int,(w->>'feeling')::int,coalesce(w->>'note',''),array(select jsonb_array_elements_text(coalesce(w->'selectedParts','[]'::jsonb)))) returning id into wid;
    idx:=0; for e in select * from jsonb_array_elements(coalesce(w->'exercises','[]'::jsonb)) loop
      insert into workout_exercises(workout_id,position,name,part,target_sets,completed_sets,reps,weight,bonus_sets,cue) values(wid,idx,e->>'name',coalesce(e->>'part','核心'),coalesce((e->>'sets')::int,0),coalesce((e->>'completedSets')::int,0),coalesce((e->>'reps')::int,0),coalesce((e->>'weight')::numeric,0),coalesce((e->>'bonusSets')::int,0),coalesce(e->>'cue','')); idx:=idx+1;
    end loop;
  end loop;
  return true;
end;
$$;

revoke all on function public.load_fitlog_snapshot() from public;
revoke all on function public.save_fitlog_snapshot(jsonb) from public;
grant execute on function public.load_fitlog_snapshot() to anon, authenticated;
grant execute on function public.save_fitlog_snapshot(jsonb) to anon, authenticated;
