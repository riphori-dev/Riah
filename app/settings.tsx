import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, useTheme } from '@/constants';
import { babyProfile } from '@/db/database';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDarkMode, setDarkMode } = useTheme();
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [gender, setGender] = useState<'girl' | 'boy' | 'neutral'>('neutral');
  const [isSaving, setIsSaving] = useState(false);

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
      console.error('Error loading profile:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Clean and capitalize name
      const cleanName = name.trim().length > 0
        ? name.trim().replace(/^\w/, c => c.toUpperCase())
        : 'Baby';

      // Update SQLite baby_profile
      const profile = await babyProfile.get();
      if (profile) {
        const database = await (await import('expo-sqlite')).openDatabaseAsync('riah.db');
        await database.runAsync(
          `UPDATE baby_profile SET name = ? WHERE id = ?`,
          [cleanName, profile.id]
        );
      }

      // Update AsyncStorage
      await AsyncStorage.setItem('babyName', cleanName);

      // Show success toast
      Alert.alert('Success', 'Profile updated!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
      >
        {/* Top spacing */}
        <View style={{ height: Spacing.xl }} />

        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
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

        {/* Main content */}
        <View style={styles.content}>
          {/* Baby's Profile Section */}
          <View style={[styles.themeCard, { backgroundColor: colors.card }]}>
            <View style={styles.themeInfo}>
              <View style={[styles.themeIcon, { backgroundColor: isDarkMode ? '#332822' : '#FFF0E8' }]}>
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
              onValueChange={setDarkMode}
              trackColor={{ false: '#E8E0D8', true: '#4A3728' }}
              thumbColor={isDarkMode ? colors.primary : '#FFFFFF'}
              ios_backgroundColor="#E8E0D8"
            />
          </View>
          <TouchableOpacity
            style={[styles.themeCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/about')}
            activeOpacity={0.8}
          >
            <View style={styles.themeInfo}>
              <View style={[styles.themeIcon, { backgroundColor: isDarkMode ? '#332822' : '#FFF0E8' }]}>                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.primary}
                />              </View>
              <View style={styles.themeTextBlock}>
                <Text style={[styles.themeTitle, { color: colors.text }]}>About Riah</Text>
                <Text style={[styles.themeSubtitle, { color: colors.lightText }]}>                  Learn more about the app, purpose, and roadmap.                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.lightText} />
          </TouchableOpacity>
          <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Baby's Profile</Text>

            {/* Name Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.nameInputLabel, { color: colors.lightText }]}>BABY'S NAME</Text>
              <View style={[styles.nameInputContainer, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                <Ionicons name="heart-outline" size={18} color={colors.primary} style={styles.nameInputIcon} />
                <TextInput
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

            {/* Birthdate Display (Read-only) */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Birthdate</Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.background, borderColor: colors.lightBorder }]}>
                <Text style={[styles.readOnlyText, { color: colors.lightText }]}>
                  {birthdate ? new Date(birthdate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Not set'}
                </Text>
              </View>
            </View>

            {/* Gender Toggle */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Gender</Text>
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    { backgroundColor: colors.background, borderColor: colors.lightBorder },
                    gender === 'girl' && styles.genderButtonSelected
                  ]}
                  onPress={() => setGender('girl')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.genderButtonText,
                    { color: colors.text },
                    gender === 'girl' && styles.genderButtonTextSelected
                  ]}>
                    Girl 🎀
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    { backgroundColor: colors.background, borderColor: colors.lightBorder },
                    gender === 'boy' && styles.genderButtonSelected
                  ]}
                  onPress={() => setGender('boy')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.genderButtonText,
                    { color: colors.text },
                    gender === 'boy' && styles.genderButtonTextSelected
                  ]}>
                    Boy 🍀
                  </Text>
                </TouchableOpacity>

                {/* <TouchableOpacity
                  style={[
                    styles.genderButton,
                    gender === 'neutral' && styles.genderButtonSelected
                  ]}
                  onPress={() => setGender('neutral')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.genderButtonText,
                    gender === 'neutral' && styles.genderButtonTextSelected
                  ]}>
                    Neutral
                  </Text>
                </TouchableOpacity> */}
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, { opacity: isSaving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#FFF0E8',
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
    color: '#4A3728',
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
    backgroundColor: '#FFFAF7',
    borderRadius: 20,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: Spacing.lg,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  nameInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C7B6E',
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
    color: '#4A3728',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A3728',
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
    color: '#8C7B6E',
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
    color: '#4A3728',
  },
  genderButtonTextSelected: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
});
