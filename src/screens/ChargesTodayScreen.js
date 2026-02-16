import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ToastAndroid,
  StyleSheet,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import {
  getDateKey,
  getMonthKey,
  parseDateKeyToDate,
  toDate,
} from '../utils/dateUtils';
import { getChargeMessage } from '../utils/chargeMessageBuilder';
import { useClientStore } from '../store/useClientStore';
import { userReceivablesCollection } from '../utils/firestoreRefs';
import {
  markReceivableAsUnpaid,
  markReceivableAsPaid,
  markReceivablesPaidByIds,
  markReceivablesUnpaidByIds,
  registerReceivableChargeSent,
  rescheduleReceivableDueDate,
  undoReceivableReschedule,
} from '../utils/firestoreService';
import {
  buildPhoneE164FromRaw,
  openWhatsAppWithMessage,
} from '../utils/whatsapp';
import { COLORS } from '../theme/legacy';
import { runGuardedAction } from '../utils/actionGuard';
import { appendReceivableHistory, RECEIVABLE_HISTORY_TYPES } from '../utils/receivableHistory';
import {
  AppScreen,
  ListContainer,
  SnackbarUndo,
  SectionHeader,
} from '../components';
import RescheduleModal from '../components/RescheduleModal';
import { ReceivableCard } from '../components/charges/ReceivableCard';
import { actionLabels, emptyMessages } from '../utils/uiCopy';

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
  const fromTimestamp = toDate(receivable?.dueDate);
  if (fromTimestamp instanceof Date && !Number.isNaN(fromTimestamp.getTime())) return fromTimestamp;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const ChargesTodayScreen = ({ navigation, route }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const clients = useClientStore((state) => state.clients);
  const setClientPaymentStatus = useClientStore((state) => state.setClientPaymentStatus);

  const [receivables, setReceivables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [payingId, setPayingId] = useState(null);
  const [chargingId, setChargingId] = useState(null);
  const [syncStateById, setSyncStateById] = useState({});
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const isReceiveMode = route?.params?.mode === 'receive';
  const retryActionRef = useRef({});
  const undoActionRef = useRef(null);
  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

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
    const parsedItems = receivables.map((receivable) => {
      const client = map.get(receivable.clientId);
      const dueDate = resolveReceivableDueDate(receivable);
      const name = client?.name || receivable.clientName || 'Cliente';
      const amount = Number(receivable.amount ?? client?.value ?? 0);
      const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
      const lastCharge = Array.isArray(receivable.chargeHistory) && receivable.chargeHistory.length > 0
        ? receivable.chargeHistory[receivable.chargeHistory.length - 1]
        : null;
      const lastChargeSentAt = toDate(receivable.lastChargeSentAt);
      const lastChargeAt = toDate(lastCharge?.at);
      const chargeDate = lastChargeSentAt || lastChargeAt;
      const hasCharge = Boolean(
        receivable?.lastChargeSentAt ||
        (Array.isArray(receivable?.chargeHistory) && receivable.chargeHistory.length > 0)
      );
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
        hasCharge,
      };
    });

    if (isReceiveMode) {
      return parsedItems.sort((a, b) => {
        if (a.hasCharge !== b.hasCharge) return a.hasCharge ? -1 : 1;
        const byChargeDate = itemMs(b.chargeDate) - itemMs(a.chargeDate);
        if (byChargeDate !== 0) return byChargeDate;
        return itemMs(a.dueDate) - itemMs(b.dueDate);
      });
    }

    return parsedItems
      .filter((item) => isSameCalendarDay(item.chargeDate, today))
      .sort((a, b) => {
        const aMs = itemMs(a.chargeDate);
        const bMs = itemMs(b.chargeDate);
        return bMs - aMs;
      });
  }, [clients, isReceiveMode, receivables]);

  const setSyncState = useCallback((id, state, retryAction = null) => {
    if (!id) return;
    setSyncStateById((prev) => ({ ...prev, [id]: state }));
    if (retryAction) {
      retryActionRef.current[id] = retryAction;
      return;
    }
    delete retryActionRef.current[id];
  }, []);

  const markSyncSaved = useCallback((id) => {
    if (!id) return;
    setSyncState(id, 'saved');
    setTimeout(() => {
      setSyncStateById((prev) => {
        if (!prev[id] || prev[id] === 'saving') return prev;
        return { ...prev, [id]: 'idle' };
      });
    }, 1800);
  }, [setSyncState]);

  const openUndo = useCallback((message, handler) => {
    undoActionRef.current = handler;
    setUndoMessage(message);
    setUndoVisible(true);
  }, []);

  const closeUndo = useCallback(() => {
    undoActionRef.current = null;
    setUndoMessage('');
    setUndoVisible(false);
  }, []);

  const handleUndo = useCallback(async () => {
    const handler = undoActionRef.current;
    closeUndo();
    if (typeof handler === 'function') {
      try {
        await handler();
      } catch (_error) {
        Alert.alert('Desfazer', 'Não foi possível desfazer a última ação.');
      }
    }
  }, [closeUndo]);

  const handleRetryForItem = useCallback((item) => {
    const action = retryActionRef.current[item?.id];
    if (typeof action === 'function') {
      action();
    }
  }, []);

  const handleCharge = useCallback(async (item) => {
    if (!currentUserId || !item || chargingId) return;
    const dueDate = item.dueDate;
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
      Alert.alert('Cobrança', 'Defina o vencimento do cliente para enviar cobrança.', [
        { text: 'Agora não', style: 'cancel' },
        {
          text: `${actionLabels.edit} cliente`,
          onPress: () => navigation.navigate('AddClient', { clientId: item.clientId }),
        },
      ]);
      return;
    }

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
    const dueEnd = new Date(dueDate);
    dueEnd.setHours(23, 59, 59, 999);
    const daysLate = Math.max(0, Math.floor((Date.now() - dueEnd.getTime()) / 86400000));
    const message = getChargeMessage(item, daysLate);
    const actionKey = `charge:${item.id}`;
    const { blocked } = await runGuardedAction(actionKey, async () => {
      setSyncState(item.id, 'saving', () => handleCharge(item));
      setChargingId(item.id);
      try {
        const opened = await openWhatsAppWithMessage({ phoneE164: item.phoneE164, message });
        if (!opened) {
          setSyncState(item.id, 'idle');
          return;
        }

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
              history: appendReceivableHistory(receivable, {
                type: RECEIVABLE_HISTORY_TYPES.CHARGE_SENT,
                at: new Date(),
                template,
              }),
            };
          })
        );
        markSyncSaved(item.id);
      } catch (_error) {
        setSyncState(item.id, 'error', () => handleCharge(item));
        Alert.alert('Cobrança', 'Não foi possível enviar cobrança agora.');
      } finally {
        setChargingId(null);
      }
    });
    if (blocked) return;
  }, [chargingId, currentUserId, markSyncSaved, navigation, setSyncState, templates]);

  const notifyPaymentSuccess = () => {
    const message = 'Pagamento marcado como pago.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Pagamento', message);
  };

  const handleMarkAsPaid = useCallback((item) => {
    if (!item || !currentUserId) return;
    Alert.alert(actionLabels.receive, `Confirmar baixa para ${item.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          if (!item.dueDate) {
            Alert.alert('Pagamento', 'Vencimento inválido para este recebível.');
            return;
          }
          const actionKey = `pay:${item.id}`;
          const { blocked } = await runGuardedAction(actionKey, async () => {
            setSyncState(item.id, 'saving', () => handleMarkAsPaid(item));
            setPayingId(item.id);
            const monthKey = getMonthKey(item.dueDate);
            const duplicateIds = [item.id];
            const removedItems = receivables.filter((entry) => duplicateIds.includes(entry.id));

            try {
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
                receivableIds: duplicateIds,
              });
              setReceivables((prev) => prev.filter((receivable) => !duplicateIds.includes(receivable.id)));
              markSyncSaved(item.id);
              notifyPaymentSuccess();
              openUndo('Pagamento registrado. Deseja desfazer?', async () => {
                await markReceivableAsUnpaid({ uid: currentUserId, receivableId: item.id });
                await markReceivablesUnpaidByIds({ uid: currentUserId, receivableIds: duplicateIds });
                setClientPaymentStatus({
                  clientId: item.clientId,
                  monthKey,
                  paid: false,
                  amount: item.amount,
                });
                setReceivables((prev) => {
                  const ids = new Set(prev.map((entry) => entry.id));
                  const restored = removedItems.filter((entry) => !ids.has(entry.id));
                  return [...prev, ...restored];
                });
              });
              if (!isReceiveMode) {
                navigation.navigate('MainTabs', { screen: 'Início' });
              }
            } catch (_error) {
              setSyncState(item.id, 'error', () => handleMarkAsPaid(item));
              Alert.alert('Pagamento', 'Não foi possível dar baixa neste recebível.');
            } finally {
              setPayingId(null);
            }
          });
          if (blocked) return;
        },
      },
    ]);
  }, [
    currentUserId,
    isReceiveMode,
    markSyncSaved,
    navigation,
    openUndo,
    receivables,
    setClientPaymentStatus,
    setSyncState,
  ]);

  const handleOpenReschedule = useCallback((item) => {
    setRescheduleItem(item);
    setRescheduleVisible(true);
  }, []);

  const handleConfirmReschedule = useCallback(async (newDate) => {
    if (!rescheduleItem || !currentUserId) {
      setRescheduleVisible(false);
      setRescheduleItem(null);
      return;
    }
    if (!(newDate instanceof Date) || Number.isNaN(newDate.getTime())) {
      Alert.alert('Cobrança', 'Data inválida para reagendamento.');
      return;
    }
    const currentItem = rescheduleItem;
    const previousDueDate = currentItem?.dueDate instanceof Date ? new Date(currentItem.dueDate) : null;
    const actionKey = `reschedule:${currentItem.id}`;

    const { blocked } = await runGuardedAction(actionKey, async () => {
      setSyncState(currentItem.id, 'saving', () => handleOpenReschedule(currentItem));
      try {
        await rescheduleReceivableDueDate({
          uid: currentUserId,
          receivableId: currentItem.id,
          dueDate: newDate,
          previousDueDate,
        });

        const dueDateKey = getDateKey(newDate);
        const monthKey = getMonthKey(newDate);

        setReceivables((prev) =>
          prev.map((entry) =>
            entry.id === currentItem.id
              ? {
                ...entry,
                dueDate: Timestamp.fromDate(newDate),
                dueDateKey,
                dueDay: newDate.getDate(),
                monthKey,
                history: appendReceivableHistory(entry, {
                  type: RECEIVABLE_HISTORY_TYPES.RESCHEDULED,
                  at: new Date(),
                  toDueDateKey: dueDateKey,
                }),
              }
              : entry
          )
        );
        markSyncSaved(currentItem.id);
        if (previousDueDate) {
          openUndo('Vencimento reagendado. Deseja desfazer?', async () => {
            await undoReceivableReschedule({
              uid: currentUserId,
              receivableId: currentItem.id,
              previousDueDate,
            });
            const previousKey = getDateKey(previousDueDate);
            const previousMonthKey = getMonthKey(previousDueDate);
            setReceivables((prev) =>
              prev.map((entry) =>
                entry.id === currentItem.id
                  ? {
                    ...entry,
                    dueDate: Timestamp.fromDate(previousDueDate),
                    dueDateKey: previousKey,
                    dueDay: previousDueDate.getDate(),
                    monthKey: previousMonthKey,
                  }
                  : entry
              )
            );
          });
        }
      } catch (_error) {
        setSyncState(currentItem.id, 'error', () => handleOpenReschedule(currentItem));
        Alert.alert('Cobrança', 'Não foi possível reagendar o vencimento.');
      } finally {
        setRescheduleVisible(false);
        setRescheduleItem(null);
      }
    });
    if (blocked) {
      setRescheduleVisible(false);
      setRescheduleItem(null);
    }
  }, [currentUserId, handleOpenReschedule, markSyncSaved, openUndo, rescheduleItem, setSyncState]);

  const handleEdit = useCallback((item) => {
    if (item?.clientId) {
      navigation.navigate('AddClient', { clientId: item.clientId });
      return;
    }
    navigation.navigate('ClientDetail', { clientId: item?.clientId, client: { name: item?.name || 'Cliente' } });
  }, [navigation]);

  const keyExtractor = useCallback((item) => item.id, []);

  const renderReceivableItem = useCallback(
    ({ item }) => (
      <ReceivableCard
        item={item}
        mode={isReceiveMode ? 'receive' : 'default'}
        onCharge={handleCharge}
        onReceive={handleMarkAsPaid}
        onReschedule={handleOpenReschedule}
        onEdit={handleEdit}
        onRetry={handleRetryForItem}
        isReceiving={payingId === item.id}
        isCharging={chargingId === item.id}
        syncState={syncStateById[item.id] || 'idle'}
      />
    ),
    [
      chargingId,
      handleCharge,
      handleEdit,
      handleMarkAsPaid,
      handleOpenReschedule,
      handleRetryForItem,
      isReceiveMode,
      payingId,
      syncStateById,
    ]
  );

  return (
    <AppScreen style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          accessibilityState={{ disabled: false }}
        >
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <SectionHeader
            title={isReceiveMode ? actionLabels.receive : 'Cobranças de hoje'}
            style={styles.titleSection}
          />
        </View>
      </View>

      <ListContainer
        loading={isLoading && items.length === 0}
        error={loadError && items.length === 0 ? loadError : ''}
        isEmpty={!isLoading && !loadError && items.length === 0}
        emptyIcon={<Icon name="check-circle" size={40} color={COLORS.textSecondary} style={styles.emptyIcon} />}
        emptyTitle={
          isReceiveMode
            ? emptyMessages.chargesToday.receiveTitle
            : emptyMessages.chargesToday.defaultTitle
        }
        emptyMessage={
          isReceiveMode
            ? emptyMessages.chargesToday.receiveMessage
            : emptyMessages.chargesToday.defaultMessage
        }
        style={styles.listContainer}
      >
        {items.length > 0 ? (
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            renderItem={renderReceivableItem}
          />
        ) : null}
      </ListContainer>

      <RescheduleModal
        visible={rescheduleVisible}
        initialDate={rescheduleItem?.dueDate || new Date()}
        onClose={() => {
          setRescheduleVisible(false);
          setRescheduleItem(null);
        }}
        onConfirm={handleConfirmReschedule}
      />

      <SnackbarUndo
        visible={undoVisible}
        message={undoMessage}
        onUndo={handleUndo}
        onDismiss={closeUndo}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  titleSection: { marginBottom: 0 },
  listContainer: { flex: 1 },
  listContent: { paddingBottom: 24 },
  emptyIcon: { opacity: 0.4 },
});

export default ChargesTodayScreen;
