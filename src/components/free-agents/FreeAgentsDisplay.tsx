import { useState, useEffect, useCallback } from 'react';

interface FreeAgent {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  cap_value: number;
  cap_value_formatted: string;
  ranking: number;
  projection?: number;
  tier?: number;
  tierPosition?: number;
}

interface FreeAgentsByPosition {
  [position: string]: FreeAgent[];
}

interface FreeAgentsDisplayProps {
  sessionToken: string;
  onLogout: () => void;
}

// Helper function to handle logout API call
async function handleLogoutAPI(sessionToken: string): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
    });
  } catch (error) {
    console.warn('Logout API call failed:', error);
  }
}

export default function FreeAgentsDisplay({ sessionToken, onLogout }: FreeAgentsDisplayProps) {
  const [freeAgents, setFreeAgents] = useState<FreeAgentsByPosition>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('QB');
  const [totalFreeAgents, setTotalFreeAgents] = useState(0);
  const [uploadingProjections, setUploadingProjections] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [showTierInput, setShowTierInput] = useState(false);
  const [tierText, setTierText] = useState('');
  const [uploadingTiers, setUploadingTiers] = useState(false);
  const [tierMessage, setTierMessage] = useState('');

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];

  const fetchFreeAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/free-agents', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const data = await response.json();

      if (response.status === 401) {
        // Session is invalid, force re-authentication
        setError('Session expired. Please log in again.');
        setTimeout(() => {
          onLogout();
        }, 2000);
        return;
      }

      if (data.success) {
        setFreeAgents(data.data);
        setTotalFreeAgents(data.totalFreeAgents);
      } else {
        setError(data.message || 'Failed to fetch free agents');
      }
    } catch (error) {
      console.error('Network error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, onLogout]);

  useEffect(() => {
    fetchFreeAgents();
  }, [fetchFreeAgents]);

  const handleProjectionUpload = async (file: File) => {
    setUploadingProjections(true);
    setUploadMessage('');
    
    try {
      const formData = new FormData();
      formData.append('projections', file);

      const response = await fetch('/api/upload-projections', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadMessage(data.message);
        // Refresh free agents data to show new rankings
        setLoading(true);
        await fetchFreeAgents();
      } else {
        setUploadMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage('Upload failed. Please try again.');
    } finally {
      setUploadingProjections(false);
    }
  };

  const handleTierUpload = async () => {
    if (!tierText.trim()) return;
    
    setUploadingTiers(true);
    setTierMessage('');
    
    try {
      const response = await fetch('/api/upload-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ tierText }),
      });

      const data = await response.json();

      if (data.success) {
        setTierMessage(data.message);
        setTierText('');
        setShowTierInput(false);
        // Refresh free agents data to show new rankings
        setLoading(true);
        await fetchFreeAgents();
      } else {
        setTierMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Tier upload error:', error);
      setTierMessage('Tier upload failed. Please try again.');
    } finally {
      setUploadingTiers(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <button
            onClick={onLogout}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Top Free Agents</h1>
              <p className="text-sm text-gray-600 mt-1">
                {totalFreeAgents} total free agents available
                {uploadMessage && uploadMessage.includes('Successfully') && (
                  <span className="ml-2 text-green-600 font-medium">• Sorted by projections</span>
                )}
                {tierMessage && tierMessage.includes('Successfully') && (
                  <span className="ml-2 text-blue-600 font-medium">• Sorted by tiers</span>
                )}
              </p>
            </div>
            <div className="flex space-x-4">
              {/* Upload Projections */}
              <label className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center cursor-pointer">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleProjectionUpload(file);
                    }
                  }}
                  className="hidden"
                />
              </label>

              {/* Upload Tiers */}
              <button
                onClick={() => setShowTierInput(!showTierInput)}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Upload Tiers
              </button>
              
              <button
                onClick={async () => {
                  await handleLogoutAPI(sessionToken);
                  onLogout();
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
          
          {/* Upload Status Messages */}
          {uploadMessage && (
            <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4`}>
              <div className={`rounded-md p-4 ${uploadMessage.startsWith('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                <p className="text-sm">{uploadMessage}</p>
              </div>
            </div>
          )}
          
          {tierMessage && (
            <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4`}>
              <div className={`rounded-md p-4 ${tierMessage.startsWith('Error') ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                <p className="text-sm">{tierMessage}</p>
              </div>
            </div>
          )}

          {/* Tier Input Modal */}
          {showTierInput && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Player Tiers</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Paste tier data in this format: &quot;Tier 1: Player1, Player2&quot; (one tier per line)
                </p>
                <textarea
                  value={tierText}
                  onChange={(e) => setTierText(e.target.value)}
                  placeholder="Tier 1: Brandon Aubrey, Cameron Dicker&#10;Tier 2: Tyler Loop, Wil Lutz, Ka'imi Fairbairn&#10;..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={uploadingTiers}
                />
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTierInput(false);
                      setTierText('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    disabled={uploadingTiers}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTierUpload}
                    disabled={uploadingTiers || !tierText.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingTiers ? 'Uploading...' : 'Upload Tiers'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Position Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {positions.map((position) => {
              const count = freeAgents[position]?.length || 0;
              return (
                <button
                  key={position}
                  onClick={() => setSelectedPosition(position)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedPosition === position
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {position}
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Free Agents Table */}
        <div className="mt-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Top 10 {selectedPosition} Free Agents
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {tierMessage && tierMessage.includes('Successfully') ?
                  'Ranked by tiers with salary cap values' :
                  uploadMessage && uploadMessage.includes('Successfully') ?
                    'Ranked by projections with salary cap values' : 'Ranked by salary cap value'}
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {freeAgents[selectedPosition]?.map((player, index) => (
                <li key={player.player_id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              #{index + 1}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {player.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {player.team ? `${player.team} • ${player.position}` : player.position}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {player.tier !== undefined ? (
                          <>
                            <div className="text-sm font-medium text-purple-600">
                              Tier {player.tier}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {player.cap_value_formatted}
                            </div>
                          </>
                        ) : player.projection !== undefined ? (
                          <>
                            <div className="text-sm font-medium text-green-600">
                              {player.projection.toFixed(1)} pts
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {player.cap_value_formatted}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">
                            {player.cap_value_formatted}
                          </div>
                        )}
                        <div className="text-sm text-gray-500">
                          {player.tier !== undefined ? (
                            <>Tier {player.tier} • Rank #{player.ranking}</>
                          ) : player.projection !== undefined ? (
                            <>Projected • Rank #{player.ranking}</>
                          ) : (
                            <>Rank #{player.ranking} overall</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )) || (
                <li className="px-4 py-8 text-center text-gray-500">
                  No free agents available for {selectedPosition}
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.916-.75M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.916-.75M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Free Agents
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {totalFreeAgents.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Positions Available
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {positions.filter(pos => (freeAgents[pos]?.length || 0) > 0).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Highest Cap Value
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {freeAgents[selectedPosition]?.[0]?.cap_value_formatted || 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
