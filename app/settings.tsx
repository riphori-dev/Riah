import ScreenFeedback from '@/components/ScreenFeedback';
import { useAction } from '@/hooks/useAction';
import NotificationService from '@/services/notifications';
import { parseBirthdate } from '@/utils/care';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  DevSettings,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme, useThemedStyles } from '@/constants';
import { babyProfile, resetTestRecords } from '@/db/database';

export default function SettingsScreen() {
  const { colors: Colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reminderAction = useAction();
  const resetAction = useAction();
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const { colors, isDarkMode, setDarkMode } = useTheme();
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [gender, setGender] = useState<'girl' | 'boy' | 'neutral'>('neutral');
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const saveLock = React.useRef(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await babyProfile.get();
      if (profile) {
        setName(profile.name || 'Baby');
        setBirthdate(profile.birthdate || '');
        setGender(profile.gender || 'neutral');
      }
    } catch (error) {
      setProfileError('Unable to load your profile. Reopen Settings to try again.');
    }
  };

  const handleSave = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    setProfileError(null);
    setProfileSaved(false);
    try {
      setIsSaving(true);

      // Clean and capitalize name
      const cleanName =
        name.trim().length > 0 ? name.trim().replace(/^\w/, (c) => c.toUpperCase()) : 'Baby';

      // Update SQLite baby_profile
      const profile = await babyProfile.get();
      if (!profile)
        throw new Error('Your profile could not be found. Reopen the app to try again.');
      await babyProfile.update(profile.id, cleanName, gender);

      // The profile write is authoritative; a cache failure must not report a failed save.
      await AsyncStorage.setItem('babyName', cleanName).catch(() => {});

      setProfileSaved(true);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Unable to save your profile. Please try again.',
      );
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
      >
        <View style={{ height: Spacing.xl }} />

        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          </View>

          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          {__DEV__ && (
            <View
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 12,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
                Testing: start fresh
              </Text>
              <Text style={{ color: colors.lightText }}>
                Erase this device’s Riah profile, care logs, supplies, appointments and timers, then
                restart onboarding. This cannot be undone.
              </Text>
              <ScreenFeedback error={resetAction.error} />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={resetAction.pending || isSaving}
                style={{ minHeight: 48, justifyContent: 'center' }}
                onPress={() => {
                  const reset = () => {
                    void resetAction.run(async () => {
                      await NotificationService.stopForReset();
                      await resetTestRecords();
                      await AsyncStorage.multiRemove([
                        'babyName',
                        'onboarded',
                        'appOpenTime',
                        'isSleeping',
                        'sleepStartTime',
                        'sleepType',
                        'breastSessionV1',
                        'lastStockNotif',
                        'riah-diaper',
                        'riah-feeding',
                      ]);
                      if (Platform.OS !== 'web') {
                        DevSettings.reload();
                      } else {
                        window.location.reload();
                      }
                    });
                  };
                  if (Platform.OS === 'web') {
                    if (window.confirm('Permanently erase all Riah test records on this device?'))
                      reset();
                  } else
                    Alert.alert(
                      'Erase Riah test data?',
                      'Your profile and all care records on this device will be permanently deleted.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Erase and restart', style: 'destructive', onPress: reset },
                      ],
                    );
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {resetAction.pending ? 'Resetting…' : 'Erase test data and restart'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.themeCard, { backgroundColor: colors.card }]}>
            <View style={styles.themeInfo}>
              <View
                style={[
                  styles.themeIcon,
                  { backgroundColor: isDarkMode ? '#332822' : Colors.softPrimary },
                ]}
              >
                <Ionicons
                  name={isDarkMode ? 'moon' : 'sunny-outline'}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.themeTextBlock}>
                <Text style={[styles.themeTitle, { color: colors.text }]}>Night mode</Text>
                <Text style={[styles.themeSubtitle, { color: colors.lightText }]}>
                  Softer colors for late-night check-ins
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              accessibilityLabel="Night mode"
              onValueChange={(enabled) => {
                void reminderAction.run(() => setDarkMode(enabled));
              }}
              trackColor={{ false: '#E8E0D8', true: Colors.text }}
              thumbColor={isDarkMode ? colors.primary : '#FFFFFF'}
              ios_backgroundColor="#E8E0D8"
            />
          </View>
          <ScreenFeedback error={reminderAction.error} />
          <View
            style={[
              styles.themeCard,
              {
                backgroundColor: colors.card,
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 12,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              Care reminders
            </Text>
            <Text style={{ color: colors.lightText }}>
              Get local reminders for care logs, appointments and low supplies. You can manage
              permission in your device settings.
            </Text>
            {reminderStatus && (
              <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
                {reminderStatus}
              </Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={reminderAction.pending}
              style={{ minHeight: 48, justifyContent: 'center' }}
              onPress={() =>
                reminderAction.run(async () => {
                  if (Platform.OS === 'web') {
                    setReminderStatus('Reminders are available in the mobile app.');
                    return;
                  }
                  const granted = await NotificationService.enable();
                  setReminderStatus(
                    granted
                      ? 'Reminders are enabled on this device.'
                      : 'Permission was not granted. You can enable notifications in device settings.',
                  );
                })
              }
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {reminderAction.pending ? 'Updating…' : 'Enable reminders'}
              </Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  void Linking.openSettings();
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text }}>Open device settings</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.themeCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/about')}
            activeOpacity={0.8}
          >
            <View style={styles.themeInfo}>
              <View
                style={[
                  styles.themeIcon,
                  { backgroundColor: isDarkMode ? '#332822' : Colors.softPrimary },
                ]}
              >
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.themeTextBlock}>
                <Text style={[styles.themeTitle, { color: colors.text }]}>About Riah</Text>
                <Text style={[styles.themeSubtitle, { color: colors.lightText }]}>
                  Learn more about the app, purpose, and roadmap.
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.lightText} />
          </TouchableOpacity>
          <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Baby's Profile</Text>

            <View style={styles.inputSection}>
              <Text style={[styles.nameInputLabel, { color: colors.lightText }]}>BABY'S NAME</Text>
              <View
                style={[
                  styles.nameInputContainer,
                  { backgroundColor: colors.background, borderColor: colors.primary },
                ]}
              >
                <Ionicons
                  name="heart-outline"
                  size={18}
                  color={colors.primary}
                  style={styles.nameInputIcon}
                />
                <TextInput
                  accessibilityLabel="Baby name"
                  style={[styles.nameInput, { color: colors.text }]}
                  placeholder="e.g. Lucia"
                  placeholderTextColor={colors.lightText}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  maxLength={30}
                />
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Birthdate</Text>
              <View
                style={[
                  styles.readOnlyField,
                  { backgroundColor: colors.background, borderColor: colors.lightBorder },
                ]}
              >
                <Text style={[styles.readOnlyText, { color: colors.lightText }]}>
                  {birthdate
                    ? parseBirthdate(birthdate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Gender</Text>
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.genderButton,
                    { backgroundColor: colors.background, borderColor: colors.lightBorder },
                    gender === 'girl' && styles.genderButtonSelected,
                  ]}
                  accessibilityState={{ selected: gender === 'girl' }}
                  onPress={() => {
                    setGender('girl');
                    setProfileSaved(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      { color: colors.text },
                      gender === 'girl' && styles.genderButtonTextSelected,
                    ]}
                  >
                    Girl 🎀
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.genderButton,
                    { backgroundColor: colors.background, borderColor: colors.lightBorder },
                    gender === 'boy' && styles.genderButtonSelected,
                  ]}
                  accessibilityState={{ selected: gender === 'boy' }}
                  onPress={() => {
                    setGender('boy');
                    setProfileSaved(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      { color: colors.text },
                      gender === 'boy' && styles.genderButtonTextSelected,
                    ]}
                  >
                    Boy 🍀
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScreenFeedback error={profileError} />
            {profileSaved && (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.text, marginVertical: 12 }}
              >
                Profile saved.
              </Text>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.saveButton, { opacity: isSaving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>
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
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.softPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderColor: Colors.primary,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.text,
    },
    headerRight: {
      width: 40,
    },
    content: {
      paddingHorizontal: Spacing.lg,
    },
    themeCard: {
      borderRadius: 20,
      padding: 16,
      marginBottom: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    themeInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    themeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    themeTextBlock: {
      flex: 1,
    },
    themeTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    themeSubtitle: {
      fontSize: 12,
      marginTop: 3,
      lineHeight: 16,
    },
    profileCard: {
      backgroundColor: Colors.card,
      borderRadius: 20,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: Spacing.lg,
    },
    inputSection: {
      marginBottom: Spacing.lg,
    },
    nameInputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.lightText,
      marginBottom: Spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    nameInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 0.5,
      borderColor: '#F4A98A',
      borderRadius: 12,
      padding: 12,
    },
    nameInputIcon: {
      marginRight: 8,
    },
    nameInput: {
      flex: 1,
      fontSize: 16,
      color: Colors.text,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
      marginBottom: Spacing.md,
    },
    readOnlyField: {
      backgroundColor: '#FFFFFF',
      borderWidth: 0.5,
      borderColor: '#E8E0D8',
      borderRadius: 12,
      padding: 12,
    },
    readOnlyText: {
      fontSize: 16,
      color: Colors.lightText,
    },
    genderButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    genderButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E8E0D8',
      alignItems: 'center',
    },
    genderButtonSelected: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    genderButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: Colors.onPrimary,
    },
    genderButtonTextSelected: {
      color: Colors.onPrimary,
    },
    saveButton: {
      backgroundColor: '#F4A98A',
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.lg,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.onPrimary,
    },
  });
