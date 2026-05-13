import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';

import { initDatabase } from '@/db/database';
import { Colors } from '@/constants';

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      try {
        await initDatabase();
        
        // Check what tables exist after initialization
        const { openDatabaseAsync } = await import('expo-sqlite');
        const db = await openDatabaseAsync('riah.db');
        const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('🔍 Available tables:', tables.map((t: any) => t.name));
        
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    setupApp();
  }, []);

  if (!dbInitialized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
