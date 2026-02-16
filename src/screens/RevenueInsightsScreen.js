import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Feather as Icon } from '@expo/vector-icons';

import { AppScreen, Card, EmptyState, ScreenHeader } from '../components';
import { formatCurrency, getMonthKey } from '../utils/dateUtils';
import { useClientStore } from '../store/useClientStore';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';

const CHART_COLORS = ['#3182CE', '#38A169', '#D69E2E', '#E53E3E', '#805AD5', '#D53F8C', '#319795'];

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
};

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
  if (total <= 0) return null;

  const radius = 78;
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

const RevenueInsightsScreen = ({ activeMonth, navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const expenses = useClientStore((state) => state.expenses);
  const deleteExpense = useClientStore((state) => state.deleteExpense);

  const targetMonth = activeMonth || getMonthKey();

  const incomeData = useMemo(() => {
    const bucketMap = new Map();
    let received = 0;
    let expected = 0;

    clients.forEach((client) => {
      const value = Number(client.value || 0);
      expected += value;

      const isPaid = normalizePaymentStatus(client.payments?.[targetMonth]) === 'paid';
      if (isPaid) received += value;

      const label = normalizeLocationLabel(client.location);
      const key = label.toLowerCase();
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          id: key,
          label,
          value: 0,
          color: CHART_COLORS[bucketMap.size % CHART_COLORS.length],
        });
      }
      if (value > 0) {
        bucketMap.get(key).value += value;
      }
    });

    const pieSegments = Array.from(bucketMap.values());
    return { received, expected, pieSegments };
  }, [clients, targetMonth]);

  const expenseData = useMemo(() => {
    const list = expenses
      .filter((expense) => String(expense.date || '').startsWith(targetMonth))
      .slice()
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const total = list.reduce((sum, item) => sum + Number(item.value || 0), 0);
    return { total, list };
  }, [expenses, targetMonth]);

  const netIncome = incomeData.received - expenseData.total;

  const handleDeleteExpense = (id) => {
    Alert.alert('Excluir', 'Deseja remover esta despesa?', [
      { text: 'Cancelar' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteExpense(id) },
    ]);
  };

  return (
    <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.container}>
      <ScreenHeader title="Financeiro" navigation={navigation} />

      <TouchableOpacity
        style={styles.addExpenseBtn}
        onPress={() => navigation.navigate('AddExpense')}
      >
        <Icon name="minus-circle" size={16} color={COLORS.danger} style={styles.addExpenseIcon} />
        <Text style={styles.addExpenseText}>Lançar despesa</Text>
      </TouchableOpacity>

      <Card>
        <Text style={styles.cardHeader}>Resultado líquido</Text>
        <View style={styles.netBlock}>
          <Text style={[styles.netValue, { color: netIncome >= 0 ? COLORS.success : COLORS.danger }]}>
            {formatCurrency(netIncome)}
          </Text>
          <Text style={styles.netLabel}>Lucro real no mês</Text>
        </View>

        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Entradas</Text>
            <Text style={[styles.balanceValue, { color: COLORS.success }]}>
              {formatCurrency(incomeData.received)}
            </Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Saídas</Text>
            <Text style={[styles.balanceValue, { color: COLORS.danger }]}>
              {formatCurrency(expenseData.total)}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Histórico de despesas</Text>
      </View>

      {expenseData.list.length === 0 ? (
        <EmptyState
          title="Sem despesas no mês"
          message="Nenhuma despesa lançada neste mês."
          style={styles.emptyCard}
        />
      ) : (
        expenseData.list.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.expenseRow}
            onLongPress={() => handleDeleteExpense(item.id)}
          >
            <View style={styles.expenseIcon}>
              <Icon name="dollar-sign" size={16} color={COLORS.danger} />
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseTitle}>{item.title}</Text>
              <Text style={styles.expenseCategory}>{item.categoryLabel || item.category || 'Outros'}</Text>
            </View>
            <Text style={styles.expenseValue}>- {formatCurrency(item.value)}</Text>
          </TouchableOpacity>
        ))
      )}

      <Card style={styles.chartCard}>
        <Text style={styles.cardHeader}>Receitas por local</Text>
        <View style={styles.chartContainer}>
          {incomeData.pieSegments.length > 0 ? (
            <PieChart segments={incomeData.pieSegments} />
          ) : (
            <Text style={styles.emptyText}>Sem dados de receita.</Text>
          )}
        </View>
        {incomeData.pieSegments.length > 0 ? (
          <View style={styles.legendList}>
            {incomeData.pieSegments.map((segment) => (
              <View key={segment.id} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {segment.label}
                </Text>
                <Text style={styles.legendValue}>{formatCurrency(segment.value)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: 60 },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,62,62,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  addExpenseIcon: { marginRight: 6 },
  addExpenseText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.danger },
  cardHeader: { ...TYPOGRAPHY.overline, color: COLORS.textSecondary, marginBottom: 12 },
  netBlock: { alignItems: 'center', marginVertical: 10 },
  netValue: { ...TYPOGRAPHY.hero },
  netLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
  balanceRow: {
    flexDirection: 'row',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  balanceValue: { ...TYPOGRAPHY.subtitle },
  dividerVertical: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 10 },
  sectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(229,62,62,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseInfo: { flex: 1, paddingHorizontal: 12 },
  expenseTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  expenseCategory: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  expenseValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.danger },
  emptyCard: { marginTop: 4 },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center' },
  chartCard: { marginTop: 24 },
  chartContainer: { alignItems: 'center', marginTop: 10 },
  legendList: { marginTop: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendLabel: { ...TYPOGRAPHY.caption, color: COLORS.textPrimary, flex: 1 },
  legendValue: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
});

export default RevenueInsightsScreen;
