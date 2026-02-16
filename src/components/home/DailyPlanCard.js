import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { getDailyTasks, getTasksProgress } from '../../utils/dailyTasks';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

const resolveTaskIcon = (type) => {
  if (type === 'OVERDUE_CHARGE') return 'alert-triangle';
  if (type === 'TODAY_CHARGE') return 'clock';
  if (type === 'CONFIRM_APPOINTMENT') return 'message-circle';
  if (type === 'TODAY_APPOINTMENT') return 'check-circle';
  return 'award';
};

const resolveTaskButtonVariant = (type) => {
  if (type === 'OVERDUE_CHARGE') return 'primary';
  if (type === 'TODAY_CHARGE') return 'primary';
  return 'secondary';
};

const resolveRemainingLabel = (remainingCount) => {
  if (remainingCount <= 0) return 'Tudo em dia';
  if (remainingCount === 1) return '1 tarefa restante';
  return `${remainingCount} tarefas restantes`;
};

export function DailyPlanCard({
  receivables = [],
  appointments = [],
  today = new Date(),
  completedTaskIds = [],
  runningTaskIds = [],
  loading = false,
  onRunTask,
  style,
}) {
  const tasks = useMemo(
    () =>
      getDailyTasks({
        receivables,
        appointments,
        today,
      }),
    [appointments, receivables, today]
  );

  const progress = useMemo(
    () => getTasksProgress(tasks, completedTaskIds),
    [completedTaskIds, tasks]
  );

  const completedSet = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);
  const pendingTasks = useMemo(
    () => tasks.filter((task) => !completedSet.has(task.id)).slice(0, 3),
    [completedSet, tasks]
  );

  const runningSet = useMemo(() => new Set(runningTaskIds), [runningTaskIds]);
  const remaining = Math.max(progress.total - progress.done, 0);

  return (
    <Card style={style}>
      <Text style={styles.title}>Plano de hoje</Text>
      <Text style={styles.subtitle}>{resolveRemainingLabel(remaining)}</Text>

      {loading ? (
        <View style={styles.loadingBlock}>
          <LoadingSkeleton width="45%" height={14} style={styles.loadingSpacing} />
          <LoadingSkeleton width="75%" height={16} style={styles.loadingSpacing} />
          <LoadingSkeleton width="100%" height={40} rounded="sm" />
        </View>
      ) : pendingTasks.length === 0 ? (
        <EmptyState
          icon={<Icon name="check" size={28} color={COLORS.success} />}
          title="Sem tarefas pendentes"
          message="Seu dia está organizado."
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.tasks}>
          {pendingTasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={styles.taskMain}>
                <View style={styles.taskIcon}>
                  <Icon name={resolveTaskIcon(task.type)} size={16} color={COLORS.primary} />
                </View>
                <View style={styles.taskTextBlock}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={styles.taskSubtitle} numberOfLines={2}>
                    {task.subtitle}
                  </Text>
                </View>
              </View>

              <Button
                label={task.actionLabel || 'Executar'}
                variant={resolveTaskButtonVariant(task.type)}
                loading={runningSet.has(task.id)}
                disabled={runningSet.has(task.id)}
                onPress={() => onRunTask?.(task)}
                style={styles.taskButton}
                textStyle={styles.taskButtonText}
              />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  tasks: {
    gap: 12,
  },
  taskRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 10,
    backgroundColor: COLORS.background,
  },
  taskMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  taskIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(43,108,176,0.14)',
  },
  taskTextBlock: {
    flex: 1,
  },
  taskTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  taskSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  taskButton: {
    minHeight: 38,
    paddingVertical: 7,
  },
  taskButtonText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  loadingBlock: {
    marginTop: 2,
  },
  loadingSpacing: {
    marginBottom: 10,
  },
  emptyState: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
});

