import { useTheme } from '@/constants';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export default function ScreenFeedback({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  if (!loading && !error) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ margin: 16, padding: 16, borderRadius: 16, backgroundColor: colors.card, gap: 12 }}
    >
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading your records" color={colors.text} />
      ) : (
        <>
          <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 16 }}>
            {error}
          </Text>
          {onRetry && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onRetry}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}
