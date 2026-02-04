import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import { formatCurrency, formatDateLabel, startOfDay, endOfDay } from '../utils/dateUtils';
import { useClientStore } from '../store/useClientStore';
import { userReceivablesCollection } from '../utils/firestoreRefs';
import { markReceivableAsPaid, registerReceivableChargeSent } from '../utils/firestoreService';
import {
  applyTemplateVariables,
  buildPhoneE164FromRaw,
  openWhatsAppWithMessage,
} from '../utils/whatsapp';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const DEFAULT_CHARGE_TEMPLATE = 'Olá {nome}, sua cobrança vence em {data}.';

const ChargesTodayScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const clients = useClientStore((state) => state.clients);

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

    const today = new Date();
    const rangeStart = startOfDay(today);
    const rangeEnd = endOfDay(today);

    setIsLoading(true);
    setLoadError('');

    const receivablesQuery = query(
      userReceivablesCollection(currentUserId),
      where('paid', '==', false),
      where('dueDate', '>=', Timestamp.fromDate(rangeStart)),
      where('dueDate', '<=', Timestamp.fromDate(rangeEnd)),
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
    const map = new Map(clients.map((client) => [client.id, client]));
    return receivables.map((receivable) => {
      const client = map.get(receivable.clientId);
      const dueDate = receivable.dueDate?.toDate?.() || new Date(receivable.dueDate);
      const name = client?.name || receivable.clientName || 'Cliente';
      const amount = Number(receivable.amount ?? client?.value ?? 0);
      const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
      const lastCharge = Array.isArray(receivable.chargeHistory) && receivable.chargeHistory.length > 0
        ? receivable.chargeHistory[receivable.chargeHistory.length - 1]
        : null;
      const lastChargeAt = lastCharge?.at?.toDate?.() || (lastCharge?.at ? new Date(lastCharge.at) : null);
      return {
        id: receivable.id,
        clientId: receivable.clientId,
        name,
        amount,
        dueDate,
        phoneE164,
        receivable,
        lastChargeAt,
      };
    });
  }, [clients, receivables]);

  const handleCharge = async (item) => {
    if (!currentUserId || !item) return;

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
      dd: String(item.dueDate.getDate()).padStart(2, '0'),
      mm: String(item.dueDate.getMonth() + 1).padStart(2, '0'),
      data: formatDateLabel(item.dueDate),
    });

    const opened = await openWhatsAppWithMessage({ phoneE164: item.phoneE164, message });
    if (!opened) return;

    try {
      await registerReceivableChargeSent({
        uid: currentUserId,
        receivableId: item.id,
        usedTemplate: template,
        userAgent: `${Platform.OS}-${Platform.Version}`,
      });
    } catch (error) {
      // ignore
    }
  };

  const handleMarkAsPaid = (item) => {
    if (!item || !currentUserId) return;
    Alert.alert('Marcar como pago', `Confirmar baixa para ${item.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          if (payingId) return;
          setPayingId(item.id);
          try {
            await markReceivableAsPaid({
              uid: currentUserId,
              receivableId: item.id,
              method: 'manual',
            });
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
                {item.lastChargeAt ? (
                  <Text style={styles.subLabel}>
                    Última cobrança: {item.lastChargeAt.toLocaleString('pt-BR')}
                  </Text>
                ) : null}
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.chargeButton}
                  onPress={() => handleCharge(item)}
                >
                  <Icon name="message-circle" size={16} color={COLORS.textOnPrimary} />
                  <Text style={styles.chargeText}>
                    {item.receivable?.lastChargeSentAt ? 'Cobrar novamente' : 'Cobrar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paidButton, payingId === item.id && styles.paidButtonDisabled]}
                  onPress={() => handleMarkAsPaid(item)}
                  disabled={payingId === item.id}
                >
                  <Icon name="check-circle" size={16} color={COLORS.textOnPrimary} />
                  <Text style={styles.chargeText}>
                    {payingId === item.id ? 'Processando' : 'Marcar pago'}
                  </Text>
                </TouchableOpacity>
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
