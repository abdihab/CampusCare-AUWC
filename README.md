# CampusCare – Ambo University, Woliso Campus

🌐 **Live Website:** [Visit CampusCare](https://campuscare-auwc.onrender.com)

CampusCare is a web-based campus problem reporting system that helps students report problems and track their progress.# CampusCare

**Your Campus. Your Voice. Better Together.**

CampusCare is a responsive student complaint and campus issue reporting platform for **Ambo University – Woliso Campus**. Students report and track issues; administrators review reports, manage departments and accounts, assign teams, respond, and monitor progress.

## Features

- Responsive student and administrator workspaces; there is no department-staff role
- Campus issue reporting with categories, priority, emergency flagging, anonymous submissions, and private image/document uploads
- Complaint IDs, status history, responses, and feedback
- Complaint search, category/status filters, CSV exports, printable PDF reports, and database-driven analytics
- Profiles, real campus announcements, in-app/realtime notifications, and light/dark themes
- English, Afaan Oromoo, and Amharic navigation/status translations
- Supabase email/password and Google OAuth authentication
- Supabase Storage, Realtime complaint updates, and row-level access policies

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- A Supabase project for authentication and data persistence

## Install and run

```sh
npm install
npm run dev
```

Before starting Vite, configure the public Supabase project URL and anon key in `.env`. Authentication, reports, announcements, and campus records require a configured Supabase project.

On Windows PowerShell, create the environment file with `Copy-Item .env.example .env`.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Only a Supabase publishable/anon key belongs in frontend environment variables. **Never add a service-role key to this application.**

## Supabase setup

1. Create a Supabase project and configure its Auth site URL and redirect URLs for your local and deployed origins (for example `http://localhost:5173/**`).
2. In **Authentication → Providers**, enable Email and Google. Configure Google OAuth credentials in your Google Cloud project and the Supabase provider settings.
3. Run [`supabase/schema.sql`](./supabase/schema.sql) once in a new Supabase project using a project owner account. It creates the tables, indexes, auth profile trigger, complaint/announcement notifications and history triggers, private file bucket, and RLS policies. For a database that already uses the earlier CampusCare schema, review and run [`supabase/migrate_updated_requirements.sql`](./supabase/migrate_updated_requirements.sql) instead.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`, then restart the Vite server.
5. Promote a trusted administrator using the Supabase SQL editor as project owner:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@ambo.edu.et';
   ```

6. Use **Students & administrators** to manage account roles and **Departments** to maintain complaint-assignment teams. Promote a trusted account to administrator only; all other accounts are students.

New signups create a student profile from the supplied registration metadata. If email confirmation is enabled, users must verify their university email before signing in. The private `complaint-files` Storage bucket allows approved image, PDF, and text formats up to 10 MB per file; the primary image picker additionally enforces 5 MB. Supabase Auth email templates and SMTP should be configured in the project for account verification and password reset emails. Report updates are delivered in-app and over Realtime.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

## Routes

`/login`, `/signup`, `/dashboard`, `/report`, `/my-complaints`, `/complaint/:id`, `/notifications`, `/announcements`, `/profile`, `/admin`, `/admin/complaints`, `/admin/people`, and `/admin/departments`.

The frontend hides routes by role for usability. **Supabase RLS is the security boundary** and independently restricts students to their own reports and attachments, and administrators to authorized campus-wide management. Anonymous reporter names remain hidden in student-facing complaint records. Never place a service-role key in the frontend.
