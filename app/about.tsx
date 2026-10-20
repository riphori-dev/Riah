import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme, useThemedStyles } from '@/constants';
import appConfig from '@/app.json';

const APP_VERSION = appConfig.expo.version;

export default function AboutScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingHorizontal: Spacing.lg }]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.backButton,
              { backgroundColor: colors.card, borderColor: colors.primary },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>About</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Developer</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              Riphoria Solutions is the creator of this application. It is a small independent
              development studio focused on building practical, real-world software that helps solve
              everyday problems using modern mobile and web technologies.{'\n\n'}
              The app is personally designed and developed by a parent and software engineer who
              specializes in building full-stack applications.{'\n\n'}
              It is built with a strong focus on simplicity, usability, and real-life needs of
              parents managing daily baby care routines. The studio currently operates as a small
              independent development effort, with the goal of growing into a broader
              product-focused team in the future.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Why this app was built
            </Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              This application was created out of personal experience as a new parent.{'\n\n'}
              Managing a baby’s daily needs—such as feeding, diaper changes, sleep schedules, and
              essential supplies—can quickly become overwhelming, especially during the early stages
              of parenthood. Important details are often forgotten or tracked inconsistently.
              {'\n\n'}
              This app was designed to solve that problem by providing a simple, centralized tool
              that helps parents:{'\n'}• Track daily baby activities in one place{'\n'}• Stay
              organized with feeding, sleep, and diaper logs{'\n'}• Manage essential baby supplies
              through inventory tracking{'\n'}• Reduce mental load and improve daily routine
              awareness{'\n\n'}
              The goal is to support parents by making baby tracking effortless, calm, and reliable
              during a time that is often stressful and fast-paced.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Current features</Text>
            {[
              'Diaper tracking',
              'Feeding logs',
              'Sleep tracking',
              'Stock/inventory tracking',
              'Dashboard overview',
              'Quick logging shortcuts',
              'Notifications/reminders',
            ].map((item) => (
              <View key={item} style={styles.listItem}>
                <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ideas for later</Text>
            {[
              'Partner sharing / sync',
              'Growth tracker (weight & height)',
              'Weekly summary report',
              'Home screen widgets',
              'Cloud backup & sync',
            ].map((item) => (
              <View key={item} style={styles.listItem}>
                <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Version</Text>
            <View style={styles.versionRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.versionLabel, { color: colors.text }]}>
                Version: {APP_VERSION}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
    },
    headerRight: {
      width: 44,
    },
    content: {
      paddingHorizontal: Spacing.lg,
    },
    card: {
      borderRadius: 24,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    paragraph: {
      fontSize: 15,
      lineHeight: 22,
      color: Colors.text,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: Spacing.sm,
    },
    bullet: {
      fontSize: 18,
      marginRight: 12,
      lineHeight: 22,
    },
    listText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
    },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    versionLabel: {
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 10,
    },
  });
