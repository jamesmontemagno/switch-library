# Switch Library – iOS App

A native iOS app built with **SwiftUI** for managing your Nintendo Switch game collection. Connects to the same Supabase backend and Azure Functions API as the web app.

## Features

- **Game Library**: View, filter, sort, and manage your Switch game collection
- **Game Search**: Search the database for Nintendo Switch and Switch 2 games
- **Game Details**: View comprehensive game information including overview, genres, developers, publishers, and similar game recommendations
- **Add Games**: Add games from search results (with cover art) or manually
- **Edit & Delete**: Edit game details, toggle favorites, mark as completed
- **Authentication**: Sign in with email/password via Supabase
- **Offline Support**: Games stored locally when Supabase is not configured
- **Accessibility**: Built with VoiceOver support, Dynamic Type, and proper accessibility labels

## Requirements

- **Xcode 16.0+**
- **iOS 17.0+**
- **[XcodeGen](https://github.com/yonaskolb/XcodeGen)** (for generating the Xcode project)

## Getting Started

### 1. Install XcodeGen

```bash
brew install xcodegen
```

### 2. Generate the Xcode Project

```bash
cd ios
xcodegen generate
```

This reads `project.yml` and creates `SwitchLibrary.xcodeproj`.

### 3. Open in Xcode

```bash
open SwitchLibrary.xcodeproj
```

Xcode will automatically resolve the Swift Package Manager dependency (Supabase Swift SDK).

### 4. Configure the App

Connection values are bundled at build time and are not editable in the app UI.

Set these keys in `project.yml` under the `SwitchLibrary` target settings:

- `INFOPLIST_KEY_API_BASE_URL`
- `INFOPLIST_KEY_SUPABASE_URL`
- `INFOPLIST_KEY_SUPABASE_KEY`

Then regenerate the project:

```bash
xcodegen generate
```

Without Supabase configured, the app works in local-only mode (games stored on device).

### 5. Build & Run

Select a simulator or device and press **⌘R** to build and run.

## Architecture

### MVVM Pattern

```
SwitchLibrary/
├── App/
│   ├── SwitchLibraryApp.swift      # App entry point
│   └── ContentView.swift           # Tab-based navigation
├── Models/
│   ├── GameModels.swift            # GameEntry, enums, Supabase row mapping
│   └── APIModels.swift             # API response types (search, details)
├── Services/
│   ├── APIService.swift            # Azure Functions API client
│   └── SupabaseService.swift       # Auth + game CRUD via Supabase
├── ViewModels/
│   ├── LibraryViewModel.swift      # Library state, filtering, sorting
│   ├── SearchViewModel.swift       # Search state, pagination
│   └── GameDetailViewModel.swift   # Game detail + recommendations
├── Views/
│   ├── Library/
│   │   ├── LibraryView.swift       # Main library list with stats
│   │   └── GameRowView.swift       # Library list row
│   ├── Search/
│   │   ├── SearchView.swift        # Search interface
│   │   └── SearchResultRow.swift   # Search result row
│   ├── GameDetail/
│   │   └── GameDetailView.swift    # Full game details + recommendations
│   ├── AddGame/
│   │   ├── AddGameView.swift       # Add from search or manually
│   │   └── EditGameView.swift      # Edit existing game
│   ├── Settings/
│   │   └── SettingsView.swift      # API config, auth, about
│   └── Components/
│       └── SharedComponents.swift  # Reusable UI components
└── Resources/
    └── Assets.xcassets/            # App icon, accent color
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  SwiftUI     │ ──▶ │  ViewModels  │ ──▶ │   Services   │
│  Views       │ ◀── │  (@Published)│ ◀── │  (async/await│
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    ▼            ▼            ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │ Supabase │ │ Azure    │ │ Local    │
                              │ (Auth +  │ │ Functions│ │ Storage  │
                              │  Games)  │ │ (Search) │ │(Fallback)│
                              └──────────┘ └──────────┘ └──────────┘
```

### Key Design Decisions

- **iOS 17+**: Uses modern SwiftUI features like `NavigationStack`, `@Observable`-compatible patterns
- **MVVM**: ViewModels use `@Published` properties and `ObservableObject` for reactive UI updates
- **Actor-based API Service**: `APIService` is an actor for thread-safe network calls
- **Dual-mode Storage**: Supabase for cloud sync, `UserDefaults` for local fallback
- **Async/Await**: All network operations use Swift concurrency
- **Accessibility**: VoiceOver labels, Dynamic Type support, semantic grouping

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [supabase-swift](https://github.com/supabase/supabase-swift) | 2.0+ | Authentication and database operations |

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | GET | Full-text game search with filters |
| `/api/games/{id}` | GET | Single game details |
| `/api/upcoming` | GET | Upcoming game releases |
| `/api/recommendations/{id}` | GET | Similar game recommendations |
| `/api/stats` | GET | Database statistics |

## Accessibility

The app is built with accessibility in mind:

- All interactive elements have accessibility labels
- `accessibilityElement(children: .combine)` for logical grouping
- System SF Symbols for consistent iconography
- Dynamic Type support throughout
- Color is never the sole indicator of information
- Standard iOS navigation patterns for VoiceOver users

Note: While built following WCAG 2.2 guidelines, manual testing with assistive technologies is recommended. Consider using [Accessibility Insights](https://accessibilityinsights.io/) for additional validation.
