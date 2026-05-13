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
  Alert,
  Switch,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing } from '@/constants';
import { appointments, Appointment } from '@/db/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabType = 'upcoming' | 'past';

interface AppointmentWithStatus extends Appointment {
  isPast: boolean;
  daysUntil: number;
}

interface ToastMessage {
  id: string;
  text: string;
  visible: boolean;
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentWithStatus[]>([]);
  const [pastAppointments, setPastAppointments] = useState<AppointmentWithStatus[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(Math.round(new Date().getMinutes() / 15) * 15);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');
  const [toast, setToast] = useState<ToastMessage>({ id: '', text: '', visible: false });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithStatus | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    date: new Date(),
    time: new Date(),
    doctor_name: '',
    location: '',
    notes: '',
    is_vaccine: false,
    vaccine_name: '',
  });

  const toastAnim = useRef(new Animated.Value(-100)).current;
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Load appointments
  const loadAppointments = useCallback(async () => {
    try {
      const allAppointments = await appointments.getAll();
      const now = Date.now();

      const processed: AppointmentWithStatus[] = allAppointments.map((apt) => {
        const isPast = apt.date < now;
        const daysUntil = Math.ceil((apt.date - now) / (1000 * 60 * 60 * 24));

        return {
          ...apt,
          isPast,
          daysUntil,
        };
      });

      const upcoming = processed.filter((apt) => !apt.isPast).sort((a, b) => a.date - b.date);
      const past = processed.filter((apt) => apt.isPast).sort((a, b) => b.date - a.date);

      setUpcomingAppointments(upcoming);
      setPastAppointments(past);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [loadAppointments])
  );

  const showToast = (message: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const id = Date.now().toString();
    setToast({ id, text: message, visible: true });

    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast({ id: '', text: '', visible: false });
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      date: new Date(),
      time: new Date(),
      doctor_name: '',
      location: '',
      notes: '',
      is_vaccine: false,
      vaccine_name: '',
    });
    setEditingAppointment(null);
  };

  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty days for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({ date: prevMonthDay, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Add days from next month to complete grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDay = new Date(year, month + 1, i);
      days.push({ date: nextMonthDay, isCurrentMonth: false });
    }
    
    return days;
  };

  const handleSaveAppointment = async () => {
    if (!formData.title.trim() || !formData.doctor_name.trim()) {
      Alert.alert('Missing fields', 'Please fill in title and doctor name');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const dateTime = new Date(formData.date);
      dateTime.setHours(formData.time.getHours(), formData.time.getMinutes());

      if (editingAppointment) {
        // Update existing appointment - for now just delete and re-add
        await appointments.deleteById(editingAppointment.id);
      }

      await appointments.insert(
        formData.title,
        dateTime.getTime(),
        formData.doctor_name,
        formData.location,
        formData.notes,
        formData.is_vaccine,
        formData.is_vaccine ? formData.vaccine_name || null : null
      );

      resetForm();
      setShowAddModal(false);
      setShowDatePicker(false);
      await loadAppointments();
      showToast('Appointment saved!');
    } catch (error) {
      console.error('Error saving appointment:', error);
      Alert.alert('Error', 'Failed to save appointment');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await appointments.deleteById(id);
      await loadAppointments();
      showToast('Appointment deleted');
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const aptDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (aptDate.getTime() === today.getTime()) {
      return 'Today';
    }
    if (aptDate.getTime() === today.getTime() - 24 * 60 * 60 * 1000) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMonthDay = (timestamp: number): { month: string; day: number } => {
    const date = new Date(timestamp);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
    };
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatTimeFromDate = (dateObj: Date): string => {
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const timePickerContent = (
    <View style={styles.timePickerContent}>
      <Text style={styles.pickerTitle}>Select Time</Text>
      
      {/* Time Display */}
      <View style={styles.timeDisplay}>
        <Text style={styles.timeDisplayHour}>
          {String(selectedHour).padStart(2, '0')}
        </Text>
        <Text style={styles.timeDisplayColon}>:</Text>
        <Text style={styles.timeDisplayMinute}>
          {String(selectedMinute).padStart(2, '0')}
        </Text>
        <Text style={styles.timeDisplayPeriod}>{selectedPeriod}</Text>
      </View>
      
      {/* Hour Grid */}
      <View style={styles.hourGrid}>
        <Text style={styles.timeGridLabel}>HOUR</Text>
        <View style={styles.hourButtonsGrid}>
          {Array.from({ length: 12 }).map((_, i) => {
            const hour = i + 1;
            const isSelected = selectedHour === hour;
            return (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.hourPill,
                  isSelected && styles.hourPillSelected,
                ]}
                onPress={() => {
                  setSelectedHour(hour);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.hourPillText,
                    isSelected && styles.hourPillTextSelected,
                  ]}
                >
                  {hour}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {/* Minute Row */}
      <View style={styles.minuteRow}>
        <Text style={styles.timeGridLabel}>MINUTES</Text>
        <View style={styles.minuteButtonsRow}>
          {['00', '15', '30', '45'].map((minute) => {
            const minuteValue = parseInt(minute);
            const isSelected = selectedMinute === minuteValue;
            return (
              <TouchableOpacity
                key={minute}
                style={[
                  styles.minutePill,
                  isSelected && styles.minutePillSelected,
                ]}
                onPress={() => {
                  setSelectedMinute(minuteValue);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.minutePillText,
                    isSelected && styles.minutePillTextSelected,
                  ]}
                >
                  {minute}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {/* AM/PM Toggle */}
      <View style={styles.periodToggle}>
        <TouchableOpacity
          style={[
            styles.periodPill,
            selectedPeriod === 'AM' && styles.periodPillSelected,
          ]}
          onPress={() => {
            setSelectedPeriod('AM');
            Haptics.selectionAsync();
          }}
        >
          <Text
            style={[
              styles.periodPillText,
              selectedPeriod === 'AM' && styles.periodPillTextSelected,
            ]}
          >
            AM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.periodPill,
            selectedPeriod === 'PM' && styles.periodPillSelected,
          ]}
          onPress={() => {
            setSelectedPeriod('PM');
            Haptics.selectionAsync();
          }}
        >
          <Text
            style={[
              styles.periodPillText,
              selectedPeriod === 'PM' && styles.periodPillTextSelected,
            ]}
          >
            PM
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Bottom Buttons */}
      <View style={styles.timePickerBottomButtons}>
        <TouchableOpacity
          style={styles.timePickerCancelButton}
          onPress={() => {
            setShowTimePicker(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }}
        >
          <Text style={styles.timePickerCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.timePickerConfirmButton}
          onPress={() => {
            // Convert 12-hour to 24-hour format
            const hour24 = selectedPeriod === 'PM' && selectedHour !== 12 
              ? selectedHour + 12 
              : selectedPeriod === 'AM' && selectedHour === 12 
              ? 0 
              : selectedHour;
              
            const newTime = new Date(formData.time);
            newTime.setHours(hour24);
            newTime.setMinutes(selectedMinute);
            setFormData({ ...formData, time: newTime });
            setShowTimePicker(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <Text style={styles.timePickerConfirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getDaysUntilLabel = (daysUntil: number): string => {
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    return `In ${daysUntil} days`;
  };

  const switchTab = (newTab: TabType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(newTab);
  };

  const formatFullDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + formatTime(timestamp);
  };

  const handleDateChange = (date: Date) => {
    setFormData({ ...formData, date });
    setShowDatePicker(false);
  };

  const handleAddAppointment = () => {
    handleSaveAppointment();
  };

  const renderAppointmentItem = (item: AppointmentWithStatus, isPast: boolean) => {
    const monthDay = formatMonthDay(item.date);
    const dateBlock = item.isPast ? '#E8D5C4' : item.daysUntil <= 3 ? '#F4A98A' : item.daysUntil <= 7 ? '#A8D5BA' : '#D4C5F9';

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)}>
        <TouchableOpacity
          style={[styles.appointmentCard, { backgroundColor: '#FFFAF7' }]}
          onPress={() => {
            setSelectedAppointment(item);
            setShowDetailModal(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.appointmentHeader}>
            {/* Date Block */}
            <View style={[styles.dateBlock, { backgroundColor: dateBlock }]}>
              <Text style={styles.dateBlockMonth}>{monthDay.month}</Text>
              <Text style={styles.dateBlockDay}>{monthDay.day}</Text>
            </View>

            {/* Content */}
            <View style={styles.appointmentInfo}>
              <Text style={styles.appointmentTitle}>{item.title}</Text>
              {item.is_vaccine && item.vaccine_name && (
                <Text style={styles.vaccineName}>💉 {item.vaccine_name}</Text>
              )}
              <View style={styles.appointmentMeta}>
                <Ionicons name="time-outline" size={13} color="#8C7B6E" />
                <Text style={styles.appointmentMetaText}>{formatTime(item.date)}</Text>
              </View>
              {item.doctor_name && (
                <View style={styles.appointmentMeta}>
                  <Ionicons name="person-outline" size={13} color="#8C7B6E" />
                  <Text style={styles.appointmentMetaText}>{item.doctor_name}</Text>
                </View>
              )}
              {item.location && (
                <View style={styles.appointmentMeta}>
                  <Ionicons name="location-outline" size={13} color="#8C7B6E" />
                  <Text style={styles.appointmentMetaText}>{item.location}</Text>
                </View>
              )}
            </View>

            {/* Right Actions */}
            {!isPast && (
              <View style={styles.appointmentActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setEditingAppointment(item);
                    setFormData({
                      title: item.title,
                      date: new Date(item.date),
                      time: new Date(item.date),
                      doctor_name: item.doctor_name,
                      location: item.location,
                      notes: item.notes,
                      is_vaccine: item.is_vaccine,
                      vaccine_name: item.vaccine_name || '',
                    });
                    setShowAddModal(true);
                  }}
                >
                  <Ionicons name="pencil" size={16} color="#F4A98A" />
                </TouchableOpacity>
              </View>
            )}
            {isPast && (
              <View style={[styles.completedPill, { backgroundColor: '#A8D5BA' }]}>
                <Text style={styles.completedPillText}>Completed</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const upcomingAlert = upcomingAppointments.find((apt) => apt.daysUntil >= 0 && apt.daysUntil <= 7);
  const isNearby = upcomingAlert && upcomingAlert.daysUntil <= 3;

  const renderRightActions = (id: number) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        Alert.alert('Delete Appointment', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            onPress: () => handleDelete(id),
            style: 'destructive',
          },
        ]);
      }}
    >
      <Ionicons name="trash-outline" size={20} color="white" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#FFF8F4' }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Add Button */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.headerTitle}>Appointments</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color="#F4A98A" />
          </TouchableOpacity>
        </View>

        {/* Upcoming Alert Banner */}
        {upcomingAlert && upcomingAlert.daysUntil <= 7 && upcomingAlert.daysUntil >= 0 && (
          <View
            style={[
              styles.alertBanner,
              {
                backgroundColor: isNearby ? '#FFF0E8' : '#EAF3DE',
                borderColor: isNearby ? '#F4A98A' : '#A8D5BA',
              },
            ]}
          >
            <View style={styles.alertIconContainer}>
              <Ionicons
                name={isNearby ? 'alarm-outline' : 'calendar-outline'}
                size={20}
                color={isNearby ? '#F4A98A' : '#A8D5BA'}
              />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{upcomingAlert.title}</Text>
              <Text style={styles.alertTime}>
                {getDaysUntilLabel(upcomingAlert.daysUntil)} • {formatTime(upcomingAlert.date)}
              </Text>
            </View>
            <View
              style={[
                styles.alertPill,
                { backgroundColor: isNearby ? '#F4A98A' : '#A8D5BA' },
              ]}
            >
              <Text style={styles.alertPillText}>
                {isNearby ? 'Soon' : 'Upcoming'}
              </Text>
            </View>
          </View>
        )}

        {/* Custom Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'upcoming' && styles.tabButtonActive,
            ]}
            onPress={() => switchTab('upcoming')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={activeTab === 'upcoming' ? '#F4A98A' : '#8C7B6E'}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'upcoming' && styles.tabButtonTextActive,
              ]}
            >
              Upcoming
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'past' && styles.tabButtonActive,
            ]}
            onPress={() => switchTab('past')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={activeTab === 'past' ? '#F4A98A' : '#8C7B6E'}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'past' && styles.tabButtonTextActive,
              ]}
            >
              Past
            </Text>
          </TouchableOpacity>
        </View>

        {/* Appointments List */}
        <View style={styles.listContainer}>
          {activeTab === 'upcoming' ? (
            upcomingAppointments.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#F4A98A" />
                </View>
                <Text style={styles.emptyStateTitle}>No Upcoming Appointments</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Schedule your baby's next appointment
                </Text>
              </View>
            ) : (
              <FlatList
                data={upcomingAppointments}
                renderItem={({ item }) => renderAppointmentItem(item, false)}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
              />
            )
          ) : pastAppointments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconContainer}>
                <Ionicons name="time-outline" size={48} color="#F4A98A" />
              </View>
              <Text style={styles.emptyStateTitle}>No Past Appointments</Text>
              <Text style={styles.emptyStateSubtitle}>
                Your past appointments will appear here
              </Text>
            </View>
          ) : (
            <FlatList
              data={pastAppointments}
              renderItem={({ item }) => renderAppointmentItem(item, true)}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
            />
          )}
        </View>
      </ScrollView>

      {/* Add Appointment Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#4A3728" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Title Input */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Appointment Title</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 2-Month Checkup"
                  placeholderTextColor="#8C7B6E"
                  value={formData.title}
                  onChangeText={(text) =>
                    setFormData({ ...formData, title: text })
                  }
                />
              </View>

              {/* Date Input */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => {
                    setDatePickerMode('date');
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={18} color="#F4A98A" />
                  <Text style={styles.datePickerButtonText}>
                    {formData.date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Time Input */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Time</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={18} color="#F4A98A" />
                  <Text style={styles.datePickerButtonText}>
                    {formatTimeFromDate(formData.time)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Time Picker Modal */}
              {showTimePicker && (
                <Modal
                  visible={showTimePicker}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowTimePicker(false)}
                >
                  <TouchableOpacity
                    style={styles.datePickerOverlay}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <View style={styles.datePickerContainer}>
                      <View style={styles.datePickerHeader}>
                        <TouchableOpacity
                          onPress={() => setShowTimePicker(false)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.datePickerCloseButton}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setShowTimePicker(false)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.datePickerDoneButton}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.datePickerContent}>
                        <Text style={styles.pickerTitle}>Select Time</Text>
                        
                        {/* Simple Time Picker */}
                        <View style={styles.timePickerColumns}>
                          <View style={styles.timeColumn}>
                            <Text style={styles.timeColumnLabel}>Hour</Text>
                            <ScrollView 
                              style={styles.timePickerScroll}
                              showsVerticalScrollIndicator={false}
                            >
                              {Array.from({ length: 12 }).map((_, i) => {
                                const hour = i + 1;
                                const isSelected = selectedHour === hour;
                                return (
                                  <TouchableOpacity
                                    key={hour}
                                    style={[
                                      styles.timeOption,
                                      isSelected && styles.timeOptionSelected,
                                    ]}
                                    onPress={() => {
                                      setSelectedHour(hour);
                                      Haptics.selectionAsync();
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.timeOptionText,
                                        isSelected && styles.timeOptionTextSelected,
                                      ]}
                                    >
                                      {hour}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                          
                          <View style={styles.timeColumn}>
                            <Text style={styles.timeColumnLabel}>Minute</Text>
                            <ScrollView 
                              style={styles.timePickerScroll}
                              showsVerticalScrollIndicator={false}
                            >
                              {[0, 15, 30, 45].map((minute) => {
                                const isSelected = selectedMinute === minute;
                                return (
                                  <TouchableOpacity
                                    key={minute}
                                    style={[
                                      styles.timeOption,
                                      isSelected && styles.timeOptionSelected,
                                    ]}
                                    onPress={() => {
                                      setSelectedMinute(minute);
                                      Haptics.selectionAsync();
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.timeOptionText,
                                        isSelected && styles.timeOptionTextSelected,
                                      ]}
                                    >
                                      {String(minute).padStart(2, '0')}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                          
                          <View style={styles.timeColumn}>
                            <Text style={styles.timeColumnLabel}>Period</Text>
                            <View style={styles.timeColumn}>
                              <TouchableOpacity
                                style={[
                                  styles.timeOption,
                                  selectedPeriod === 'AM' && styles.timeOptionSelected,
                                ]}
                                onPress={() => {
                                  setSelectedPeriod('AM');
                                  Haptics.selectionAsync();
                                }}
                              >
                                <Text
                                  style={[
                                    styles.timeOptionText,
                                    selectedPeriod === 'AM' && styles.timeOptionTextSelected,
                                  ]}
                                >
                                  AM
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.timeOption,
                                  selectedPeriod === 'PM' && styles.timeOptionSelected,
                                ]}
                                onPress={() => {
                                  setSelectedPeriod('PM');
                                  Haptics.selectionAsync();
                                }}
                              >
                                <Text
                                  style={[
                                    styles.timeOptionText,
                                    selectedPeriod === 'PM' && styles.timeOptionTextSelected,
                                  ]}
                                >
                                  PM
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                        
                        {/* Bottom Buttons */}
                        <View style={styles.modalFooter}>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                              setShowTimePicker(false);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            }}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.saveButton}
                            onPress={() => {
                              // Convert 12-hour to 24-hour format
                              const hour24 = selectedPeriod === 'PM' && selectedHour !== 12 
                                ? selectedHour + 12 
                                : selectedPeriod === 'AM' && selectedHour === 12 
                                ? 0 
                                : selectedHour;
                                
                              const newTime = new Date(formData.time);
                              newTime.setHours(hour24);
                              newTime.setMinutes(selectedMinute);
                              setFormData({ ...formData, time: newTime });
                              setShowTimePicker(false);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }}
                          >
                            <Text style={styles.saveButtonText}>Confirm</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}

              {/* Date Picker Modal */}
{/* Date Picker Modal */}
{showDatePicker && (
  <Modal
    visible={showDatePicker}
    transparent
    animationType="fade"
    onRequestClose={() => setShowDatePicker(false)}
  >
    <TouchableOpacity
      style={styles.datePickerOverlay}
      onPress={() => setShowDatePicker(false)}
    >
      <TouchableOpacity
        style={styles.datePickerContainer}
        activeOpacity={1}
        onPress={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <View style={styles.datePickerHeader}>
          <TouchableOpacity
            onPress={() => setShowDatePicker(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.datePickerCloseButton}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowDatePicker(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.datePickerDoneButton}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.datePickerContent}>
          {/* Month/Year Navigation */}
          <View style={styles.monthYearNavigation}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const newMonth = new Date(currentMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCurrentMonth(newMonth);
              }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color="#F4A98A"
              />
            </TouchableOpacity>

            <Text style={styles.monthYearText}>
              {currentMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const newMonth = new Date(currentMonth);
                newMonth.setMonth(newMonth.getMonth() + 1);
                setCurrentMonth(newMonth);
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#F4A98A"
              />
            </TouchableOpacity>
          </View>

          {/* Days of Week */}
          <View style={styles.weekDaysContainer}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
              (day) => (
                <Text
                  key={day}
                  style={styles.weekDayText}
                >
                  {day}
                </Text>
              )
            )}
          </View>

          {/* Calendar Grid */}
          <ScrollView style={styles.calendarScroll}>
            <View style={styles.calendarGrid}>
              {getCalendarDays(currentMonth).map(
                (day, index) => {
                  const isSelected =
                    formData.date.toDateString() ===
                    day.date.toDateString();

                  const isToday =
                    day.date.toDateString() ===
                    new Date().toDateString();

                  const isCurrentMonth =
                    day.date.getMonth() ===
                    currentMonth.getMonth();

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDay,
                        isSelected &&
                          styles.calendarDaySelected,
                        isToday &&
                          styles.calendarDayToday,
                        !isCurrentMonth &&
                          styles.calendarDayOtherMonth,
                      ]}
                      onPress={() => {
                        setFormData({
                          ...formData,
                          date: day.date,
                        });
                      }}
                      disabled={!isCurrentMonth}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          isSelected &&
                            styles.calendarDayTextSelected,
                          isToday &&
                            styles.calendarDayTextToday,
                          !isCurrentMonth &&
                            styles.calendarDayTextOtherMonth,
                        ]}
                      >
                        {day.date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          </ScrollView>

          {/* Time Display */}
          <View style={styles.timeDisplay}>
            <Text style={styles.timeDisplayHour}>
              {String(selectedHour).padStart(2, '0')}
            </Text>

            <Text style={styles.timeDisplayColon}>
              :
            </Text>

            <Text style={styles.timeDisplayMinute}>
              {String(selectedMinute).padStart(2, '0')}
            </Text>

            <Text style={styles.timeDisplayPeriod}>
              {selectedPeriod}
            </Text>
          </View>

          {/* Hour Grid */}
          <View style={styles.hourGrid}>
            <Text style={styles.timeGridLabel}>
              HOUR
            </Text>

            <View style={styles.hourButtonsGrid}>
              {Array.from({ length: 12 }).map((_, i) => {
                const hour = i + 1;
                const isSelected =
                  selectedHour === hour;

                return (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.hourPill,
                      isSelected &&
                        styles.hourPillSelected,
                    ]}
                    onPress={() => {
                      setSelectedHour(hour);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text
                      style={[
                        styles.hourPillText,
                        isSelected &&
                          styles.hourPillTextSelected,
                      ]}
                    >
                      {hour}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Minute Row */}
          <View style={styles.minuteRow}>
            <Text style={styles.timeGridLabel}>
              MINUTES
            </Text>

            <View style={styles.minuteButtonsRow}>
              {['00', '15', '30', '45'].map(
                (minute) => {
                  const minuteValue =
                    parseInt(minute);

                  const isSelected =
                    selectedMinute === minuteValue;

                  return (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.minutePill,
                        isSelected &&
                          styles.minutePillSelected,
                      ]}
                      onPress={() => {
                        setSelectedMinute(
                          minuteValue
                        );

                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.minutePillText,
                          isSelected &&
                            styles.minutePillTextSelected,
                        ]}
                      >
                        {minute}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          </View>

          {/* AM/PM Toggle */}
          <View style={styles.periodToggle}>
            <TouchableOpacity
              style={[
                styles.periodPill,
                selectedPeriod === 'AM' &&
                  styles.periodPillSelected,
              ]}
              onPress={() => {
                setSelectedPeriod('AM');
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.periodPillText,
                  selectedPeriod === 'AM' &&
                    styles.periodPillTextSelected,
                ]}
              >
                AM
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodPill,
                selectedPeriod === 'PM' &&
                  styles.periodPillSelected,
              ]}
              onPress={() => {
                setSelectedPeriod('PM');
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.periodPillText,
                  selectedPeriod === 'PM' &&
                    styles.periodPillTextSelected,
                ]}
              >
                PM
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Buttons */}
          <View style={styles.timePickerBottomButtons}>
            <TouchableOpacity
              style={styles.timePickerCancelButton}
              onPress={() => {
                setShowDatePicker(false);

                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error
                );
              }}
            >
              <Text style={styles.timePickerCancelText}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.timePickerConfirmButton}
              onPress={() => {
                const hour24 =
                  selectedPeriod === 'PM' &&
                  selectedHour !== 12
                    ? selectedHour + 12
                    : selectedPeriod === 'AM' &&
                      selectedHour === 12
                    ? 0
                    : selectedHour;

                const newTime = new Date(
                  formData.time
                );

                newTime.setHours(hour24);
                newTime.setMinutes(selectedMinute);

                setFormData({
                  ...formData,
                  time: newTime,
                });

                setShowDatePicker(false);

                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }}
            >
              <Text style={styles.timePickerConfirmText}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
)}

              {/* Doctor Name */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Doctor Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Dr. Sarah Smith"
                  placeholderTextColor="#8C7B6E"
                  value={formData.doctor_name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, doctor_name: text })
                  }
                />
              </View>

              {/* Location */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Pediatric Clinic"
                  placeholderTextColor="#8C7B6E"
                  value={formData.location}
                  onChangeText={(text) =>
                    setFormData({ ...formData, location: text })
                  }
                />
              </View>

              {/* Vaccine Toggle */}
              <View style={styles.formField}>
                <View style={styles.vaccineTitleRow}>
                  <Text style={styles.inputLabel}>Vaccine Appointment</Text>
                  <Switch
                    value={formData.is_vaccine}
                    onValueChange={(value) =>
                      setFormData({ ...formData, is_vaccine: value })
                    }
                    trackColor={{ false: '#E8D5C4', true: '#A8D5BA' }}
                    thumbColor={formData.is_vaccine ? '#7B68EE' : '#D4C5F9'}
                  />
                </View>

                {formData.is_vaccine && (
                  <TextInput
                    style={[styles.textInput, { marginTop: Spacing.md }]}
                    placeholder="Vaccine name (e.g., Rotavirus)"
                    placeholderTextColor="#8C7B6E"
                    value={formData.vaccine_name}
                    onChangeText={(text) =>
                      setFormData({ ...formData, vaccine_name: text })
                    }
                  />
                )}
              </View>

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 100 }]}
                  placeholder="Any additional notes or reminders"
                  placeholderTextColor="#8C7B6E"
                  value={formData.notes}
                  onChangeText={(text) =>
                    setFormData({ ...formData, notes: text })
                  }
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Modal Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleAddAppointment()}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {editingAppointment ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      {toast.visible && (
        <Animated.View
          style={[
            styles.toast,
            {
              transform: [{ translateY: toastAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.toastContent}>
            <Ionicons name="checkmark-circle" size={18} color="#FFF" />
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F4',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4A3728',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0E8',
    borderWidth: 0.5,
    borderColor: '#F4A98A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    elevation: 3,
  },
  alertBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 0.5,
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    elevation: 3,
  },
  alertIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 169, 138, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A3728',
  },
  alertTime: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8C7B6E',
    marginTop: 2,
  },
  alertPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: '#FFFAF7',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#FFF0E8',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8C7B6E',
  },
  tabButtonTextActive: {
    color: '#F4A98A',
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
  },
  appointmentCard: {
    backgroundColor: '#FFFAF7',
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dateBlock: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBlockMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  dateBlockDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A3728',
  },
  appointmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  appointmentMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8C7B6E',
  },
  vaccineName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F4A98A',
    marginTop: 4,
    fontStyle: 'italic',
  },
  appointmentActions: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: Spacing.sm,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8C7B6E',
    textAlign: 'center',
    maxWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(74, 55, 40, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF8F4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFAF7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A3728',
  },
  modalBodyScroll: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  formField: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A3728',
  },
  textInput: {
    backgroundColor: '#FFFAF7',
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 14,
    color: '#4A3728',
    borderWidth: 0.5,
    borderColor: '#F4A98A',
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    elevation: 2,
  },
  datePickerButton: {
    backgroundColor: '#FFFAF7',
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 0.5,
    borderColor: '#F4A98A',
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    elevation: 2,
  },
  datePickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A3728',
    flex: 1,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#FFF8F4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    maxHeight: '85%',
    minHeight: '60%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFAF7',
  },
  datePickerCloseButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8C7B6E',
  },
  datePickerDoneButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4A98A',
  },
  timePickerContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxHeight: 400,
  },
  datePickerContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  datePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  dateOption: {
    width: '30%',
    paddingVertical: Spacing.md,
    borderRadius: 12,
    backgroundColor: '#FFFAF7',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E8D5C4',
  },
  dateOptionSelected: {
    backgroundColor: '#F4A98A',
    borderColor: '#F4A98A',
  },
  dateOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7B6E',
  },
  dateOptionTextSelected: {
    color: '#FFF',
  },
  timePickerScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  timeOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFAF7',
    borderWidth: 0.5,
    borderColor: '#E8D5C4',
  },
  timeOptionSelected: {
    backgroundColor: '#F4A98A',
    borderColor: '#F4A98A',
  },
  timeOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8C7B6E',
  },
  timeOptionTextSelected: {
    color: '#FFF',
  },
  vaccineTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#FFFAF7',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    backgroundColor: '#FFFAF7',
    borderWidth: 0.5,
    borderColor: '#F4A98A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4A98A',
  },
  saveButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    backgroundColor: '#F4A98A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  deleteAction: {
    backgroundColor: '#E8542F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginLeft: Spacing.sm,
  },
  toast: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  toastContent: {
    backgroundColor: '#F4A98A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 16,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  dateOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dateOptionToday: {
    backgroundColor: '#EAF3DE',
    borderColor: '#A8D5BA',
  },
  dateOptionTextToday: {
    color: '#3B6D11',
    fontWeight: '700',
  },
  dateOptionDayText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8C7B6E',
    marginTop: 2,
  },
  timePickerContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxHeight: 400,
  },
  timeDisplay: {
    backgroundColor: '#FFFAF7',
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#F4A98A',
  },
  timeDisplayHour: {
    fontSize: 48,
    fontWeight: '700',
    color: '#4A3728',
  },
  timeDisplayColon: {
    fontSize: 48,
    fontWeight: '700',
    color: '#F4A98A',
    marginHorizontal: 4,
  },
  timeDisplayMinute: {
    fontSize: 48,
    fontWeight: '700',
    color: '#4A3728',
  },
  timeDisplayPeriod: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8C7B6E',
    marginLeft: 8,
  },
  hourGrid: {
    flex: 1,
  },
  hourButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  hourPill: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  hourPillSelected: {
    backgroundColor: '#F4A98A',
  },
  hourPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A3728',
  },
  hourPillTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  minuteRow: {
    marginTop: Spacing.lg,
  },
  minuteButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  minutePill: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutePillSelected: {
    backgroundColor: '#F4A98A',
  },
  minutePillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A3728',
  },
  minutePillTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  periodToggle: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillSelected: {
    backgroundColor: '#F4A98A',
  },
  periodPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A3728',
  },
  periodPillTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  timePickerBottomButtons: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  timePickerCancelButton: {
    flex: 1,
    backgroundColor: '#FFF0E8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timePickerCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8C7B6E',
  },
  timePickerConfirmButton: {
    flex: 1,
    backgroundColor: '#F4A98A',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    elevation: 4,
  },
  timePickerConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  timePickerColumns: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeColumnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7B6E',
    marginBottom: Spacing.sm,
  },
  timePickerScroll: {
    maxHeight: 200,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF0E8',
    marginBottom: 4,
    alignItems: 'center',
  },
  timeOptionSelected: {
    backgroundColor: '#F4A98A',
  },
  timeOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A3728',
  },
  timeOptionTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  timeColumnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: Spacing.sm,
  },
  monthYearNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFAF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A3728',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#8C7B6E',
  },
  calendarScroll: {
    maxHeight: 280,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  calendarDaySelected: {
    backgroundColor: '#F4A98A',
  },
  calendarDayToday: {
    backgroundColor: '#EAF3DE',
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A3728',
  },
  calendarDayTextSelected: {
    color: '#FFF',
  },
  calendarDayTextToday: {
    color: '#3B6D11',
    fontWeight: '700',
  },
  calendarDayTextOtherMonth: {
    color: '#8C7B6E',
  },
  timeDisplay: {
    backgroundColor: '#FFFAF7',
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#F4A98A',
  },
  timeDisplayText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A3728',
  },
  timeWheelsContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  timeWheel: {
    flex: 1,
    alignItems: 'center',
  },
  wheelLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: Spacing.sm,
  },
  wheelScroll: {
    height: 200,
  },
  wheelItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8C7B6E',
  },
  wheelItemTextSelected: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F4A98A',
  },
  simpleTimePicker: {
    gap: Spacing.lg,
  },
  timeGrid: {
    flex: 1,
  },
  timeGridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3728',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  timeButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  timeButton: {
    width: 50,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFAF7',
    borderWidth: 0.5,
    borderColor: '#E8D5C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonSelected: {
    backgroundColor: '#F4A98A',
    borderColor: '#F4A98A',
  },
  timeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7B6E',
  },
  timeButtonTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
});
