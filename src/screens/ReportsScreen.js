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
import { Feather as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

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

const CHART_COLORS = ['#3182CE', '#38A169', '#D69E2E', '#E53E3E', '#805AD5', '#D53F8C', '#319795'];

const normalizeLocationLabel = (value) => {
  if (!value) return 'Sem local';
  const normalized = String(value).trim();
  return normalized || 'Sem local';
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'L',
    x,
    y,
    'Z',
  ].join(' ');
};

const PieChart = ({ segments = [] }) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  const radius = 74;
  const size = radius * 2 + 10;
  let cumulativeAngle = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((segment) => {
        const angle = (segment.value / total) * 360;
        if (angle <= 0) return null;
        const path = describeArc(radius + 5, radius + 5, radius, cumulativeAngle, cumulativeAngle + angle);
        cumulativeAngle += angle;
        return <Path key={segment.id} d={path} fill={segment.color} />;
      })}
    </Svg>
  );
};

const ReportsScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const clients = useClientStore((state) => state.clients);

  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [summary, setSummary] = useState(null);
  const [clientRows, setClientRows] = useState([]);
  const [incomeByLocation, setIncomeByLocation] = useState([]);
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
        setIncomeByLocation(parsed.locationRows || []);
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
        const locationMap = new Map();
        receivables.forEach((item) => {
          const amount = Number(item.amount || 0);
          if (!Number.isFinite(amount) || amount <= 0) return;
          const client = clientsMap.get(item.clientId);
          const label = normalizeLocationLabel(client?.location);
          const key = label.toLowerCase();
          if (!locationMap.has(key)) {
            locationMap.set(key, {
              id: key,
              label,
              value: 0,
              color: CHART_COLORS[locationMap.size % CHART_COLORS.length],
            });
          }
          locationMap.get(key).value += amount;
        });
        const locationRows = Array.from(locationMap.values()).sort((a, b) => b.value - a.value);

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
        setIncomeByLocation(locationRows);

        if (cacheKey) {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ summary: summaryNext, clientRows: clientRowsNext, locationRows })
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

  const totalByLocation = useMemo(
    () => incomeByLocation.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [incomeByLocation]
  );

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
          <Text style={styles.cardTitle}>Origem da renda por local</Text>
          {incomeByLocation.length > 0 ? (
            <>
              <View style={styles.pieContainer}>
                <PieChart segments={incomeByLocation} />
              </View>
              <View style={styles.legendList}>
                {incomeByLocation.map((item) => {
                  const percentage = totalByLocation > 0 ? (item.value / totalByLocation) * 100 : 0;
                  return (
                    <View key={item.id} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.legendValue}>
                        {formatCurrency(item.value)} ({percentage.toFixed(1)}%)
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Sem receita para exibir por local neste mês.</Text>
            </View>
          )}
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
  pieContainer: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  legendList: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { ...TYPOGRAPHY.caption, color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  legendValue: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
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
