-- Run in a STAGING Supabase SQL editor after migration, as a privileged SQL user.
-- All fixtures and changes roll back. Uses Supabase's real Auth/Storage schemas.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('90000000-0000-4000-8000-000000000001','uat-owner@example.invalid','{"name":"UAT Owner"}'),
('90000000-0000-4000-8000-000000000002','uat-guide@example.invalid','{"name":"UAT Guide"}'),
('90000000-0000-4000-8000-000000000003','uat-other@example.invalid','{"name":"Other Guide"}');
update public.profiles set role='Owner' where id='90000000-0000-4000-8000-000000000001';
insert into public.tours(id,name,code,start_date,end_date,guests,guide_id) values('90000000-0000-4000-8000-000000000010','UAT assigned tour','UAT-RLS',current_date,current_date,1,'90000000-0000-4000-8000-000000000002');
set local role authenticated;
set local "request.jwt.claim.sub"='90000000-0000-4000-8000-000000000003';
do $$begin if exists(select 1 from public.tours where code='UAT-RLS') then raise exception 'FAIL: unassigned guide reads tour';end if;end$$;
set local "request.jwt.claim.sub"='90000000-0000-4000-8000-000000000002';
do $$begin if not exists(select 1 from public.tours where code='UAT-RLS') then raise exception 'FAIL: assigned guide cannot read tour';end if;end$$;
do $$begin begin perform public.manage_member('90000000-0000-4000-8000-000000000002','Guide','Owner',true);raise exception 'FAIL: self promotion';exception when others then if SQLERRM like 'FAIL:%' then raise;end if;end;end$$;
set local "request.jwt.claim.sub"='90000000-0000-4000-8000-000000000001';
select public.manage_member('90000000-0000-4000-8000-000000000002','UAT Guide','Guide',false);
set local "request.jwt.claim.sub"='90000000-0000-4000-8000-000000000002';
do $$begin if exists(select 1 from public.tours) then raise exception 'FAIL: disabled guide reads tours';end if;end$$;
rollback;
