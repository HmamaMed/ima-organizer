-- Rollback only: first stop the upgraded app and reconcile any writes made after cutover.
-- Restore the previous deployment/profile/database credentials, then unfreeze public.
-- Keep couples_app intact; never automatically copy its changed data back over public.
begin;
do $unfreeze$
declare app_table text;
begin
    for app_table in select c.relname from pg_trigger t
        join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and t.tgname='lifeorganizer_cutover_readonly'
    loop
        execute format('drop trigger lifeorganizer_cutover_readonly on public.%I', app_table);
    end loop;
end $unfreeze$;
drop function if exists public.lifeorganizer_cutover_readonly();
commit;
