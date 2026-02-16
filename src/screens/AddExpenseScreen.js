// /src/screens/AddExpenseScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Card, FormField, FormScreen } from '../components';
import { useClientStore } from '../store/useClientStore';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../theme/legacy';
import { formLabels } from '../utils/uiCopy';

const CATEGORIES = [
  { id: 'marketing', label: 'Marketing', icon: 'trending-up', color: '#4299E1' },
  { id: 'transport', label: 'Transporte', icon: 'truck', color: '#ECC94B' },
  { id: 'utilities', label: 'Internet/Luz', icon: 'wifi', color: '#805AD5' },
  { id: 'supplies', label: 'Materiais', icon: 'box', color: '#ED8936' },
  { id: 'tax', label: 'Impostos', icon: 'file-text', color: '#F56565' },
  { id: 'other', label: 'Outros', icon: 'more-horizontal', color: '#A0AEC0' },
];

const formatCurrencyRaw = (value) => {
  const clean = String(value || '').replace(/\D+/g, '');
  const intValue = clean.length ? parseInt(clean, 10) : 0;
  return (intValue / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const parseCurrencyToNumber = (value) => {
  const clean = String(value || '').replace(/\D+/g, '');
  const intValue = clean.length ? parseInt(clean, 10) : 0;
  return intValue / 100;
};

const AddExpenseScreen = ({ navigation }) => {
  const addExpense = useClientStore((state) => state.addExpense);

  const [title, setTitle] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [category, setCategory] = useState(CATEGORIES[CATEGORIES.length - 1]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Atencao', 'Informe uma descricao para a despesa.');
      return;
    }

    const numericValue = parseCurrencyToNumber(valueStr);
    if (!numericValue || numericValue <= 0) {
      Alert.alert('Atencao', 'Informe um valor valido.');
      return;
    }

    setIsSaving(true);
    try {
      await addExpense({
        title: title.trim(),
        value: numericValue,
        category: category.id,
        categoryLabel: category.label,
        date: date.toISOString(),
      });

      navigation.goBack();
    } finally {
      setIsSaving(false);
    }
  };

  const onDateChange = (_, selectedDate) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <FormScreen
      title={formLabels.addExpense.title}
      navigation={navigation}
      onSubmit={handleSave}
      submitLabel={formLabels.addExpense.submit}
      loading={isSaving}
    >
      <View style={styles.amountContainer}>
        <FormField
          label={formLabels.addExpense.amount}
          style={styles.amountField}
          labelStyle={styles.amountLabel}
        >
          <TextInput
            style={styles.amountInput}
            value={valueStr}
            onChangeText={(text) => setValueStr(formatCurrencyRaw(text))}
            keyboardType="numeric"
            placeholder="R$ 0,00"
            placeholderTextColor={COLORS.textSecondary}
            autoFocus
            accessibilityLabel={formLabels.addExpense.amount}
          />
        </FormField>
      </View>

      <Card style={styles.formCard}>
        <FormField label={formLabels.addExpense.description} style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={formLabels.addExpense.descriptionPlaceholder}
            placeholderTextColor={COLORS.textSecondary}
            accessibilityLabel={formLabels.addExpense.description}
          />
        </FormField>

        <FormField label={formLabels.addExpense.date} style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.dateSelector}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Selecionar data da despesa"
          >
            <Icon name="calendar" size={20} color={COLORS.textPrimary} />
            <Text style={styles.dateText}>
              {date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          ) : null}
        </FormField>

        <FormField label={formLabels.addExpense.category} style={styles.inputGroupNoSpacing}>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const isSelected = category.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catItem,
                    isSelected && styles.catItemSelected,
                    isSelected && { borderColor: cat.color, backgroundColor: `${cat.color}15` },
                  ]}
                  onPress={() => setCategory(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoria ${cat.label}`}
                >
                  <Icon
                    name={cat.icon}
                    size={20}
                    color={isSelected ? cat.color : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.catText,
                      isSelected && { color: cat.color, fontWeight: '700' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FormField>
      </Card>
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  amountContainer: { alignItems: 'center', marginBottom: 22, marginTop: 4 },
  amountField: { width: '100%', alignItems: 'center', marginBottom: 0 },
  amountLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 8 },
  amountInput: { ...TYPOGRAPHY.hero, color: COLORS.danger },
  formCard: {
    borderRadius: 20,
    ...SHADOWS.medium,
  },
  inputGroup: { marginBottom: 24 },
  inputGroupNoSpacing: { marginBottom: 4 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...TYPOGRAPHY.body,
    paddingVertical: 8,
    color: COLORS.textPrimary,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateText: { marginLeft: 10, ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  catItem: {
    width: '30%',
    aspectRatio: 1.3,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '1.5%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catItemSelected: {
    backgroundColor: COLORS.surface,
  },
  catText: { ...TYPOGRAPHY.caption, marginTop: 6, color: COLORS.textSecondary },
});

export default AddExpenseScreen;
