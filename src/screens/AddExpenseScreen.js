// /src/screens/AddExpenseScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useClientStore } from '../store/useClientStore';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

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

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Atencao', 'Informe uma descricao para a despesa.');
      return;
    }

    const numericValue = parseCurrencyToNumber(valueStr);
    if (!numericValue || numericValue <= 0) {
      Alert.alert('Atencao', 'Informe um valor valido.');
      return;
    }

    addExpense({
      title: title.trim(),
      value: numericValue,
      category: category.id,
      categoryLabel: category.label,
      date: date.toISOString(),
    });

    navigation.goBack();
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Icon name="x" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Despesa</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Valor da despesa</Text>
            <TextInput
              style={styles.amountInput}
              value={valueStr}
              onChangeText={(text) => setValueStr(formatCurrencyRaw(text))}
              keyboardType="numeric"
              placeholder="R$ 0,00"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descricao</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Anuncio Instagram"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowDatePicker(true)}
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
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Categoria</Text>
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
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  keyboardWrapper: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  saveText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.primary },
  closeBtn: { padding: 4 },
  content: { padding: 20 },
  amountContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  amountLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 8 },
  amountInput: { ...TYPOGRAPHY.hero, color: COLORS.danger },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  inputGroup: { marginBottom: 24 },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 12 },
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
