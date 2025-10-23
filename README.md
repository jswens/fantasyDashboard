# Fantasy League Dashboard

A modern web application to display real-time fantasy football league data, including team rosters, salary cap information, player details, and league standings.

## Features

- **League Overview**: Dashboard with key statistics and team summaries
- **Team Management**: View team rosters, salary cap usage, and player details
- **Player Database**: Search and filter all NFL players with cap values
- **Real-time Data**: Integration with Sleeper API and Google Sheets
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technology Stack

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes (serverless functions)
- **Data Sources**: Sleeper API, Google Sheets
- **Deployment**: Vercel (free tier)
- **Styling**: Tailwind CSS with custom NFL/fantasy theme

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fantasy-league-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```
SLEEPER_LEAGUE_ID=1119283875567620096
GOOGLE_SHEET_ID=1t6us1naBjjpU1k5Ew-ndCLjq7DkblbbBpXpArH6czUs
MAX_SALARY_CAP=170266667
GOOGLE_SHEETS_CREDENTIALS=<your-service-account-json>
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Development Status

### ✅ Completed Tasks
- [x] Project initialization and structure setup
- [x] TypeScript configuration and type definitions
- [x] Basic component structure (Header, Loading, TeamCard)
- [x] Utility functions for currency and cap calculations
- [x] API route structure for teams endpoint
- [x] Main dashboard page with stats overview
- [x] Tailwind CSS configuration with custom colors

### 🚧 In Progress
- [ ] Install dependencies (waiting for network connectivity)
- [ ] Sleeper API integration
- [ ] Google Sheets API integration
- [ ] Team detail pages
- [ ] Player search functionality

### 📋 Pending Tasks
- [ ] Complete API implementations
- [ ] Add data caching with JSON files
- [ ] Team detail pages with full rosters
- [ ] Player database and search
- [ ] Cap usage charts and analytics
- [ ] Mobile responsive design refinements
- [ ] Error handling and loading states
- [ ] Deploy to Vercel

## Architecture

The application follows a Next.js full-stack architecture:

- **Frontend**: React components with TypeScript
- **API Layer**: Next.js API routes in `/pages/api/`
- **Data Processing**: Utility functions that mirror the Python capsheet logic
- **Styling**: Tailwind CSS with custom fantasy football theme
- **Data Storage**: JSON file caching + optional database integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and for personal use.
