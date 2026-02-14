import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ToastAndroid,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import {
  formatCurrency,
  formatDateLabel,
  getMonthKey,
  parseDateKeyToDate,
} from '../utils/dateUtils';
import { useClientStore } from '../store/useClientStore';
import { userReceivablesCollection } from '../utils/firestoreRefs';
import {
  markReceivableAsPaid,
  markReceivablesPaidByIds,
  registerReceivableChargeSent,
} from '../utils/firestoreService';
import {
  applyTemplateVariables,
  buildPhoneE164FromRaw,
  openWhatsAppWithMessage,
} from '../utils/whatsapp';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const DEFAULT_CHARGE_TEMPLATE = 'Olá {nome}, sua cobrança vence em {data}.';

const isSameCalendarDay = (a, b) => {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
};

const itemMs = (value) => {
  if (!(value instanceof Date)) return 0;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const resolveReceivableDueDate = (receivable) => {
  const fromTimestamp = receivable?.dueDate?.toDate?.() || (receivable?.dueDate ? new Date(receivable.dueDate) : null);
  if (fromTimestamp instanceof Date && !Number.isNaN(fromTimestamp.getTime())) return fromTimestamp;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const ChargesTodayScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const clients = useClientStore((state) => state.clients);
  const setClientPaymentStatus = useClientStore((state) => state.setClientPaymentStatus);

  const [receivables, setReceivables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    if (!currentUserId) {
      setReceivables([]);
      setIsLoading(false);
      setLoadError('');
      return;
    }

    setIsLoading(true);
    setLoadError('');

    const receivablesQuery = query(
      userReceivablesCollection(currentUserId),
      where('paid', '==', false),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(
      receivablesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setReceivables(items);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
        setLoadError('Não foi possível carregar as cobranças.');
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const items = useMemo(() => {
    const today = new Date();
    const map = new Map(clients.map((client) => [client.id, client]));
    return receivables.map((receivable) => {
      const client = map.get(receivable.clientId);
      const dueDate = resolveReceivableDueDate(receivable);
      const name = client?.name || receivable.clientName || 'Cliente';
      const amount = Number(receivable.amount ?? client?.value ?? 0);
      const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
      const lastCharge = Array.isArray(receivable.chargeHistory) && receivable.chargeHistory.length > 0
        ? receivable.chargeHistory[receivable.chargeHistory.length - 1]
        : null;
      const lastChargeSentAt = receivable.lastChargeSentAt?.toDate?.() || (receivable.lastChargeSentAt ? new Date(receivable.lastChargeSentAt) : null);
      const lastChargeAt = lastCharge?.at?.toDate?.() || (lastCharge?.at ? new Date(lastCharge.at) : null);
      const chargeDate = lastChargeSentAt || lastChargeAt;
      return {
        id: receivable.id,
        clientId: receivable.clientId,
        name,
        amount,
        dueDate,
        phoneE164,
        receivable,
        lastChargeAt,
        chargeDate,
      };
    })
      .filter((item) => isSameCalendarDay(item.chargeDate, today))
      .sort((a, b) => {
        const aMs = itemMs(a.chargeDate);
        const bMs = itemMs(b.chargeDate);
        return bMs - aMs;
      });
  }, [clients, receivables]);

  const handleCharge = async (item) => {
    if (!currentUserId || !item) return;
    const dueDate = item.dueDate || new Date();

    const last = item.receivable?.lastChargeSentAt;
    if (last) {
      const lastDate = last.toDate?.() || new Date(last);
      const today = new Date();
      if (
        lastDate.getDate() === today.getDate() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getFullYear() === today.getFullYear()
      ) {
        Alert.alert('Cobrança', 'Você já enviou cobrança para este cliente hoje.');
        return;
      }
    }

    const template = templates?.chargeMsg?.trim() || DEFAULT_CHARGE_TEMPLATE;
    const message = applyTemplateVariables(template, {
      nome: item.name,
      dd: String(dueDate.getDate()).padStart(2, '0'),
      mm: String(dueDate.getMonth() + 1).padStart(2, '0'),
      data: formatDateLabel(dueDate),
    });

    const opened = await openWhatsAppWithMessage({ phoneE164: item.phoneE164, message });
    if (!opened) return;

    try {
      const fallbackReceivable = {
        clientId: item.clientId,
        clientName: item.name,
        amount: Number(item.amount ?? 0),
        dueDate,
        monthKey: item.receivable?.monthKey || getMonthKey(dueDate),
        paid: false,
      };
      await registerReceivableChargeSent({
        uid: currentUserId,
        receivableId: item.id,
        usedTemplate: template,
        userAgent: `${Platform.OS}-${Platform.Version}`,
        fallbackReceivable,
      });
      const sentAt = Timestamp.fromDate(new Date());
      setReceivables((prev) =>
        prev.map((receivable) => {
          if (receivable.id !== item.id) return receivable;
          const history = Array.isArray(receivable.chargeHistory) ? receivable.chargeHistory : [];
          return {
            ...receivable,
            lastChargeSentAt: sentAt,
            chargeHistory: [
              ...history,
              { at: sentAt, channel: 'whatsapp', template },
            ],
          };
        })
      );
    } catch (error) {
      // ignore
    }
  };

  const notifyPaymentSuccess = () => {
    const message = 'Pagamento marcado como pago.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Pagamento', message);
  };

  const handleMarkAsPaid = (item) => {
    if (!item || !currentUserId) return;
    Alert.alert('Marcar como pago', `Confirmar baixa para ${item.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          if (payingId) return;
          if (!item.dueDate) {
            Alert.alert('Pagamento', 'Vencimento inválido para este recebível.');
            return;
          }
          setPayingId(item.id);
          try {
            const monthKey = getMonthKey(item.dueDate);
            await markReceivableAsPaid({
              uid: currentUserId,
              receivableId: item.id,
              method: 'manual',
              fallbackReceivable: {
                clientId: item.clientId,
                clientName: item.name,
                amount: Number(item.amount ?? 0),
                dueDate: item.dueDate,
                monthKey,
                paid: true,
              },
            });
            setClientPaymentStatus({
              clientId: item.clientId,
              monthKey,
              paid: true,
              amount: item.amount,
            });
            await markReceivablesPaidByIds({
              uid: currentUserId,
              receivableIds: [item.id],
            });
            setReceivables((prev) => prev.filter((receivable) => receivable.id !== item.id));
            notifyPaymentSuccess();
            navigation.navigate('MainTabs', { screen: 'Início' });
          } catch (error) {
            Alert.alert('Pagamento', 'Não foi possível dar baixa neste recebível.');
          } finally {
            setPayingId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Cobranças de hoje</Text>
        <View style={styles.headerSpacer} />
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="check-circle" size={40} color={COLORS.textSecondary} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyText}>
            {isLoading
              ? 'Carregando cobranças...'
              : loadError || 'Nenhuma cobrança pendente hoje.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.subLabel}>Vence em {formatDateLabel(item.dueDate)}</Text>
                {item.chargeDate ? (
                  <Text style={styles.subLabel}>
                    Última cobrança: {item.chargeDate.toLocaleString('pt-BR')}
                  </Text>
                ) : null}
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
              </View>
              <View style={styles.cardActions}>
                {(() => {
                  const hasCharge = Boolean(
                    item.receivable?.lastChargeSentAt ||
                      (item.receivable?.chargeHistory?.length || 0) > 0
                  );
                  if (hasCharge) {
                    return (
                      <TouchableOpacity
                        style={[styles.paidButton, payingId === item.id && styles.paidButtonDisabled]}
                        onPress={() => handleMarkAsPaid(item)}
                        disabled={payingId === item.id}
                      >
                        <Icon name="check-circle" size={16} color={COLORS.textOnPrimary} />
                        <Text style={styles.chargeText}>
                          {payingId === item.id ? 'Processando' : 'Marcar como pago'}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      style={styles.chargeButton}
                      onPress={() => handleCharge(item)}
                    >
                      <Icon name="message-circle" size={16} color={COLORS.textOnPrimary} />
                      <Text style={styles.chargeText}>Cobrar</Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  headerSpacer: { width: 36 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: { flex: 1, marginRight: 12 },
  cardActions: { alignItems: 'flex-end' },
  name: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  subLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
  amount: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary, marginTop: 8 },
  chargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  paidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  paidButtonDisabled: { opacity: 0.7 },
  chargeText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary, marginLeft: 6 },
});

export default ChargesTodayScreen;
