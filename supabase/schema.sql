-- CampusCare database schema for Supabase (PostgreSQL).
-- Run in the Supabase SQL editor using a project owner account.

create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'admin');
create type public.complaint_status as enum ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected');
create type public.complaint_priority as enum ('Low', 'Medium', 'High', 'Urgent');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

insert into public.departments (name, description) values
  ('ICT Services', 'Campus connectivity, computer labs, and IT support'),
  ('Facilities', 'Campus buildings, water, electricity, and maintenance'),
  ('Library Services', 'Library facilities, resources, and study spaces'),
  ('Student Affairs', 'Student support, dormitories, and campus services'),
  ('Campus Security', 'Campus safety and security')
on conflict (name) do nothing;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  student_id text unique,
  email text,
  department text,
  academic_year text,
  phone text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  student_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(title) between 5 and 150),
  category text not null,
  location text not null,
  description text not null check (char_length(description) >= 15),
  status public.complaint_status not null default 'Submitted',
  priority public.complaint_priority not null default 'Medium',
  is_anonymous boolean not null default false,
  is_emergency boolean not null default false,
  department_id uuid references public.departments (id) on delete set null,
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table public.complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  status public.complaint_status,
  message text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  complaint_id uuid references public.complaints (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null unique references public.complaints (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'Campus news',
  author_id uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index complaints_student_created_idx on public.complaints (student_id, created_at desc);
create index complaints_status_priority_idx on public.complaints (status, priority);
create index complaints_department_status_idx on public.complaints (department_id, status);
create index complaints_category_idx on public.complaints (category);
create index complaint_updates_complaint_created_idx on public.complaint_updates (complaint_id, created_at desc);
create index complaint_attachments_complaint_idx on public.complaint_attachments (complaint_id, created_at);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index announcements_published_idx on public.announcements (published_at desc);

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_complaint_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'Resolved' and old.status is distinct from new.status then
    new.resolved_at = now();
  end if;
  return new;
end;
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, student_id, email, department, academic_year, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'department', ''),
    nullif(new.raw_user_meta_data ->> 'academic_year', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

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
      from public.profiles p
      where p.role = 'admin';
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
    from public.profiles p
    where p.role = 'admin';
  end if;

  if new.department_id is distinct from old.department_id and new.department_id is not null then
    insert into public.notifications (user_id, complaint_id, title, message, type)
    select p.id, new.id, 'A team has been assigned', 'A team has been assigned to your report ' || new.public_id || '.', 'department_assigned'
    from public.profiles p
    where p.id = new.student_id;
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
  from public.profiles p
  where p.role = 'student';
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

create trigger complaints_updated_at
  before update on public.complaints
  for each row execute procedure public.set_complaint_timestamps();

create trigger complaints_notify_change
  after insert or update on public.complaints
  for each row execute procedure public.notify_complaint_change();

create trigger announcements_notify_students
  after insert on public.announcements
  for each row execute procedure public.notify_new_announcement();

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_attachments enable row level security;
alter table public.complaint_updates enable row level security;
alter table public.notifications enable row level security;
alter table public.feedback enable row level security;
alter table public.announcements enable row level security;

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
  using (
    student_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );
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
  using (
    (select public.current_user_role()) = 'admin'
    or uploaded_by = (select auth.uid())
  );

create policy "Users can view their own notifications"
  on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Students can submit feedback on their own complaints"
  on public.feedback for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from public.complaints c where c.id = complaint_id and c.student_id = (select auth.uid()) and c.status = 'Resolved')
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

create policy "Admins can send notifications"
  on public.notifications for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

-- Private files are accessible only to their complaint owner and administrators.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-files', 'complaint-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

create policy "Students can upload files to their own complaints"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'complaint-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.complaints c
      where c.public_id = (storage.foldername(name))[2]
        and c.student_id = (select auth.uid())
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
        where c.public_id = (storage.foldername(name))[2]
          and c.student_id = (select auth.uid())
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

-- Enable realtime updates for complaint status changes.
alter publication supabase_realtime add table public.complaints;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.complaint_updates;
alter publication supabase_realtime add table public.complaint_attachments;
