# Admin Dashboard - Visual Overview

## Page Structure

The admin dashboard is located at `/admin` and provides a comprehensive overview of application statistics.

## Layout

### Header
- Title: "Admin Dashboard"
- Subtitle: "Usage statistics and application insights"

### Statistics Overview (Card Grid)

The dashboard displays 5 key metric cards in a responsive grid:

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  👥 Total Users     │  │  🎮 Total Games     │  │  🔗 Active Sharers  │
│                     │  │                     │  │                     │
│      1,234          │  │      5,678          │  │        567          │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│ 👥 Total Follows    │  │  🔍 API Searches    │
│                     │  │                     │
│        890          │  │      2,345          │
└─────────────────────┘  └─────────────────────┘
```

### Detailed Statistics Sections

#### 1. Games by Platform
```
📊 Games by Platform

Platform             | Count  | Percentage
---------------------|--------|------------
Nintendo Switch      | 4,500  | 79.3%
Nintendo Switch 2    | 1,178  | 20.7%
```

#### 2. Games by Format
```
📊 Games by Format

Format               | Count  | Percentage
---------------------|--------|------------
Physical             | 3,200  | 56.4%
Digital              | 2,478  | 43.6%
```

#### 3. Top Games by Collection Count
```
🏆 Top Games by Collection Count

#  | Game Title                        | Collections
---|-----------------------------------|-------------
1  | The Legend of Zelda: Tears of... | 523
2  | Super Mario Odyssey               | 487
3  | Animal Crossing: New Horizons     | 445
4  | Mario Kart 8 Deluxe               | 423
5  | Super Smash Bros. Ultimate        | 398
6  | Pokémon Scarlet/Violet            | 367
7  | Splatoon 3                        | 334
8  | Metroid Dread                     | 289
9  | Fire Emblem: Three Houses         | 256
10 | Xenoblade Chronicles 3            | 234
```

#### 4. Recent User Registrations
```
🕐 Recent User Registrations

Display Name         | Registered On
---------------------|------------------
JohnDoe              | Jan 19, 2026
GamerGirl123         | Jan 18, 2026
NintendoFan87        | Jan 18, 2026
SwitchCollector      | Jan 17, 2026
ZeldaLover           | Jan 17, 2026
MarioKarter          | Jan 16, 2026
PokemonMaster        | Jan 16, 2026
SplatoonPlayer       | Jan 15, 2026
MetroidFan           | Jan 15, 2026
FireEmblemHero       | Jan 14, 2026
```

## Color Scheme

The dashboard uses the application's theme system:

### Light Theme
- Background: Clean white (#ffffff)
- Cards: Light gray background with subtle borders
- Primary color: Nintendo Red (#e60012)
- Text: Dark gray for readability

### Dark Theme
- Background: Dark gray (#1a1a1a)
- Cards: Slightly lighter dark gray (#2a2a2a)
- Primary color: Lighter red for contrast
- Text: Light gray/white for readability

### Retro Themes (NES/Famicom)
- Maintains retro aesthetic with chunky borders
- Uses theme-appropriate accent colors

## Responsive Design

### Desktop View (> 768px)
- Cards displayed in grid: 3 columns for stats, 2 columns for additional metrics
- Tables display full width with all columns visible
- Navigation shows full text labels

### Mobile View (≤ 768px)
- Cards stack vertically (1 column)
- Tables remain scrollable horizontally if needed
- Compact spacing for better mobile UX
- Bottom navigation includes admin icon

## Navigation Access

### Header Navigation (Desktop)
```
[Logo] My Switch Library    [Search] [Library] [Following] [Admin] [Share]    [User Avatar]
                                                              ^^^^^^
                                                         (Admin link appears here)
```

### Bottom Navigation (Mobile)
```
┌─────────┬─────────┬──────────┬─────────┐
│  🔍     │  📚     │  👥      │  📈     │
│ Search  │ Library │Following │  Admin  │
└─────────┴─────────┴──────────┴─────────┘
                               ^^^^^^^^^^
                          (Admin icon appears here)
```

## Loading States

When loading statistics:
```
┌─────────────────────────────────┐
│   Admin Dashboard               │
│                                 │
│   Loading statistics...         │
│                                 │
└─────────────────────────────────┘
```

## Error States

When Supabase is not configured:
```
┌──────────────────────────────────────────────────┐
│   Admin Dashboard                                │
│                                                  │
│   ⚠️ Failed to load statistics.                 │
│   Admin dashboard only works with Supabase mode. │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Security Features

1. **Route Protection**: Non-admin users are redirected to home page
2. **Visual Indicators**: Admin link only visible to admin users
3. **Environment-Based**: Admin access controlled via environment variable
4. **No PII Display**: Shows aggregate data only, no email addresses

## Performance Considerations

- All statistics are fetched on page load
- Data displayed in real-time (no caching at dashboard level)
- Database queries optimized for count operations
- Responsive design minimizes layout shifts

## Accessibility

- Semantic HTML structure
- ARIA labels for navigation
- Keyboard navigable
- Screen reader friendly tables
- Color contrast meets WCAG 2.1 AA standards

## Future Enhancements

- Add data export (CSV/JSON)
- Time-based filtering (last 7 days, 30 days, etc.)
- Interactive charts and graphs
- Real-time refresh button
- More granular statistics (genres, release years, etc.)
