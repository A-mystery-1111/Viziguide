# ViziGuide frontend

## Run locally

```sh
npm install
npm run dev
```

Supabase configuration is read from `.env`:

```sh
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

The local `.env` is ignored by Git. Never put a Supabase `service_role` key in a frontend environment variable. Restart Vite after changing environment values.

In Supabase Authentication settings, set the site URL to your local app and allow its `/app`, `/login`, and `/reset-password` redirect URLs. Enable email/password authentication. For Google sign-in, enable the Google provider and use the callback URL shown by Supabase in your Google OAuth client settings.

## Database schema

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor to create the profiles, products, diagnoses, chat messages, and reminders tables. The script enables row-level security and limits each table to the signed-in user's rows. It also creates a profile automatically when a new auth user is inserted.

Routes under `/app` require an authenticated Supabase session. Unauthenticated visitors are redirected to the login page and returned to their requested route after signing in. The previous dashboard URLs redirect to their `/app` equivalents.

## Authentication context

`src/auth/AuthContext.tsx` provides `signUp`, `signIn`, `signInWithGoogle`, `signOut`, and `resetPassword`, plus the current user, session, and loading state. Sign-up may require email confirmation depending on the Supabase project settings.

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
