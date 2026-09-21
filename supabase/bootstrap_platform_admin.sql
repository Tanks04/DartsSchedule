-- NOVA INSTALACIJA: pokrenuti nakon što se prvi vlasnik jednom prijavi u aplikaciju.
-- Zamijenite adresu u oba mjesta ispod.
insert into public.app_users(email,user_id,role)
select lower(email),id,'platform_admin' from auth.users
where lower(email)=lower('YOUR_EMAIL@example.com')
on conflict(email) do update set user_id=excluded.user_id,role='platform_admin';
