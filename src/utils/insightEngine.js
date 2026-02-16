const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveMetrics = (data = {}) => {
  const revenue = safeNumber(data?.revenue ?? data?.paidIn ?? data?.incoming ?? 0);
  const totalReceivables = Math.max(1, safeNumber(data?.totalReceivables ?? data?.receivablesCount ?? 0));
  const paidReceivables = safeNumber(data?.paidReceivables ?? data?.paidCount ?? 0);
  const overdueReceivables = safeNumber(data?.overdueReceivables ?? data?.overdueCount ?? 0);
  const totalAppointments = Math.max(1, safeNumber(data?.totalAppointments ?? data?.appointmentsCount ?? 0));
  const canceledAppointments = safeNumber(data?.canceledAppointments ?? data?.cancellations ?? 0);
  const missedLoss = safeNumber(data?.missedLoss ?? data?.absenceLoss ?? 0);

  return {
    revenue,
    collectionRate: paidReceivables / totalReceivables,
    overdueRate: overdueReceivables / totalReceivables,
    cancellationRate: canceledAppointments / totalAppointments,
    missedLoss,
  };
};

export const getMonthlyInsights = (currentMonthData = {}, previousMonthData = {}) => {
  const current = resolveMetrics(currentMonthData);
  const previous = resolveMetrics(previousMonthData);
  const insights = [];

  if (current.collectionRate - previous.collectionRate >= 0.08) {
    insights.push('Melhora cobrança neste mês.');
  } else if (current.collectionRate - previous.collectionRate <= -0.08) {
    insights.push('Cobrança enfraqueceu no comparativo mensal.');
  }

  if (current.overdueRate - previous.overdueRate >= 0.06) {
    insights.push('Piora inadimplência; priorize clientes críticos.');
  } else if (previous.overdueRate - current.overdueRate >= 0.06) {
    insights.push('Inadimplência recuou em relação ao mês anterior.');
  }

  if (previous.revenue > 0 && (current.revenue - previous.revenue) / previous.revenue >= 0.08) {
    insights.push('Crescimento receita no mês.');
  } else if (previous.revenue > 0 && (previous.revenue - current.revenue) / previous.revenue >= 0.08) {
    insights.push('Receita abaixo do mês anterior.');
  }

  if (current.missedLoss > previous.missedLoss * 1.1 && current.missedLoss > 0) {
    insights.push('Perda por faltas aumentou neste mês.');
  } else if (previous.missedLoss > 0 && current.missedLoss < previous.missedLoss * 0.9) {
    insights.push('Perda por faltas caiu no comparativo.');
  }

  if (insights.length === 0) {
    insights.push('Mês estável até agora, sem variações críticas.');
  }

  const defaults = [
    'Acompanhe os recebimentos para manter previsibilidade.',
    'Reforçar lembretes antecipados ajuda a reduzir atrasos.',
    'Monitorar faltas pode proteger sua receita.',
  ];

  const unique = Array.from(new Set([...insights, ...defaults]));
  return unique.slice(0, 3);
};

