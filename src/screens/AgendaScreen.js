// /src/screens/AgendaScreen.js

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Feather as Icon } from '@expo/vector-icons';

import { getDateKey } from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';

// ... (LocaleConfig e COLORS continuam os mesmos)
LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  monthNamesShort: ['Jan.','Fev.','Mar','Abr','Mai','Jun','Jul.','Ago','Set.','Out.','Nov.','Dez.'],
  dayNames: ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'],
  dayNamesShort: ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
};

const AgendaScreen = ({ clients, scheduleOverrides = {} }) => {
  const [selectedDate, setSelectedDate] = useState('');

  // =======================================================
  // TRANSFORMA A LISTA DE CLIENTES EM DADOS PARA O CALENDÁRIO
  // =======================================================
  const appointmentsData = useMemo(() => {
    const data = {};
    const today = new Date();
    // Olhamos para os próximos 90 dias
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const appointmentsForDay = getAppointmentsForDate({ date, clients, overrides: scheduleOverrides });

      if (appointmentsForDay.length > 0) {
        const dateString = getDateKey(date);
        data[dateString] = appointmentsForDay;
      }
    }
    return data;
  }, [clients, scheduleOverrides]);
  // =======================================================
  
  const selectedAppointments = appointmentsData[selectedDate] || [];
  const todayString = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
      </View>
      <Calendar
        current={todayString}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          ...Object.keys(appointmentsData).reduce((obj, date) => {
            obj[date] = { marked: true, dotColor: COLORS.text };
            return obj;
          }, {}),
          [selectedDate]: { selected: true, selectedColor: COLORS.text, marked: true, dotColor: 'white' },
          [todayString]: { today: true }
        }}
        theme={{
          backgroundColor: COLORS.background,
          calendarBackground: COLORS.background,
          textSectionTitleColor: COLORS.accent,
          selectedDayBackgroundColor: COLORS.text,
          selectedDayTextColor: '#ffffff',
          todayTextColor: COLORS.text,
          dayTextColor: COLORS.text,
          textDisabledColor: COLORS.placeholder,
          arrowColor: COLORS.text,
          monthTextColor: COLORS.text,
          textDayFontFamily: 'System',
          textMonthFontFamily: 'System',
          textDayHeaderFontFamily: 'System',
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
      />
      
      {selectedDate ? (
        <ScrollView style={styles.appointmentsList}>
          {selectedAppointments.length > 0 ? (
            selectedAppointments.map(app => (
              <View key={app.id} style={styles.appointmentCard}>
                <View style={styles.appointmentHeader}>
                  <View style={styles.appointmentTitleBlock}>
                    <Text style={styles.appointmentName}>{app.name}</Text>
                    {app.status && app.status !== 'scheduled' ? (
                      <View
                        style={[
                          styles.statusBadge,
                          app.status === 'done' ? styles.statusBadgeDone : styles.statusBadgePending,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {app.status === 'done'
                            ? 'Concluído'
                            : app.status === 'rescheduled'
                              ? 'Adiado'
                              : app.status}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.timePill}>
                    <Icon name="clock" size={16} color="#1E1E1E" />
                    <Text style={styles.timePillText}>{app.time || '--:--'}</Text>
                  </View>
                </View>

                <View style={styles.appointmentBody}>
                  <View style={styles.infoRow}>
                    <Icon name="map-pin" size={16} color="rgba(30,30,30,0.6)" />
                    <Text style={styles.appointmentLocation}>{app.location}</Text>
                  </View>
                  {app.note ? (
                    <View style={[styles.infoRow, styles.noteRow]}>
                      <Icon name="clipboard" size={16} color="rgba(30,30,30,0.6)" />
                      <Text style={styles.appointmentNote}>{app.note}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noAppointmentsText}>Nenhum compromisso para este dia.</Text>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

// ... Estilos (nenhuma mudança aqui)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 30, paddingTop: 30, paddingBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  appointmentsList: { marginTop: 20, flex: 1 },
  appointmentCard: {
    marginHorizontal: 30,
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.06)',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentTitleBlock: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  appointmentName: { fontSize: 16, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  statusBadge: { marginLeft: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeDone: { backgroundColor: '#5CB85C' },
  statusBadgePending: { backgroundColor: '#F0AD4E' },
  statusBadgeText: { color: COLORS.background, fontSize: 11, fontWeight: '700' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(30,30,30,0.05)',
  },
  timePillText: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: COLORS.text },
  appointmentBody: { marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  appointmentLocation: { marginLeft: 8, fontSize: 13, color: COLORS.accent, flexShrink: 1 },
  appointmentNote: { marginLeft: 8, fontSize: 13, color: COLORS.placeholder, flexShrink: 1 },
  noteRow: { marginBottom: 0 },
  noAppointmentsText: { color: COLORS.placeholder, fontStyle: 'italic', paddingHorizontal: 30, textAlign: 'center', marginTop: 20 },
});


export default AgendaScreen;
