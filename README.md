# Switch Library

A web app for tracking your Nintendo Switch and Nintendo Switch 2 game collection.

## Features

- 🎮 **Track Your Collection** - Manage physical and digital games
- 📷 **Barcode Scanning** - Quickly add games by scanning barcodes (coming soon)
- 🔍 **Game Database** - Powered by IGDB for rich game metadata (coming soon)
- 🔗 **Share & Compare** - Share your library with friends (coming soon)
- 🔐 **GitHub Authentication** - Sign in with your GitHub account

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router 6
- **Styling**: CSS with dark mode support
- **Hosting**: GitHub Pages

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/jamesmontemagno/switch-library.git
cd switch-library

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## GitHub OAuth Setup (Optional)

To enable GitHub authentication:

1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set the homepage URL to your GitHub Pages URL
3. Set the callback URL to your GitHub Pages URL
4. Create a `.env` file with your client ID:
   ```
   VITE_GITHUB_CLIENT_ID=your_client_id
   ```

Without OAuth configuration, the app runs in demo mode with a mock user.

## Deployment

The app automatically deploys to GitHub Pages when changes are pushed to the `main` branch.

Live at: https://jamesmontemagno.github.io/switch-library/

## License

MIT License - see [LICENSE](LICENSE) for details.
