// /src/screens/AgendaScreen.js

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Feather as Icon } from '@expo/vector-icons';

import { getDateKey } from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';
import { useClientStore } from '../store/useClientStore';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  monthNamesShort: ['Jan.','Fev.','Mar','Abr','Mai','Jun','Jul.','Ago','Set.','Out.','Nov.','Dez.'],
  dayNames: ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'],
  dayNamesShort: ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const AgendaScreen = ({ scheduleOverrides = {} }) => {
  const clients = useClientStore((state) => state.clients);
  const [selectedDate, setSelectedDate] = useState('');

  const appointmentsData = useMemo(() => {
    const data = {};
    const today = new Date();
    for (let i = 0; i < 90; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const appointmentsForDay = getAppointmentsForDate({ date, clients, overrides: scheduleOverrides });
      if (appointmentsForDay.length > 0) {
        data[getDateKey(date)] = appointmentsForDay;
      }
    }
    return data;
  }, [clients, scheduleOverrides]);

  const selectedAppointments = appointmentsData[selectedDate] || [];
  const todayString = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          current={todayString}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={{
            ...Object.keys(appointmentsData).reduce((obj, date) => {
              obj[date] = { marked: true, dotColor: COLORS.primary };
              return obj;
            }, {}),
            [selectedDate]: { selected: true, selectedColor: COLORS.primary, marked: true, dotColor: 'white' },
            [todayString]: { today: true, todayTextColor: COLORS.primary },
          }}
          theme={{
            backgroundColor: COLORS.surface,
            calendarBackground: COLORS.surface,
            textSectionTitleColor: COLORS.textSecondary,
            selectedDayBackgroundColor: COLORS.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: COLORS.primary,
            dayTextColor: COLORS.textPrimary,
            textDisabledColor: '#D1D5DB',
            arrowColor: COLORS.primary,
            monthTextColor: COLORS.textPrimary,
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '500',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
          }}
          style={styles.calendar}
        />
      </View>

      <ScrollView style={styles.listContainer}>
        {selectedDate ? (
          <>
            <Text style={styles.dateHeader}>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            {selectedAppointments.length > 0 ? (
              selectedAppointments.map((appointment) => (
                <View key={appointment.id} style={styles.card}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeText}>{appointment.time}</Text>
                  </View>
                  <View style={styles.infoBlock}>
                    <Text style={styles.clientName}>{appointment.name}</Text>
                    <View style={styles.row}>
                      <Icon name="map-pin" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.location}>{appointment.location}</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum compromisso.</Text>
            )}
          </>
        ) : (
          <Text style={styles.placeholderText}>Selecione um dia no calendario.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 24, paddingBottom: 10 },
  title: { ...TYPOGRAPHY.display, color: COLORS.textPrimary },
  calendarContainer: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  calendar: { borderRadius: 16, backgroundColor: COLORS.surface },
  listContainer: { flex: 1, paddingHorizontal: 24, marginTop: 20 },
  dateHeader: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 12, textTransform: 'capitalize' },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  timeBlock: { width: 50, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border, marginRight: 12 },
  timeText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  infoBlock: { flex: 1, justifyContent: 'center' },
  clientName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  location: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginLeft: 4 },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: 20 },
  placeholderText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
});

export default AgendaScreen;
