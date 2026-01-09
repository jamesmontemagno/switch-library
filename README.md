# My Switch Library

A web app for tracking your Nintendo Switch and Nintendo Switch 2 game collection.

## Features

- 🎮 **Track Your Collection** - Manage physical and digital games
- 📷 **Barcode Scanning** - Quickly add games by scanning barcodes (coming soon)
- 🔍 **Game Database** - Powered by TheGamesDB for rich game metadata
- 🔗 **Share & Compare** - Share your library with friends (coming soon)
- 🔐 **GitHub Authentication** - Sign in with your GitHub account via Supabase
- 💾 **Cloud Storage** - Data persisted with Supabase

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router 6
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with GitHub OAuth
- **Game API**: TheGamesDB
- **Styling**: CSS with dark mode support

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm
- Supabase account (free tier available)
- TheGamesDB API key (optional, for game search)

### Installation

```bash
# Clone the repository
git clone https://github.com/jamesmontemagno/switch-library.git
cd switch-library

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your project URL and anon key from Settings > API

### 2. Set up the Database Schema

Run the SQL from `supabase/schema.sql` in your Supabase SQL Editor to create:
- `profiles` table for user data
- `games` table for game entries
- `share_profiles` table for sharing functionality
- Row Level Security policies

### 3. Configure GitHub OAuth

1. Go to Authentication > Providers in your Supabase dashboard
2. Enable GitHub provider
3. Create a GitHub OAuth App at https://github.com/settings/developers
4. Set the callback URL to: `https://your-project.supabase.co/auth/v1/callback`
5. Add the Client ID and Secret to Supabase

### 4. Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_THEGAMESDB_API_KEY=your-api-key  # Optional
```

## TheGamesDB API

To enable game search and metadata:

1. Register at [TheGamesDB](https://thegamesdb.net/)
2. Request an API key
3. Add it to your `.env` file

Without an API key, the app works but won't have game search functionality.

## Deployment

### Recommended: Netlify (with API Proxy)

For production deployments with game search functionality, **Netlify is recommended** as it supports serverless functions to handle API proxying and avoid CORS issues.

1. **Connect your repository to Netlify:**
   - Sign up at [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository

2. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 20 or higher

3. **Add environment variables:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_THEGAMESDB_API_KEY=your-api-key
   ```

4. **Deploy:**
   - Netlify will automatically deploy on push to `main`
   - The `netlify.toml` configuration includes serverless functions for API proxying

### Alternative: GitHub Pages

⚠️ **Note:** GitHub Pages only supports static hosting and cannot proxy API requests. Game search features will not work due to CORS restrictions.

To deploy to GitHub Pages:

1. Set the base path:
   ```env
   VITE_BASE_PATH=/switch-library/
   ```

2. The GitHub Actions workflow will automatically deploy on push to `main`.

### Other Static Hosts

You can also deploy to:
- **Vercel** - Supports serverless functions (similar to Netlify)
- **Railway** - Supports full-stack deployments
- **Cloudflare Pages** - Supports Workers for API proxying

For any static-only hosting, you'll need to set up a separate backend or API proxy to avoid CORS issues with TheGamesDB API.

## Demo Mode

Without Supabase configuration, the app runs in demo mode:
- Mock authentication with a demo user
- Data stored in localStorage
- Full functionality for testing

## License

MIT License - see [LICENSE](LICENSE) for details.
