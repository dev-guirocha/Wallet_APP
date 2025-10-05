// /src/screens/HomeScreen.js

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import { formatCurrency, getReadableMonth, getNextDueDateFromDay } from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
};

const HomeScreen = ({
  clientTerm,
  navigation,
  clients,
  activeMonth,
  onToggleClientPayment,
  planTier = 'free',
  clientLimit = 3,
}) => {
  const [selectedPayment, setSelectedPayment] = useState(null);

  const monthLabel = useMemo(() => getReadableMonth(activeMonth), [activeMonth]);

  const financialData = useMemo(() => {
    const totals = clients.reduce(
      (acc, client) => {
        const numericValue = Number(client.value || 0);
        acc.expected += numericValue;
        if (client.paymentStatus === 'paid') {
          acc.received += numericValue;
        } else {
          acc.pending += numericValue;
        }
        return acc;
      },
      { expected: 0, received: 0, pending: 0 },
    );

    const progress = totals.expected > 0 ? totals.received / totals.expected : 0;

    return {
      ...totals,
      progress,
    };
  }, [clients]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return getAppointmentsForDate({ date: today, clients });
  }, [clients]);

  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfHorizon = new Date(startOfToday);
    endOfHorizon.setDate(startOfToday.getDate() + 7);
    endOfHorizon.setHours(23, 59, 59, 999);

    return clients
      .filter((client) => client.paymentStatus !== 'paid')
      .map((client) => {
        const nextDueDate = client.dueDay ? getNextDueDateFromDay(client.dueDay, startOfToday, client.time) : null;
        return {
          ...client,
          nextDueDate,
        };
      })
      .filter((client) => {
        if (!client.dueDay) return false;
        if (!client.nextDueDate) return false;
        return client.nextDueDate >= startOfToday && client.nextDueDate <= endOfHorizon;
      })
      .sort((a, b) => {
        if (!a.nextDueDate) return 1;
        if (!b.nextDueDate) return -1;
        return a.nextDueDate.getTime() - b.nextDueDate.getTime();
      });
  }, [clients]);

  const handleOpenPaymentMenu = (client) => {
    setSelectedPayment(client);
  };

  const handleClosePaymentMenu = () => {
    setSelectedPayment(null);
  };

  const handleTogglePaymentFromMenu = () => {
    if (selectedPayment && onToggleClientPayment) {
      onToggleClientPayment(selectedPayment.id);
    }
    handleClosePaymentMenu();
  };

  const getFormattedDate = () => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const date = new Date().toLocaleDateString('pt-BR', options);
    return date.charAt(0).toUpperCase() + date.slice(1);
  };

  const progressWidth = `${Math.max(0, Math.min(100, Math.round(financialData.progress * 100)))}%`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Bom dia, Guilherme</Text>
          <Text style={styles.date}>{getFormattedDate()}</Text>
          {planTier === 'free' ? (
            <View style={styles.homeLimitBanner}>
              <Text style={styles.homeLimitText}>
                {`Plano gratuito: ${clients.length}/${clientLimit} clientes`}
              </Text>
              {clients.length >= clientLimit ? (
                <Text style={styles.homeLimitCTA}>Passe para o Pro para liberar mais cadastros</Text>
              ) : null}
            </View>
          ) : (
            <View style={[styles.homeLimitBanner, styles.homeLimitBannerPro]}>
              <Text style={styles.homeLimitTextPro}>Plano Pro ativo</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>VISÃO DO MÊS ({monthLabel})</Text>
          <Text style={styles.receivedValue}>R$ {formatCurrency(financialData.received)}</Text>
          <Text style={styles.receivedLabel}>Recebido até o momento</Text>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>Total previsto: R$ {formatCurrency(financialData.expected)}</Text>
            <Text style={styles.progressText}>Pendente: R$ {formatCurrency(financialData.pending)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRÓXIMOS PAGAMENTOS</Text>
          <FlatList
            data={upcomingPayments}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pill} onPress={() => handleOpenPaymentMenu(item)}>
                <Text style={styles.pillText}>{item.name}</Text>
                <Text style={styles.pillSubText}>
                  {item.paymentStatus === 'paid'
                    ? 'Pago'
                    : item.nextDueDate
                      ? `Vence ${item.nextDueDate.toLocaleDateString('pt-BR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}`
                      : 'Vencimento a definir'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyFlatListText}>Nenhum pagamento previsto nos próximos 7 dias.</Text>}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPROMISSOS DE HOJE</Text>
          {todayAppointments.length > 0 ? (
            todayAppointments.map((item) => (
              <View key={item.id} style={styles.appointmentItem}>
                <Text style={styles.appointmentTime}>{item.time}</Text>
                <View style={styles.appointmentDetails}>
                  <Text style={styles.appointmentName}>{item.name}</Text>
                  <Text style={styles.appointmentLocation}>{item.location}</Text>
                  {item.note ? <Text style={styles.appointmentNote}>{item.note}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noAppointmentsText}>Nenhum compromisso hoje.</Text>
          )}
        </View>

      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddClient', { clientTerm })}>
        <Icon name="plus" size={28} color={COLORS.background} />
      </TouchableOpacity>

      <Modal
        visible={!!selectedPayment}
        animationType="fade"
        transparent
        onRequestClose={handleClosePaymentMenu}
      >
        <TouchableWithoutFeedback onPress={handleClosePaymentMenu}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.paymentMenu}>
                <Text style={styles.paymentTitle}>Atualizar pagamento</Text>
                {selectedPayment ? (
                  <View style={styles.paymentDetails}>
                    <Text style={styles.paymentName}>{selectedPayment.name}</Text>
                    <Text style={styles.paymentInfo}>
                      {selectedPayment.paymentStatus === 'paid'
                        ? 'Marcado como pago neste mês.'
                        : selectedPayment.dueDay
                          ? `Vencimento dia ${selectedPayment.dueDay}.`
                          : 'Sem dia definido para pagamento.'}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.paymentAction} onPress={handleTogglePaymentFromMenu}>
                  <Icon
                    name={selectedPayment?.paymentStatus === 'paid' ? 'rotate-ccw' : 'check-circle'}
                    size={20}
                    color={COLORS.background}
                    style={styles.paymentActionIcon}
                  />
                  <Text style={styles.paymentActionText}>
                    {selectedPayment?.paymentStatus === 'paid' ? 'Desmarcar pagamento' : 'Marcar como pago'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.paymentCancel} onPress={handleClosePaymentMenu}>
                  <Text style={styles.paymentCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  header: { padding: 30, paddingBottom: 15 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  date: { fontSize: 16, color: COLORS.accent, marginTop: 4 },
  homeLimitBanner: {
    marginTop: 18,
    backgroundColor: 'rgba(30,30,30,0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  homeLimitBannerPro: { backgroundColor: '#5CB85C' },
  homeLimitText: { color: COLORS.accent, fontSize: 14 },
  homeLimitTextPro: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  homeLimitCTA: { marginTop: 4, color: COLORS.text, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: 'rgba(30,30,30,0.05)',
    borderRadius: 20,
    padding: 25,
    marginHorizontal: 30,
    marginBottom: 30,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, marginBottom: 10, textTransform: 'uppercase' },
  receivedValue: { fontSize: 32, fontWeight: 'bold', color: COLORS.text },
  receivedLabel: { fontSize: 16, color: COLORS.accent, marginBottom: 20 },
  progressContainer: { height: 8, backgroundColor: 'rgba(30,30,30,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: COLORS.text, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  progressText: { fontSize: 12, color: COLORS.accent },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, marginBottom: 15, marginLeft: 30, textTransform: 'uppercase' },
  pill: {
    backgroundColor: 'rgba(30,30,30,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginLeft: 15,
    alignItems: 'center',
  },
  pillText: { color: COLORS.text, fontWeight: '600' },
  pillSubText: { color: COLORS.accent, fontSize: 12, marginTop: 2 },
  emptyFlatListText: { color: COLORS.placeholder, marginLeft: 30 },
  appointmentItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, marginBottom: 20 },
  appointmentTime: { fontSize: 16, fontWeight: '600', color: COLORS.text, width: 60 },
  appointmentDetails: { flex: 1, borderLeftWidth: 2, borderLeftColor: COLORS.text, paddingLeft: 15 },
  appointmentName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  appointmentLocation: { fontSize: 14, color: COLORS.accent },
  appointmentNote: { fontSize: 12, color: COLORS.placeholder, marginTop: 4 },
  noAppointmentsText: { color: COLORS.placeholder, textAlign: 'center', paddingHorizontal: 30 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { height: 2, width: 0 },
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  paymentMenu: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  paymentTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  paymentDetails: { marginBottom: 24 },
  paymentName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  paymentInfo: { fontSize: 14, color: COLORS.accent, marginTop: 4 },
  paymentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 16,
    paddingVertical: 14,
  },
  paymentActionIcon: { marginRight: 12 },
  paymentActionText: { color: COLORS.background, fontSize: 16, fontWeight: '600' },
  paymentCancel: { marginTop: 16, alignItems: 'center' },
  paymentCancelText: { color: COLORS.accent, fontSize: 14 },
});

export default HomeScreen;
