import ScreenFeedback from '@/components/ScreenFeedback';
import { useAction } from '@/hooks/useAction';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, useTheme, useThemedStyles } from '@/constants';
import { StockItem, stockItems } from '@/db/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORIES = ['Diapers', 'Wipes', 'Formula', 'Medicine', 'Other'];

interface StockItemWithCategory extends StockItem {
  isLowStock: boolean;
}

const getCategoryInfo = (category: string) => {
  const categoryMap: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    Diapers: { icon: 'cube-outline', color: '#F4A98A' },
    Wipes: { icon: 'water-outline', color: '#A8D5BA' },
    Formula: { icon: 'cafe-outline', color: '#F9C784' },
    Medicine: { icon: 'medical-outline', color: '#F4A98A' },
    Other: { icon: 'ellipsis-horizontal-outline', color: Colors.lightText },
  };
  return categoryMap[category] || categoryMap['Other'];
};

const getStockPercentage = (quantity: number, threshold: number): number => {
  if (threshold === 0) return 100;
  return Math.min((quantity / threshold) * 100, 100);
};

const getProgressColor = (quantity: number, threshold: number): string => {
  const percentage = (quantity / threshold) * 100;
  if (quantity <= threshold) return '#F4A98A'; // Below threshold - red
  if (percentage < 120) return '#F9C784'; // Within 20% - yellow
  return '#A8D5BA'; // Above threshold - green
};

export default function StockScreen() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Diapers',
    quantity: 1,
    unit: 'packs',
    low_stock_threshold: 1,
  });
  const [toast, setToast] = useState({ visible: false, text: '' });
  const toastAnim = useRef(new Animated.Value(100)).current;
  const { colors: Colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mutation = useAction();
  const deletion = useConfirmDelete();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const refreshGeneration = useRef(0);

  const loadData = useCallback(async (quiet = false) => {
    const generation = ++refreshGeneration.current;
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const stockData = await stockItems.getAll();
      if (generation === refreshGeneration.current) setItems(stockData);
    } catch (error) {
      if (generation === refreshGeneration.current)
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load your records. Please try again.',
        );
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const showToast = useCallback(
    (message: string) => {
      setToast({ visible: true, text: message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setToast({ visible: false, text: '' });
        });
      }, 2000);
    },
    [toastAnim],
  );

  const handleAddItem = useCallback(async () => {
    if (!formData.name.trim()) throw new Error('Enter an item name.');

    try {
      await stockItems.insert(
        formData.name.trim(),
        formData.category,
        formData.quantity,
        formData.low_stock_threshold,
        formData.unit,
      );

      setShowAddModal(false);
      setFormData({
        name: '',
        category: 'Diapers',
        quantity: 1,
        unit: 'packs',
        low_stock_threshold: 1,
      });

      showToast('Item added successfully');
      loadData();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to save changes. Please try again.',
      );
    }
  }, [formData, loadData, showToast]);

  const handleUpdateQuantity = useCallback(
    async (id: number, delta: number) => {
      try {
        await stockItems.adjustQuantity(id, delta);
        await loadData(true);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to update stock. Try again.');
      }
    },
    [loadData],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await stockItems.deleteById(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        loadData();
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : 'Unable to save changes. Please try again.',
        );
      }
    },
    [loadData],
  );

  const renderRightActions = useCallback(
    (id: number) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Delete this record"
        style={styles.deleteAction}
        onPress={() => deletion.ask(() => handleDelete(id))}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
      </TouchableOpacity>
    ),
    [handleDelete, deletion],
  );

  const itemsWithCategory: StockItemWithCategory[] = items.map((item) => ({
    ...item,
    isLowStock: item.quantity <= item.low_stock_threshold,
  }));

  const groupedItems: Record<string, StockItemWithCategory[]> = itemsWithCategory.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, StockItemWithCategory[]>,
  );

  const lowStockItems = itemsWithCategory.filter((item) => item.isLowStock);

  const renderStockItem = useCallback(
    (item: StockItemWithCategory) => {
      const categoryInfo = getCategoryInfo(item.category);
      const percentage = getStockPercentage(item.quantity, item.low_stock_threshold);
      const progressColor = getProgressColor(item.quantity, item.low_stock_threshold);

      return (
        <Swipeable key={item.id} renderRightActions={() => renderRightActions(item.id)}>
          <View style={[styles.itemCard, { backgroundColor: Colors.card }]}>
            <View style={[styles.categoryIcon, { backgroundColor: `${categoryInfo.color}20` }]}>
              <Ionicons name={categoryInfo.icon} size={22} color={categoryInfo.color} />
            </View>

            <View style={styles.itemMiddle}>
              <Text style={styles.itemName}>{item.name}</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${percentage}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>
              </View>

              <Text style={styles.thresholdText}>
                {item.quantity} {item.unit} left · threshold: {item.low_stock_threshold}
              </Text>
            </View>

            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${item.name} by 1 ${item.unit}`}
                disabled={item.quantity <= 0}
                onPress={() => handleUpdateQuantity(item.id, -1)}
              >
                <Ionicons name="remove" size={16} color="#F4A98A" />
              </TouchableOpacity>

              <Text style={styles.quantityNumber}>{item.quantity}</Text>

              <TouchableOpacity
                style={[styles.quantityButton, styles.quantityButtonPlus]}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${item.name} by 1 ${item.unit}`}
                onPress={() => handleUpdateQuantity(item.id, 1)}
              >
                <Ionicons name="add" size={16} color={Colors.successText} />
              </TouchableOpacity>
            </View>
          </View>
        </Swipeable>
      );
    },
    [handleUpdateQuantity, renderRightActions, Colors, styles],
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenFeedback
          loading={loading}
          error={loadError || mutation.error}
          onRetry={loadError ? () => loadData() : undefined}
        />

        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.headerTitle}>Stock Tracker</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add stock item"
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {items.length > 0 &&
          (lowStockItems.length > 0 ? (
            <View style={[styles.statusBanner, { backgroundColor: Colors.softPrimary }]}>
              <View style={styles.statusIcon}>
                <Ionicons name="alert-circle" size={24} color={Colors.primary} />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>{lowStockItems.length} items running low</Text>
                <Text style={styles.statusSubtext}>
                  {lowStockItems.map((item) => item.name).join(', ')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusBanner, { backgroundColor: Colors.softGreen }]}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.successText} />
              <Text style={styles.allStockedText}>All stocked</Text>
            </View>
          ))}

        {Object.entries(groupedItems).map(([category, categoryItems]) => {
          if (categoryItems.length === 0) return null;
          const categoryInfo = getCategoryInfo(category);

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryHeaderLeft}>
                  <Ionicons name={categoryInfo.icon} size={16} color={categoryInfo.color} />
                  <Text style={styles.categoryTitle}>{category}</Text>
                </View>
                <View style={styles.itemCountPill}>
                  <Text style={styles.itemCountText}>{categoryItems.length}</Text>
                </View>
              </View>

              <View style={styles.categoryItems}>
                {categoryItems.map((item) => renderStockItem(item))}
              </View>
            </View>
          );
        })}

        {!loading && !loadError && items.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="cube-outline"
              size={64}
              color={Colors.primary}
              style={{ opacity: 0.4 }}
            />
            <Text style={styles.emptyStateText}>Keep essentials within reach</Text>
            <Text style={{ color: Colors.lightText, textAlign: 'center', marginTop: 8 }}>
              Add diapers, milk or supplies to see when it is time to restock.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setShowAddModal(true)}
              style={{ minHeight: 48, justifyContent: 'center', marginTop: 16 }}
            >
              <Text style={{ color: Colors.text, fontWeight: '700' }}>Add your first item</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.bottomSheetContent, { backgroundColor: Colors.background }]}>
            <View style={styles.dragHandle} />

            <Text style={styles.modalTitle}>Add Stock Item</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={styles.formContainer}>
              <ScreenFeedback error={loadError || mutation.error} />

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Item name</Text>
                <TextInput
                  accessibilityLabel="Item name"
                  style={[styles.formInput, { borderColor: Colors.primary }]}
                  placeholder="e.g. Newborn Diapers"
                  placeholderTextColor={Colors.lightText}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {CATEGORIES.map((category) => {
                    const categoryInfo = getCategoryInfo(category);
                    return (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={category}
                        style={[
                          styles.categoryPill,
                          formData.category === category && styles.categoryPillActive,
                        ]}
                        onPress={() => setFormData({ ...formData, category })}
                      >
                        <Ionicons
                          name={categoryInfo.icon}
                          size={14}
                          color={formData.category === category ? 'white' : Colors.lightText}
                        />
                        <Text
                          style={[
                            styles.categoryPillText,
                            { color: formData.category === category ? 'white' : Colors.lightText },
                          ]}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.quantityButton}
                    accessibilityLabel="Decrease starting quantity"
                    onPress={() =>
                      setFormData({ ...formData, quantity: Math.max(0, formData.quantity - 1) })
                    }
                  >
                    <Ionicons name="remove" size={16} color="#F4A98A" />
                  </TouchableOpacity>
                  <Text style={styles.quantityNumber}>{formData.quantity}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.quantityButton, styles.quantityButtonPlus]}
                    accessibilityLabel="Increase starting quantity"
                    onPress={() => setFormData({ ...formData, quantity: formData.quantity + 1 })}
                  >
                    <Ionicons name="add" size={16} color={Colors.successText} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Unit</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {['packs', 'cans', 'pieces', 'bottles'].map((unit) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={unit}
                      style={[
                        styles.categoryPill,
                        formData.unit === unit && styles.categoryPillActive,
                      ]}
                      onPress={() => setFormData({ ...formData, unit })}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: formData.unit === unit ? 'white' : Colors.lightText },
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Low stock alert threshold</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.quantityButton}
                    accessibilityLabel="Decrease low stock threshold"
                    onPress={() =>
                      setFormData({
                        ...formData,
                        low_stock_threshold: Math.max(1, formData.low_stock_threshold - 1),
                      })
                    }
                  >
                    <Ionicons name="remove" size={16} color="#F4A98A" />
                  </TouchableOpacity>
                  <Text style={styles.quantityNumber}>{formData.low_stock_threshold}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.quantityButton, styles.quantityButtonPlus]}
                    accessibilityLabel="Increase low stock threshold"
                    onPress={() =>
                      setFormData({
                        ...formData,
                        low_stock_threshold: formData.low_stock_threshold + 1,
                      })
                    }
                  >
                    <Ionicons name="add" size={16} color={Colors.successText} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.thresholdSubtext}>Alert at or below this amount</Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.modalButton, styles.modalAddButton]}
                disabled={mutation.pending}
                accessibilityState={{ busy: mutation.pending }}
                onPress={() => mutation.run(handleAddItem)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.addButtonText}>
                  {mutation.pending ? 'Adding…' : 'Add item'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast.visible && (
        <Animated.View
          style={[
            styles.toast,
            {
              transform: [{ translateY: toastAnim }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="white" />
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      )}
      {deletion.dialog}
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.text,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: Colors.primary,
    },
    statusBanner: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
      borderRadius: 20,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    statusIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFE8D6',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    statusContent: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 2,
    },
    statusSubtext: {
      fontSize: 12,
      color: Colors.lightText,
    },
    allStockedText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.successText,
      marginLeft: Spacing.sm,
    },
    categorySection: {
      marginTop: 16,
      marginBottom: 8,
    },
    categoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingHorizontal: Spacing.lg,
    },
    categoryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    categoryTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
    },
    itemCountPill: {
      backgroundColor: Colors.softPrimary,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    itemCountText: {
      color: Colors.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    categoryItems: {
      paddingHorizontal: Spacing.lg,
    },
    itemCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: Colors.card,
      padding: 14,
      marginBottom: 8,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    categoryIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemMiddle: {
      flex: 1,
      minWidth: 0,
      marginHorizontal: 12,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 6,
    },
    progressContainer: {
      marginTop: 6,
    },
    progressBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.lightBorder,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    thresholdText: {
      fontSize: 11,
      color: Colors.lightText,
      marginTop: 4,
    },
    quantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      width: '100%',
      marginTop: 12,
    },
    quantityButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quantityButtonPlus: {
      backgroundColor: Colors.softGreen,
    },
    quantityNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
      minWidth: 32,
      textAlign: 'center',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
      marginTop: 16,
    },
    deleteAction: {
      backgroundColor: Colors.dangerText,
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      borderRadius: 16,
      marginLeft: Spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'flex-end',
    },
    bottomSheetContent: {
      maxHeight: '90%',
      paddingBottom: 24,
      backgroundColor: Colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      width: '100%',
    },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#E0D8D0',
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 20,
    },
    formContainer: {
      gap: 20,
    },
    formField: {
      gap: 8,
    },
    formLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.lightText,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    formInput: {
      borderRadius: 12,
      borderWidth: 0.5,
      padding: 12,
      fontSize: 14,
      color: Colors.text,
      backgroundColor: 'white',
    },
    categoryScroll: {
      flexDirection: 'row',
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: Colors.softPrimary,
      gap: 6,
      marginRight: 8,
    },
    categoryPillActive: {
      backgroundColor: Colors.primary,
    },
    categoryPillText: {
      fontSize: 13,
      fontWeight: '700',
    },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    thresholdSubtext: {
      fontSize: 11,
      color: Colors.lightText,
      textAlign: 'center',
      marginTop: 4,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    cancelButton: {
      backgroundColor: Colors.softPrimary,
    },
    cancelButtonText: {
      color: Colors.lightText,
      fontSize: 16,
      fontWeight: '600',
    },
    modalAddButton: {
      backgroundColor: Colors.primary,
    },
    addButtonText: {
      color: Colors.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    toast: {
      position: 'absolute',
      bottom: 40,
      left: Spacing.lg,
      right: Spacing.lg,
      backgroundColor: Colors.successText,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: 999,
      gap: Spacing.md,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 5,
    },
    toastText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
  });
