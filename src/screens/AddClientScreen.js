// /src/screens/AddClientScreen.js

import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useClientStore } from '../store/useClientStore';
import { buildPhoneE164FromRaw } from '../utils/whatsapp';
import { Card, FormField, FormScreen, SnackbarUndo } from '../components';
import { COLORS as THEME, SHADOWS, TYPOGRAPHY } from '../theme/legacy';

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
const WEEKDAY_ORDER = WEEKDAYS.reduce((acc, day, index) => {
  acc[day] = index;
  return acc;
}, {});
const TIME_SUFFIX = 'h';
const DEFAULT_TIME_HOUR = 9;

const sortWeekdays = (days = []) =>
  [...days].sort((a, b) => {
    const orderA = WEEKDAY_ORDER[a];
    const orderB = WEEKDAY_ORDER[b];
    if (orderA === undefined && orderB === undefined) return String(a).localeCompare(String(b));
    if (orderA === undefined) return 1;
    if (orderB === undefined) return -1;
    return orderA - orderB;
  });

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
  const [selectedDays, setSelectedDays] = useState(
    Array.isArray(editingClient?.days) ? sortWeekdays(editingClient.days) : []
  );
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
  const [isSaving, setIsSaving] = useState(false);
  const [editUndoPayload, setEditUndoPayload] = useState(null);
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name || '');
      setLocation(editingClient.location || '');
      setSelectedDays(Array.isArray(editingClient.days) ? sortWeekdays(editingClient.days) : []);
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
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        setDayTimes((current) => {
          if (!current[day]) return current;
          const next = { ...current };
          delete next[day];
          return next;
        });
        return prev.filter((d) => d !== day);
      }
      return sortWeekdays([...prev, day]);
    });
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

  const handleSave = async () => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);

    try {
      if (!name.trim()) {
        Alert.alert('Campo obrigatório', `Informe o nome do ${term.toLowerCase()}.`);
        return;
      }

      const hasDefaultTime = Boolean(classTimeLabel);
      const missingDayTimes = selectedDays.filter((day) => !dayTimes[day]);
      const hasAnySelectedDay = selectedDays.length > 0;
      const hasCompleteDayTimes = hasAnySelectedDay && missingDayTimes.length === 0;

      if (!hasDefaultTime && !hasCompleteDayTimes) {
        const message = hasAnySelectedDay
          ? 'Defina um horário padrão ou preencha horários para todos os dias selecionados.'
          : 'Selecione o horário do atendimento.';
        Alert.alert('Campo obrigatório', message);
        if (!hasAnySelectedDay) {
          setPickerContext({ type: 'default', day: null });
          setTimeBeforePicker({ date: new Date(classTimeDate), label: classTimeLabel });
          setShowTimePicker(true);
        }
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

      const phoneE164 = buildPhoneE164FromRaw(phoneDigits);

      const orderedSelectedDays = sortWeekdays(selectedDays);

      const newClientData = {
        name,
        location,
        phone,
        phoneRaw: phoneDigits,
        phoneE164,
        days: orderedSelectedDays,
        time: classTimeLabel,
        value: currencyNumber,
        valueFormatted: monthlyValue,
        dueDay: due,
        dayTimes: orderedSelectedDays.reduce((acc, day) => {
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
          const previousClientSnapshot = { ...editingClient };
          await Promise.resolve(updateClient(editingClient.id, newClientData));
          setEditUndoPayload({
            clientId: editingClient.id,
            previousClient: previousClientSnapshot,
          });
        }
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

      Promise.resolve(addClient(newClientData)).catch(() => {});
      navigation.goBack();
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <>
      <FormScreen
        title={isEditing ? `Editar ${term}` : `Novo ${term}`}
        navigation={navigation}
        onSubmit={handleSave}
        submitLabel={isEditing ? 'Salvar alterações' : 'Salvar'}
        loading={isSaving}
        submitDisabled={Boolean(editUndoPayload)}
      >
        <View style={styles.container}>
          {isFreePlan && !isEditing ? (
            <Card style={styles.limitNotice}>
              <Text style={styles.limitText}>
                {clientCount < clientLimit
                  ? `Versão gratuita: ${clientCount}/${clientLimit} clientes.`
                  : 'Limite gratuito atingido. Conheça o Plano Pro para adicionar mais.'}
              </Text>
            </Card>
          ) : null}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Dados do {term}</Text>
            <FormField label={`Nome do ${term}`} style={styles.field}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={`Nome do ${term.toLowerCase()}`}
                placeholderTextColor={COLORS.placeholder}
              />
            </FormField>
            <FormField label="Local de atendimento" style={styles.field}>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Ex: Studio Centro"
                placeholderTextColor={COLORS.placeholder}
              />
            </FormField>
            <FormField
              label="Telefone *"
              style={styles.fieldLast}
              helper="Com DDD, para confirmação e cobrança no WhatsApp."
            >
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(text) => setPhone(formatPhoneBR(text))}
                keyboardType="phone-pad"
                placeholder="(99) 99999-9999"
                placeholderTextColor={COLORS.placeholder}
              />
            </FormField>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Agenda</Text>
            <FormField label="Dias da semana" style={styles.field}>
              <View style={styles.weekdaysContainer}>
                {WEEKDAYS.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonSelected]}
                    onPress={() => toggleDay(day)}
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar dia ${day}`}
                  >
                    <Text style={[styles.dayText, selectedDays.includes(day) && styles.dayTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>

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
                        accessibilityRole="button"
                        accessibilityLabel={`Definir horário para ${day}`}
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

            <FormField label="Horário padrão (opcional)" style={styles.fieldLast}>
              <TouchableOpacity
                style={[styles.input, styles.timePickerButton]}
                onPress={openDefaultTimePicker}
                accessibilityRole="button"
                accessibilityLabel="Selecionar horário padrão"
              >
                <Text style={classTimeLabel ? styles.timePickerValue : styles.timePickerPlaceholder}>
                  {classTimeLabel || 'Selecionar horário'}
                </Text>
              </TouchableOpacity>
            </FormField>

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
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Financeiro</Text>
            <View style={styles.row}>
              <FormField label="Valor mensal" style={[styles.field, styles.rowField]}>
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
                  placeholderTextColor={COLORS.placeholder}
                />
              </FormField>
              <FormField label="Data de pagamento" style={[styles.field, styles.rowField]}>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={(text) => {
                    const digits = onlyDigits(text).slice(0, 2);
                    setDueDate(digits);
                  }}
                  keyboardType="numeric"
                  placeholder="Dia (1-31)"
                  placeholderTextColor={COLORS.placeholder}
                />
              </FormField>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notificações</Text>
            <View style={[styles.switchGroup, styles.field]}>
              <Text style={styles.switchLabel}>Notificar pagamento</Text>
              <Switch
                value={notificationsPaymentOptIn}
                onValueChange={setNotificationsPaymentOptIn}
                trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
                thumbColor={notificationsPaymentOptIn ? COLORS.background : '#f4f3f4'}
              />
            </View>
            <View style={[styles.switchGroup, styles.fieldLast]}>
              <Text style={styles.switchLabel}>Lembretes de compromissos</Text>
              <Switch
                value={notificationsScheduleOptIn}
                onValueChange={setNotificationsScheduleOptIn}
                trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
                thumbColor={notificationsScheduleOptIn ? COLORS.background : '#f4f3f4'}
              />
            </View>
          </Card>
        </View>
      </FormScreen>
      {Platform.OS === 'android' && showTimePicker ? (
        <DateTimePicker
          value={classTimeDate}
          mode="time"
          display="default"
          is24Hour
          onChange={handleTimePickerChange}
        />
      ) : null}

      <SnackbarUndo
        visible={Boolean(editUndoPayload)}
        message="Cobrança editada. Deseja desfazer?"
        onUndo={async () => {
          if (!editUndoPayload?.clientId || !editUndoPayload?.previousClient) {
            setEditUndoPayload(null);
            return;
          }
          await Promise.resolve(updateClient(editUndoPayload.clientId, editUndoPayload.previousClient));
          setEditUndoPayload(null);
        }}
        onDismiss={() => {
          setEditUndoPayload(null);
          navigation.goBack();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 4, gap: 14 },
  sectionCard: {
    borderRadius: 18,
    ...SHADOWS.small,
  },
  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
    marginBottom: 14,
  },
  field: { marginBottom: 14 },
  fieldLast: { marginBottom: 0 },
  input: {
    backgroundColor: COLORS.background,
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timePickerButton: { justifyContent: 'center' },
  timePickerValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  timePickerPlaceholder: { ...TYPOGRAPHY.body, color: COLORS.placeholder },
  row: { flexDirection: 'row', gap: 10 },
  rowField: { flex: 1, minWidth: 120 },
  weekdaysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayButton: {
    minWidth: 44,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
  },
  dayButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayText: { ...TYPOGRAPHY.caption, color: COLORS.text, fontWeight: '700' },
  dayTextSelected: { color: COLORS.textOnPrimary },
  limitNotice: {
    backgroundColor: 'rgba(43,108,176,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(43,108,176,0.22)',
  },
  limitText: { ...TYPOGRAPHY.body, color: COLORS.text },
  iosPickerContainer: {
    marginTop: 12,
    backgroundColor: COLORS.background,
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
  iosPickerAction: { ...TYPOGRAPHY.bodyMedium, color: COLORS.accent },
  iosPickerActionPrimary: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  dayTimesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayTimeButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.text },
  dayTimeReset: { marginLeft: 10, padding: 6, borderRadius: 12, backgroundColor: COLORS.border },
  switchGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  switchLabel: { ...TYPOGRAPHY.subtitle, color: COLORS.accent, marginRight: 12 },
});

export default AddClientScreen;
