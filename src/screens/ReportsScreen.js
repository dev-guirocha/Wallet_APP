import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

import MonthPicker from '../components/MonthPicker';
import {
  AppScreen,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SegmentedControl,
  ScreenHeader,
} from '../components';
import { useClientStore } from '../store/useClientStore';
import { fetchReceivablesForRange } from '../utils/firestoreService';
import { formatCurrency, getMonthKey, startOfDay, endOfDay } from '../utils/dateUtils';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';
import { emptyMessages, reportMetricLabels } from '../utils/uiCopy';

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

const CHART_MODES = [
  { key: 'REVENUE', label: reportMetricLabels.REVENUE, color: COLORS.info },
  { key: 'RECEIVED', label: reportMetricLabels.RECEIVED, color: COLORS.success },
  { key: 'LOST', label: reportMetricLabels.LOST, color: COLORS.danger },
];

const resolveDueDate = (value) => {
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  const parsed = value ? new Date(value) : null;
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null;
  return parsed;
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
  const [monthReceivables, setMonthReceivables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [chartMode, setChartMode] = useState('REVENUE');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('');
  const chartModeOptions = useMemo(
    () => CHART_MODES.map((mode) => ({ key: mode.key, label: mode.label })),
    []
  );
  const keyExtractorClient = useCallback((item) => item.clientId, []);
  const handleSelectChartMode = useCallback((nextMode) => setChartMode(nextMode), []);
  const handleRetryLoad = useCallback(() => {
    setReloadNonce((prev) => prev + 1);
  }, []);

  const cacheKey = useMemo(() => {
    if (!currentUserId) return '';
    return `reports-cache-${currentUserId}-${monthKey}`;
  }, [currentUserId, monthKey]);

  useEffect(() => {
    setSelectedPeriodKey('');
  }, [monthKey, chartMode]);

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
        setMonthReceivables(parsed.receivables || []);
      } catch (_error) {
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
        setMonthReceivables(receivables);

        if (cacheKey) {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              summary: summaryNext,
              clientRows: clientRowsNext,
              locationRows,
              receivables,
            })
          );
        }
      } catch (_error) {
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
  }, [cacheKey, clients, currentUserId, monthKey, reloadNonce]);

  const totalByLocation = useMemo(
    () => incomeByLocation.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [incomeByLocation]
  );

  const periods = useMemo(() => {
    const base = Array.from({ length: 5 }).map((_, index) => ({
      key: `W${index + 1}`,
      label: `Sem ${index + 1}`,
      revenue: 0,
      received: 0,
      lost: 0,
    }));

    monthReceivables.forEach((item) => {
      const dueDate = resolveDueDate(item?.dueDate);
      if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) return;
      const day = dueDate.getDate();
      const bucketIndex = Math.min(4, Math.floor((day - 1) / 7));
      const amount = Number(item?.amount || 0);
      if (!Number.isFinite(amount)) return;

      const bucket = base[bucketIndex];
      bucket.revenue += amount;
      if (item?.paid) {
        bucket.received += amount;
      } else {
        bucket.lost += amount;
      }
    });

    return base;
  }, [monthReceivables]);

  const getPeriodValue = (period, mode) => {
    if (mode === 'RECEIVED') return Number(period?.received || 0);
    if (mode === 'LOST') return Number(period?.lost || 0);
    return Number(period?.revenue || 0);
  };

  const chartModeConfig = useMemo(
    () => CHART_MODES.find((mode) => mode.key === chartMode) || CHART_MODES[0],
    [chartMode]
  );

  const maxPeriodValue = useMemo(() => {
    const values = periods.map((period) => getPeriodValue(period, chartMode));
    return Math.max(1, ...values);
  }, [chartMode, periods]);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.key === selectedPeriodKey) || null,
    [periods, selectedPeriodKey]
  );

  const selectedPeriodValue = selectedPeriod ? getPeriodValue(selectedPeriod, chartMode) : 0;

  const modeTotal = useMemo(
    () => periods.reduce((sum, period) => sum + getPeriodValue(period, chartMode), 0),
    [chartMode, periods]
  );

  const interpretationText = useMemo(() => {
    if (!summary) return emptyMessages.reports.noDataInterpretation;

    if (summary.pending <= 0) {
      return emptyMessages.reports.interpretationHealthy;
    }
    if (summary.delinquencyPercent >= 35) {
      return emptyMessages.reports.interpretationHighDelinquency;
    }
    if (summary.paid >= summary.expected * 0.75) {
      return emptyMessages.reports.interpretationGoodRhythm;
    }
    return emptyMessages.reports.interpretationRecovery;
  }, [summary]);

  const hasReportData = useMemo(
    () =>
      Boolean(summary) ||
      clientRows.length > 0 ||
      incomeByLocation.length > 0 ||
      monthReceivables.length > 0,
    [clientRows.length, incomeByLocation.length, monthReceivables.length, summary]
  );

  const shouldShowLoadingSkeleton = isLoading && !hasReportData && !loadError;

  const renderClientRow = useCallback(
    ({ item }) => (
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
    ),
    [navigation]
  );

  return (
    <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.container}>
      <ScreenHeader title="Relatórios" navigation={navigation} />

      <MonthPicker monthKey={monthKey} onChange={setMonthKey} />

      {shouldShowLoadingSkeleton ? (
        <View style={styles.loading}>
          <LoadingSkeleton width="100%" height={130} style={styles.loadingBlock} />
          <LoadingSkeleton width="100%" height={220} style={styles.loadingBlock} />
        </View>
      ) : null}

      {loadError ? (
        <ErrorState
          title="Falha ao carregar relatório"
          message={loadError}
          onRetry={handleRetryLoad}
          style={styles.errorCard}
        />
      ) : null}

      {summary ? (
        <Card style={styles.card}>
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
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Leitura do mês</Text>
        <Text style={styles.interpretationText}>{interpretationText}</Text>

        <SegmentedControl
          options={chartModeOptions}
          value={chartMode}
          onChange={handleSelectChartMode}
          style={styles.modeSwitchRow}
        />

        <View style={styles.periodChartRow}>
          {periods.map((period) => {
            const value = getPeriodValue(period, chartMode);
            const barHeightPercent = Math.max(10, (value / maxPeriodValue) * 100);
            const isActive = selectedPeriodKey === period.key;
            return (
              <TouchableOpacity
                key={period.key}
                style={styles.periodItem}
                onPress={() => setSelectedPeriodKey(period.key)}
                accessibilityRole="button"
                accessibilityLabel={`Ver resumo da ${period.label}`}
              >
                <View style={[styles.periodBarBase, isActive && styles.periodBarBaseActive]}>
                  <View
                    style={[
                      styles.periodBarFill,
                      { height: `${barHeightPercent}%`, backgroundColor: chartModeConfig.color },
                    ]}
                  />
                </View>
                <Text style={styles.periodLabel}>{period.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedPeriod ? (
          <Text style={styles.periodSummary}>
            {selectedPeriod.label}: {chartModeConfig.label.toLowerCase()} de {formatCurrency(selectedPeriodValue)}
            {' '}({modeTotal > 0 ? ((selectedPeriodValue / modeTotal) * 100).toFixed(1) : '0.0'}% do mês).
          </Text>
        ) : (
          <Text style={styles.periodSummaryHint}>{emptyMessages.reports.periodHint}</Text>
        )}
      </Card>

      <Card style={styles.card}>
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
          <EmptyState
            title="Sem receita por local"
            message="Sem receita para exibir por local neste mês."
            style={styles.emptyCard}
          />
        )}
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Clientes</Text>
      </View>

      {clientRows.length === 0 && !isLoading ? (
        <EmptyState
          title="Sem recebíveis no mês"
          message="Nenhum recebível neste mês."
          style={styles.emptyCard}
        />
      ) : (
        <FlatList
          data={clientRows}
          keyExtractor={keyExtractorClient}
          renderItem={renderClientRow}
          scrollEnabled={false}
        />
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: 80 },
  loading: { marginTop: 12 },
  loadingBlock: { marginBottom: 10 },
  errorCard: { marginTop: 12 },
  card: { marginTop: 16 },
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.textSecondary, marginBottom: 12 },
  interpretationText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  modeSwitchRow: {
    marginBottom: 14,
  },
  periodChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  periodItem: {
    flex: 1,
    alignItems: 'center',
  },
  periodBarBase: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(148,163,184,0.12)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 4,
  },
  periodBarBaseActive: {
    borderColor: COLORS.info,
  },
  periodBarFill: {
    width: '100%',
    borderRadius: 8,
    minHeight: 6,
  },
  periodLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  periodSummary: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
  },
  periodSummaryHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
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
  emptyCard: { marginTop: 8 },
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
