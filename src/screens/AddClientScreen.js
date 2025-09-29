// /src/screens/AddClientScreen.js

import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const TIME_SUFFIX = 'h';
const DEFAULT_TIME_HOUR = 9;

const createBaseTime = () => {
  const date = new Date();
  date.setHours(DEFAULT_TIME_HOUR, 0, 0, 0);
  return date;
};

const parseTimeStringToDate = (value) => {
  const reference = createBaseTime();
  if (!value) return reference;

  const sanitized = String(value).toLowerCase();
  const match = sanitized.match(/(\d{1,2})(?:[:h]?([0-9]{1,2}))?/);
  if (!match) return reference;

  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10) || DEFAULT_TIME_HOUR));
  const minutes = match[2] ? Math.min(59, Math.max(0, parseInt(match[2], 10) || 0)) : 0;

  const result = new Date(reference);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const formatTimeLabel = (date) => {
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = date.getMinutes();
  if (minutes > 0) {
    return `${hours}${TIME_SUFFIX}${String(minutes).padStart(2, '0')}`;
  }
  return `${hours}${TIME_SUFFIX}`;
};

const AddClientScreen = ({
  navigation,
  route,
  onAddClient,
  onUpdateClient,
  defaultClientTerm = 'Cliente',
  planTier = 'free',
  clientLimit = 3,
  clientCount = 0,
}) => {
  const { clientTerm, client } = route.params ?? {};
  const term = clientTerm || defaultClientTerm;
  const isEditing = !!client;

  const [name, setName] = useState(client?.name ?? '');
  const [location, setLocation] = useState(client?.location ?? '');
  const [selectedDays, setSelectedDays] = useState(Array.isArray(client?.days) ? [...client.days] : []);
  const initialTimeDate = parseTimeStringToDate(client?.time);
  const [classTimeDate, setClassTimeDate] = useState(initialTimeDate);
  const [classTimeLabel, setClassTimeLabel] = useState(client?.time ? formatTimeLabel(initialTimeDate) : '');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeBeforePicker, setTimeBeforePicker] = useState(null);
  const [monthlyValue, setMonthlyValue] = useState(
    client?.value !== undefined && client?.value !== null ? String(client.value) : ''
  );
  const [dueDate, setDueDate] = useState(client?.dueDay ?? '');
  const [notificationsOptIn, setNotificationsOptIn] = useState(
    client?.notificationsOptIn !== undefined ? client.notificationsOptIn : true
  );

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setLocation(client.location || '');
      setSelectedDays(Array.isArray(client.days) ? [...client.days] : []);
      const nextDate = parseTimeStringToDate(client.time || '');
      setClassTimeDate(nextDate);
      setClassTimeLabel(client.time ? formatTimeLabel(nextDate) : '');
      setMonthlyValue(
        client.value !== undefined && client.value !== null ? String(client.value) : ''
      );
      setDueDate(client.dueDay || '');
      setNotificationsOptIn(client.notificationsOptIn !== undefined ? client.notificationsOptIn : true);
    }
  }, [client]);

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleTimePickerChange = (event, date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        if (timeBeforePicker) {
          setClassTimeDate(timeBeforePicker.date);
          setClassTimeLabel(timeBeforePicker.label || '');
        }
        setTimeBeforePicker(null);
        setShowTimePicker(false);
        return;
      }

      if (date) {
        setClassTimeDate(date);
        setClassTimeLabel(formatTimeLabel(date));
      }

      setTimeBeforePicker(null);
      setShowTimePicker(false);
      return;
    }

    if (event?.type === 'dismissed') {
      handleTimePickerCancel();
      return;
    }

    if (date) {
      setClassTimeDate(date);
      setClassTimeLabel(formatTimeLabel(date));
    }
  };

  const handleTimePickerCancel = () => {
    if (timeBeforePicker) {
      setClassTimeDate(timeBeforePicker.date);
      setClassTimeLabel(timeBeforePicker.label || '');
    }
    setTimeBeforePicker(null);
    setShowTimePicker(false);
  };

  const handleTimePickerDone = () => {
    if (!classTimeLabel && classTimeDate) {
      setClassTimeLabel(formatTimeLabel(classTimeDate));
    }
    setTimeBeforePicker(null);
    setShowTimePicker(false);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', `Informe o nome do ${term.toLowerCase()}.`);
      return;
    }

    if (!classTimeLabel) {
      Alert.alert('Campo obrigatório', 'Selecione o horário do atendimento.');
      setTimeBeforePicker({ date: new Date(classTimeDate), label: classTimeLabel });
      setShowTimePicker(true);
      return;
    }

    const sanitizedValue = String(monthlyValue).trim();
    if (!sanitizedValue) {
      Alert.alert('Campo obrigatório', 'Informe o valor mensal.');
      return;
    }

    const numericValue = Number(sanitizedValue.replace(',', '.'));
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      Alert.alert('Valor inválido', 'Informe um valor mensal válido.');
      return;
    }

    const newClientData = {
      name,
      location,
      days: selectedDays,
      time: classTimeLabel,
      value: sanitizedValue,
      dueDay: dueDate,
      notificationsOptIn,
    };
    if (isEditing) {
      onUpdateClient?.(client.id, newClientData);
      navigation.goBack();
      return;
    }

    const success = onAddClient ? onAddClient(newClientData) : true;
    if (success) {
      navigation.goBack();
    } else {
      Alert.alert(
        'Limite atingido',
        `A versão gratuita permite cadastrar até ${clientLimit} clientes. Conheça o Plano Pro para liberar cadastros ilimitados.`,
        [
          {
            text: 'Ver Plano Pro',
            onPress: () => navigation.navigate('Subscription', {
              planTier,
              clientCount,
              clientLimit,
            }),
          },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="x" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? `Editar ${term}` : `Novo ${term}`}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Salvar alterações' : 'Salvar'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container}>
        {planTier === 'free' && !isEditing ? (
          <View style={styles.limitNotice}>
            <Text style={styles.limitText}>
              {clientCount < clientLimit
                ? `Versão gratuita: ${clientCount}/${clientLimit} clientes.`
                : 'Limite gratuito atingido. Conheça o Plano Pro para adicionar mais.'}
            </Text>
          </View>
        ) : null}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome do {term}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Local de Atendimento</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dias da Semana</Text>
          <View style={styles.weekdaysContainer}>
            {WEEKDAYS.map(day => (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonSelected]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayText, selectedDays.includes(day) && styles.dayTextSelected]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.label}>Horário</Text>
          <TouchableOpacity
            style={[styles.input, styles.timePickerButton]}
            onPress={() => {
              setTimeBeforePicker({
                date: new Date(classTimeDate),
                label: classTimeLabel,
              });
              setShowTimePicker(true);
            }}
          >
            <Text style={classTimeLabel ? styles.timePickerValue : styles.timePickerPlaceholder}>
              {classTimeLabel || 'Selecionar horário'}
            </Text>
          </TouchableOpacity>
        </View>
        {Platform.OS === 'ios' && showTimePicker ? (
          <View style={styles.iosPickerContainer}>
            <View style={styles.iosPickerHeader}>
              <TouchableOpacity onPress={handleTimePickerCancel}>
                <Text style={styles.iosPickerAction}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTimePickerDone}>
                <Text style={[styles.iosPickerAction, styles.iosPickerActionPrimary]}>Concluir</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={classTimeDate}
              mode="time"
              display="spinner"
              is24Hour
              onChange={handleTimePickerChange}
            />
          </View>
        ) : null}
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
          <Text style={styles.label}>Valor Mensal</Text>
          <TextInput style={styles.input} value={monthlyValue} onChangeText={setMonthlyValue} keyboardType="numeric" placeholder="R$"/>
        </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Data de Pagamento</Text>
          <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} keyboardType="numeric" placeholder="Dia"/>
        </View>
        <View style={[styles.inputGroup, styles.switchGroup]}>
          <Text style={styles.switchLabel}>Receber lembretes</Text>
          <Switch
            value={notificationsOptIn}
            onValueChange={setNotificationsOptIn}
            trackColor={{ false: 'rgba(30,30,30,0.2)', true: COLORS.text }}
            thumbColor={notificationsOptIn ? COLORS.background : '#f4f3f4'}
          />
        </View>
      </ScrollView>
      {Platform.OS === 'android' && showTimePicker ? (
        <DateTimePicker
          value={classTimeDate}
          mode="time"
          display="default"
          is24Hour
          onChange={handleTimePickerChange}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(30,30,30,0.1)' },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  saveButton: { backgroundColor: COLORS.text, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  saveButtonText: { color: COLORS.background, fontWeight: 'bold' },
  container: { padding: 20 },
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 16, color: COLORS.accent, marginBottom: 8 },
  input: { backgroundColor: 'rgba(30,30,30,0.05)', height: 50, borderRadius: 10, paddingHorizontal: 15, fontSize: 16, color: COLORS.text },
  timePickerButton: { justifyContent: 'center' },
  timePickerValue: { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  timePickerPlaceholder: { fontSize: 16, color: COLORS.placeholder },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  weekdaysContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(30,30,30,0.05)' },
  dayButtonSelected: { backgroundColor: COLORS.text },
  dayText: { color: COLORS.text, fontWeight: 'bold' },
  dayTextSelected: { color: COLORS.background },
  switchGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, color: COLORS.accent, marginRight: 12 },
  limitNotice: { backgroundColor: 'rgba(30,30,30,0.08)', borderRadius: 10, padding: 12, marginBottom: 20 },
  limitText: { color: COLORS.accent, fontSize: 14 },
  iosPickerContainer: {
    marginTop: 12,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.08)',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iosPickerAction: { fontSize: 16, color: COLORS.accent },
  iosPickerActionPrimary: { color: COLORS.text, fontWeight: '600' },
});

export default AddClientScreen;
