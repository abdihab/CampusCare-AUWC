-- Upgrade an existing CampusCare database to student/admin-only access,
-- private complaint attachments, emergency reports, and admin notifications.
-- Run once in the Supabase SQL editor as a project owner.

begin;

drop policy if exists "Authenticated users can view departments" on public.departments;
drop policy if exists "Admins can manage departments" on public.departments;
drop policy if exists "Users can view their own profile and admins can view all" on public.profiles;
drop policy if exists "Users can update their own profile and admins can update all" on public.profiles;
drop policy if exists "Admins can create profiles" on public.profiles;
drop policy if exists "Students, assigned staff, and admins can view complaints" on public.complaints;
drop policy if exists "Students can view their own complaints and admins can view all" on public.complaints;
drop policy if exists "Students can submit their own complaints" on public.complaints;
drop policy if exists "Admins and assigned staff can update complaints" on public.complaints;
drop policy if exists "Only admins can update complaints" on public.complaints;
drop policy if exists "Admins can delete complaints" on public.complaints;
drop policy if exists "Students see public updates and staff see assigned complaint updates" on public.complaint_updates;
drop policy if exists "Students see public updates and admins see all updates" on public.complaint_updates;
drop policy if exists "Authorized staff can add updates" on public.complaint_updates;
drop policy if exists "Admins can add updates" on public.complaint_updates;
drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can mark their own notifications read" on public.notifications;
drop policy if exists "Students can submit feedback on their own complaints" on public.feedback;
drop policy if exists "Students and admins can view feedback" on public.feedback;
drop policy if exists "Authenticated users can view current announcements" on public.announcements;
drop policy if exists "Admins can manage announcements" on public.announcements;
drop policy if exists "Admins can send notifications" on public.notifications;
drop policy if exists "Complaint owners can upload complaint images" on storage.objects;
drop policy if exists "Authorized users can view complaint images" on storage.objects;
drop policy if exists "Students can upload files to their own complaints" on storage.objects;
drop policy if exists "Complaint owners and admins can view files" on storage.objects;
drop policy if exists "Admins and complaint owners can delete files" on storage.objects;

drop trigger if exists profiles_protect_role on public.profiles;
drop trigger if exists complaints_protect_staff_fields on public.complaints;
drop function if exists public.protect_staff_complaint_fields();
drop function if exists public.current_user_department_id();
drop function if exists public.current_user_role();
drop function if exists public.protect_profile_role();

update public.profiles set role = 'student' where role::text = 'staff';
alter table public.profiles alter column role drop default;
create type public.user_role_new as enum ('student', 'admin');
alter table public.profiles
  alter column role type public.user_role_new
  using (case when role::text = 'admin' then 'admin' else 'student' end)::public.user_role_new;
drop type public.user_role;
alter type public.user_role_new rename to user_role;
alter table public.profiles alter column role set default 'student';

alter table public.complaints
  add column if not exists is_emergency boolean not null default false;

create table if not exists public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index if not exists complaint_attachments_complaint_idx
  on public.complaint_attachments (complaint_id, created_at);

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and (select auth.uid()) is not null
    and coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Only administrators can change account roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

create or replace function public.notify_complaint_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.complaint_updates (complaint_id, author_id, status, message)
    values (new.id, new.student_id, new.status, 'Your report was received and will be reviewed by our campus team.');
    insert into public.notifications (user_id, complaint_id, title, message, type)
    values (new.student_id, new.id, 'Report submitted', 'Your report ' || new.public_id || ' has been received.', 'complaint_submitted');
    if new.is_emergency then
      insert into public.notifications (user_id, complaint_id, title, message, type)
      select p.id, new.id, 'Emergency report needs attention', 'Emergency report ' || new.public_id || ' requires urgent review.', 'emergency_report'
      from public.profiles p where p.role = 'admin';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.complaint_updates (complaint_id, author_id, status, message)
    values (new.id, (select auth.uid()), new.status, 'Your report status changed to ' || new.status || '.');
    insert into public.notifications (user_id, complaint_id, title, message, type)
    values (new.student_id, new.id, 'Report status updated', new.public_id || ' is now ' || new.status || '.', 'status_changed');
  end if;
  if new.is_emergency is distinct from old.is_emergency and new.is_emergency then
    insert into public.notifications (user_id, complaint_id, title, message, type)
    select p.id, new.id, 'Emergency report needs attention', 'Emergency report ' || new.public_id || ' requires urgent review.', 'emergency_report'
    from public.profiles p where p.role = 'admin';
  end if;
  if new.department_id is distinct from old.department_id and new.department_id is not null then
    insert into public.notifications (user_id, complaint_id, title, message, type)
    values (new.student_id, new.id, 'A team has been assigned', 'A team has been assigned to your report ' || new.public_id || '.', 'department_assigned');
  end if;
  if new.admin_response is distinct from old.admin_response and new.admin_response is not null then
    insert into public.complaint_updates (complaint_id, author_id, status, message)
    values (new.id, (select auth.uid()), new.status, new.admin_response);
    insert into public.notifications (user_id, complaint_id, title, message, type)
    values (new.student_id, new.id, 'A response was added', 'The campus team responded to ' || new.public_id || '.', 'response_added');
  end if;
  return new;
end;
$$;

create or replace function public.notify_new_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, title, message, type)
  select p.id, 'Campus announcement', new.title, 'announcement'
  from public.profiles p where p.role = 'student';
  return new;
end;
$$;
drop trigger if exists announcements_notify_students on public.announcements;
create trigger announcements_notify_students
  after insert on public.announcements
  for each row execute procedure public.notify_new_announcement();

create policy "Authenticated users can view departments"
  on public.departments for select to authenticated using (true);
create policy "Admins can manage departments"
  on public.departments for all to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "Users can view their own profile and admins can view all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');
create policy "Users can update their own profile and admins can update all"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin')
  with check (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');
create policy "Admins can create profiles"
  on public.profiles for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "Students can view their own complaints and admins can view all"
  on public.complaints for select to authenticated
  using (student_id = (select auth.uid()) or (select public.current_user_role()) = 'admin');
create policy "Students can submit their own complaints"
  on public.complaints for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.current_user_role()) = 'student');
create policy "Only admins can update complaints"
  on public.complaints for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy "Admins can delete complaints"
  on public.complaints for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "Students see public updates and admins see all updates"
  on public.complaint_updates for select to authenticated
  using (
    (not is_internal and exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = (select auth.uid())
    ))
    or (select public.current_user_role()) = 'admin'
  );
create policy "Admins can add updates"
  on public.complaint_updates for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

alter table public.complaint_attachments enable row level security;
create policy "Complaint owners and admins can view attachment metadata"
  on public.complaint_attachments for select to authenticated
  using (
    (select public.current_user_role()) = 'admin'
    or exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = (select auth.uid())
    )
  );
create policy "Students can add attachments to their own complaints"
  on public.complaint_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = (select auth.uid())
    )
  );
create policy "Admins and attachment owners can remove attachments"
  on public.complaint_attachments for delete to authenticated
  using ((select public.current_user_role()) = 'admin' or uploaded_by = (select auth.uid()));

create policy "Users can view their own notifications"
  on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Admins can send notifications"
  on public.notifications for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "Students can submit feedback on their own complaints"
  on public.feedback for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = (select auth.uid()) and c.status = 'Resolved'
    )
  );
create policy "Students and admins can view feedback"
  on public.feedback for select to authenticated
  using (student_id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

create policy "Authenticated users can view current announcements"
  on public.announcements for select to authenticated
  using (expires_at is null or expires_at > now());
create policy "Admins can manage announcements"
  on public.announcements for all to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-files', 'complaint-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])
on conflict (id) do update
set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

create policy "Students can upload files to their own complaints"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'complaint-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.complaints c
      where c.public_id = (storage.foldername(name))[2] and c.student_id = (select auth.uid())
    )
  );
create policy "Complaint owners and admins can view files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'complaint-files'
    and (
      (select public.current_user_role()) = 'admin'
      or exists (
        select 1 from public.complaints c
        where c.public_id = (storage.foldername(name))[2] and c.student_id = (select auth.uid())
      )
    )
  );
create policy "Admins and complaint owners can delete files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'complaint-files'
    and (
      (select public.current_user_role()) = 'admin'
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

-- Keep read access to existing private image objects during the transition.
create policy "Legacy complaint image owners and admins can read images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'complaint-images'
    and (
      (select public.current_user_role()) = 'admin'
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'complaint_attachments'
  ) then
    execute 'alter publication supabase_realtime add table public.complaint_attachments';
  end if;
end;
$$;

commit;
