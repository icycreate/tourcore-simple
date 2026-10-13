begin;
create type public.team_role as enum ('Owner','Admin','Operations','Accounting','Guide');
create type public.tour_status as enum ('Draft','Planned','Ongoing','Completed','Cancelled');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null,email text not null unique,role public.team_role not null default 'Guide',active boolean not null default true);
create table public.vehicles(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))>0),source text not null check(source in ('Company','Supplier')),supplier_name text not null default '',registration text not null,capacity integer not null check(capacity>0),check(source<>'Supplier' or length(trim(supplier_name))>0));
create table public.resources(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))>0),kind text not null check(kind in ('Hotel','Attraction','Restaurant')),location text not null default '',contact text not null default '',notes text not null default '');
create table public.tours(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))>0),code text not null unique,start_date date not null,end_date date not null,status public.tour_status not null default 'Draft',guide_id uuid references public.profiles(id),vehicle_id uuid references public.vehicles(id),guests integer not null check(guests>0),notes text not null default '',check(end_date>=start_date));
create table public.stops(id uuid primary key default gen_random_uuid(),tour_id uuid not null references public.tours(id) on delete cascade,resource_id uuid references public.resources(id),date date not null,time time not null,title text not null check(length(trim(title))>0),location text not null default '',reference text not null default '',contact text not null default '',cost numeric(12,2) not null default 0 check(cost>=0),notes text not null default '',status text not null default 'Pending' check(status in ('Pending','Confirmed','Cancelled')));
create table public.expenses(id uuid primary key default gen_random_uuid(),tour_id uuid references public.tours(id),created_by uuid not null references public.profiles(id),date date not null,category text not null check(category in ('Accommodation','Meals','Transport','Attractions','Office','Other')),description text not null check(length(trim(description))>0),amount numeric(12,2) not null check(amount>0),receipt_path text);
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid,action text not null,entity text not null,record_id uuid,created_at timestamptz not null default now(),details jsonb not null default '{}');
create index tours_guide on public.tours(guide_id);
create index stops_tour_date on public.stops(tour_id,date,time);
create index expenses_tour_date on public.expenses(tour_id,date);
create index expenses_creator on public.expenses(created_by);
create index audit_recent on public.audit_logs(created_at desc);

create function public.current_role() returns public.team_role language sql stable security definer set search_path = public as $$select role from public.profiles where id=auth.uid() and active$$;
create function public.can_manage() returns boolean language sql stable as $$select coalesce(public.current_role() in ('Owner','Admin','Operations'),false)$$;
create function public.can_account() returns boolean language sql stable as $$select coalesce(public.current_role() in ('Owner','Admin','Accounting'),false)$$;
create function public.can_team() returns boolean language sql stable as $$select coalesce(public.current_role() in ('Owner','Admin'),false)$$;
create function public.can_read_tour(t uuid) returns boolean language sql stable security definer set search_path = public as $$select public.current_role() is not null and (public.current_role()<>'Guide' or exists(select 1 from public.tours where id=t and guide_id=auth.uid()))$$;
create function public.assigned_to(t uuid) returns boolean language sql stable security definer set search_path = public as $$select public.current_role()='Guide' and exists(select 1 from public.tours where id=t and guide_id=auth.uid())$$;

create function public.new_profile() returns trigger language plpgsql security definer set search_path = public as $$begin insert into public.profiles(id,name,email) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),new.email);return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();

create function public.log_change() returns trigger language plpgsql security definer set search_path = public as $$begin insert into public.audit_logs(actor_id,action,entity,record_id,details) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id),jsonb_build_object('before',case when TG_OP='INSERT' then null else to_jsonb(old) end,'after',case when TG_OP='DELETE' then null else to_jsonb(new) end));return coalesce(new,old);end$$;

create function public.validate_tour() returns trigger language plpgsql set search_path = public as $$begin
if new.guide_id is not null and not exists(select 1 from public.profiles where id=new.guide_id and role='Guide' and active) then raise exception 'Assign an active Guide';end if;
if new.vehicle_id is not null and not exists(select 1 from public.vehicles where id=new.vehicle_id and capacity>=new.guests) then raise exception 'Vehicle capacity must cover all guests';end if;
if TG_OP='INSERT' and new.status<>'Draft' then raise exception 'New tours start as Draft';end if;
if TG_OP='UPDATE' and new.status<>old.status and not ((old.status='Draft' and new.status in ('Planned','Cancelled')) or (old.status='Planned' and new.status in ('Draft','Ongoing','Cancelled')) or (old.status='Ongoing' and new.status in ('Completed','Cancelled'))) then raise exception 'Invalid tour lifecycle transition';end if;
if new.status in ('Planned','Ongoing') and (new.guide_id is null or new.vehicle_id is null) then raise exception 'Assign a guide and vehicle before planning a tour';end if;
if TG_OP='UPDATE' and exists(select 1 from public.stops where tour_id=new.id and (date<new.start_date or date>new.end_date)) then raise exception 'Tour dates must include every itinerary stop';end if;
return new;end$$;
create trigger validate_tour before insert or update on public.tours for each row execute function public.validate_tour();
create function public.validate_stop() returns trigger language plpgsql set search_path = public as $$begin if not exists(select 1 from public.tours where id=new.tour_id and new.date between start_date and end_date) then raise exception 'Stop date must fall within tour dates';end if;return new;end$$;
create trigger validate_stop before insert or update on public.stops for each row execute function public.validate_stop();
create function public.validate_expense() returns trigger language plpgsql set search_path = public as $$begin
if TG_OP='UPDATE' and (new.created_by<>old.created_by or new.id<>old.id) then raise exception 'Expense creator is immutable';end if;
if new.receipt_path is not null and new.receipt_path not like new.created_by::text || '/%' then raise exception 'Receipt must belong to expense creator';end if;
if new.receipt_path is not null and not exists(select 1 from storage.objects where bucket_id='receipts' and name=new.receipt_path) then raise exception 'Receipt upload not found';end if;
return new;end$$;
create trigger validate_expense before insert or update on public.expenses for each row execute function public.validate_expense();

alter table public.profiles enable row level security;
alter table public.tours enable row level security;
alter table public.vehicles enable row level security;
alter table public.resources enable row level security;
alter table public.stops enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

create policy profile_read on public.profiles for select to authenticated using(public.current_role() is not null and (id=auth.uid() or public.current_role()<>'Guide'));
-- Profiles have no direct mutation policy. All admin changes use the guarded RPC below.
create policy tour_read on public.tours for select to authenticated using(public.can_read_tour(id));
create policy tour_insert on public.tours for insert to authenticated with check(public.can_manage());
create policy tour_update on public.tours for update to authenticated using(public.can_manage()) with check(public.can_manage());
-- No tour deletion: cancel instead, preserving financial and audit history.
create policy vehicle_read on public.vehicles for select to authenticated using(public.current_role() is not null and (public.current_role()<>'Guide' or exists(select 1 from public.tours t where t.vehicle_id=vehicles.id and t.guide_id=auth.uid())));
create policy vehicle_insert on public.vehicles for insert to authenticated with check(public.can_manage());
create policy vehicle_update on public.vehicles for update to authenticated using(public.can_manage()) with check(public.can_manage());
create policy resource_read on public.resources for select to authenticated using(public.current_role() is not null and (public.current_role()<>'Guide' or exists(select 1 from public.stops s join public.tours t on t.id=s.tour_id where s.resource_id=resources.id and t.guide_id=auth.uid())));
create policy resource_insert on public.resources for insert to authenticated with check(public.can_manage());
create policy resource_update on public.resources for update to authenticated using(public.can_manage()) with check(public.can_manage());
create policy stop_read on public.stops for select to authenticated using(public.can_read_tour(tour_id));
create policy stop_insert on public.stops for insert to authenticated with check(public.can_manage());
create policy stop_update on public.stops for update to authenticated using(public.can_manage()) with check(public.can_manage());
create policy stop_delete on public.stops for delete to authenticated using(public.can_manage());
create policy expense_read on public.expenses for select to authenticated using(public.current_role() is not null and (public.current_role()<>'Guide' or public.assigned_to(tour_id)));
create policy expense_insert on public.expenses for insert to authenticated with check(created_by=auth.uid() and (public.current_role() in ('Owner','Admin','Operations','Accounting') or public.assigned_to(tour_id)));
create policy expense_update on public.expenses for update to authenticated using(public.can_account() or (created_by=auth.uid() and (public.current_role()='Operations' or public.assigned_to(tour_id)))) with check(public.can_account() or (created_by=auth.uid() and (public.current_role()='Operations' or public.assigned_to(tour_id))));
create policy audit_read on public.audit_logs for select to authenticated using(public.can_team());

create function public.manage_member(member_id uuid,member_name text,member_role public.team_role,member_active boolean) returns void language plpgsql security definer set search_path = public as $$declare actor public.team_role;target public.team_role;begin
-- Serializes all team changes so concurrent admins cannot remove the last Owner.
perform pg_advisory_xact_lock(721004);
actor:=public.current_role();if actor is null or actor not in ('Owner','Admin') then raise exception 'Administrator access required';end if;
select role into target from public.profiles where id=member_id for update;
if target is null then raise exception 'Member not found';end if;
if actor<>'Owner' and (target='Owner' or member_role='Owner') then raise exception 'Only Owners can manage Owner accounts';end if;
if member_id=auth.uid() and (not member_active or member_role<>actor) then raise exception 'Cannot disable or change your own role';end if;
if length(trim(member_name))=0 then raise exception 'Name is required';end if;
if target='Owner' and (member_role<>'Owner' or not member_active) and not exists(select 1 from public.profiles where role='Owner' and active and id<>member_id) then raise exception 'At least one active Owner is required';end if;
update public.profiles set name=trim(member_name),role=member_role,active=member_active where id=member_id;
end$$;

do $$declare t text;begin foreach t in array array['profiles','vehicles','resources','tours','stops','expenses'] loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function public.log_change()',t);end loop;end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy receipt_upload on storage.objects for insert to authenticated with check(bucket_id='receipts' and public.current_role() is not null and (storage.foldername(name))[1]=auth.uid()::text);
create policy receipt_read on storage.objects for select to authenticated using(bucket_id='receipts' and public.current_role() is not null and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.expenses e where e.receipt_path=name and (public.current_role()<>'Guide' or public.assigned_to(e.tour_id)))));

revoke all on function public.new_profile(),public.log_change(),public.validate_tour(),public.validate_stop(),public.validate_expense() from public,anon,authenticated;
revoke all on function public.current_role(),public.can_manage(),public.can_account(),public.can_team(),public.can_read_tour(uuid),public.assigned_to(uuid),public.manage_member(uuid,text,public.team_role,boolean) from public,anon;
grant execute on function public.current_role(),public.can_manage(),public.can_account(),public.can_team(),public.can_read_tour(uuid),public.assigned_to(uuid),public.manage_member(uuid,text,public.team_role,boolean) to authenticated;
grant select,insert,update,delete on public.profiles,public.vehicles,public.resources,public.tours,public.stops,public.expenses to authenticated;
grant select on public.audit_logs to authenticated;
revoke all on public.profiles,public.vehicles,public.resources,public.tours,public.stops,public.expenses,public.audit_logs from anon;
commit;
