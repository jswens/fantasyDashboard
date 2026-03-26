#!/usr/bin/env ts-node

import { DataProcessor } from './src/lib/services/data-processor';

async function testZeroCapWarnings() {
  console.log('🔄 Testing Zero Cap Warning System...\n');
  
  const dataProcessor = new DataProcessor();
  
  try {
    // Force create a new processed players cache
    console.log('🔧 Creating fresh processed players cache...');
    const success = await dataProcessor.createProcessedPlayersCache({});
    
    if (success) {
      console.log('✅ Successfully created processed players cache!\n');
      
      // Get zero cap warning stats
      console.log('📊 Checking zero cap warning stats...');
      const stats = await dataProcessor.getZeroCapWarningStats();
      
      if (stats) {
        console.log(`⚠️  Zero cap hit players: ${stats.zeroCapCount}`);
        console.log(`👥 Total players: ${stats.totalPlayers}`);
        console.log(`📈 Percentage: ${stats.percentage}%\n`);
        
        if (stats.zeroCapCount > 0) {
          console.log('🎯 Found players with zero cap hits - warnings will be displayed!');
        } else {
          console.log('ℹ️  No players with zero cap hits found');
        }
      } else {
        console.log('❌ Could not retrieve zero cap warning stats');
      }
      
    } else {
      console.log('❌ Failed to create processed players cache');
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testZeroCapWarnings();
