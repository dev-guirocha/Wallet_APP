// /src/screens/AddClientScreen.js

import React, { useEffect, useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useClientStore } from '../store/useClientStore';
import { COLORS as THEME, TYPOGRAPHY } from '../constants/theme';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  placeholder: THEME.textSecondary,
  accent: THEME.textSecondary,
  border: THEME.border,
  primary: THEME.primary,
  textOnPrimary: THEME.textOnPrimary,
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

// --- Helpers de máscara e normalização ---
const onlyDigits = (str = '') => String(str).replace(/\D+/g, '');

const formatCurrencyBRFromDigits = (digits) => {
  // digits: string só com números (centavos)
  const clean = onlyDigits(digits);
  const int = clean.length ? parseInt(clean, 10) : 0;
  const cents = (int / 100).toFixed(2); // 1234 -> "12.34"
  // Converte para formato brasileiro "12,34" com milhares
  const [intPart, decPart] = cents.split('.');
  const intPartBR = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${intPartBR},${decPart}`;
};

const unformatCurrencyToNumber = (value) => {
  // Converte "R$ 1.234,56" -> 1234.56 (Number)
  if (!value) return 0;
  const clean = onlyDigits(value);
  const int = clean.length ? parseInt(clean, 10) : 0;
  return int / 100;
};

const formatPhoneBR = (value) => {
  const d = onlyDigits(value).slice(0, 11); // até 11 dígitos
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; // celular 11 dígitos
};

const FREE_CLIENT_LIMIT = 3;

const AddClientScreen = ({ navigation, route, defaultClientTerm = 'Cliente' }) => {
  const storeClientTerm = useClientStore((state) => state.clientTerm);
  const addClient = useClientStore((state) => state.addClient);
  const updateClient = useClientStore((state) => state.updateClient);
  const clientCount = useClientStore((state) => state.clients.length);
  const planTier = useClientStore((state) => state.planTier);

  const { clientTerm, clientToEdit, clientId } = route.params ?? {};
  const editingClient = useClientStore((state) =>
    state.clients.find((client) => client.id === clientId || client.id === clientToEdit?.id)
  ) || clientToEdit || null;
  const term = clientTerm || storeClientTerm || defaultClientTerm;
  const isEditing = !!editingClient;
  const isFreePlan = planTier !== 'pro';
  const clientLimit = FREE_CLIENT_LIMIT;

  const [name, setName] = useState(editingClient?.name ?? '');
  const [location, setLocation] = useState(editingClient?.location ?? '');
  const [selectedDays, setSelectedDays] = useState(Array.isArray(editingClient?.days) ? [...editingClient.days] : []);
  const [dayTimes, setDayTimes] = useState(editingClient?.dayTimes ? { ...editingClient.dayTimes } : {});
  const initialTimeDate = parseTimeStringToDate(editingClient?.time);
  const [classTimeDate, setClassTimeDate] = useState(initialTimeDate);
  const [classTimeLabel, setClassTimeLabel] = useState(editingClient?.time ? formatTimeLabel(initialTimeDate) : '');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeBeforePicker, setTimeBeforePicker] = useState(null);
  const [pickerContext, setPickerContext] = useState({ type: 'default', day: null });
  const [monthlyValue, setMonthlyValue] = useState(
    editingClient?.value !== undefined && editingClient?.value !== null
      ? formatCurrencyBRFromDigits(String(Math.round(Number(editingClient.value) * 100)))
      : ''
  );
  const [dueDate, setDueDate] = useState(editingClient?.dueDay ? String(editingClient.dueDay) : '');
  const [phone, setPhone] = useState(editingClient?.phone ?? '');
  const [notificationsPaymentOptIn, setNotificationsPaymentOptIn] = useState(
    editingClient?.notificationsPaymentOptIn !== undefined ? editingClient.notificationsPaymentOptIn : true,
  );
  const [notificationsScheduleOptIn, setNotificationsScheduleOptIn] = useState(
    editingClient?.notificationsScheduleOptIn !== undefined ? editingClient.notificationsScheduleOptIn : true,
  );

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name || '');
      setLocation(editingClient.location || '');
      setSelectedDays(Array.isArray(editingClient.days) ? [...editingClient.days] : []);
      const nextDate = parseTimeStringToDate(editingClient.time || '');
      setClassTimeDate(nextDate);
      setClassTimeLabel(editingClient.time ? formatTimeLabel(nextDate) : '');
      setMonthlyValue(
        editingClient.value !== undefined && editingClient.value !== null
          ? formatCurrencyBRFromDigits(String(Math.round(Number(editingClient.value) * 100)))
          : ''
      );
      setDueDate(editingClient.dueDay !== undefined && editingClient.dueDay !== null ? String(editingClient.dueDay) : '');
      setDayTimes(editingClient.dayTimes ? { ...editingClient.dayTimes } : {});
      setNotificationsPaymentOptIn(
        editingClient.notificationsPaymentOptIn !== undefined ? editingClient.notificationsPaymentOptIn : true,
      );
      setNotificationsScheduleOptIn(
        editingClient.notificationsScheduleOptIn !== undefined ? editingClient.notificationsScheduleOptIn : true,
      );
      setPhone(editingClient.phone || '');
    }
  }, [editingClient, clientToEdit]);

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
      setDayTimes((prev) => {
        if (!prev[day]) return prev;
        const next = { ...prev };
        delete next[day];
        return next;
      });
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleTimePickerChange = (event, date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        if (timeBeforePicker) {
          setClassTimeDate(timeBeforePicker.date);
          if (pickerContext.type === 'default') {
            setClassTimeLabel(timeBeforePicker.label || '');
          }
          if (pickerContext.type === 'day' && pickerContext.day) {
            setDayTimes((prev) => {
              if (!timeBeforePicker.label) {
                const next = { ...prev };
                delete next[pickerContext.day];
                return next;
              }
              return { ...prev, [pickerContext.day]: timeBeforePicker.label };
            });
          }
        }
        setTimeBeforePicker(null);
        setShowTimePicker(false);
        setPickerContext({ type: 'default', day: null });
        return;
      }

      if (date) {
        setClassTimeDate(date);
        if (pickerContext.type === 'default') {
          setClassTimeLabel(formatTimeLabel(date));
        } else if (pickerContext.type === 'day' && pickerContext.day) {
          const label = formatTimeLabel(date);
          setDayTimes((prev) => ({ ...prev, [pickerContext.day]: label }));
        }
      }

      setTimeBeforePicker(null);
      setShowTimePicker(false);
      setPickerContext({ type: 'default', day: null });
      return;
    }

    if (event?.type === 'dismissed') {
      handleTimePickerCancel();
      return;
    }

    if (date) {
      setClassTimeDate(date);
      if (pickerContext.type === 'default') {
        setClassTimeLabel(formatTimeLabel(date));
      }
    }
  };

  const handleTimePickerCancel = () => {
    if (timeBeforePicker) {
      setClassTimeDate(timeBeforePicker.date);
      if (pickerContext.type === 'default') {
        setClassTimeLabel(timeBeforePicker.label || '');
      }
      if (pickerContext.type === 'day' && pickerContext.day) {
        setDayTimes((prev) => {
          if (!timeBeforePicker.label) {
            const next = { ...prev };
            delete next[pickerContext.day];
            return next;
          }
          return { ...prev, [pickerContext.day]: timeBeforePicker.label };
        });
      }
    }
    setTimeBeforePicker(null);
    setShowTimePicker(false);
    setPickerContext({ type: 'default', day: null });
  };

  const handleTimePickerDone = () => {
    if (pickerContext.type === 'default') {
      if (!classTimeLabel && classTimeDate) {
        setClassTimeLabel(formatTimeLabel(classTimeDate));
      }
    } else if (pickerContext.type === 'day' && pickerContext.day) {
      if (classTimeDate) {
        const label = formatTimeLabel(classTimeDate);
        setDayTimes((prev) => ({ ...prev, [pickerContext.day]: label }));
      }
    }
    setTimeBeforePicker(null);
    setShowTimePicker(false);
    setPickerContext({ type: 'default', day: null });
  };

  const openDefaultTimePicker = () => {
    setPickerContext({ type: 'default', day: null });
    setTimeBeforePicker({
      date: new Date(classTimeDate),
      label: classTimeLabel,
    });
    setShowTimePicker(true);
  };

  const openDayTimePicker = (day) => {
    const existing = dayTimes[day];
    const baseDate = parseTimeStringToDate(existing || classTimeLabel || '');
    setClassTimeDate(baseDate);
    setPickerContext({ type: 'day', day });
    setTimeBeforePicker({
      date: new Date(baseDate),
      label: existing || '',
    });
    setShowTimePicker(true);
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

    const currencyNumber = unformatCurrencyToNumber(monthlyValue);
    if (!Number.isFinite(currencyNumber) || currencyNumber <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor mensal válido.');
      return;
    }

    const due = parseInt(onlyDigits(dueDate), 10);
    if (!Number.isFinite(due) || due < 1 || due > 31) {
      Alert.alert('Data de pagamento inválida', 'Informe um dia entre 1 e 31.');
      return;
    }

    const phoneDigits = onlyDigits(phone);
    if (!phoneDigits || (phoneDigits.length !== 10 && phoneDigits.length !== 11)) {
      Alert.alert('Telefone obrigatório', 'Informe um telefone válido com DDD.');
      return;
    }
    // Validação de DDD brasileiro e regra simples de celular (11 dígitos começa com 9)
    const validDDDs = new Set(['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99']);
    const ddd = phoneDigits.slice(0, 2);
    if (!validDDDs.has(ddd)) {
      Alert.alert('DDD inválido', 'Informe um DDD válido do Brasil.');
      return;
    }
    if (phoneDigits.length === 11 && phoneDigits[2] !== '9') {
      Alert.alert('Telefone inválido', 'Celular com 11 dígitos deve começar com 9.');
      return;
    }

    const newClientData = {
      name,
      location,
      phone,
      phoneRaw: phoneDigits,
      days: selectedDays,
      time: classTimeLabel,
      value: currencyNumber,
      valueFormatted: monthlyValue,
      dueDay: due,
      dayTimes: selectedDays.reduce((acc, day) => {
        if (dayTimes[day]) {
          acc[day] = dayTimes[day];
        }
        return acc;
      }, {}),
      notificationsPaymentOptIn,
      notificationsScheduleOptIn,
    };
    if (isEditing) {
      if (editingClient?.id) {
        updateClient(editingClient.id, newClientData);
      }
      navigation.goBack();
      return;
    }

    if (isFreePlan && clientCount >= clientLimit) {
      Alert.alert(
        'Limite atingido',
        `A versão gratuita permite cadastrar até ${clientLimit} clientes. Conheça o plano pago para liberar cadastros ilimitados.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver planos', onPress: () => navigation.navigate('PlanDetails') },
        ],
      );
      return;
    }

    addClient(newClientData);
    navigation.goBack();
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
        {isFreePlan && !isEditing ? (
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
        <Text style={styles.label}>Telefone *</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(text) => setPhone(formatPhoneBR(text))}
          keyboardType="phone-pad"
          placeholder="(99) 99999-9999"
        />
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
        {selectedDays.length > 0 ? (
          <View style={styles.dayTimesContainer}>
            <Text style={styles.dayTimesTitle}>Horários por dia (opcional)</Text>
            {selectedDays.map((day) => {
              const overrideLabel = dayTimes[day];
              const displayLabel = overrideLabel || classTimeLabel || 'Selecionar';
              return (
                <View key={day} style={styles.dayTimeRow}>
                  <Text style={styles.dayTimeLabel}>{day}</Text>
                  <TouchableOpacity
                    style={styles.dayTimeButton}
                    onPress={() => openDayTimePicker(day)}
                  >
                    <Text style={styles.dayTimeButtonText}>{displayLabel}</Text>
                    <Icon name="clock" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                  {overrideLabel ? (
                    <TouchableOpacity
                      style={styles.dayTimeReset}
                      onPress={() =>
                        setDayTimes((prev) => {
                          const next = { ...prev };
                          delete next[day];
                          return next;
                        })
                      }
                    >
                      <Icon name="x" size={16} color={COLORS.placeholder} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.label}>Horário padrão</Text>
          <TouchableOpacity
            style={[styles.input, styles.timePickerButton]}
            onPress={openDefaultTimePicker}
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
          <TextInput
            style={styles.input}
            value={monthlyValue}
            onChangeText={(text) => {
              const digits = onlyDigits(text);
              const formatted = formatCurrencyBRFromDigits(digits);
              setMonthlyValue(formatted);
            }}
            keyboardType="numeric"
            placeholder="R$ 0,00"
            />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Data de Pagamento</Text>
          <TextInput
            style={styles.input}
            value={dueDate}
            onChangeText={(text) => {
              const digits = onlyDigits(text).slice(0, 2);
              setDueDate(digits);
            }}
            keyboardType="numeric"
            placeholder="Dia (1-31)"
            />
          </View>
        <View style={[styles.inputGroup, styles.switchGroup]}>
          <Text style={styles.switchLabel}>Notificar pagamento</Text>
          <Switch
            value={notificationsPaymentOptIn}
            onValueChange={setNotificationsPaymentOptIn}
            trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
            thumbColor={notificationsPaymentOptIn ? COLORS.background : '#f4f3f4'}
          />
        </View>
        <View style={[styles.inputGroup, styles.switchGroup]}>
          <Text style={styles.switchLabel}>Lembretes de compromissos</Text>
          <Switch
            value={notificationsScheduleOptIn}
            onValueChange={setNotificationsScheduleOptIn}
            trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
            thumbColor={notificationsScheduleOptIn ? COLORS.background : '#f4f3f4'}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  saveButton: { backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  saveButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
  container: { padding: 20 },
  inputGroup: { marginBottom: 25 },
  label: { ...TYPOGRAPHY.subtitle, color: COLORS.accent, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timePickerButton: { justifyContent: 'center' },
  timePickerValue: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  timePickerPlaceholder: { ...TYPOGRAPHY.subtitle, color: COLORS.placeholder },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  weekdaysContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.text },
  dayTextSelected: { color: COLORS.textOnPrimary },
  limitNotice: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  limitText: { ...TYPOGRAPHY.body, color: COLORS.accent },
  iosPickerContainer: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iosPickerAction: { ...TYPOGRAPHY.subtitle, color: COLORS.accent },
  iosPickerActionPrimary: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  dayTimesContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayTimesTitle: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginBottom: 12 },
  dayTimeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dayTimeLabel: { width: 60, ...TYPOGRAPHY.buttonSmall, color: COLORS.text },
  dayTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayTimeButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.text },
  dayTimeReset: { marginLeft: 10, padding: 6, borderRadius: 12, backgroundColor: COLORS.border },
  switchGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { ...TYPOGRAPHY.subtitle, color: COLORS.accent, marginRight: 12 },
});

export default AddClientScreen;
