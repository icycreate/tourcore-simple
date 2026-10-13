-- Optional operational seed. No fake Auth accounts or passwords.
-- Run after migrations. Create/invite real users through Auth/the application.
insert into public.vehicles(id,name,source,supplier_name,registration,capacity) values
('00000000-0000-4000-8000-000000000020','Toyota Hiace','Company','','BZ-2841',15),
('00000000-0000-4000-8000-000000000021','Coastal Shuttle','Supplier','Western Transport','BZ-0923',12) on conflict do nothing;
insert into public.resources(id,name,kind,location,contact,notes) values
('00000000-0000-4000-8000-000000000030','San Ignacio Resort','Hotel','San Ignacio','+501 824 2034',''),
('00000000-0000-4000-8000-000000000031','Xunantunich','Attraction','San Jose Succotz','','Ferry crossing required.'),
('00000000-0000-4000-8000-000000000032','Hode’s Place','Restaurant','San Ignacio','','Group lunch.') on conflict do nothing;
insert into public.tours(id,name,code,start_date,end_date,status,guests,notes) values
('00000000-0000-4000-8000-000000000010','Belize Discovery','TC-DEMO-001',current_date,current_date+5,'Draft',12,'Assign a real guide and vehicle before planning this tour.') on conflict do nothing;
