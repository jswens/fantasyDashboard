# Player Caching System Implementation

## Overview
I've successfully implemented a local caching system for Sleeper players with cap numbers from the capsheet.csv file. Here's what was created:

## Key Features

### 1. CSV Processing
- **File**: `src/lib/services/data-processor.ts`
- **Method**: `readCapsheetCSV()` - Parses the capsheet.csv file
- **Method**: `parseCSVLine()` - Handles CSV parsing with proper quote handling

### 2. Processed Players Cache
- **Cache File**: `data/processed-players-cache.json`
- **Method**: `createProcessedPlayersCache()` - Creates cache from Sleeper data + CSV cap numbers
- **Method**: `loadProcessedPlayersFromCache()` - Loads cached processed players
- **Cache Duration**: 24 hours

### 3. Player Matching Logic
- **Method**: `findPlayerCapNumberFromRows()` - Matches Sleeper players to cap sheet entries
- **Strategies**:
  1. Exact name and team match
  2. Name match with position verification  
  3. Fuzzy name match for different formatting

### 4. API Endpoints
- **Endpoint**: `POST /api/refresh` - Refresh player data from Sleeper API
- **Parameters**: `{"force": false}` for player data only, `{"force": true}` for full refresh

### 5. Enhanced Data Flow
- **Current Flow**: Raw Sleeper data → Process with cap numbers → Cache processed players → Build teams
- **Cache Levels**: 
  - Raw Sleeper players (`data/players.json`)
  - Processed players with cap numbers (`data/processed-players-cache.json`)  
  - Team data (`data/teams-cache.json`)

## File Structure
```
data/
├── capsheet.csv                    # Source cap sheet data
├── players.json                    # Raw Sleeper player data
├── processed-players-cache.json    # Processed players with cap numbers (NEW)
└── teams-cache.json               # Team data cache
```

## Usage

### Automatic Cache Loading
The system automatically:
1. Checks for processed players cache (24hr TTL)
2. If cache miss, creates new cache from raw data + CSV
3. If no raw data, would fetch from Sleeper API

### Manual Refresh via API
```bash
# Refresh just player data
curl -X POST http://localhost:3000/api/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"force": false}'

# Force refresh all data (players + teams)
curl -X POST http://localhost:3000/api/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"force": true}'
```

### Enhanced FantasyDataService Methods
- `refreshPlayerData()` - Fetch fresh Sleeper data and rebuild processed cache
- `forceRefreshAllData()` - Full refresh including clearing team cache

## Data Processing Details

### Player Matching Algorithm
1. **Exact Match**: Name + Team abbreviation
2. **Position Match**: Name + Position when team doesn't match exactly
3. **Fuzzy Match**: Normalized names (lowercase, no special chars) + Team

### Processed Player Object
Each cached player includes:
```typescript
{
  ...sleeperPlayerData,           // Original Sleeper fields
  cap_value: number,              // Integer cap value
  cap_value_formatted: string,    // Formatted string like "$1,148,777"
  search_name: string             // Lowercase full name for searching
}
```

## Type Definitions Updated
- Changed `CapNumberRow` from tuple to interface for better type safety
- Added proper CSV field mapping

## Performance Benefits
- **Reduced API Calls**: Cache processed data locally
- **Faster Load Times**: Pre-processed cap calculations
- **Efficient Matching**: One-time CSV processing vs repeated lookups
- **Configurable TTL**: 24-hour cache prevents stale data

## Next Steps
To use the system:
1. Ensure `data/capsheet.csv` is up to date
2. Call `/api/refresh` to populate caches
3. The app will automatically use cached processed players
4. Cache refreshes automatically after 24 hours or manually via API

This implementation provides a robust, efficient caching layer that significantly improves performance while maintaining data accuracy through intelligent player matching algorithms.
