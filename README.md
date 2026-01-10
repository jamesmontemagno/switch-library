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

### Hybrid Deployment: GitHub Pages + Azure Functions (Recommended for this setup)

This approach keeps the static frontend on GitHub Pages (free hosting) while deploying the backend to Azure Functions. This is ideal for personal projects and provides the best of both worlds.

#### Step 1: Deploy Backend to Azure Functions

1. **Deploy the Azure Functions backend:**
   ```bash
   cd backend-api
   func azure functionapp publish switchlibrary-api
   ```
   
2. **Note your Azure Functions URL** (e.g., `https://switchlibrary-api.azurewebsites.net`)

3. **Configure CORS in Azure Portal:**
   - Go to your Function App → CORS
   - Add your GitHub Pages URL (e.g., `https://jamesmontemagno.github.io`)
   - Save the settings

See [backend-api/README.md](backend-api/README.md) for detailed deployment instructions.

#### Step 2: Deploy Frontend to GitHub Pages

1. **Configure environment variables in GitHub Secrets:**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
     - `VITE_THEGAMESDB_API_KEY`: Your TheGamesDB API key
     - `VITE_API_BASE_URL`: Your Azure Functions URL (e.g., `https://switchlibrary-api.azurewebsites.net/api/thegamesdb`)
     - `VITE_BASE_PATH`: `/switch-library/` (or your repo name)

2. **The GitHub Actions workflow will automatically deploy on push to `main`**

3. **Access your app at:** `https://YOUR_USERNAME.github.io/switch-library/`

### Alternative: Integrated Azure Deployment

For production deployments where you want everything on Azure, you can use Azure Static Web Apps with integrated Azure Functions.

#### Frontend Deployment (Azure Static Web Apps)

1. **Create an Azure Static Web App:**
   ```bash
   az login
   az staticwebapp create --name myswitchlibrary --resource-group SwitchLibraryRG \
     --location eastus2 --source https://github.com/YOUR_USERNAME/switch-library \
     --branch main --app-location "/" --output-location "dist"
   ```

2. **Configure environment variables in Azure Portal:**
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `VITE_THEGAMESDB_API_KEY`: Your TheGamesDB API key

3. **Build settings:**
   - Build command: `npm run build`
   - App location: `/`
   - Output location: `dist`

#### Backend Deployment (Azure Functions)

Quick deployment:
```bash
cd backend-api
func azure functionapp publish switchlibrary-api
```

After deployment:
1. Note the Azure Functions URL (e.g., `https://switchlibrary-api.azurewebsites.net`)
2. Update the frontend to use the backend URL via `VITE_API_BASE_URL` environment variable
3. Configure CORS in the Azure Function App to allow your frontend domain

### Local Development

#### Running the Full Stack Locally

1. **Start the backend** (in one terminal):
   ```bash
   cd backend-api
   dotnet run
   ```
   The backend will run on `http://localhost:7071`

2. **Start the frontend** (in another terminal):
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173` and proxy API requests to the backend

## Demo Mode

Without Supabase configuration, the app runs in demo mode:
- Mock authentication with a demo user
- Data stored in localStorage
- Full functionality for testing

## License

MIT License - see [LICENSE](LICENSE) for details.
