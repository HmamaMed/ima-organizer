-- Run once in the EXISTING database as its owner, immediately before cutover.
-- This blocks old app writes (including scheduled jobs) without changing any rows.
-- For rollback see unfreeze-personal.sql; keep both schemas until validation is complete.
begin;
-- RUNTIME_ROLE_SETUP
create or replace function public.lifeorganizer_cutover_readonly()
returns trigger language plpgsql as $fence$
begin
    raise exception 'The original app is read-only during upgrade; use the updated app'
        using errcode = '55000';
end $fence$;
do $freeze$
declare app_table text;
begin
    foreach app_table in array array[
        'users','couples','couple_memberships','notes','memory_groups','media_assets','memories',
        'wish_photos','wishes','watch_items','watch_reviews','recipes','recipe_ingredients','recipe_steps',
        'birthday_reminders','birthday_deliveries','birthday_notifications','agios','library_exercises',
        'programmes','programme_days','day_exercises','workout_logs','exercise_ticks'
    ] loop
        if to_regclass(format('public.%I',app_table)) is not null then
            execute format('drop trigger if exists lifeorganizer_cutover_readonly on public.%I',app_table);
            execute format('create trigger lifeorganizer_cutover_readonly before insert or update or delete or truncate on public.%I for each statement execute function public.lifeorganizer_cutover_readonly()',app_table);
        end if;
    end loop;
end $freeze$;
commit;
