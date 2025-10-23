import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Player } from '@/lib/types';
import { formatIntAsCurrency } from '@/lib/utils/formatters';

interface PositionCapData {
  position: string;
  capValue: number;
  percentage: number;
  playerCount: number;
}

interface CapByPositionChartProps {
  players: Player[];
  totalCapUsed: number;
}

// Position color mapping for consistent visual representation
const POSITION_COLORS: Record<string, string> = {
  QB: '#3B82F6',    // Blue
  RB: '#10B981',    // Green
  WR: '#F59E0B',    // Amber
  TE: '#8B5CF6',    // Purple
  K: '#EF4444',     // Red
  DEF: '#6B7280',   // Gray
  DB: '#06B6D4',    // Cyan
  DL: '#84CC16',    // Lime
  LB: '#F97316',    // Orange
  FLEX: '#EC4899',  // Pink
  BN: '#64748B',    // Slate
  IR: '#71717A',    // Zinc
};

// Default color for positions not in the mapping
const DEFAULT_COLOR = '#9CA3AF';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PositionCapData }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload as PositionCapData;
  
  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg">
      <p className="font-medium text-gray-900">{data.position}</p>
      <p className="text-sm text-gray-600">
        {formatIntAsCurrency(data.capValue)} ({data.percentage.toFixed(1)}%)
      </p>
      <p className="text-xs text-gray-500">
        {data.playerCount} {data.playerCount === 1 ? 'player' : 'players'}
      </p>
    </div>
  );
};

export default function CapByPositionChart({ players, totalCapUsed }: CapByPositionChartProps) {
  // Group players by position and calculate cap usage
  const positionData = React.useMemo(() => {
    const positionMap = new Map<string, { capValue: number; playerCount: number }>();
    
    players.forEach(player => {
      const position = player.position || 'Unknown';
      const current = positionMap.get(position) || { capValue: 0, playerCount: 0 };
      positionMap.set(position, {
        capValue: current.capValue + player.cap_value,
        playerCount: current.playerCount + 1,
      });
    });

    // Convert to array and calculate percentages
    const data: PositionCapData[] = Array.from(positionMap.entries())
      .map(([position, { capValue, playerCount }]) => ({
        position,
        capValue,
        percentage: totalCapUsed > 0 ? (capValue / totalCapUsed) * 100 : 0,
        playerCount,
      }))
      .sort((a, b) => b.capValue - a.capValue); // Sort by cap value descending

    return data;
  }, [players, totalCapUsed]);

  if (positionData.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cap Space by Position</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="mt-2 text-sm">No position data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Cap Space by Position</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={positionData}
                dataKey="capValue"
                nameKey="position"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label={(entry: PositionCapData) => 
                  entry.percentage > 5 ? `${entry.position}` : ''
                }
                labelLine={false}
              >
                {positionData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={POSITION_COLORS[entry.position] || DEFAULT_COLOR} 
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Position Breakdown Table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Position Breakdown</h4>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {positionData.map((item) => (
              <div key={item.position} className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: POSITION_COLORS[item.position] || DEFAULT_COLOR }}
                  />
                  <span className="text-sm font-medium text-gray-700">{item.position}</span>
                  <span className="text-xs text-gray-500">
                    ({item.playerCount} {item.playerCount === 1 ? 'player' : 'players'})
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatIntAsCurrency(item.capValue)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Positions:</span>
            <span className="ml-2 font-medium text-gray-900">{positionData.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Cap Used:</span>
            <span className="ml-2 font-medium text-gray-900">{formatIntAsCurrency(totalCapUsed)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
