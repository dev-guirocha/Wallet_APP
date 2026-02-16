import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { MoneyText } from '../ui/MoneyText';
import { StatusPill } from '../ui/StatusPill';
import { colors, spacing, typography } from '../../theme';
import { toDate } from '../../utils/dateUtils';
import { groupByBucket } from '../../utils/grouping';
import { feedCopy, getEventA11yLabel } from '../../utils/uiCopy';

const GROUP_ORDER = ['today', 'yesterday', 'week'];
const GROUP_LABELS = {
  today: feedCopy.groups.TODAY,
  yesterday: feedCopy.groups.YESTERDAY,
  week: feedCopy.groups.WEEK,
};

const IMPORTANCE_META = {
  high: {
    color: colors.danger,
    label: feedCopy.importance.high,
    status: 'OVERDUE',
  },
  medium: {
    color: colors.warning,
    label: feedCopy.importance.medium,
    status: 'PENDING',
  },
  low: {
    color: colors.info,
    label: feedCopy.importance.low,
    status: 'SCHEDULED',
  },
};

const normalizeImportance = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
};

const resolveIconName = (type) => {
  const normalized = String(type || '').toUpperCase();

  if (normalized === 'PAID') return 'check-circle';
  if (normalized === 'CHARGE_SENT') return 'send';
  if (normalized === 'RESCHEDULED') return 'calendar';
  if (normalized === 'EDITED') return 'edit-2';
  if (normalized === 'INSIGHT') return 'bar-chart-2';
  if (normalized.includes('PREDICT')) return 'activity';
  if (normalized.includes('RISK')) return 'alert-triangle';
  if (normalized.includes('APPOINTMENT')) return 'clock';
  if (normalized.includes('CLIENT')) return 'user';

  return 'bell';
};

const normalizeItem = (item) => {
  const parsedDate = toDate(item?.date);
  if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) return null;
  const amount = Number(item?.amount);

  return {
    ...item,
    id: String(item?.id || `${item?.type || 'event'}-${parsedDate.getTime()}`),
    date: parsedDate,
    title: String(item?.title || 'Atualizacao'),
    subtitle: item?.subtitle ? String(item.subtitle) : '',
    amount: Number.isFinite(amount) ? amount : null,
    importance: normalizeImportance(item?.importance),
    type: String(item?.type || 'UPDATE'),
  };
};

const normalizeGroups = (items, referenceDate) => {
  const grouped = groupByBucket(items, referenceDate);

  const merged = {
    today: [],
    yesterday: [],
    week: [],
  };

  grouped.forEach((group) => {
    if (group.key === 'today') {
      merged.today.push(...group.items);
      return;
    }

    if (group.key === 'yesterday') {
      merged.yesterday.push(...group.items);
      return;
    }

    merged.week.push(...group.items);
  });

  return GROUP_ORDER.filter((key) => merged[key].length > 0).map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: merged[key],
  }));
};

const isSameCalendarDay = (left, right) =>
  left instanceof Date &&
  right instanceof Date &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatItemDate = (date, today) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const reference = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const yesterday = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - 1);

  if (isSameCalendarDay(date, reference)) return feedCopy.groups.TODAY;
  if (isSameCalendarDay(date, yesterday)) return feedCopy.groups.YESTERDAY;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
};

export const ActivityFeedItem = memo(function ActivityFeedItem({
  item,
  today = new Date(),
  groupKey = 'week',
  onPressItem,
}) {
  const importance = IMPORTANCE_META[item.importance] || IMPORTANCE_META.low;
  const hasPressAction = typeof onPressItem === 'function';
  const shouldHideRelativeMeta = groupKey === 'today' || groupKey === 'yesterday';
  const metaDateLabel = shouldHideRelativeMeta ? '' : formatItemDate(item.date, today);
  const hasMetaDate = Boolean(metaDateLabel);
  const hasAmount = Number.isFinite(item.amount);

  return (
    <View style={styles.itemRow}>
      <View style={[styles.importanceBar, { backgroundColor: importance.color }]} />
      <Pressable
        accessibilityRole={hasPressAction ? 'button' : 'text'}
        accessibilityLabel={getEventA11yLabel(item)}
        onPress={() => onPressItem?.(item)}
        disabled={!hasPressAction}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => [styles.itemPressable, pressed && hasPressAction ? styles.itemPressed : null]}
      >
        <Card style={styles.itemCard} contentStyle={styles.itemCardContent}>
          <View style={styles.itemTopRow}>
            <View style={styles.itemTitleRow}>
              <View style={[styles.iconDot, { backgroundColor: `${importance.color}22` }]}>
                <Icon name={resolveIconName(item.type)} size={14} color={importance.color} />
              </View>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <StatusPill
              status={importance.status}
              label={importance.label}
              style={styles.importancePill}
              textStyle={styles.importancePillText}
            />
          </View>

          {item.subtitle ? (
            <Text style={styles.itemSubtitle} numberOfLines={4}>
              {item.subtitle}
            </Text>
          ) : null}

          <View style={[styles.itemMetaRow, !hasMetaDate && styles.itemMetaRowEnd]}>
            {hasMetaDate ? <Text style={styles.itemMeta}>{metaDateLabel}</Text> : null}
            {hasAmount ? (
              <MoneyText value={item.amount} variant="sm" tone="neutral" />
            ) : null}
          </View>
        </Card>
      </Pressable>
    </View>
  );
});

export function ActivityFeedCard({
  items = [],
  title = feedCopy.titles.updates,
  maxItems = 5,
  today = new Date(),
  emptyTitle = feedCopy.empty.updatesTitle,
  emptyMessage = feedCopy.empty.updatesMessage,
  style,
  onPressItem,
  showTitle = true,
}) {
  const visibleItems = useMemo(() => {
    const normalized = (Array.isArray(items) ? items : [])
      .map(normalizeItem)
      .filter(Boolean)
      .sort((left, right) => right.date.getTime() - left.date.getTime());

    if (typeof maxItems === 'number' && maxItems > 0) {
      return normalized.slice(0, maxItems);
    }

    return normalized;
  }, [items, maxItems]);

  const groups = useMemo(() => normalizeGroups(visibleItems, today), [today, visibleItems]);

  return (
    <Card style={style}>
      {showTitle ? <Text style={styles.title}>{title}</Text> : null}

      {groups.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          icon={<Icon name="inbox" size={26} color={colors.muted} />}
          style={styles.emptyState}
          titleStyle={styles.emptyTitle}
          messageStyle={styles.emptyMessage}
        />
      ) : (
        <View style={styles.groupsContainer}>
          {groups.map((group) => (
            <View key={group.key} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>{group.label}</Text>

              <View style={styles.groupItems}>
                {group.items.map((item) => (
                  <ActivityFeedItem
                    key={item.id}
                    item={item}
                    today={today}
                    groupKey={group.key}
                    onPressItem={onPressItem}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  groupsContainer: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  groupBlock: {
    gap: spacing.xs,
  },
  groupTitle: {
    ...typography.caption,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupItems: {
    gap: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 72,
    gap: spacing.xs,
  },
  importanceBar: {
    width: 4,
    borderRadius: 999,
    marginVertical: 4,
  },
  itemPressable: {
    flex: 1,
  },
  itemPressed: {
    opacity: 0.88,
  },
  itemCard: {
    flex: 1,
  },
  itemCardContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  iconDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  importancePill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  importancePillText: {
    fontSize: 11,
  },
  itemSubtitle: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  itemMetaRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  itemMetaRowEnd: {
    justifyContent: 'flex-end',
  },
  itemMeta: {
    ...typography.caption,
    color: colors.muted,
  },
  emptyState: {
    alignItems: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: spacing.md,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'left',
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'left',
  },
});
