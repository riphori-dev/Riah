import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Animated,
  UIManager,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing } from '@/constants';
import { stockItems, StockItem } from '@/db/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORIES = ['Diapers', 'Wipes', 'Formula', 'Medicine', 'Other'];

const DEFAULT_STOCK_CLEANUP_KEY = 'stockDefaultItemsCleaned';
const DEFAULT_STOCK_CLEANUP_ITEMS = [
  { name: 'Newborn Diapers', category: 'Diapers', quantity: 2, low_stock_threshold: 1, unit: 'packs' },
  { name: 'Wet Wipes', category: 'Wipes', quantity: 3, low_stock_threshold: 1, unit: 'packs' },
  { name: 'Formula', category: 'Formula', quantity: 1, low_stock_threshold: 1, unit: 'cans' },
  { name: 'Baby Tylenol', category: 'Medicine', quantity: 1, low_stock_threshold: 1, unit: 'bottles' },
];

interface StockItemWithCategory extends StockItem {
  isLowStock: boolean;
}

const getCategoryInfo = (category: string) => {
  const categoryMap: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    'Diapers': { icon: 'cube-outline', color: '#F4A98A' },
    'Wipes': { icon: 'water-outline', color: '#A8D5BA' },
    'Formula': { icon: 'cafe-outline', color: '#F9C784' },
    'Medicine': { icon: 'medical-outline', color: '#F4A98A' },
    'Other': { icon: 'ellipsis-horizontal-outline', color: '#8C7B6E' },
  };
  return categoryMap[category] || categoryMap['Other'];
};

const getStockPercentage = (quantity: number, threshold: number): number => {
  if (threshold === 0) return 100;
  return Math.min((quantity / threshold) * 100, 100);
};

const getProgressColor = (quantity: number, threshold: number): string => {
  const percentage = (quantity / threshold) * 100;
  if (quantity < threshold) return '#F4A98A'; // Below threshold - red
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
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async () => {
    try {
      let stockData = await stockItems.getAll();
      const hasCleanedDefaultItems = await AsyncStorage.getItem(DEFAULT_STOCK_CLEANUP_KEY);

      if (!hasCleanedDefaultItems) {
        const defaultItemIds = stockData
          .filter((item) => DEFAULT_STOCK_CLEANUP_ITEMS.some((defaultItem) => (
            item.name === defaultItem.name &&
            item.category === defaultItem.category &&
            item.quantity === defaultItem.quantity &&
            item.low_stock_threshold === defaultItem.low_stock_threshold &&
            item.unit === defaultItem.unit
          )))
          .map((item) => item.id);

        if (defaultItemIds.length > 0) {
          await Promise.all(defaultItemIds.map((id) => stockItems.deleteById(id)));
          stockData = await stockItems.getAll();
        }

        await AsyncStorage.setItem(DEFAULT_STOCK_CLEANUP_KEY, 'true');
      }

      setItems(stockData);
    } catch (error) {
      console.error('Error loading stock items:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const showToast = useCallback((message: string) => {
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
  }, [toastAnim]);

  const handleAddItem = useCallback(async () => {
    if (!formData.name.trim()) return;

    try {
      await stockItems.insert(
        formData.name.trim(),
        formData.category,
        formData.quantity,
        formData.low_stock_threshold,
        formData.unit
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
      console.error('Error adding item:', error);
    }
  }, [formData, loadData, showToast]);

  const handleUpdateQuantity = useCallback(async (id: number, newQuantity: number) => {
    if (newQuantity < 0) return;

    try {
      // Get the current item to update it
      const currentItems = await stockItems.getAll();
      const currentItem = currentItems.find(item => item.id === id);
      if (currentItem) {
        // Delete the old item and insert a new one with updated quantity
        await stockItems.deleteById(id);
        await stockItems.insert(
          currentItem.name,
          currentItem.category,
          newQuantity,
          currentItem.low_stock_threshold,
          currentItem.unit
        );
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      loadData();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  }, [loadData]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await stockItems.deleteById(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, [loadData]);

  const renderRightActions = useCallback((id: number) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleDelete(id)}
    >
      <Ionicons name="trash-outline" size={24} color="white" />
    </TouchableOpacity>
  ), [handleDelete]);

  const itemsWithCategory: StockItemWithCategory[] = items.map(item => ({
    ...item,
    isLowStock: item.quantity < item.low_stock_threshold,
  }));

  const groupedItems: Record<string, StockItemWithCategory[]> = itemsWithCategory.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StockItemWithCategory[]>);

  const lowStockItems = itemsWithCategory.filter(item => item.isLowStock);

  const renderStockItem = useCallback((item: StockItemWithCategory) => {
    const categoryInfo = getCategoryInfo(item.category);
    const percentage = getStockPercentage(item.quantity, item.low_stock_threshold);
    const progressColor = getProgressColor(item.quantity, item.low_stock_threshold);

    return (
      <Swipeable key={item.id} renderRightActions={() => renderRightActions(item.id)}>
        <View style={[styles.itemCard, { backgroundColor: Colors.card }]}>
          {/* Category Icon */}
          <View style={[styles.categoryIcon, { backgroundColor: `${categoryInfo.color}20` }]}>
            <Ionicons name={categoryInfo.icon} size={22} color={categoryInfo.color} />
          </View>

          {/* Middle Content */}
          <View style={styles.itemMiddle}>
            <Text style={styles.itemName}>{item.name}</Text>
            
            {/* Progress Bar */}
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
              {item.quantity} units left · threshold: {item.low_stock_threshold}
            </Text>
          </View>

          {/* Quantity Controls */}
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
            >
              <Ionicons name="remove" size={16} color="#F4A98A" />
            </TouchableOpacity>
            
            <Text style={styles.quantityNumber}>{item.quantity}</Text>
            
            <TouchableOpacity
              style={[styles.quantityButton, styles.quantityButtonPlus]}
              onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
            >
              <Ionicons name="add" size={16} color="#3B6D11" />
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  }, [handleUpdateQuantity, renderRightActions]);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.headerTitle}>Stock Tracker</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stock Status Banner */}
        {items.length > 0 && (lowStockItems.length > 0 ? (
          <View style={[styles.statusBanner, { backgroundColor: '#FFF0E8' }]}>
            <View style={styles.statusIcon}>
              <Ionicons name="alert-circle" size={24} color={Colors.primary} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>
                {lowStockItems.length} items running low
              </Text>
              <Text style={styles.statusSubtext}>
                {lowStockItems.map(item => item.name).join(', ')}
              </Text>
            </View>
            <TouchableOpacity style={styles.viewAllPill}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.statusBanner, { backgroundColor: '#EAF3DE' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#3B6D11" />
            <Text style={styles.allStockedText}>All stocked</Text>
          </View>
        ))}

        {/* Categorized Stock List */}
        {Object.entries(groupedItems).map(([category, categoryItems]) => {
          if (categoryItems.length === 0) return null;
          const categoryInfo = getCategoryInfo(category);
          
          return (
            <View key={category} style={styles.categorySection}>
              {/* Category Header */}
              <View style={styles.categoryHeader}>
                <View style={styles.categoryHeaderLeft}>
                  <Ionicons name={categoryInfo.icon} size={16} color={categoryInfo.color} />
                  <Text style={styles.categoryTitle}>{category}</Text>
                </View>
                <View style={styles.itemCountPill}>
                  <Text style={styles.itemCountText}>{categoryItems.length}</Text>
                </View>
              </View>
              
              {/* Category Items */}
              <View style={styles.categoryItems}>
                {categoryItems.map((item) => renderStockItem(item))}
              </View>
            </View>
          );
        })}

        {/* Empty State */}
        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={Colors.primary} style={{ opacity: 0.4 }} />
            <Text style={styles.emptyStateText}>Please enter your baby item stocks.</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Item Bottom Sheet Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheetContent, { backgroundColor: Colors.background }]}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />
            
            {/* Modal Title */}
            <Text style={styles.modalTitle}>Add Stock Item</Text>
            
            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Item Name */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Item name</Text>
                <TextInput
                  style={[styles.formInput, { borderColor: Colors.primary }]}
                  placeholder="e.g. Newborn Diapers"
                  placeholderTextColor={Colors.lightText}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>
              
              {/* Category */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {CATEGORIES.map((category) => {
                    const categoryInfo = getCategoryInfo(category);
                    return (
                      <TouchableOpacity
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
                          color={formData.category === category ? 'white' : '#8C7B6E'}
                        />
                        <Text
                          style={[
                            styles.categoryPillText,
                            { color: formData.category === category ? 'white' : '#8C7B6E' },
                          ]}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              
              {/* Quantity */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setFormData({ ...formData, quantity: Math.max(0, formData.quantity - 1) })}
                  >
                    <Ionicons name="remove" size={16} color="#F4A98A" />
                  </TouchableOpacity>
                  <Text style={styles.quantityNumber}>{formData.quantity}</Text>
                  <TouchableOpacity
                    style={[styles.quantityButton, styles.quantityButtonPlus]}
                    onPress={() => setFormData({ ...formData, quantity: formData.quantity + 1 })}
                  >
                    <Ionicons name="add" size={16} color="#3B6D11" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Unit */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {['packs', 'cans', 'pieces', 'bottles'].map((unit) => (
                    <TouchableOpacity
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
                          { color: formData.unit === unit ? 'white' : '#8C7B6E' },
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              {/* Low Stock Alert Threshold */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Low stock alert threshold</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setFormData({ ...formData, low_stock_threshold: Math.max(1, formData.low_stock_threshold - 1) })}
                  >
                    <Ionicons name="remove" size={16} color="#F4A98A" />
                  </TouchableOpacity>
                  <Text style={styles.quantityNumber}>{formData.low_stock_threshold}</Text>
                  <TouchableOpacity
                    style={[styles.quantityButton, styles.quantityButtonPlus]}
                    onPress={() => setFormData({ ...formData, low_stock_threshold: formData.low_stock_threshold + 1 })}
                  >
                    <Ionicons name="add" size={16} color="#3B6D11" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.thresholdSubtext}>Alert when below this amount</Text>
              </View>
            </View>
            
            {/* Bottom Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalAddButton]}
                onPress={handleAddItem}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
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
    backgroundColor: '#FFF0E8',
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
    color: '#8C7B6E',
  },
  viewAllPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewAllText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  allStockedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B6D11',
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
    backgroundColor: '#FFF0E8',
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
    backgroundColor: '#F0EDE8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  thresholdText: {
    fontSize: 11,
    color: '#8C7B6E',
    marginTop: 4,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonPlus: {
    backgroundColor: '#EAF3DE',
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
  emptyStateSubtext: {
    fontSize: 13,
    color: '#8C7B6E',
    marginTop: 8,
  },
  deleteAction: {
    backgroundColor: '#C0392B',
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
    color: '#8C7B6E',
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
    backgroundColor: '#FFF0E8',
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
    color: '#8C7B6E',
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
    backgroundColor: '#FFF0E8',
  },
  cancelButtonText: {
    color: '#8C7B6E',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAddButton: {
    backgroundColor: Colors.primary,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: '#3B6D11',
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
