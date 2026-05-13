import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants';
import { stockItems } from '@/db/database';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [hasLowStock, setHasLowStock] = useState(false);

  const checkLowStock = async () => {
    try {
      const items = await stockItems.getAll();
      const lowStock = items.some(
        (item) => item.quantity < item.low_stock_threshold
      );
      setHasLowStock(lowStock);
    } catch (error) {
      console.error('Error checking low stock:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      checkLowStock();
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary, // #F4A98A
        tabBarInactiveTintColor: '#C4B5A8', // muted warm gray
        tabBarStyle: {
          backgroundColor: Colors.background, // #FFF8F4
          borderTopColor: '#F0E6DF',
          borderTopWidth: 1,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="diaper"
        options={{
          title: 'Diaper',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'water' : 'water-outline'}
              size={24}
              color={color}
            />
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
            <Ionicons
              name={focused ? 'moon' : 'moon-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'cube' : 'cube-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarBadge: hasLowStock ? '!' : null,
        }}
      />

      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}