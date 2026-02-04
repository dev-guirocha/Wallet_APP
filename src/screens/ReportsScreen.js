import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MonthPicker from '../components/MonthPicker';
import { useClientStore } from '../store/useClientStore';
import { fetchReceivablesForRange } from '../utils/firestoreService';
import { formatCurrency, getMonthKey, startOfDay, endOfDay } from '../utils/dateUtils';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const buildMonthStart = (monthKey) => {
  const [yearString, monthString] = String(monthKey).split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return startOfDay(new Date());
  return startOfDay(new Date(year, month - 1, 1));
};

const buildMonthEnd = (monthKey) => {
  const [yearString, monthString] = String(monthKey).split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return endOfDay(new Date());
  return endOfDay(new Date(year, month, 0));
};

const buildMonthKeyFromDate = (date) => getMonthKey(date);

const buildHistoryBuckets = (receivables, monthKeys) => {
  const buckets = {};
  monthKeys.forEach((key) => {
    buckets[key] = { monthKey: key, total: 0, paid: 0 };
  });

  receivables.forEach((item) => {
    const dueDate = item.dueDate?.toDate?.() || (item.dueDate ? new Date(item.dueDate) : null);
    if (!dueDate) return;
    const key = buildMonthKeyFromDate(dueDate);
    if (!buckets[key]) return;
    const amount = Number(item.amount || 0);
    if (!Number.isFinite(amount)) return;
    buckets[key].total += amount;
    if (item.paid) {
      buckets[key].paid += amount;
    }
  });

  return monthKeys.map((key) => buckets[key]);
};

const buildMonthKeys = (baseMonthKey) => {
  const [yearString, monthString] = String(baseMonthKey).split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const baseDate = Number.isFinite(year) && Number.isFinite(month)
    ? new Date(year, month - 1, 1)
    : new Date();

  const keys = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(baseDate);
    date.setMonth(baseDate.getMonth() - i);
    keys.push(getMonthKey(date));
  }
  return keys;
};

const ReportsScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const clients = useClientStore((state) => state.clients);

  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [summary, setSummary] = useState(null);
  const [clientRows, setClientRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const cacheKey = useMemo(() => {
    if (!currentUserId) return '';
    return `reports-cache-${currentUserId}-${monthKey}`;
  }, [currentUserId, monthKey]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;

    const loadCached = async () => {
      if (!cacheKey) return;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) return;
        const parsed = JSON.parse(cached);
        if (!active) return;
        setSummary(parsed.summary || null);
        setClientRows(parsed.clientRows || []);
        setHistory(parsed.history || []);
      } catch (error) {
        // ignore cache errors
      }
    };

    loadCached();
    return () => {
      active = false;
    };
  }, [cacheKey, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;

    const fetchData = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const monthStart = buildMonthStart(monthKey);
        const monthEnd = buildMonthEnd(monthKey);
        const receivables = await fetchReceivablesForRange({
          uid: currentUserId,
          startDate: monthStart,
          endDate: monthEnd,
        });

        const expected = receivables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const paid = receivables.reduce((sum, item) => sum + (item.paid ? Number(item.amount || 0) : 0), 0);
        const pending = expected - paid;
        const delinquencyPercent = expected > 0 ? (pending / expected) * 100 : 0;
        const chargesSent = receivables.reduce(
          (sum, item) => sum + (Array.isArray(item.chargeHistory) ? item.chargeHistory.length : 0),
          0
        );

        const clientsMap = new Map(clients.map((client) => [client.id, client]));
        const perClient = new Map();
        receivables.forEach((item) => {
          const clientId = item.clientId || 'unknown';
          const current = perClient.get(clientId) || {
            clientId,
            name: clientsMap.get(clientId)?.name || item.clientName || 'Cliente',
            expected: 0,
            paid: 0,
            charges: 0,
          };
          const amount = Number(item.amount || 0);
          current.expected += amount;
          if (item.paid) current.paid += amount;
          current.charges += Array.isArray(item.chargeHistory) ? item.chargeHistory.length : 0;
          perClient.set(clientId, current);
        });

        const clientRowsNext = Array.from(perClient.values()).map((item) => ({
          ...item,
          pending: item.expected - item.paid,
        }));

        clientRowsNext.sort((a, b) => b.pending - a.pending);

        const historyRangeStart = buildMonthStart(buildMonthKeys(monthKey)[0]);
        const historyRangeEnd = buildMonthEnd(monthKey);
        const historyReceivables = await fetchReceivablesForRange({
          uid: currentUserId,
          startDate: historyRangeStart,
          endDate: historyRangeEnd,
        });
        const historyKeys = buildMonthKeys(monthKey);
        const historyBuckets = buildHistoryBuckets(historyReceivables, historyKeys);

        if (!active) return;

        const summaryNext = {
          expected,
          paid,
          pending,
          delinquencyPercent,
          chargesSent,
        };

        setSummary(summaryNext);
        setClientRows(clientRowsNext);
        setHistory(historyBuckets);

        if (cacheKey) {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ summary: summaryNext, clientRows: clientRowsNext, history: historyBuckets })
          );
        }
      } catch (error) {
        if (!active) return;
        setLoadError('Não foi possível carregar o relatório.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [cacheKey, clients, currentUserId, monthKey]);

  const maxHistoryTotal = useMemo(() => {
    if (!history.length) return 1;
    return Math.max(...history.map((item) => item.total), 1);
  }, [history]);

  const renderClientRow = ({ item }) => (
    <TouchableOpacity
      style={styles.clientRow}
      onPress={() => navigation.navigate('ClientReport', { clientId: item.clientId, clientName: item.name })}
    >
      <View>
        <Text style={styles.clientName}>{item.name}</Text>
        <Text style={styles.clientMeta}>
          Previsto: {formatCurrency(item.expected)} • Pago: {formatCurrency(item.paid)}
        </Text>
        <Text style={styles.clientMeta}>
          Pendência: {formatCurrency(item.pending)} • Cobranças: {item.charges}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Relatórios</Text>
        </View>

        <MonthPicker monthKey={monthKey} onChange={setMonthKey} />

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : null}

        {loadError ? (
          <TouchableOpacity style={styles.errorCard} onPress={() => setMonthKey((prev) => prev)}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Text style={styles.errorHint}>Toque para tentar novamente</Text>
          </TouchableOpacity>
        ) : null}

        {summary ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Geral do mês</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Previsto</Text>
                <Text style={styles.summaryValue}>{formatCurrency(summary.expected)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Pago</Text>
                <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                  {formatCurrency(summary.paid)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Pendente</Text>
                <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
                  {formatCurrency(summary.pending)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Inadimplência</Text>
                <Text style={styles.summaryValue}>{summary.delinquencyPercent.toFixed(1)}%</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Cobranças enviadas</Text>
                <Text style={styles.summaryValue}>{summary.chargesSent}</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressPaid,
                  {
                    width: summary.expected > 0 ? `${(summary.paid / summary.expected) * 100}%` : '0%',
                  },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>Progresso de pagamentos</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimos 6 meses</Text>
          <View style={styles.historyRow}>
            {history.map((item) => {
              const height = Math.max(8, (item.total / maxHistoryTotal) * 80);
              return (
                <View key={item.monthKey} style={styles.historyItem}>
                  <View style={[styles.historyBar, { height }]} />
                  <Text style={styles.historyLabel}>{item.monthKey.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Clientes</Text>
        </View>

        {clientRows.length === 0 && !isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhum recebível neste mês.</Text>
          </View>
        ) : (
          <FlatList
            data={clientRows}
            keyExtractor={(item) => item.clientId}
            renderItem={renderClientRow}
            scrollEnabled={false}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingBottom: 80 },
  header: { marginBottom: 16 },
  title: { ...TYPOGRAPHY.display, color: COLORS.textPrimary },
  loading: { marginTop: 12 },
  errorCard: {
    marginTop: 12,
    backgroundColor: 'rgba(229,62,62,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.danger },
  errorHint: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    marginTop: 16,
  },
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.textSecondary, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryItem: { flex: 1 },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  summaryValue: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(26,32,44,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressPaid: { height: '100%', backgroundColor: COLORS.primary },
  progressLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 6 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  historyItem: { alignItems: 'center', flex: 1 },
  historyBar: {
    width: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  historyLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 6 },
  sectionHeader: { marginTop: 20, marginBottom: 10 },
  sectionTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  clientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  clientName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  clientMeta: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
});

export default ReportsScreen;
