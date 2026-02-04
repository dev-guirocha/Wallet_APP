import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { getMonthKey, getReadableMonth } from '../utils/dateUtils';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

const shiftMonthKey = (monthKey, delta) => {
  if (!monthKey) return getMonthKey();
  const [yearString, monthString] = String(monthKey).split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return getMonthKey();
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return getMonthKey(date);
};

const MonthPicker = ({ monthKey, onChange }) => {
  const label = getReadableMonth(monthKey);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => onChange?.(shiftMonthKey(monthKey, -1))}
      >
        <Icon name="chevron-left" size={18} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => onChange?.(shiftMonthKey(monthKey, 1))}
      >
        <Icon name="chevron-right" size={18} color={COLORS.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
});

export default MonthPicker;
