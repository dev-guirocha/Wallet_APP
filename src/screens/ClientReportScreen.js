import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import { useClientStore } from '../store/useClientStore';
import { fetchReceivablesForRange } from '../utils/firestoreService';
import { formatCurrency, getMonthKey, startOfDay, endOfDay } from '../utils/dateUtils';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const buildRangeForSixMonths = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: startOfDay(start), end: endOfDay(end) };
};

const buildMonthKeys = () => {
  const today = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(getMonthKey(date));
  }
  return keys;
};

const ClientReportScreen = ({ navigation, route }) => {
  const { clientId, clientName } = route.params || {};
  const currentUserId = useClientStore((state) => state.currentUserId);
  const clients = useClientStore((state) => state.clients);

  const [history, setHistory] = useState([]);
  const [avgValue, setAvgValue] = useState(0);
  const [avgDaysToPay, setAvgDaysToPay] = useState(0);
  const [chargeCount, setChargeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const resolvedName = useMemo(() => {
    const fromStore = clients.find((item) => item.id === clientId)?.name;
    return fromStore || clientName || 'Cliente';
  }, [clients, clientId, clientName]);

  useEffect(() => {
    if (!currentUserId || !clientId) return;
    let active = true;

    const fetchData = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const { start, end } = buildRangeForSixMonths();
        const receivables = await fetchReceivablesForRange({
          uid: currentUserId,
          startDate: start,
          endDate: end,
        });

        const clientReceivables = receivables.filter((item) => item.clientId === clientId);
        const totalAmount = clientReceivables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const avg = clientReceivables.length > 0 ? totalAmount / clientReceivables.length : 0;

        let totalDays = 0;
        let paidCount = 0;
        let charges = 0;

        clientReceivables.forEach((item) => {
          charges += Array.isArray(item.chargeHistory) ? item.chargeHistory.length : 0;
          if (!item.paidAt) return;
          const dueDate = item.dueDate?.toDate?.() || (item.dueDate ? new Date(item.dueDate) : null);
          const paidAt = item.paidAt?.toDate?.() || new Date(item.paidAt);
          if (!dueDate || !paidAt) return;
          const diffDays = Math.max(0, (paidAt.getTime() - dueDate.getTime()) / 86400000);
          totalDays += diffDays;
          paidCount += 1;
        });

        const historyKeys = buildMonthKeys();
        const buckets = historyKeys.map((key) => ({ monthKey: key, total: 0, paid: 0 }));
        const bucketMap = new Map(buckets.map((item) => [item.monthKey, item]));

        clientReceivables.forEach((item) => {
          const dueDate = item.dueDate?.toDate?.() || (item.dueDate ? new Date(item.dueDate) : null);
          if (!dueDate) return;
          const key = getMonthKey(dueDate);
          const bucket = bucketMap.get(key);
          if (!bucket) return;
          const amount = Number(item.amount || 0);
          bucket.total += amount;
          if (item.paid) bucket.paid += amount;
        });

        if (!active) return;

        setHistory(buckets);
        setAvgValue(avg);
        setAvgDaysToPay(paidCount > 0 ? totalDays / paidCount : 0);
        setChargeCount(charges);
      } catch (error) {
        if (!active) return;
        setLoadError('Não foi possível carregar o relatório do cliente.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [clientId, currentUserId]);

  const maxHistoryTotal = useMemo(() => {
    if (!history.length) return 1;
    return Math.max(...history.map((item) => item.total), 1);
  }, [history]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{resolvedName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumo (6 meses)</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Valor médio</Text>
            <Text style={styles.summaryValue}>{formatCurrency(avgValue)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Cobranças</Text>
            <Text style={styles.summaryValue}>{chargeCount}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tempo médio para pagar</Text>
            <Text style={styles.summaryValue}>{avgDaysToPay.toFixed(1)} dias</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Histórico 6 meses</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  loading: { marginTop: 16 },
  errorCard: {
    backgroundColor: 'rgba(229,62,62,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.danger },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    marginBottom: 16,
  },
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.textSecondary, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryItem: { flex: 1 },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  summaryValue: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  historyItem: { alignItems: 'center', flex: 1 },
  historyBar: {
    width: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  historyLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 6 },
});

export default ClientReportScreen;
