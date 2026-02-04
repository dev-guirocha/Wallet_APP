import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const mergeDateAndTime = (datePart, timePart) => {
  const baseDate = datePart instanceof Date ? datePart : new Date();
  const baseTime = timePart instanceof Date ? timePart : new Date();
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    baseTime.getHours(),
    baseTime.getMinutes(),
    0,
    0
  );
};

const formatDateLabel = (date) =>
  date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const formatTimeLabel = (date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const RescheduleModal = ({ visible, initialDate, onClose, onConfirm }) => {
  const [draftDate, setDraftDate] = useState(initialDate || new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftDate(initialDate || new Date());
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible, initialDate]);

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'dismissed') {
        setShowDatePicker(false);
        return;
      }
      setShowDatePicker(false);
    }
    if (!selectedDate) return;
    setDraftDate((prev) => mergeDateAndTime(selectedDate, prev));
  };

  const handleTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'dismissed') {
        setShowTimePicker(false);
        return;
      }
      setShowTimePicker(false);
    }
    if (!selectedDate) return;
    setDraftDate((prev) => mergeDateAndTime(prev, selectedDate));
  };

  const handleConfirm = () => {
    onConfirm?.(draftDate);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Remarcar compromisso</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nova data</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.selectorText}>{formatDateLabel(draftDate)}</Text>
            </TouchableOpacity>
            {showDatePicker ? (
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Novo horário</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.selectorText}>{formatTimeLabel(draftDate)}</Text>
            </TouchableOpacity>
            {showTimePicker ? (
              <DateTimePicker
                value={draftDate}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
              />
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.medium,
  },
  title: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 8 },
  selector: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectorText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 8 },
  cancelText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textSecondary },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  confirmText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
});

export default RescheduleModal;
