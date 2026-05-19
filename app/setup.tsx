import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { babyProfile } from '@/db/database';

const PALETTE = {
  background: '#FFF8F4',
  card: '#FFFAF7',
  primary: '#F4A98A',
  mint: '#A8D5BA',
  yellow: '#F9C784',
  text: '#4A3728',
  muted: '#8C7B6E',
  lightText: '#C4B5A8',
  border: '#F0EDE8',
  softPeach: '#FFF0E8',
  successBg: '#EAF3DE',
  success: '#3B6D11',
  boy: '#5BA8D4',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type Gender = 'girl' | 'boy' | 'neutral';

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender>('neutral');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Calculate age in months from birthdate
  const calculateAgeInMonths = (birthdate: Date): number => {
    const now = new Date();
    const years = now.getFullYear() - birthdate.getFullYear();
    const months = now.getMonth() - birthdate.getMonth();
    return years * 12 + months;
  };

  // Generate date picker data
  const datePickerData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 2020; year--) {
      years.push(year);
    }

    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return { years, months: MONTHS, days };
  }, []);

  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerDay, setPickerDay] = useState(new Date().getDate());

  const handleDateSelect = () => {
    const selected = new Date(pickerYear, pickerMonth, pickerDay);
    setSelectedDate(selected);
    setShowDatePicker(false);
  };

  const handleGenderSelect = (gender: Gender) => {
    Haptics.selectionAsync();
    setSelectedGender(gender);
  };

  const handleContinue = async () => {
    if (!selectedDate) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSubmitting(true);

      // Calculate age in months
      const ageMonths = calculateAgeInMonths(selectedDate);

      // Clean and capitalize name
      const cleanName = name.trim().length > 0
        ? name.trim().replace(/^\w/, c => c.toUpperCase())
        : 'Baby';

      // Save to SQLite baby_profile
      await babyProfile.insert(
        cleanName,
        ageMonths,
        selectedDate.toISOString().split('T')[0], // YYYY-MM-DD format
        selectedGender
      );

      // Save name to AsyncStorage for quick access
      await AsyncStorage.setItem('babyName', cleanName);

      // Save onboarded flag to AsyncStorage
      await AsyncStorage.setItem('onboarded', 'true');

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving baby profile:', error);
      setIsSubmitting(false);
    }
  };

  const isContinueDisabled = !selectedDate || isSubmitting;
  const formattedDate = selectedDate?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/landing')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={PALETTE.text} />
          </TouchableOpacity>

          <Text style={styles.stepText}>Step 1 of 1</Text>

          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="happy-outline" size={40} color={PALETTE.primary} />
          </View>
          <Text style={styles.heading}>Tell us about your baby</Text>
          <Text style={styles.subtitle}>
            This helps Riah personalize{'\n'}everything for you.
          </Text>
        </View>

        <View style={styles.formCard}>
          <FieldLabel icon="heart-outline" label="BABY'S NAME" />
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Lucia"
            placeholderTextColor={PALETTE.lightText}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={30}
            returnKeyType="next"
          />
          {name.trim().length > 0 && (
            <Text style={styles.namePreview}>Hi, {name.trim()}!</Text>
          )}

          <View style={styles.divider} />

          <FieldLabel icon="calendar-outline" label="BABY'S BIRTHDATE" />
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.75}
          >
            <View style={styles.dateButtonLeft}>
              <Ionicons name="calendar-outline" size={18} color={PALETTE.primary} />
              <Text
                style={[
                  styles.dateButtonText,
                  { color: selectedDate ? PALETTE.text : PALETTE.lightText },
                ]}
              >
                {formattedDate ?? 'Tap to select birthdate'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={PALETTE.lightText} />
          </TouchableOpacity>

          {!selectedDate && (
            <View style={styles.validationRow}>
              <Ionicons name="alert-circle-outline" size={13} color={PALETTE.primary} />
              <Text style={styles.validationText}>
                {' '}Please select your baby's birthdate to continue
              </Text>
            </View>
          )}

          {selectedDate && (
            <View style={styles.agePill}>
              <Ionicons name="checkmark-circle" size={14} color={PALETTE.success} />
              <Text style={styles.ageText}>
                {' '}{calculateAgeInMonths(selectedDate)} months old
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.genderLabelRow}>
            <Ionicons name="person-outline" size={14} color={PALETTE.primary} />
            <Text style={styles.fieldLabelText}> BABY'S GENDER</Text>
            <Text style={styles.optionalLabel}> · Optional</Text>
          </View>

          <View style={styles.genderButtons}>
            <GenderPill
              gender="girl"
              icon="heart"
              label="Girl"
              isSelected={selectedGender === 'girl'}
              onPress={() => handleGenderSelect('girl')}
            />
            <GenderPill
              gender="boy"
              icon="star"
              label="Boy"
              isSelected={selectedGender === 'boy'}
              onPress={() => handleGenderSelect('boy')}
            />
            {/* <GenderPill
              gender="neutral"
              icon="remove-circle-outline"
              label="Skip"
              isSelected={selectedGender === 'neutral'}
              isLast
              onPress={() => handleGenderSelect('neutral')}
            /> */}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            { opacity: isContinueDisabled ? 0.5 : 1 },
          ]}
          onPress={handleContinue}
          disabled={isContinueDisabled}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.continueContent}>
              <Ionicons name="arrow-forward-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.continueText}>Continue</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>You can change these anytime in Settings</Text>
      </ScrollView>

      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.dragHandle} />
            <Text style={styles.modalTitle}>Select Birthdate</Text>

            <View style={styles.pickerContainer}>
              <PickerColumn
                label="Day"
                items={datePickerData.days}
                selectedItem={pickerDay}
                onSelect={setPickerDay}
              />
              <PickerColumn
                label="Month"
                items={datePickerData.months}
                selectedItem={MONTHS[pickerMonth]}
                onSelect={(month) => setPickerMonth(MONTHS.indexOf(month as string))}
              />
              <PickerColumn
                label="Year"
                items={datePickerData.years}
                selectedItem={pickerYear}
                onSelect={setPickerYear}
              />
            </View>

            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={handleDateSelect}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmText}>Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowDatePicker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      <Ionicons name={icon} size={14} color={PALETTE.primary} />
      <Text style={styles.fieldLabelText}> {label}</Text>
    </View>
  );
}

function GenderPill({
  gender,
  icon,
  label,
  isSelected,
  isLast = false,
  onPress,
}: {
  gender: Gender;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isSelected: boolean;
  isLast?: boolean;
  onPress: () => void;
}) {
  const selectedStyle = {
    girl: styles.girlPillSelected,
    boy: styles.boyPillSelected,
    neutral: styles.neutralPillSelected,
  }[gender];

  const selectedColor = {
    girl: PALETTE.primary,
    boy: PALETTE.boy,
    neutral: PALETTE.muted,
  }[gender];

  const unselectedColor = gender === 'neutral' ? PALETTE.lightText : PALETTE.muted;

  return (
    <TouchableOpacity
      style={[
        styles.genderPill,
        isLast && styles.genderPillLast,
        isSelected && selectedStyle,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isSelected ? selectedColor : PALETTE.lightText}
      />
      <Text
        style={[
          styles.genderText,
          { color: isSelected ? selectedColor : unselectedColor },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PickerColumn<T extends string | number>({
  label,
  items,
  selectedItem,
  onSelect,
}: {
  label: string;
  items: T[];
  selectedItem: T;
  onSelect: (item: T) => void;
}) {
  return (
    <View style={styles.pickerColumn}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView
        style={styles.pickerScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {items.map((item) => {
          const isSelected = selectedItem === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
              onPress={() => onSelect(item)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.pickerItemText,
                  isSelected && styles.pickerItemTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: PALETTE.background,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepText: {
    color: PALETTE.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  headerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALETTE.softPeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    color: PALETTE.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: PALETTE.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: PALETTE.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  genderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabelText: {
    color: PALETTE.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  optionalLabel: {
    color: PALETTE.lightText,
    fontSize: 11,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PALETTE.primary,
    borderRadius: 12,
    color: PALETTE.text,
    fontSize: 15,
    padding: 14,
  },
  namePreview: {
    color: PALETTE.primary,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: PALETTE.border,
    marginVertical: 20,
  },
  dateButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PALETTE.primary,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  validationText: {
    color: PALETTE.primary,
    fontSize: 12,
  },
  agePill: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: PALETTE.successBg,
    borderRadius: 999,
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ageText: {
    color: PALETTE.success,
    fontSize: 12,
    fontWeight: '700',
  },
  genderButtons: {
    flexDirection: 'row',
  },
  genderPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    flexDirection: 'row',
    paddingVertical: 14,
    marginRight: 8,
  },
  genderPillLast: {
    marginRight: 0,
  },
  girlPillSelected: {
    backgroundColor: '#FFE8F0',
    borderColor: PALETTE.primary,
    borderWidth: 1.5,
  },
  boyPillSelected: {
    backgroundColor: '#E8F4FF',
    borderColor: PALETTE.boy,
    borderWidth: 1.5,
  },
  neutralPillSelected: {
    backgroundColor: PALETTE.border,
    borderColor: PALETTE.muted,
    borderWidth: 1.5,
  },
  genderText: {
    fontSize: 14,
    marginLeft: 6,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: PALETTE.primary,
    borderRadius: 20,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  continueContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  footerNote: {
    color: PALETTE.lightText,
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: PALETTE.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  dragHandle: {
    alignSelf: 'center',
    backgroundColor: '#E0D8D0',
    borderRadius: 2,
    height: 4,
    marginBottom: 20,
    width: 40,
  },
  modalTitle: {
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    color: PALETTE.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pickerScroll: {
    height: 200,
    width: '100%',
  },
  pickerItem: {
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
    paddingVertical: 10,
  },
  pickerItemSelected: {
    backgroundColor: PALETTE.primary,
  },
  pickerItemText: {
    color: PALETTE.text,
    fontSize: 16,
  },
  pickerItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalConfirmButton: {
    alignItems: 'center',
    backgroundColor: PALETTE.primary,
    borderRadius: 16,
    marginTop: 16,
    padding: 14,
    width: '100%',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelButton: {
    alignItems: 'center',
    backgroundColor: PALETTE.softPeach,
    borderRadius: 16,
    marginTop: 8,
    padding: 14,
    width: '100%',
  },
  modalCancelText: {
    color: PALETTE.muted,
    fontSize: 16,
    fontWeight: '600',
  },
});
