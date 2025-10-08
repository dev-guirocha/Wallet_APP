import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { formatCurrency, getMonthKey } from '../utils/dateUtils';

const COLOR_PALETTE = ['#4C6EF5', '#F76707', '#12B886', '#845EF7', '#FF922B', '#51CF66', '#15AABF', '#E64980'];

const normalizeLocationLabel = (value) => {
  if (!value) return 'Sem local';
  const label = String(value).trim();
  return label.length > 0 ? label : 'Sem local';
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

const PieChart = ({ segments }) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Sem dados suficientes para gerar o gráfico.</Text>
      </View>
    );
  }

  const radius = 90;
  const size = radius * 2 + 10;
  let cumulativeAngle = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((segment) => {
        const angle = (segment.value / total) * 360;
        if (angle <= 0) {
          return null;
        }
        const path = describeArc(radius + 5, radius + 5, radius, cumulativeAngle, cumulativeAngle + angle);
        cumulativeAngle += angle;
        return <Path key={segment.id} d={path} fill={segment.color} />;
      })}
    </Svg>
  );
};

const RevenueInsightsScreen = ({ clients = [], activeMonth }) => {
  const previousMonthKey = useMemo(() => {
    if (!activeMonth) return null;
    const [yearString, monthString] = activeMonth.split('-');
    const year = Number(yearString);
    const month = Number(monthString);
    if (!year || !month) return null;
    const baseDate = new Date(year, month - 1, 1);
    baseDate.setMonth(baseDate.getMonth() - 1);
    return getMonthKey(baseDate);
  }, [activeMonth]);

  const insights = useMemo(() => {
    const bucketMap = new Map();

    clients.forEach((client) => {
      const label = normalizeLocationLabel(client.location);
      const key = label.toLowerCase();
      if (!bucketMap.has(key)) {
        const color = COLOR_PALETTE[bucketMap.size % COLOR_PALETTE.length];
        bucketMap.set(key, {
          id: key,
          label,
          color,
          expectedCurrent: 0,
          receivedCurrent: 0,
          expectedPrevious: 0,
          receivedPrevious: 0,
        });
      }

      const bucket = bucketMap.get(key);
      const value = Number(client.value || 0);
      const payments = client.payments ?? {};

      bucket.expectedCurrent += value;
      if (payments[activeMonth]?.status === 'paid') {
        bucket.receivedCurrent += value;
      }

      if (previousMonthKey) {
        bucket.expectedPrevious += value;
        if (payments[previousMonthKey]?.status === 'paid') {
          bucket.receivedPrevious += value;
        }
      }
    });

    const items = Array.from(bucketMap.values()).map((item) => ({
      ...item,
      pendingCurrent: Math.max(item.expectedCurrent - item.receivedCurrent, 0),
      difference: item.receivedCurrent - item.receivedPrevious,
    }));

    const totalExpected = items.reduce((sum, item) => sum + item.expectedCurrent, 0);
    const totalReceived = items.reduce((sum, item) => sum + item.receivedCurrent, 0);
    const topCategory = items.reduce(
      (top, item) => (item.receivedCurrent > (top?.receivedCurrent ?? 0) ? item : top),
      null,
    );

    return {
      items,
      totalExpected,
      totalReceived,
      topCategory,
    };
  }, [clients, activeMonth, previousMonthKey]);

  const pieSegments = useMemo(
    () =>
      insights.items
        .filter((item) => item.expectedCurrent > 0)
        .map((item) => ({ id: item.id, value: item.expectedCurrent, color: item.color })),
    [insights.items],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Visão de Receitas</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distribuição por categoria</Text>
          <View style={styles.chartWrapper}>
            <PieChart segments={pieSegments} />
            <View style={styles.legend}>
              {insights.items.length === 0 ? (
                <Text style={styles.legendEmpty}>Cadastre clientes para visualizar a distribuição por local.</Text>
              ) : (
                insights.items.map((item) => (
                  <View key={item.id} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <View style={styles.legendTextBlock}>
                      <Text style={styles.legendLabel}>{item.label}</Text>
                      <Text style={styles.legendValue}>R$ {formatCurrency(item.expectedCurrent)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo financeiro</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total previsto</Text>
              <Text style={styles.summaryValue}>R$ {formatCurrency(insights.totalExpected)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Recebido</Text>
              <Text style={styles.summaryValue}>R$ {formatCurrency(insights.totalReceived)}</Text>
            </View>
          </View>
          {insights.topCategory ? (
            <View style={styles.topCategoryBanner}>
              <Text style={styles.topCategoryLabel}>Maior receita</Text>
              <Text style={styles.topCategoryValue}>
                {insights.topCategory.label} — R$ {formatCurrency(insights.topCategory.receivedCurrent)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comparativo mensal</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableCellCategory]}>Categoria</Text>
            <Text style={styles.tableCell}>Mês atual</Text>
            <Text style={styles.tableCell}>Mês anterior</Text>
            <Text style={styles.tableCell}>Diferença</Text>
          </View>
          {insights.items.length === 0 ? (
            <View style={styles.tableEmptyState}>
              <Text style={styles.tableEmptyText}>Sem dados para comparação. Adicione clientes e marque pagamentos.</Text>
            </View>
          ) : (
            insights.items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableCellCategory]}>{item.label}</Text>
                <Text style={styles.tableCell}>R$ {formatCurrency(item.receivedCurrent)}</Text>
                <Text style={styles.tableCell}>R$ {formatCurrency(item.receivedPrevious)}</Text>
                <Text style={[styles.tableCell, item.difference >= 0 ? styles.positiveText : styles.negativeText]}>
                  {item.difference >= 0 ? '+' : ''}R$ {formatCurrency(item.difference)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E4E2DD' },
  container: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1E1E1E', marginBottom: 24 },
  card: {
    backgroundColor: 'rgba(30,30,30,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#5D5D5D', marginBottom: 18, textTransform: 'uppercase' },
  chartWrapper: { flexDirection: 'row', alignItems: 'center' },
  legend: { flex: 1, marginLeft: 18 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  legendDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  legendTextBlock: { flex: 1 },
  legendLabel: { fontSize: 14, fontWeight: '600', color: '#1E1E1E' },
  legendValue: { fontSize: 13, color: 'rgba(30,30,30,0.7)', marginTop: 2 },
  legendEmpty: { fontSize: 13, color: 'rgba(30,30,30,0.7)', lineHeight: 18 },
  chartPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: { color: '#5D5D5D', fontSize: 13, textAlign: 'center' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  summaryBox: { flex: 1 },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(30,30,30,0.12)', marginHorizontal: 16 },
  summaryLabel: { fontSize: 12, color: '#5D5D5D', marginBottom: 4, textTransform: 'uppercase' },
  summaryValue: { fontSize: 18, fontWeight: '600', color: '#1E1E1E' },
  topCategoryBanner: {
    marginTop: 18,
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  topCategoryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  topCategoryValue: { fontSize: 16, color: '#FFF', fontWeight: '600', marginTop: 6 },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,30,30,0.1)',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,30,30,0.05)',
  },
  tableCell: { flex: 1, fontSize: 13, color: '#1E1E1E', textAlign: 'right' },
  tableCellCategory: { textAlign: 'left', fontWeight: '600' },
  positiveText: { color: '#2F9E44', fontWeight: '600' },
  negativeText: { color: '#E03131', fontWeight: '600' },
  tableEmptyState: { paddingVertical: 18 },
  tableEmptyText: { textAlign: 'center', color: 'rgba(30,30,30,0.7)', fontSize: 13 },
});

export default RevenueInsightsScreen;
