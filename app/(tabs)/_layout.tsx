import { subscribeToDataChanges } from '@/services/dataEvents';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/constants';
import { stockItems } from '@/db/database';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [hasLowStock, setHasLowStock] = useState(false);

  const checkLowStock = async () => {
    try {
      const items = await stockItems.getAll();
      const lowStock = items.some((item) => item.quantity <= item.low_stock_threshold);
      setHasLowStock(lowStock);
    } catch (error) {
      console.error('Error checking low stock:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      checkLowStock();
      return subscribeToDataChanges(() => {
        void checkLowStock();
      });
    }, []),
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary, // #F4A98A
        tabBarInactiveTintColor: colors.lightText, // muted warm gray
        tabBarStyle: {
          backgroundColor: colors.background, // #FFF8F4
          borderTopColor: colors.lightBorder,
          borderTopWidth: 1,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
          height: 76 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 0,
          lineHeight: 16,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="diaper"
        options={{
          title: 'Diaper',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'water' : 'water-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="feeding"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'restaurant' : 'restaurant-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="sleep"
        options={{
          title: 'Sleep',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'moon' : 'moon-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
          ),
          tabBarBadge: hasLowStock ? '!' : undefined,
        }}
      />

      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
