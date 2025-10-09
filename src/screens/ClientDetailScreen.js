import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#8A8A8A',
  cardBackground: '#DAD8D3',
};

// Helpers
const onlyDigits = (str = '') => String(str).replace(/\D+/g, '');
const formatCurrencyBR = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7); // 'AAAA-MM'

const openWhatsApp = async (digits, msg) => {
  try {
    const appUrl = `whatsapp://send?phone=55${digits}&text=${encodeURIComponent(msg)}`;
    const webUrl = `https://wa.me/55${digits}?text=${encodeURIComponent(msg)}`;
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      return Linking.openURL(appUrl);
    }
    return Linking.openURL(webUrl);
  } catch (e) {
    return Linking.openURL(`https://wa.me/55${digits}?text=${encodeURIComponent(msg)}`);
  }
};

// Retorna o próximo compromisso (hoje ou nos próximos 6 dias) considerando overrides por dia
const getNextAppointment = (client) => {
  const daysArray = Array.isArray(client.days) ? client.days : [];
  const dayTimes = client.dayTimes || {};
  const defaultTime = client.time || '';

  // Se não houver dias definidos, tentar hoje com o horário padrão
  if (!daysArray.length) {
    return { label: 'hoje', time: defaultTime };
  }

  const mapLabelToIndex = { Dom: 0, Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, Sáb: 6 };
  const mapIndexToLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIdx = now.getDay(); // 0 = Dom ... 6 = Sáb

  const parseHHMM = (hhmm) => {
    if (!hhmm || typeof hhmm !== 'string') return null;
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  for (let offset = 0; offset < 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const label = mapIndexToLabel[idx];
    if (!daysArray.includes(label)) continue;
    const timeForDay = dayTimes[label] || defaultTime;
    const minutes = parseHHMM(timeForDay);
    if (minutes === null) continue;

    if (offset === 0) {
      // hoje: só vale se horário ainda não passou
      if (minutes >= nowMinutes) {
        return { label: 'hoje', time: timeForDay };
      }
      // se já passou, continua procurando
    } else if (offset === 1) {
      return { label: 'amanhã', time: timeForDay };
    } else {
      return { label, time: timeForDay };
    }
  }

  // fallback: usa primeiro dia configurado e horário padrão
  return { label: daysArray[0], time: dayTimes[daysArray[0]] || defaultTime };
};


const ClientDetailScreen = ({ route, navigation, onEditClient, onDeleteClient }) => {
  // Recebe os dados do paciente passados pela navegação
  const { client } = route.params;

  const currentMonthKey = getCurrentMonthKey();
  const isPaidThisMonth = client?.payments?.[currentMonthKey] === 'pago';
  const currentStatusText = isPaidThisMonth ? 'Pago este mês' : 'Pendente';
  const currentStatusColor = isPaidThisMonth ? '#5CB85C' : '#F0AD4E';

  // =======================================================
  // CHECKPOINT 8: HISTÓRICO DE PAGAMENTOS REAL
  // =======================================================
  const paymentHistory = useMemo(() => {
    if (!client?.payments) return [];

    return Object.entries(client.payments)
      .map(([monthKey, status]) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('pt-BR', { month: 'long' });
        const formattedMonth = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${String(year).slice(2)}`;
        return {
          month: formattedMonth,
          status: status === 'pago' ? 'Pago' : 'Pendente',
          color: status === 'pago' ? '#5CB85C' : '#F0AD4E',
          amount: Number(client.value) || 0,
          amountLabel: formatCurrencyBR(client.value),
        };
      })
      .reverse();
  }, [client?.payments]);
  // =======================================================

  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'paid' | 'pending'
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'paid') return paymentHistory.filter((h) => h.status === 'Pago');
    if (historyFilter === 'pending') return paymentHistory.filter((h) => h.status === 'Pendente');
    return paymentHistory;
  }, [paymentHistory, historyFilter]);

  const phoneDisplay = client.phone || 'Não informado';
  const currencyDisplay = client.valueFormatted ?? formatCurrencyBR(client.value);
  const daysArray = Array.isArray(client.days) ? client.days : [];
  const daysDisplay = daysArray.length ? daysArray.join(', ') : 'Não informado';
  const nextAppt = getNextAppointment(client);
  const timeDisplay = nextAppt.time || 'Não informado';


  const handleWhatsAppConfirm = async () => {
    if (!client.phone) return;
    const digits = onlyDigits(client.phone);
    if (!digits) return;
    const dia = nextAppt.label || 'hoje';
    const msg = `Olá, ${client.name}!\n\nConfirmando seu horário de ${dia} às ${timeDisplay}.\n\nSe precisar reagendar, por favor me avise. Obrigado!`;
    await openWhatsApp(digits, msg);
  };

  const handleGenerateReceipt = async () => {
    const valor = client.valueFormatted ?? formatCurrencyBR(client.value);
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, Roboto, Arial; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            p { margin: 4px 0; }
            .box { border: 1px solid #ccc; border-radius: 8px; padding: 16px; margin-top: 16px; }
            .muted { color: #666; }
          </style>
        </head>
        <body>
          <h1>Recibo de Pagamento</h1>
          <div class="box">
            <p><strong>Cliente:</strong> ${client.name}</p>
            <p><strong>Valor:</strong> ${valor}</p>
            <p><strong>Vencimento:</strong> Dia ${client.dueDay}</p>
            <p><strong>Local:</strong> ${client.location || '—'}</p>
            <p><strong>Dias/Horário:</strong> ${daysDisplay} — ${timeDisplay}</p>
          </div>
          <p class="muted">Gerado por Wallet App</p>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS !== 'web') {
        await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar recibo' });
      } else {
        Linking.openURL(uri);
      }
    } catch (e) {
      console.warn('Erro ao gerar recibo', e);
    }
  };

  const handleDeleteClient = () => {
    if (!onDeleteClient) {
      Alert.alert('Ação indisponível', 'Função de excluir não foi configurada.');
      return;
    }
    Alert.alert(
      `Apagar ${route.params?.clientTerm || 'Cliente'}`,
      `Tem certeza que deseja apagar "${client.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            try {
              onDeleteClient(client.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível excluir. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  const DetailRow = ({ icon, label, value }) => (
    <View style={styles.detailRow}>
      <Icon name={icon} size={20} color={COLORS.accent} style={styles.detailIcon} />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{client.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddClient', { clientToEdit: client, clientTerm: route.params?.clientTerm || 'Cliente' })}>
          <Icon name="edit-2" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerStatusRow}>
        <View style={[styles.statusPill, { backgroundColor: currentStatusColor }]}> 
          <Text style={styles.statusPillText}>{currentStatusText}</Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppConfirm} disabled={!client.phone}>
          <Icon name="message-circle" size={18} color={COLORS.background} />
          <Text style={styles.actionText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleGenerateReceipt}>
          <Icon name="file-text" size={18} color={COLORS.background} />
          <Text style={styles.actionText}>Gerar recibo</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <DetailRow icon="map-pin" label="Local" value={client.location || 'Não informado'} />
        <DetailRow icon="phone" label="Telefone" value={phoneDisplay} />
        <DetailRow icon="dollar-sign" label="Valor Mensal" value={currencyDisplay} />
        <DetailRow icon="credit-card" label="Vencimento" value={client.dueDay ? `Dia ${client.dueDay}` : 'Não informado'} />
        <DetailRow icon="calendar" label="Dias" value={daysDisplay} />
        <DetailRow icon="clock" label="Horário" value={timeDisplay} />
        {daysArray.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionSubtitle}>Agenda por dia</Text>
            {daysArray.map((d) => {
              const timeForDay = client.dayTimes && client.dayTimes[d] ? client.dayTimes[d] : client.time;
              return (
                <View key={d} style={styles.scheduleRow}>
                  <Text style={styles.scheduleDay}>{d}</Text>
                  <Text style={styles.scheduleTime}>{timeForDay || '—'}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.separator} />

        <View style={styles.filterRow}>
          <TouchableOpacity onPress={() => setHistoryFilter('all')} style={[styles.filterBtn, historyFilter === 'all' && styles.filterBtnActive]}>
            <Text style={[styles.filterText, historyFilter === 'all' && styles.filterTextActive]}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHistoryFilter('paid')} style={[styles.filterBtn, historyFilter === 'paid' && styles.filterBtnActive]}>
            <Text style={[styles.filterText, historyFilter === 'paid' && styles.filterTextActive]}>Pagos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHistoryFilter('pending')} style={[styles.filterBtn, historyFilter === 'pending' && styles.filterBtnActive]}>
            <Text style={[styles.filterText, historyFilter === 'pending' && styles.filterTextActive]}>Pendentes</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Histórico de Pagamentos</Text>
        {filteredHistory.map((item, index) => (
          <View key={index} style={styles.historyRow}>
            <Text style={styles.historyMonth}>{item.month}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amountText}>{item.amountLabel}</Text>
              <View style={[styles.statusBadge, { backgroundColor: item.color, marginTop: 4 }]}> 
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 20 }} />
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteClient}>
          <Icon name="trash-2" size={18} color={COLORS.background} />
          <Text style={styles.deleteButtonText}>Excluir {route.params?.clientTerm || 'Cliente'}</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(30,30,30,0.1)' },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginHorizontal: 10 },
  container: { padding: 30 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  detailIcon: { marginRight: 20 },
  detailLabel: { fontSize: 14, color: COLORS.accent, marginBottom: 2 },
  detailValue: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  separator: { height: 1, backgroundColor: 'rgba(30,30,30,0.1)', marginVertical: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.cardBackground, borderRadius: 10, padding: 15, marginBottom: 10 },
  historyMonth: { fontSize: 16, color: COLORS.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.text, paddingVertical: 12, borderRadius: 10 },
  actionText: { color: COLORS.background, fontWeight: '700', textAlign: 'center' },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, marginBottom: 8 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.cardBackground, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6 },
  scheduleDay: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  scheduleTime: { fontSize: 14, color: COLORS.text },
  deleteButton: {marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D9534F', paddingVertical: 14, borderRadius: 10, marginHorizontal: 20 },
  deleteButtonText: {color: COLORS.background, fontWeight: '700'},

  headerStatusRow: { paddingHorizontal: 20, paddingTop: 8 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  statusPillText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  filterRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(30,30,30,0.08)' },
  filterBtnActive: { backgroundColor: COLORS.text },
  filterText: { color: COLORS.text, fontWeight: '600' },
  filterTextActive: { color: COLORS.background },

  amountText: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
});

export default ClientDetailScreen;