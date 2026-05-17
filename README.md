# Supabase Workspace Setup

This project is a minimal Supabase starter app.

## Setup

1. Open the folder in VS Code: `c:\Users\admin\Downloads\index.html\Supabase\New folder`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`.
4. Add your Supabase credentials from your Supabase project.
5. Run the app:
   ```bash
   npm run dev
   ```

## Environment variables

Copy `.env.example` to `.env` and replace with your Supabase values. For the new server, use the project ref `vhblvqcojeakcyxeeujo`:

```env
VITE_SUPABASE_URL=https://vhblvqcojeakcyxeeujo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase authentication

This app now uses Supabase Auth for login. To sign in:

1. Open your Supabase project.
2. Go to `Authentication` → `Users`.
3. Add a new user with an email and password.
4. Use that email and password in the app login form.

If you want, I can also help you set up a Supabase Auth sign-up page or create the user table automatically.

## Supabase database setup

This app currently uses Supabase only for authentication. To store app data in Supabase, create the tables you need in the Supabase dashboard or SQL editor.

For example, create a table called `todos` or `erp_data` and give the authenticated user access.

## How it works

- `public/index.html` contains the UI.
- `src/app.js` initializes Supabase with `createClient`.
- The app fetches sample rows from a table called `todos`.

## Next steps

- Create a table in Supabase named `todos` with columns: `id`, `task`, `is_complete`.
- Update `src/app.js` to match your schema.
- Use Supabase Auth or Realtime if needed.
