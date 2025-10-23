# Fantasy Football League Dashboard - Project Setup Guide

## Project Overview
Build a modern web application to display real-time fantasy football league data, including team rosters, salary cap information, player details, and league standings based on the existing Python capsheet application.

## Project Status & Progress

### ✅ COMPLETED TASKS
- [x] **Project Foundation**: Created Next.js TypeScript project with Tailwind CSS
- [x] **Directory Structure**: Set up proper folder organization (src/, lib/, components/, pages/)
- [x] **Type Definitions**: Converted Python data models to TypeScript interfaces
- [x] **Utility Functions**: Ported Python formatters and calculations to TypeScript
- [x] **Component Architecture**: Built React components (Header, Loading, TeamCard)
- [x] **API Routes**: Created team endpoints with proper Next.js structure
- [x] **Dashboard UI**: Implemented main dashboard with stats overview and team grid
- [x] **Data Services**: Created service layer to handle Sleeper API and JSON processing
- [x] **Data Migration**: Copied existing JSON files (players.json, cap_numbers.json) to project

### ⏳ IN PROGRESS 
- [ ] **Dependency Installation**: Need to run `npm install` once network connectivity restored
- [ ] **API Integration**: Complete Sleeper API service implementation
- [ ] **Real Data Loading**: Connect dashboard to actual team and player data

### 📋 TODO
- [ ] **Team Detail Pages**: Individual team roster views with player cap information
- [ ] **Player Search**: Search and filter functionality across all players
- [ ] **Charts/Visualization**: Salary cap usage charts and league analytics
- [ ] **Responsive Design**: Mobile optimization and cross-device testing
- [ ] **Deployment**: Deploy to Vercel free tier hosting

## Current System Analysis

### Existing Data Sources
1. **Sleeper API**: Team rosters and player information (League ID: 1119283875567620096)
2. **Google Sheets**: Salary cap values (Sheet ID: 1t6us1naBjjpU1k5Ew-ndCLjq7DkblbbBpXpArH6czUs)
3. **Local JSON Files**: Cached player and cap number data

### Key Constants and Configuration
```python
LEAGUE_ID = 1119283875567620096
MAX_SALARY_CAP = 170266667  # $170.27M
GOOGLE_SHEET_ID = "1t6us1naBjjpU1k5Ew-ndCLjq7DkblbbBpXpArH6czUs"
CAPNUMBERS_RANGE = "capsheet!B2:G"
```

### Team Data Structure
```python
team_data = {
    '989631512561696768': {  # Justin Lea
        'slack_id': '<@U252E6DF0>',
        'team_name': 'Justin Lea'
    },
    '77846283045715968': {  # JSwens
        'slack_id': '<@U251NTJRZ>',
        'team_name': 'JSwens'
    },
    '991170880766099456': {  # Randy
        'slack_id': '<@U285N03C2>',
        'team_name': 'Randy'
    },
    '966489703690113024': {  # Kicker
        'slack_id': '<@UCBDZ4FBN>',
        'team_name': 'Kicker'
    },
    '989926690593857537': {  # Mike
        'slack_id': '<@U25F78TPF>',
        'team_name': 'Mike'
    },
    '989979320439328768': {  # Dan
        'slack_id': '<@U25EZ2BMX>',
        'team_name': 'Dan'
    },
    '989662695697797120': {  # Justin Durussel
        'slack_id': '<@U25A45222>',
        'team_name': 'Justin Durussel'
    },
    '989976772391272448': {  # Mac
        'slack_id': '<@U019URFSW2U>',
        'team_name': 'Mac'
    },
    '991934980680896512': {  # Jackson
        'slack_id': '<@U04SF7U4BQB>',
        'team_name': 'Jackson'
    },
    '991417561361248256': {  # Kevin
        'slack_id': '<@U252E6DF0>',
        'team_name': 'Kevin'
    },
    '984651053201141760': {  # Eric
        'slack_id': '<@U252E6DF0>',
        'team_name': 'Eric'
    },
    '989939483485196288': {  # Trish
        'slack_id': '<@U25GS23A6>',
        'team_name': 'Trish'
    }
}
```

## Technical Requirements

### Technology Stack (Free Tier Optimized)
- **Backend**: Python FastAPI or Next.js API Routes
- **Frontend**: React.js with Next.js and TypeScript
- **Styling**: Tailwind CSS
- **Database**: JSON files (current setup) or Vercel Postgres (free tier)
- **Caching**: In-memory caching or JSON file caching
- **Charts**: Chart.js or Recharts
- **Deployment**: Vercel (full-stack) - **FREE TIER RECOMMENDED**

### Free Hosting Options Comparison

#### Option 1: Vercel Full-Stack (RECOMMENDED)
- **Cost**: FREE (generous limits)
- **Frontend**: Next.js app
- **Backend**: Next.js API routes (serverless functions)
- **Database**: JSON files + Vercel Postgres (free: 60 hours compute/month)
- **Limits**: 100GB bandwidth/month, 1000 serverless function invocations/day
- **Pros**: Zero configuration, automatic deployments, great performance
- **Best for**: Your use case - perfect for fantasy league dashboard

#### Option 2: Netlify + Netlify Functions
- **Cost**: FREE
- **Frontend**: React/Next.js
- **Backend**: Netlify Functions (AWS Lambda)
- **Database**: JSON files or external free DB
- **Limits**: 100GB bandwidth/month, 125,000 function invocations/month
- **Pros**: Simple deployment, good CI/CD

#### Option 3: Render (Free Tier)
- **Cost**: FREE (with limitations)
- **Frontend + Backend**: Full applications
- **Database**: PostgreSQL (free tier available)
- **Limits**: Apps sleep after 15min inactivity, 500 build hours/month
- **Pros**: Traditional hosting model, good for Python apps
- **Cons**: Cold start delays

#### Option 4: Railway (Free Tier)
- **Cost**: FREE trial ($5 credit, then pay-per-use)
- **Pros**: Great for Python/FastAPI
- **Cons**: Not permanently free

### API Endpoints to Implement (Next.js API Routes)
```
GET /api/league/info          - League basic information
GET /api/teams               - All teams with basic stats
GET /api/teams/{team_id}     - Detailed team roster and cap info
GET /api/players             - All players with cap values
GET /api/players/search      - Search players by name/team
GET /api/analytics/overview  - League-wide analytics
POST /api/data/refresh       - Trigger data refresh
GET /api/health             - API health check
```

### Free Tier Architecture (Vercel Recommended)
```
Next.js App on Vercel (FREE)
├── Frontend: React components
├── API Routes: /pages/api/* (serverless functions)
├── Data Storage: JSON files + optional Vercel Postgres
└── Deployment: Automatic Git-based deployment
```

### Data Models

#### Team Model
```python
class Team:
    id: str                    # Sleeper team ID
    name: str                  # Team name
    owner_name: str           # Owner display name
    slack_id: str             # Slack user ID
    players: List[Player]     # Roster players
    total_cap_used: int       # Total salary cap used
    cap_remaining: int        # Remaining cap space
    is_over_cap: bool         # Whether team exceeds cap
    player_count: int         # Number of players on roster
    last_updated: datetime    # When data was last refreshed
```

#### Player Model
```python
class Player:
    sleeper_id: str           # Sleeper player ID
    first_name: str           # Player first name
    last_name: str            # Player last name
    full_name: str            # Full display name
    position: str             # Player position
    nfl_team: str             # NFL team abbreviation
    cap_value: int            # Salary cap hit (in dollars)
    cap_value_formatted: str  # Formatted as currency
    team_id: Optional[str]    # Which fantasy team owns this player
    is_rostered: bool         # Whether player is on a team
    search_name: str          # Normalized name for searching
```

#### League Model
```python
class League:
    id: str                   # League ID
    name: str                 # League name
    total_teams: int          # Number of teams
    salary_cap: int           # Maximum salary cap
    teams_over_cap: int       # Count of teams over cap
    average_cap_usage: float  # Average cap utilization
    last_updated: datetime    # When data was refreshed
    total_players: int        # Total rostered players
```

## Current Business Logic

### Data Processing Flow
1. **Fetch cap numbers** from Google Sheets (range: capsheet!B2:G)
2. **Get all NFL players** from Sleeper API
3. **Filter players** with valid NFL teams
4. **Match players** to cap values by name and team
5. **Load team rosters** from Sleeper
6. **Calculate team totals** and cap compliance
7. **Generate alerts** for teams over cap

### Key Algorithms

#### Player-to-Cap Matching Logic
```python
# Current matching logic (case-sensitive)
for cap in cap_numbers.get("values", []):
    if (player["first_name"] in cap[0] and 
        player["last_name"] in cap[0] and 
        cap[5] == player_team):
        cap_number = cap[2]
        break
```

#### Currency Conversion
```python
def convert_currency_to_int(currency_str):
    if currency_str == None:
        return 0
    clean_str = currency_str.replace('$', '').replace(',', '')
    return int(clean_str)

def format_int_as_currency(value):
    return locale.currency(value, grouping=True)
```

## Website Features to Implement

### Phase 1: Core Dashboard
- ✅ League overview with key stats
- ✅ Teams grid showing cap status
- ⏳ Basic team detail pages (structure created, needs implementation)
- ⏳ Player search functionality (pending)
- ✅ Responsive mobile design (Tailwind responsive classes)

### Phase 2: Enhanced Features
- [ ] Real-time data refresh
- [ ] Advanced filtering and sorting
- [ ] Cap usage charts and analytics
- [ ] Historical tracking
- [ ] Export functionality

### Phase 3: Advanced Analytics
- [ ] Team comparison tools
- [ ] Position breakdown analysis
- [ ] Market value trends
- [ ] Predictive analytics

## UI/UX Requirements

### Dashboard Layout
```
Header: League name, last updated, refresh button
Stats Bar: Total teams, teams over cap, avg cap usage
Teams Grid: 3-4 columns on desktop, 1-2 on mobile
Each Team Card:
  - Team name and owner
  - Cap usage bar (green/yellow/red)
  - Cap remaining/overage
  - Player count
  - "View Details" link
```

### Team Detail Page
```
Header: Team name, owner, back button
Cap Summary: Usage bar, remaining, total
Player Table:
  - Name, Position, NFL Team, Cap Hit
  - Sortable columns
  - Search/filter within roster
Analytics: Position breakdown chart
```

### Player Database Page
```
Search Bar: Name, position, team filters
Player Grid/Table:
  - Name, Position, NFL Team, Cap Value
  - Availability status (rostered/free)
  - Link to team if rostered
Pagination: Handle large player dataset
```

## Development Environment Setup

### Required Dependencies (Free Tier Optimized)
```
Next.js Full-Stack App:
- next.js
- react
- typescript
- tailwindcss
- @types/react
- @types/node
- sleeper-api-wrapper (for client-side or API routes)
- googleapis (for Google Sheets access)
- chart.js or recharts (for visualizations)

Optional (if using Vercel Postgres):
- @vercel/postgres
- drizzle-orm (lightweight ORM)
```

### Environment Variables (Vercel)
```
# Vercel Environment Variables (set in dashboard)
SLEEPER_LEAGUE_ID=1119283875567620096
GOOGLE_SHEET_ID=1t6us1naBjjpU1k5Ew-ndCLjq7DkblbbBpXpArH6czUs
MAX_SALARY_CAP=170266667
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...} # JSON as string
POSTGRES_URL=vercel_postgres_url # if using Vercel Postgres
```

## File Structure (Free Tier - Next.js Full-Stack)
```
fantasy-league-dashboard/
├── pages/
│   ├── api/
│   │   ├── league/
│   │   │   └── info.ts
│   │   ├── teams/
│   │   │   ├── index.ts
│   │   │   └── [id].ts
│   │   ├── players/
│   │   │   ├── index.ts
│   │   │   └── search.ts
│   │   ├── analytics/
│   │   │   └── overview.ts
│   │   ├── data/
│   │   │   └── refresh.ts
│   │   └── health.ts
│   ├── teams/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── players/
│   │   └── index.tsx
│   ├── analytics/
│   │   └── index.tsx
│   ├── _app.tsx
│   ├── _document.tsx
│   └── index.tsx (Dashboard)
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Loading.tsx
│   │   └── ErrorBoundary.tsx
│   ├── team/
│   │   ├── TeamCard.tsx
│   │   ├── TeamGrid.tsx
│   │   ├── TeamDetail.tsx
│   │   └── CapUsageBar.tsx
│   └── player/
│       ├── PlayerCard.tsx
│       ├── PlayerTable.tsx
│       └── PlayerSearch.tsx
├── lib/
│   ├── services/
│   │   ├── sleeper.ts
│   │   ├── sheets.ts
│   │   └── data-processor.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── constants.ts
│   └── types/
│       ├── team.ts
│       ├── player.ts
│       └── league.ts
├── public/
│   └── favicon.ico
├── styles/
│   └── globals.css
├── data/ (cached JSON files)
│   ├── players.json
│   ├── cap_numbers.json
│   └── teams.json
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local
├── .gitignore
└── README.md
```

### Alternative File Structure (Separate Backend - if needed)
```
fantasy-league-dashboard/
├── backend/ (if using separate Python API)
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── teams.py
│   │   │   │   ├── players.py
│   │   │   │   ├── league.py
│   │   │   │   └── analytics.py
│   │   │   └── main.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── team.py
│   │   │   ├── player.py
│   │   │   └── league.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── sleeper_service.py
│   │   │   ├── sheets_service.py
│   │   │   └── data_processor.py
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── formatters.py
│   │   └── config.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── frontend/ (Next.js frontend only)
│   └── [standard Next.js structure]
└── README.md
```

## Security Considerations
- Store Google Sheets credentials securely
- Implement CORS properly for frontend/backend communication
- Add rate limiting to API endpoints
- Validate all input data
- Use environment variables for sensitive data

## Performance Optimizations (Free Tier Friendly)
- Cache frequently accessed data in JSON files
- Use static generation (SSG) where possible with Next.js
- Implement client-side caching with React Query or SWR
- Optimize bundle size with dynamic imports
- Use Vercel's Edge Functions for faster response times
- Implement efficient data fetching patterns

## Deployment Steps (Vercel - FREE)

### Option 1: Vercel Full-Stack (Recommended)
1. **Prepare Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Import your repository
   - Vercel auto-detects Next.js and configures build settings
   - Add environment variables in Vercel dashboard

3. **Configure Environment Variables in Vercel Dashboard**
   ```
   SLEEPER_LEAGUE_ID=1119283875567620096
   GOOGLE_SHEET_ID=1t6us1naBjjpU1k5Ew-ndCLjq7DkblbbBpXpArH6czUs
   MAX_SALARY_CAP=170266667
   GOOGLE_SHEETS_CREDENTIALS=<your-service-account-json>
   ```

4. **Automatic Deployments**
   - Every git push to main branch triggers auto-deployment
   - Preview deployments for pull requests
   - Zero downtime deployments

### Option 2: Netlify Deployment
1. **Build for Static Export** (if using static generation)
   ```bash
   npm run build
   npm run export
   ```

2. **Deploy to Netlify**
   - Drag and drop `out` folder to Netlify
   - Or connect GitHub repository for auto-deployments
   - Configure environment variables in Netlify dashboard

### Option 3: GitHub Pages (Static Only)
1. **Configure for Static Export**
   ```javascript
   // next.config.js
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'export',
     images: {
       unoptimized: true
     }
   }
   module.exports = nextConfig
   ```

2. **Deploy with GitHub Actions**
   - Use GitHub Actions workflow for automatic deployment
   - Static site only (no API routes)

## Free Tier Limitations & Solutions

### Vercel Free Tier Limits
- **Bandwidth**: 100GB/month (more than enough for fantasy league)
- **Function Executions**: 1000/day (sufficient for your use case)
- **Build Time**: 6 hours/month (plenty for this project)
- **Storage**: 1GB (adequate for JSON files)

### Solutions for Limits
1. **Caching Strategy**: Cache API responses in JSON files
2. **Static Generation**: Pre-generate pages where possible
3. **Client-side Processing**: Move some logic to browser
4. **Efficient Data Fetching**: Only fetch when data changes

### Cost Monitoring
- Monitor usage in Vercel dashboard
- Set up alerts for approaching limits
- Optimize if nearing thresholds

## Success Metrics
- Page load times under 2 seconds
- Mobile responsive on all devices
- Real-time data updates within 5 minutes
- 99% uptime during football season
- Support for concurrent users during peak times

---

## Getting Started Instructions for Agent (Free Tier)

### Recommended Approach: Next.js Full-Stack on Vercel (FREE)

1. **Initialize Project** ✅ COMPLETED
   ```bash
   npx create-next-app@latest fantasy-league-dashboard --typescript --tailwind --eslint --app
   cd fantasy-league-dashboard
   ```

2. **Install Additional Dependencies** ⏳ PENDING (network issues)
   ```bash
   npm install sleeper-api-wrapper googleapis chart.js react-chartjs-2
   npm install -D @types/node
   ```

3. **Set up Project Structure** ✅ COMPLETED
   - ✅ Create `pages/api/` directory for API routes
   - ✅ Create `lib/` directory for services and utilities
   - ✅ Create `components/` directory for React components
   - ✅ Create `data/` directory for cached JSON files

4. **Extract Logic from capsheet.py** ✅ PARTIALLY COMPLETED
   - ✅ Convert Python functions to TypeScript (formatters, constants)
   - ✅ Create API routes in `pages/api/` (teams endpoint structure)
   - ⏳ Implement the same data processing logic (in progress)
   - ✅ Maintain JSON file caching strategy

5. **Build MVP Dashboard** ✅ PARTIALLY COMPLETED
   - Dashboard page with league overview
   - Teams grid with basic cap information
   - Team detail pages with roster views
   - Basic player search functionality

6. **Deploy to Vercel**
   - Push to GitHub repository
   - Connect to Vercel account
   - Configure environment variables
   - Automatic deployment on git push

### Alternative: Separate Frontend/Backend

If you prefer to keep Python backend:
1. **Frontend**: Deploy Next.js to Vercel (free)
2. **Backend**: Deploy FastAPI to Render (free tier with limitations)
3. **Database**: Use JSON files or Render PostgreSQL (free tier)

### Data Migration Strategy
- Keep existing JSON file caching approach
- Your current `players.json` and `cap_numbers.json` work perfectly
- No database setup needed initially
- Can upgrade to Vercel Postgres later if needed

### Success with Free Tier
Your fantasy league dashboard is **perfect for free tier** because:
- Small user base (12 team owners)
- Data updates infrequently (few times per day max)
- Moderate data size (JSON files work fine)
- Low concurrent user load
- Simple read-heavy operations

The existing capsheet.py contains all the core business logic and data processing that needs to be adapted into Next.js API routes. Focus on maintaining the same data accuracy and team/player matching logic while building a modern web interface around it.

## Testing Strategy (Free Tier)
- Unit tests for utility functions with Jest
- Component testing with React Testing Library
- API route testing with Next.js test utilities
- End-to-end testing with Playwright (free on GitHub Actions)
- Use GitHub Actions for CI/CD (free for public repos)

## Additional Free Tier Services

### Analytics (Optional)
- **Vercel Analytics**: Free tier available
- **Google Analytics**: Free
- **Plausible**: Open source, self-hosted option

### Monitoring (Optional)
- **Vercel Monitoring**: Basic monitoring included
- **UptimeRobot**: Free monitoring for up to 50 monitors
- **GitHub Actions**: Free monitoring via scheduled runs

### Domain (Optional)
- **Vercel**: Free `yourapp.vercel.app` subdomain
- **Freenom**: Free domain names (limited TLDs)
- **GitHub Student Pack**: Free domain if you're a student
