# Development Guide

## Quick Start

### 1. Install Dependencies
```bash
cd fantasy-league-dashboard
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 3. Build for Production
```bash
npm run build
npm start
```

## Project Structure

```
fantasy-league-dashboard/
├── src/
│   ├── components/           # React components
│   │   ├── common/          # Shared components (Header, Loading)
│   │   └── team/            # Team-specific components (TeamCard)
│   ├── lib/                 # Utilities and services
│   │   ├── services/        # Data services (Sleeper API, data processing)
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Helper functions and constants
│   ├── pages/               # Next.js pages and API routes
│   │   ├── api/             # API endpoints
│   │   └── index.tsx        # Main dashboard page
│   └── styles/              # CSS files
├── data/                    # JSON data files
│   ├── players.json         # Player data from Sleeper API
│   └── cap_numbers.json     # Salary cap values from Google Sheets
└── public/                  # Static assets
```

## Key Components

### Data Services (`src/lib/services/`)
- **fantasy-data.ts**: Main service orchestrating all data operations
- **sleeper-api.ts**: Sleeper API integration for team/player data
- **data-processor.ts**: Local JSON file processing (mirrors Python logic)

### React Components (`src/components/`)
- **Header**: Navigation and refresh functionality
- **TeamCard**: Individual team display with salary cap visualization
- **Loading**: Loading state component

### API Endpoints (`src/pages/api/`)
- **/api/teams**: Get all team data with salary cap information
- **/api/league/stats**: Get league-wide statistics

## Environment Setup

### Required Environment Variables (when using Google Sheets API)
Create a `.env.local` file:
```
GOOGLE_SHEETS_API_KEY=your_api_key_here
GOOGLE_SHEET_ID=1t6us1naBjjpU1k5Ew-ndCLjq7DkblbbBpXpArH6czUs
```

### Data Refresh Process
1. **Automatic**: API calls refresh data from Sleeper on each request
2. **Manual**: Use refresh button in dashboard header
3. **Cached**: JSON files provide fallback data when APIs are unavailable

## Development Notes

### Current Data Flow
1. Dashboard loads → calls `/api/teams`
2. Teams API → uses `FantasyDataService.getAllTeams()`
3. Fantasy service → processes local JSON files + calls Sleeper API
4. Returns combined team data with salary cap calculations

### Key Differences from Python Version
- **Async/Await**: All data operations are asynchronous
- **TypeScript**: Strong typing for better development experience
- **React State**: UI updates reactively to data changes
- **Next.js API**: Server-side data processing with client-side rendering

### Testing the Application
1. **Data Verification**: Check that team data loads correctly
2. **Salary Calculations**: Verify cap usage percentages and over-cap detection
3. **UI Responsiveness**: Test on different screen sizes
4. **API Error Handling**: Test with network issues or API failures

### Known Issues
- TypeScript configuration may need adjustment for Node.js modules
- Network connectivity required for initial npm install
- Sleeper API rate limiting may affect frequent refreshes

## Deployment to Vercel

### 1. Connect Repository
```bash
npm install -g vercel
vercel login
vercel
```

### 2. Environment Variables
Set in Vercel dashboard:
- `GOOGLE_SHEETS_API_KEY`
- `GOOGLE_SHEET_ID`

### 3. Build Configuration
Vercel automatically detects Next.js and builds correctly.

### Free Tier Limits
- **Bandwidth**: 100GB/month
- **Function Calls**: 1,000/day
- **Build Time**: 32 builds/month
- **Custom Domains**: 1 domain included

Perfect for this fantasy league dashboard project!
