// /src/screens/AgendaScreen.js

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';

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

// Mapeia nossos dias da semana para os números que a biblioteca de datas usa (0=Dom, 1=Seg, etc.)
const dayMap = { 'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3, 'Qui': 4, 'Sex': 5, 'Sáb': 6 };

const AgendaScreen = ({ clients }) => {
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
      const dayOfWeek = date.getDay();
      
      const appointmentsForDay = clients.filter(client => {
        const clientDays = client.days.map(d => dayMap[d]);
        return clientDays.includes(dayOfWeek);
      });

      if (appointmentsForDay.length > 0) {
        const dateString = date.toISOString().split('T')[0];
        data[dateString] = appointmentsForDay;
      }
    }
    return data;
  }, [clients]);
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
              <View key={app.id} style={styles.appointmentItem}>
                <Text style={styles.appointmentTime}>{app.time}</Text>
                <View style={styles.appointmentDetails}>
                  <Text style={styles.appointmentName}>{app.name}</Text>
                  <Text style={styles.appointmentLocation}>{app.location}</Text>
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
  appointmentItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, marginBottom: 20 },
  appointmentTime: { fontSize: 16, fontWeight: '600', color: COLORS.text, width: 60 },
  appointmentDetails: { flex: 1, borderLeftWidth: 2, borderLeftColor: COLORS.text, paddingLeft: 15 },
  appointmentName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  appointmentLocation: { fontSize: 14, color: COLORS.accent },
  noAppointmentsText: { color: COLORS.placeholder, fontStyle: 'italic', paddingHorizontal: 30, textAlign: 'center', marginTop: 20 },
});


export default AgendaScreen;