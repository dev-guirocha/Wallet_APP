import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { useClientStore } from '../store/useClientStore';
import { COLORS as THEME, TYPOGRAPHY } from '../constants/theme';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  placeholder: THEME.textSecondary,
  accent: THEME.textSecondary,
  border: THEME.border,
  cardBackground: THEME.surface,
  danger: THEME.danger,
  success: THEME.success,
  warning: THEME.warning,
  primary: THEME.primary,
  textOnPrimary: THEME.textOnPrimary,
};

// Helpers
const onlyDigits = (str = '') => String(str).replace(/\D+/g, '');
const formatCurrencyBR = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
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


const ClientDetailScreen = ({ route, navigation }) => {
  const clientTerm = useClientStore((state) => state.clientTerm);
  const deleteClient = useClientStore((state) => state.deleteClient);
  const { client, clientId } = route.params || {};
  const resolvedClient = useClientStore((state) =>
    state.clients.find((item) => item.id === (clientId || client?.id))
  );
  const activeClient = resolvedClient || client;

  if (!activeClient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Cliente não encontrado</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>
    );
  }

  const currentMonthKey = getCurrentMonthKey();
  const isPaidThisMonth = normalizePaymentStatus(activeClient?.payments?.[currentMonthKey]) === 'paid';
  const currentStatusText = isPaidThisMonth ? 'Pago este mês' : 'Pendente';
  const currentStatusColor = isPaidThisMonth ? COLORS.success : COLORS.warning;

  // =======================================================
  // CHECKPOINT 8: HISTÓRICO DE PAGAMENTOS REAL
  // =======================================================
  const paymentHistory = useMemo(() => {
    if (!activeClient?.payments) return [];

    return Object.entries(activeClient.payments)
      .map(([monthKey, entry]) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('pt-BR', { month: 'long' });
        const formattedMonth = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${String(year).slice(2)}`;
        const status = normalizePaymentStatus(entry);
        return {
          month: formattedMonth,
          status: status === 'paid' ? 'Pago' : 'Pendente',
          color: status === 'paid' ? COLORS.success : COLORS.warning,
          amount: Number(activeClient.value) || 0,
          amountLabel: formatCurrencyBR(activeClient.value),
        };
      })
      .reverse();
  }, [activeClient?.payments, activeClient?.value]);
  // =======================================================

  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'paid' | 'pending'
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'paid') return paymentHistory.filter((h) => h.status === 'Pago');
    if (historyFilter === 'pending') return paymentHistory.filter((h) => h.status === 'Pendente');
    return paymentHistory;
  }, [paymentHistory, historyFilter]);

  const phoneDisplay = activeClient.phone || 'Não informado';
  const currencyDisplay = activeClient.valueFormatted ?? formatCurrencyBR(activeClient.value);
  const daysArray = Array.isArray(activeClient.days) ? activeClient.days : [];
  const daysDisplay = daysArray.length ? daysArray.join(', ') : 'Não informado';
  const nextAppt = getNextAppointment(activeClient || {});
  const timeDisplay = nextAppt.time || 'Não informado';


  const handleWhatsAppConfirm = async () => {
    if (!activeClient?.phone) return;
    const digits = onlyDigits(activeClient.phone);
    if (!digits) return;
    const dia = nextAppt.label || 'hoje';
    const msg = `Olá, ${activeClient.name}!\n\nConfirmando seu horário de ${dia} às ${timeDisplay}.\n\nSe precisar reagendar, por favor me avise. Obrigado!`;
    await openWhatsApp(digits, msg);
  };

  const handleGenerateReceipt = async () => {
    const valor = activeClient?.valueFormatted ?? formatCurrencyBR(activeClient?.value);
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
            <p><strong>Cliente:</strong> ${activeClient?.name || 'Cliente'}</p>
            <p><strong>Valor:</strong> ${valor}</p>
            <p><strong>Vencimento:</strong> Dia ${activeClient?.dueDay || '—'}</p>
            <p><strong>Local:</strong> ${activeClient?.location || '—'}</p>
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
    if (!activeClient?.id) return;
    Alert.alert(
      `Apagar ${clientTerm || 'Cliente'}`,
      `Tem certeza que deseja apagar "${activeClient.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            try {
              deleteClient(activeClient.id);
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
        <Text style={styles.title} numberOfLines={1}>{activeClient?.name || ''}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddClient', { clientId: activeClient?.id })}>
          <Icon name="edit-2" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerStatusRow}>
        <View style={[styles.statusPill, { backgroundColor: currentStatusColor }]}> 
          <Text style={styles.statusPillText}>{currentStatusText}</Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppConfirm} disabled={!activeClient?.phone}>
          <Icon name="message-circle" size={18} color={COLORS.background} />
          <Text style={styles.actionText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleGenerateReceipt}>
          <Icon name="file-text" size={18} color={COLORS.background} />
          <Text style={styles.actionText}>Gerar recibo</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <DetailRow icon="map-pin" label="Local" value={activeClient?.location || 'Não informado'} />
        <DetailRow icon="phone" label="Telefone" value={phoneDisplay} />
        <DetailRow icon="dollar-sign" label="Valor Mensal" value={currencyDisplay} />
        <DetailRow
          icon="credit-card"
          label="Vencimento"
          value={activeClient?.dueDay ? `Dia ${activeClient.dueDay}` : 'Não informado'}
        />
        <DetailRow icon="calendar" label="Dias" value={daysDisplay} />
        <DetailRow icon="clock" label="Horário" value={timeDisplay} />
        {daysArray.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionSubtitle}>Agenda por dia</Text>
            {daysArray.map((d) => {
              const timeForDay =
                activeClient?.dayTimes && activeClient.dayTimes[d]
                  ? activeClient.dayTimes[d]
                  : activeClient?.time;
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
          <Text style={styles.deleteButtonText}>Excluir {clientTerm || 'Cliente'}</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
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
  title: { flex: 1, textAlign: 'center', ...TYPOGRAPHY.title, color: COLORS.text, marginHorizontal: 10 },
  container: { padding: 30 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  detailIcon: { marginRight: 20 },
  detailLabel: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginBottom: 2 },
  detailValue: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  separator: { height: 1, backgroundColor: COLORS.border, marginVertical: 15 },
  sectionTitle: { ...TYPOGRAPHY.title, color: COLORS.text, marginBottom: 20 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyMonth: { ...TYPOGRAPHY.body, color: COLORS.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  statusText: { ...TYPOGRAPHY.caption, color: COLORS.textOnPrimary },
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary, textAlign: 'center' },
  sectionSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginBottom: 8 },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduleDay: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  scheduleTime: { ...TYPOGRAPHY.body, color: COLORS.text },
  deleteButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  deleteButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },

  headerStatusRow: { paddingHorizontal: 20, paddingTop: 8 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  statusPillText: { ...TYPOGRAPHY.caption, color: COLORS.textOnPrimary },

  filterRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(26,32,44,0.08)' },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { ...TYPOGRAPHY.caption, color: COLORS.text },
  filterTextActive: { ...TYPOGRAPHY.caption, color: COLORS.textOnPrimary },

  amountText: { ...TYPOGRAPHY.caption, color: COLORS.accent },
});

export default ClientDetailScreen;
