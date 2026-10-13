begin;
-- One agency per installation, matching TourCore's single-operator scope.
create table public.companies (
 id uuid primary key default gen_random_uuid(),
 singleton boolean not null default true unique check(singleton),
 name text not null check(length(trim(name)) between 1 and 160),
 legal_name text not null default '',
 business_type text not null default 'Tour Agency' check(business_type in ('Company','Tour Agency')),
 registration_number text not null default '', tax_id text not null default '',
 email text not null default '', phone text not null default '', website text not null default '',
 address text not null default '', city text not null default '', country text not null default '',
 description text not null default '', logo_path text,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
 id uuid primary key references public.profiles(id) on delete cascade,
 language text not null default 'en' check(language in ('en','es','zh-Hant','zh-Hans')),
 appearance text not null default 'light' check(appearance in ('light','dark')),
 onboarding_completed boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;
alter table public.user_preferences enable row level security;
create policy company_read on public.companies for select to authenticated using(public.current_role() is not null);
create policy company_insert on public.companies for insert to authenticated with check(public.can_team() and created_by=auth.uid());
create policy company_update on public.companies for update to authenticated using(public.can_team()) with check(public.can_team());
create policy preference_read on public.user_preferences for select to authenticated using(id=auth.uid() and public.current_role() is not null);
create policy preference_insert on public.user_preferences for insert to authenticated with check(id=auth.uid() and public.current_role() is not null);
create policy preference_update on public.user_preferences for update to authenticated using(id=auth.uid() and public.current_role() is not null) with check(id=auth.uid() and public.current_role() is not null);

create function public.validate_company() returns trigger language plpgsql security definer set search_path=public as $$begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.created_by<>old.created_by) then raise exception 'Company identity and creator are immutable';end if;
 if new.logo_path is not null and (new.logo_path not like new.id::text || '/%' or not exists(select 1 from storage.objects where bucket_id='company-logos' and name=new.logo_path)) then raise exception 'Company logo upload not found';end if;
 new.updated_at:=now();return new;
end$$;
create trigger validate_company before insert or update on public.companies for each row execute function public.validate_company();
create function public.validate_preferences() returns trigger language plpgsql set search_path=public as $$begin
 if TG_OP='UPDATE' and new.id<>old.id then raise exception 'Preference owner is immutable';end if;
 new.updated_at:=now();return new;
end$$;
create trigger validate_preferences before insert or update on public.user_preferences for each row execute function public.validate_preferences();
create trigger audit_company after insert or update on public.companies for each row execute function public.log_change();
-- Preferences are personal; company audit history does not expose another user's preferences.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('company-logos','company-logos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy logo_upload on storage.objects for insert to authenticated with check(bucket_id='company-logos' and public.can_team() and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|webp)$');
create policy logo_read on storage.objects for select to authenticated using(bucket_id='company-logos' and public.current_role() is not null and (public.can_team() or exists(select 1 from public.companies c where c.logo_path=storage.objects.name)));
-- Each change uploads a unique object. No overwrites/deletion: existing references remain valid.
grant select,insert,update on public.companies,public.user_preferences to authenticated;
revoke all on public.companies,public.user_preferences from anon;
revoke all on function public.validate_company(),public.validate_preferences() from public,anon,authenticated;
commit;
