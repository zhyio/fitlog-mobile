create or replace function public.save_fitlog_snapshot(snapshot jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare part_name text; plan_items jsonb; e jsonb; w jsonb; pid uuid; wid uuid; idx integer;
begin
  delete from workout_exercises where id is not null;
  delete from workouts where id is not null;
  delete from plan_exercises where id is not null;
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
