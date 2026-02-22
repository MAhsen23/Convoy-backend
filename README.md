# FastFix - Node.js Backend

This is a clean Node.js backend using Express and Supabase.

## Folder Structure

```
src/
  config/           # Configuration files
    config.js       # Environment variables
    db.js           # Supabase client
  controllers/      # Route handlers & DB logic
  routes/           # API route definitions
  app.js            # Express app setup
  server.js         # Entry point
```

## Prerequisites

You need to have a Supabase project set up.

### How to Set Up Supabase

1.  **Create a Supabase Account**:
    - Go to [https://supabase.com](https://supabase.com)
    - Sign up for a free account

2.  **Create a New Project**:
    - Click "New Project"
    - Choose your organization
    - Enter project name and database password
    - Select a region close to you

3.  **Get Your Project Credentials**:
    - Go to Project Settings > API
    - Copy your Project URL and anon/public key

## Installation & Running

1.  `npm install`
2.  Update your `.env` file with your Supabase credentials:
    ```ini
    PORT=3000
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
3.  `npm run dev`
