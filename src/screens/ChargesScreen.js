import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import {
  endOfDay,
  getDateKey,
  getMonthKey,
  parseDateKeyToDate,
  startOfDay,
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
import { sortReceivablesByRisk } from '../utils/riskAnalysis';
import {
  AppScreen,
  ListContainer,
  SegmentedControl,
  SnackbarUndo,
  SectionHeader,
} from '../components';
import RescheduleModal from '../components/RescheduleModal';
import { ReceivableCard } from '../components/charges/ReceivableCard';
import {
  actionLabels,
  emptyMessages,
  getChargesEmptyMessage,
  titles,
} from '../utils/uiCopy';

const DEFAULT_CHARGE_TEMPLATE = 'Olá {nome}, sua cobrança vence em {data}.';

const FILTER_OPTIONS = [
  { key: 'DUE_TODAY', label: titles.today },
  { key: 'TOMORROW', label: titles.tomorrow },
  { key: 'OVERDUE', label: titles.overdue },
  { key: 'NEXT_7_DAYS', label: '7 dias' },
  { key: 'ALL', label: 'Todas' },
];

const resolveFilterKey = (value, fallback = 'ALL') => {
  if (!value) return fallback;
  const normalized = String(value).toUpperCase();
  const aliases = {
    TODAY: 'DUE_TODAY',
    HOJE: 'DUE_TODAY',
    TOMORROW: 'TOMORROW',
    AMANHA: 'TOMORROW',
    AMANHÃ: 'TOMORROW',
    OVERDUE: 'OVERDUE',
    ATRASADAS: 'OVERDUE',
    NEXT_7_DAYS: 'NEXT_7_DAYS',
    SEVEN_DAYS: 'NEXT_7_DAYS',
    ALL: 'ALL',
    TODAS: 'ALL',
  };
  return aliases[normalized] || fallback;
};

const isSameCalendarDay = (left, right) => {
  if (!(left instanceof Date) || !(right instanceof Date)) return false;
  return (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );
};

const resolveReceivableDueDate = (receivable) => {
  const fromTimestamp = toDate(receivable?.dueDate);
  if (fromTimestamp instanceof Date && !Number.isNaN(fromTimestamp.getTime())) return fromTimestamp;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const resolveSortPriority = (dueDate, todayStart, todayEnd, sevenDaysEnd) => {
  if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) return 4;
  const ms = dueDate.getTime();
  if (ms < todayStart.getTime()) return 0;
  if (ms >= todayStart.getTime() && ms <= todayEnd.getTime()) return 1;
  if (ms > todayEnd.getTime() && ms <= sevenDaysEnd.getTime()) return 2;
  return 3;
};

const ChargesScreen = ({ navigation, route }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const clients = useClientStore((state) => state.clients);
  const setClientPaymentStatus = useClientStore((state) => state.setClientPaymentStatus);

  const isReceiveMode = route?.params?.mode === 'receive';

  const [receivables, setReceivables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [payingId, setPayingId] = useState(null);
  const [chargingId, setChargingId] = useState(null);
  const [syncStateById, setSyncStateById] = useState({});
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState(
    resolveFilterKey(route?.params?.initialFilter, isReceiveMode ? 'DUE_TODAY' : 'ALL')
  );
  const segmentedFilterOptions = useMemo(() => FILTER_OPTIONS, []);
  const retryActionRef = useRef({});
  const undoActionRef = useRef(null);

  useEffect(() => {
    const nextFilter = resolveFilterKey(route?.params?.initialFilter, isReceiveMode ? 'DUE_TODAY' : 'ALL');
    setActiveFilter(nextFilter);
  }, [isReceiveMode, route?.params?.initialFilter]);

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

  const allItems = useMemo(() => {
    const clientsMap = new Map(clients.map((client) => [client.id, client]));
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(todayStart);
    const sevenDaysEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 6));

    const mappedItems = sortReceivablesByRisk(
      receivables.map((receivable) => {
        const client = clientsMap.get(receivable.clientId);
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
        const sortPriority = resolveSortPriority(dueDate, todayStart, todayEnd, sevenDaysEnd);

        return {
          id: receivable.id,
          clientId: receivable.clientId,
          name,
          amount,
          dueDate,
          phoneE164,
          receivable,
          chargeDate,
          hasCharge,
          sortPriority,
        };
      })
    );

    return mappedItems.sort((left, right) => {
      const byPriority = left.sortPriority - right.sortPriority;
      if (byPriority !== 0) return byPriority;
      if (left.riskLevel !== right.riskLevel) {
        const riskWeight = { LOW: 0, MEDIUM: 1, HIGH: 2 };
        return (riskWeight[right.riskLevel] || 0) - (riskWeight[left.riskLevel] || 0);
      }
      const leftMs = left.dueDate instanceof Date ? left.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const rightMs = right.dueDate instanceof Date ? right.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (leftMs !== rightMs) return leftMs - rightMs;
      if (left.hasCharge !== right.hasCharge) return left.hasCharge ? -1 : 1;
      return String(left.name).localeCompare(String(right.name));
    });
  }, [clients, receivables]);

  const filteredItems = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(todayStart);
    const sevenDaysEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 6));
    const tomorrowStart = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1));

    if (activeFilter === 'DUE_TODAY') {
      return allItems.filter((item) => item.dueDate && isSameCalendarDay(item.dueDate, todayStart));
    }
    if (activeFilter === 'TOMORROW') {
      return allItems.filter((item) => item.dueDate && isSameCalendarDay(item.dueDate, tomorrowStart));
    }
    if (activeFilter === 'OVERDUE') {
      return allItems.filter((item) => item.dueDate instanceof Date && item.dueDate.getTime() < todayStart.getTime());
    }
    if (activeFilter === 'NEXT_7_DAYS') {
      return allItems.filter((item) => {
        if (!(item.dueDate instanceof Date)) return false;
        const dueMs = item.dueDate.getTime();
        return dueMs > todayEnd.getTime() && dueMs <= sevenDaysEnd.getTime();
      });
    }
    return allItems;
  }, [activeFilter, allItems]);

  const setSyncState = useCallback((id, state, retryAction = null) => {
    if (!id) return;
    setSyncStateById((prev) => ({ ...prev, [id]: state }));
    if (retryAction) {
      retryActionRef.current[id] = retryAction;
      return;
    }
    delete retryActionRef.current[id];
  }, []);

  const handleChangeFilter = useCallback((nextFilter) => {
    setActiveFilter(nextFilter);
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
    setUndoVisible(false);
    setUndoMessage('');
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
          onPress: () => {
            if (item.clientId) {
              navigation.navigate('AddClient', { clientId: item.clientId });
              return;
            }
            navigation.navigate('ClientDetail', { clientId: item.clientId });
          },
        },
      ]);
      return;
    }

    const template = templates?.chargeMsg?.trim() || DEFAULT_CHARGE_TEMPLATE;
    const dueEnd = endOfDay(dueDate);
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
        Alert.alert('Cobrança', 'Não foi possível enviar a cobrança agora.');
      } finally {
        setChargingId(null);
      }
    });

    if (blocked) {
      return;
    }
  }, [chargingId, currentUserId, markSyncSaved, navigation, setSyncState, templates]);

  const handleMarkAsPaid = useCallback((item) => {
    if (!item || !currentUserId || payingId) return;
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
  }, [currentUserId, markSyncSaved, openUndo, payingId, receivables, setClientPaymentStatus, setSyncState]);

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
          onPress={() => navigation.goBack()}
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
            title={isReceiveMode ? actionLabels.receive : 'Cobranças'}
            style={styles.titleSection}
          />
        </View>
      </View>

      <SegmentedControl
        options={segmentedFilterOptions}
        value={activeFilter}
        onChange={handleChangeFilter}
        style={styles.filtersRow}
      />

      <ListContainer
        loading={isLoading && filteredItems.length === 0}
        error={loadError && filteredItems.length === 0 ? loadError : ''}
        isEmpty={!isLoading && !loadError && filteredItems.length === 0}
        emptyIcon={<Icon name="check-circle" size={40} color={COLORS.textSecondary} style={styles.emptyIcon} />}
        emptyTitle={emptyMessages.charges.title}
        emptyMessage={getChargesEmptyMessage({
          filterKey: activeFilter,
          mode: isReceiveMode ? 'receive' : 'default',
        })}
        style={styles.listContainer}
      >
        {filteredItems.length > 0 ? (
          <FlatList
            data={filteredItems}
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
    marginBottom: 16,
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
  filtersRow: {
    marginBottom: 16,
  },
  listContainer: { flex: 1 },
  listContent: { paddingBottom: 24 },
  emptyIcon: { opacity: 0.4 },
});

export default ChargesScreen;
