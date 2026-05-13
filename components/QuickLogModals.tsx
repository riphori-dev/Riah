import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants';
import { diaperLogs, feedingLogs, sleepLogs, stockItems } from '@/db/database';

interface QuickLogModalsProps {
  diaperModalVisible: boolean;
  feedingModalVisible: boolean;
  sleepModalVisible: boolean;
  stockModalVisible: boolean;
  onCloseDiaper: () => void;
  onCloseFeeding: () => void;
  onCloseSleep: () => void;
  onCloseStock: () => void;
  onLogComplete: () => void;
}

export default function QuickLogModals({
  diaperModalVisible,
  feedingModalVisible,
  sleepModalVisible,
  stockModalVisible,
  onCloseDiaper,
  onCloseFeeding,
  onCloseSleep,
  onCloseStock,
  onLogComplete,
}: QuickLogModalsProps) {
  const insets = useSafeAreaInsets();

  // Diaper state
  const [diaperType, setDiaperType] = useState<'wet' | 'dirty' | 'both'>('wet');
  const [diaperNotes, setDiaperNotes] = useState('');

  // Feeding state
  const [feedingType, setFeedingType] = useState<'breast' | 'bottle' | 'solids'>('bottle');
  const [feedingAmount, setFeedingAmount] = useState('');
  const [feedingDuration, setFeedingDuration] = useState('');
  const [feedingNotes, setFeedingNotes] = useState('');

  // Sleep state
  const [sleepStartTime, setSleepStartTime] = useState(new Date());
  const [sleepEndTime, setSleepEndTime] = useState(new Date());
  const [sleepNotes, setSleepNotes] = useState('');

  // Stock state
  const [stockItemName, setStockItemName] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockThreshold, setStockThreshold] = useState('');
  const [stockUnit, setStockUnit] = useState('');

  const handleDiaperLog = async () => {
    try {
      await diaperLogs.insert(Date.now(), diaperType, diaperNotes);
      setDiaperType('wet');
      setDiaperNotes('');
      onCloseDiaper();
      onLogComplete();
    } catch (error) {
      console.error('Error logging diaper:', error);
    }
  };

  const handleFeedingLog = async () => {
    try {
      await feedingLogs.insert(
        Date.now(),
        feedingType,
        feedingAmount ? parseFloat(feedingAmount) : null,
        feedingDuration ? parseInt(feedingDuration) : null,
        feedingNotes
      );
      setFeedingType('bottle');
      setFeedingAmount('');
      setFeedingDuration('');
      setFeedingNotes('');
      onCloseFeeding();
      onLogComplete();
    } catch (error) {
      console.error('Error logging feeding:', error);
    }
  };

  const handleSleepLog = async () => {
    try {
      const duration = Math.round((sleepEndTime.getTime() - sleepStartTime.getTime()) / 60000);
      await sleepLogs.insert(
        sleepStartTime.getTime(),
        sleepEndTime.getTime(),
        duration,
        duration > 120 ? 'night' : 'nap',
        sleepNotes
      );
      setSleepStartTime(new Date());
      setSleepEndTime(new Date());
      setSleepNotes('');
      onCloseSleep();
      onLogComplete();
    } catch (error) {
      console.error('Error logging sleep:', error);
    }
  };

  const handleStockLog = async () => {
    try {
      await stockItems.insert(
        stockItemName,
        'general',
        parseInt(stockQuantity),
        parseInt(stockThreshold),
        stockUnit
      );
      setStockItemName('');
      setStockQuantity('');
      setStockThreshold('');
      setStockUnit('');
      onCloseStock();
      onLogComplete();
    } catch (error) {
      console.error('Error logging stock:', error);
    }
  };

  const renderDiaperModal = () => (
    <Modal visible={diaperModalVisible} transparent animationType="slide" onRequestClose={onCloseDiaper}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onCloseDiaper}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>💧 Diaper Change</Text>
            <TouchableOpacity onPress={handleDiaperLog}>
              <Text style={styles.confirmButton}>Log</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeButtons}>
                {(['wet', 'dirty', 'both'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      diaperType === type && { backgroundColor: '#EBF7FF' }
                    ]}
                    onPress={() => setDiaperType(type)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      diaperType === type && { color: '#185FA5' }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="Any notes..."
                placeholderTextColor={Colors.lightText}
                value={diaperNotes}
                onChangeText={setDiaperNotes}
                multiline
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderFeedingModal = () => (
    <Modal visible={feedingModalVisible} transparent animationType="slide" onRequestClose={onCloseFeeding}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onCloseFeeding}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>🍼 Feeding</Text>
            <TouchableOpacity onPress={handleFeedingLog}>
              <Text style={styles.confirmButton}>Log</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeButtons}>
                {(['breast', 'bottle', 'solids'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      feedingType === type && { backgroundColor: '#FFF0E8' }
                    ]}
                    onPress={() => setFeedingType(type)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      feedingType === type && { color: '#854F0B' }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.inputLabel}>Amount (ml) - optional</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="e.g., 120"
                placeholderTextColor={Colors.lightText}
                value={feedingAmount}
                onChangeText={setFeedingAmount}
                keyboardType="numeric"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Duration (minutes) - optional</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="e.g., 15"
                placeholderTextColor={Colors.lightText}
                value={feedingDuration}
                onChangeText={setFeedingDuration}
                keyboardType="numeric"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="Any notes..."
                placeholderTextColor={Colors.lightText}
                value={feedingNotes}
                onChangeText={setFeedingNotes}
                multiline
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderSleepModal = () => (
    <Modal visible={sleepModalVisible} transparent animationType="slide" onRequestClose={onCloseSleep}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onCloseSleep}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>😴 Sleep</Text>
            <TouchableOpacity onPress={handleSleepLog}>
              <Text style={styles.confirmButton}>Log</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.inputLabel}>Start Time</Text>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: Colors.card }]}
                onPress={() => setSleepStartTime(new Date())}
              >
                <Text style={styles.timeButtonText}>
                  {sleepStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={styles.inputLabel}>End Time</Text>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: Colors.card }]}
                onPress={() => setSleepEndTime(new Date())}
              >
                <Text style={styles.timeButtonText}>
                  {sleepEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="Any notes..."
                placeholderTextColor={Colors.lightText}
                value={sleepNotes}
                onChangeText={setSleepNotes}
                multiline
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderStockModal = () => (
    <Modal visible={stockModalVisible} transparent animationType="slide" onRequestClose={onCloseStock}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onCloseStock}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>📦 Stock Item</Text>
            <TouchableOpacity onPress={handleStockLog}>
              <Text style={styles.confirmButton}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: Spacing.lg }}>
            <View>
              <Text style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="e.g., Diapers"
                placeholderTextColor={Colors.lightText}
                value={stockItemName}
                onChangeText={setStockItemName}
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="e.g., 50"
                placeholderTextColor={Colors.lightText}
                value={stockQuantity}
                onChangeText={setStockQuantity}
                keyboardType="numeric"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Low Stock Threshold</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="e.g., 10"
                placeholderTextColor={Colors.lightText}
                value={stockThreshold}
                onChangeText={setStockThreshold}
                keyboardType="numeric"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors.card }]}
                placeholder="e.g., pieces, ml, oz"
                placeholderTextColor={Colors.lightText}
                value={stockUnit}
                onChangeText={setStockUnit}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {renderDiaperModal()}
      {renderFeedingModal()}
      {renderSleepModal()}
      {renderStockModal()}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
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
  modalBody: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  timeButton: {
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
});
