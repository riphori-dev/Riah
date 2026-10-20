import { useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme, useThemedStyles } from '@/constants';

const { height } = Dimensions.get('window');

export default function LandingScreen() {
  const { colors: Colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/setup');
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        bounces={false}
      >
        <View style={{ height: height * 0.08 }} />

        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/duck-logo.png')}
            style={{ width: 140, height: 140 }}
            resizeMode="contain"
          />
        </View>

        <View style={{ height: Spacing.xl }} />

        <View style={styles.content}>
          <Text style={styles.heading}>Hello! 👋</Text>

          <Text style={styles.subheading}>
            I'm <Text style={{ color: Colors.primary, fontWeight: '700' }}>Riah</Text>, your baby
            care assistant
          </Text>

          <View style={styles.descriptionBox}>
            <Text style={styles.description}>
              I'm here to help you track all the precious moments of your baby's day — from feeding
              and sleep to diaper changes and appointments.
            </Text>

            <Text style={[styles.description, { marginTop: Spacing.md }]}>
              Everything is designed to be simple, warm, and easy to use, even at 3am. 💙
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <FeatureItem
              icon="🍼"
              title="Feeding Tracker"
              description="Log breast, bottle, or solid meals"
            />
            <FeatureItem icon="💧" title="Diaper Logs" description="Track wet and dirty changes" />
            <FeatureItem
              icon="😴"
              title="Sleep Monitor"
              description="Record naps and nighttime sleep"
            />
            <FeatureItem
              icon="📦"
              title="Stock Manager"
              description="Never run out of essentials"
            />
            <FeatureItem
              icon="📋"
              title="Appointments"
              description="Keep vaccines and checkups on track"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.getStartedButton, { backgroundColor: Colors.primary }]}
          onPress={handleGetStarted}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Let's get started 🌟</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const createStyles = (Colors: typeof import('@/constants').Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    logoContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
    },
    content: {
      paddingHorizontal: Spacing.lg,
    },
    heading: {
      fontSize: 36,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    subheading: {
      fontSize: 22,
      fontWeight: '600',
      color: Colors.text,
      textAlign: 'center',
      marginBottom: Spacing.xl,
      lineHeight: 32,
    },
    descriptionBox: {
      backgroundColor: Colors.card,
      borderRadius: 16,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: Colors.lightBorder,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
    description: {
      fontSize: 15,
      color: Colors.text,
      lineHeight: 24,
      fontWeight: '500',
    },
    featuresContainer: {
      marginBottom: Spacing.xl,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    featureIcon: {
      fontSize: 28,
      marginRight: Spacing.md,
      marginTop: Spacing.xs,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
      marginBottom: Spacing.xs,
    },
    featureDescription: {
      fontSize: 14,
      color: Colors.lightText,
      lineHeight: 20,
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      backgroundColor: Colors.background,
    },
    getStartedButton: {
      paddingVertical: Spacing.lg,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.onPrimary,
      letterSpacing: 0.5,
    },
  });
