// /src/screens/HomeScreen.js

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
};

const HomeScreen = ({ clientTerm, navigation, clients }) => {
  const [fabMenuVisible, setFabMenuVisible] = useState(false);

  // =======================================================
  // CÁLCULOS DINÂMICOS BASEADOS NOS DADOS REAIS
  // =======================================================
  const financialData = useMemo(() => {
    const totalToReceive = clients.reduce((sum, client) => sum + parseFloat(client.value || 0), 0);
    // Lógica de "recebido" virá quando implementarmos a função de pagamento
    const received = 0; 
    const pending = totalToReceive - received;
    const progress = totalToReceive > 0 ? (received / totalToReceive) * 100 : 0;

    return {
      totalToReceive: totalToReceive.toFixed(2),
      received: received.toFixed(2),
      pending: pending.toFixed(2),
      progress: `${progress}%`,
    };
  }, [clients]);

  const todayAppointments = useMemo(() => {
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3); // Ex: 'Seg'
    return clients.filter(client => client.days.includes(today));
  }, [clients]);
  // =======================================================

  const getFormattedDate = () => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const date = new Date().toLocaleDateString('pt-BR', options);
    return date.charAt(0).toUpperCase() + date.slice(1);
  };
  
  const navigateAndCloseMenu = (screen) => {
    setFabMenuVisible(false);
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Bom dia, Guilherme</Text>
          <Text style={styles.date}>{getFormattedDate()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>VISÃO DO MÊS</Text>
          <Text style={styles.receivedValue}>R$ {financialData.received}</Text>
          <Text style={styles.receivedLabel}>Recebido até o momento</Text>
          
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: financialData.progress }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>Total a Receber: R$ {financialData.totalToReceive}</Text>
            <Text style={styles.progressText}>Pendente: R$ {financialData.pending}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRÓXIMOS PAGAMENTOS</Text>
          <FlatList
            data={clients} // Usa a lista de clientes real
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pill}>
                <Text style={styles.pillText}>{item.name}</Text>
                <Text style={styles.pillSubText}>Vence dia {item.dueDay}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPROMISSOS DE HOJE</Text>
          {todayAppointments.length > 0 ? (
            todayAppointments.map(item => (
              <View key={item.id} style={styles.appointmentItem}>
                <Text style={styles.appointmentTime}>{item.time}</Text>
                <View style={styles.appointmentDetails}>
                  <Text style={styles.appointmentName}>{item.name}</Text>
                  <Text style={styles.appointmentLocation}>{item.location}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noAppointmentsText}>Nenhum compromisso hoje.</Text>
          )}
        </View>
      </ScrollView>

      {/* Menu do FAB */}
      {fabMenuVisible && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => console.log('Agendar pressionado')}>
            <Text style={styles.fabMenuText}>Agendar</Text>
            <Icon name="calendar" size={20} color={COLORS.background} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => navigateAndCloseMenu('AddClient')}>
            <Text style={styles.fabMenuText}>Novo {clientTerm}</Text>
            <Icon name="user-plus" size={20} color={COLORS.background} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setFabMenuVisible(!fabMenuVisible)}>
        <Icon name={fabMenuVisible ? "x" : "plus"} size={28} color={COLORS.background} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ... Estilos (nenhuma mudança aqui)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  header: { padding: 30, paddingBottom: 15 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  date: { fontSize: 16, color: COLORS.accent, marginTop: 4 },
  card: { backgroundColor: 'rgba(30,30,30,0.05)', borderRadius: 20, padding: 25, marginHorizontal: 30, marginBottom: 30 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, marginBottom: 10 },
  receivedValue: { fontSize: 32, fontWeight: 'bold', color: COLORS.text },
  receivedLabel: { fontSize: 16, color: COLORS.accent, marginBottom: 20 },
  progressContainer: { height: 8, backgroundColor: 'rgba(30,30,30,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: COLORS.text, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressText: { fontSize: 12, color: COLORS.accent },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, marginBottom: 15, marginLeft: 30 },
  pill: { backgroundColor: 'rgba(30,30,30,0.05)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, marginLeft: 15, alignItems: 'center' },
  pillText: { color: COLORS.text, fontWeight: '600' },
  pillSubText: { color: COLORS.accent, fontSize: 12, marginTop: 2 },
  appointmentItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, marginBottom: 20 },
  appointmentTime: { fontSize: 16, fontWeight: '600', color: COLORS.text, width: 60 },
  appointmentDetails: { flex: 1, borderLeftWidth: 2, borderLeftColor: COLORS.text, paddingLeft: 15 },
  appointmentName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  appointmentLocation: { fontSize: 14, color: COLORS.accent },
  noAppointmentsText: { color: COLORS.placeholder, textAlign: 'center', paddingHorizontal: 30 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { height: 2, width: 0 } },
  fabMenu: { position: 'absolute', bottom: 100, right: 30, backgroundColor: COLORS.text, borderRadius: 15, elevation: 5, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { height: 2, width: 0 } },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20 },
  fabMenuText: { color: COLORS.background, fontSize: 16, fontWeight: '600', marginRight: 10 },
});


export default HomeScreen;