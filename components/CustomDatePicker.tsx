import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants';

interface CustomDatePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function CustomDatePicker({
  visible,
  onClose,
  onConfirm,
  initialDate = new Date()
}: CustomDatePickerProps) {
  const insets = useSafeAreaInsets();
  
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedHour, setSelectedHour] = useState(initialDate.getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(
    Math.floor(initialDate.getMinutes() / 15) * 15
  );
  const [selectedAmPm, setSelectedAmPm] = useState(initialDate.getHours() < 12 ? 'AM' : 'PM');

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => currentYear + i),
    [currentYear]
  );

  const days = useMemo(() => 
    Array.from({ length: 31 }, (_, i) => i + 1),
    []
  );

  const minutes = ['00', '15', '30', '45'];

  const handleConfirm = () => {
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    
    // Convert 12-hour to 24-hour format
    let hour24 = selectedHour;
    if (selectedAmPm === 'PM' && selectedHour !== 12) {
      hour24 += 12;
    } else if (selectedAmPm === 'AM' && selectedHour === 12) {
      hour24 = 0;
    }
    
    date.setHours(hour24, parseInt(String(selectedMinute)));
    onConfirm(date);
    onClose();
  };

  const renderPicker = (
    items: (string | number)[],
    selectedItem: string | number,
    onSelect: (item: any) => void,
    width: number = 80
  ) => (
    <View style={[styles.pickerContainer, { width }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.pickerScroll}
      >
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.pickerItem,
              selectedItem === item && styles.selectedItem
            ]}
            onPress={() => onSelect(item)}
          >
            <Text
              style={[
                styles.pickerItemText,
                selectedItem === item && styles.selectedItemText
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          {
            backgroundColor: Colors.background,
            paddingBottom: insets.bottom + Spacing.xl
          }
        ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Date & Time</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmButton}>Confirm</Text>
            </TouchableOpacity>
          </View>

          {/* Date Pickers */}
          <View style={styles.pickersRow}>
            {renderPicker(days, selectedDay, setSelectedDay, 60)}
            {renderPicker(MONTHS, MONTHS[selectedMonth], (month) => 
              setSelectedMonth(MONTHS.indexOf(month))
            )}
            {renderPicker(years.map(String), selectedYear, (year) => 
              setSelectedYear(parseInt(year))
            )}
          </View>

          {/* Time Pickers */}
          <View style={styles.pickersRow}>
            {renderPicker(
              Array.from({ length: 12 }, (_, i) => i + 1).map(String),
              selectedHour,
              setSelectedHour,
              60
            )}
            {renderPicker(minutes, selectedMinute, setSelectedMinute, 60)}
            {renderPicker(['AM', 'PM'], selectedAmPm, setSelectedAmPm, 60)}
          </View>

          {/* Selected Date Preview */}
          <View style={styles.previewContainer}>
            <Text style={styles.previewText}>
              {MONTHS[selectedMonth]} {selectedDay}, {selectedYear} at{' '}
              {selectedHour}:{selectedMinute} {selectedAmPm}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    marginBottom: Spacing.xl,
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
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  pickerContainer: {
    height: 180,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginHorizontal: Spacing.xs,
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
  },
  selectedItem: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A3728',
  },
  selectedItemText: {
    color: '#FFF',
    fontWeight: '700',
  },
  previewContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
