import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants';
import { babyProfile } from '@/db/database';

const { height: screenHeight } = Dimensions.get('window');

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedGender, setSelectedGender] = useState<'girl' | 'boy' | 'neutral'>('neutral');
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
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setFullYear(today.getFullYear() + 1); // Allow future dates up to 1 year
    
    const minDate = new Date(today);
    minDate.setFullYear(today.getFullYear() - 5); // Allow dates from 5 years ago

    const years = [];
    for (let year = maxDate.getFullYear(); year >= minDate.getFullYear(); year--) {
      years.push(year);
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return { years, months, days };
  }, []);

  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerDay, setPickerDay] = useState(new Date().getDate());

  const handleDateSelect = () => {
    const selected = new Date(pickerYear, pickerMonth, pickerDay);
    setSelectedDate(selected);
    setShowDatePicker(false);
  };

  const handleContinue = async () => {
    if (!selectedDate) return;

    try {
      setIsSubmitting(true);

      // Calculate age in months
      const ageMonths = calculateAgeInMonths(selectedDate);

      // Save to SQLite baby_profile
      await babyProfile.insert(
        ageMonths,
        selectedDate.toISOString().split('T')[0], // YYYY-MM-DD format
        selectedGender
      );

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

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        bounces={false}
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
            <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.progressText}>Step 1 of 1</Text>
          </View>
          
          <View style={styles.headerRight} />
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.heading}>Tell us about your baby 🍼</Text>
          <Text style={styles.subtitle}>
            This helps Riah track the right things for your little one.
          </Text>

          {/* Birthdate Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Baby's birthdate</Text>
            <TouchableOpacity
              style={[styles.dateInput, { backgroundColor: Colors.card }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dateInputText,
                { color: selectedDate ? Colors.text : Colors.lightText }
              ]}>
                {selectedDate 
                  ? selectedDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  : 'Select birthdate'
                }
              </Text>
              <MaterialCommunityIcons name="calendar" size={20} color={Colors.primary} />
            </TouchableOpacity>
            
            {/* Age calculation display */}
            {selectedDate && (
              <Text style={styles.ageDisplay}>
                That's {calculateAgeInMonths(selectedDate)} months old 🎉
              </Text>
            )}
          </View>

          {/* Gender Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Baby's gender</Text>
            <View style={styles.genderButtons}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  selectedGender === 'girl' && styles.genderButtonSelected
                ]}
                onPress={() => setSelectedGender('girl')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.genderButtonText,
                  selectedGender === 'girl' && styles.genderButtonTextSelected
                ]}>
                  Girl 🎀
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  selectedGender === 'boy' && styles.genderButtonSelected
                ]}
                onPress={() => setSelectedGender('boy')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.genderButtonText,
                  selectedGender === 'boy' && styles.genderButtonTextSelected
                ]}>
                  Boy 🍀
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.optionalText}>Optional - defaults to neutral</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom button */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { 
              backgroundColor: isContinueDisabled ? Colors.lightText : Colors.primary,
              opacity: isContinueDisabled ? 0.5 : 1
            }
          ]}
          onPress={handleContinue}
          disabled={isContinueDisabled}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Setting up...' : 'Continue →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Birthdate</Text>
              <TouchableOpacity onPress={handleDateSelect}>
                <Text style={styles.confirmButton}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerContainer}>
              {/* Day Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Day</Text>
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {datePickerData.days.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.pickerItem,
                        pickerDay === day && { backgroundColor: Colors.primary }
                      ]}
                      onPress={() => setPickerDay(day)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        pickerDay === day && { color: '#FFFFFF' }
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Month</Text>
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {datePickerData.months.map((month, index) => (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.pickerItem,
                        pickerMonth === index && { backgroundColor: Colors.primary }
                      ]}
                      onPress={() => setPickerMonth(index)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        pickerMonth === index && { color: '#FFFFFF' }
                      ]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Year</Text>
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {datePickerData.years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.pickerItem,
                        pickerYear === year && { backgroundColor: Colors.primary }
                      ]}
                      onPress={() => setPickerYear(year)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        pickerYear === year && { color: '#FFFFFF' }
                      ]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  progressText: {
    fontSize: 12,
    color: Colors.lightText,
    fontWeight: '500',
  },
  headerRight: {
    width: 40,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  dateInputText: {
    fontSize: 16,
    fontWeight: '500',
  },
  ageDisplay: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: Spacing.sm,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  genderButtonTextSelected: {
    color: '#FFFFFF',
  },
  optionalText: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.background,
  },
  continueButton: {
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
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  cancelButton: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.lightText,
  },
  confirmButton: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  pickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  pickerScroll: {
    height: 200,
    width: '100%',
  },
  pickerItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
});
