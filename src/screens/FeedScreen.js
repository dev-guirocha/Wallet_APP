import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import {
  ActivityFeedItem,
  AppScreen,
  ListContainer,
  ScreenHeader,
  SegmentedControl,
} from '../components';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';
import { toDate } from '../utils/dateUtils';
import { feedCopy, getFeedFilterLabel } from '../utils/uiCopy';

const FILTER_KEYS = ['ALL', 'FINANCE', 'CLIENTS', 'SCHEDULE', 'RISK'];
const FILTER_ALIASES = {
  ALL: 'ALL',
  TODOS: 'ALL',
  FINANCE: 'FINANCE',
  FINANCEIRO: 'FINANCE',
  CLIENTS: 'CLIENTS',
  CLIENTES: 'CLIENTS',
  SCHEDULE: 'SCHEDULE',
  AGENDA: 'SCHEDULE',
  RISK: 'RISK',
  RISCO: 'RISK',
};

const normalizeImportance = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
};

const normalizeEvents = (events = []) => {
  if (!Array.isArray(events)) return [];

  return events
    .map((event, index) => {
      const date = toDate(event?.date);
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

      return {
        id: String(event?.id || `feed-${index}`),
        date,
        type: String(event?.type || 'UPDATE').toUpperCase(),
        title: String(event?.title || feedCopy.titles.updates),
        subtitle: event?.subtitle ? String(event.subtitle) : '',
        amount: Number.isFinite(Number(event?.amount)) ? Number(event.amount) : null,
        importance: normalizeImportance(event?.importance),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.date.getTime() - left.date.getTime());
};

const normalizeFilterKey = (value, fallback = 'FINANCE') => {
  const normalized = String(value || '').toUpperCase();
  return FILTER_ALIASES[normalized] || fallback;
};

const matchesFilter = (event, filter) => {
  const type = String(event?.type || '').toUpperCase();

  if (filter === 'ALL') return true;

  if (filter === 'FINANCE') {
    return (
      type === 'PAID' ||
      type === 'CHARGE_SENT' ||
      type === 'EDITED' ||
      type === 'RESCHEDULED' ||
      type.includes('PAY') ||
      type.includes('CHARGE') ||
      type.includes('FINANC')
    );
  }

  if (filter === 'CLIENTS') {
    return type.includes('CLIENT') || type === 'EDITED';
  }

  if (filter === 'SCHEDULE') {
    return type.includes('APPOINTMENT') || type === 'RESCHEDULED';
  }

  if (filter === 'RISK') {
    return type.includes('RISK') || type.includes('PREDICT') || type === 'INSIGHT';
  }
  return false;
};

const FeedScreen = ({ navigation, route }) => {
  const initialFilterParam = String(route?.params?.initialFilter || 'FINANCE').toUpperCase();
  const safeInitialFilter = normalizeFilterKey(initialFilterParam, 'FINANCE');
  const listRef = useRef(null);
  const todayReference = useMemo(() => new Date(), []);
  const filterOptions = useMemo(
    () => FILTER_KEYS.map((key) => ({ key, label: getFeedFilterLabel(key) })),
    []
  );

  const [activeFilter, setActiveFilter] = useState(safeInitialFilter);
  const hasInvalidEventsSource = route?.params?.events != null && !Array.isArray(route?.params?.events);
  const loadError = hasInvalidEventsSource ? feedCopy.error.message : '';

  const feedEvents = useMemo(
    () => normalizeEvents(route?.params?.events || []),
    [route?.params?.events]
  );

  const filteredEvents = useMemo(
    () => feedEvents.filter((event) => matchesFilter(event, activeFilter)),
    [activeFilter, feedEvents]
  );
  const keyExtractor = useCallback((item) => item.id, []);
  const renderItem = useCallback(
    ({ item }) => <ActivityFeedItem item={item} today={todayReference} />,
    [todayReference]
  );
  const handleChangeFilter = useCallback((nextFilter) => {
    setActiveFilter(nextFilter);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, []);
  const emptyTitle = feedEvents.length === 0 ? feedCopy.empty.updatesTitle : feedCopy.empty.filterTitle;
  const emptyMessage = feedEvents.length === 0 ? feedCopy.empty.updatesMessage : feedCopy.empty.filterMessage;

  return (
    <AppScreen style={styles.safeArea} contentContainerStyle={styles.content}>
      <ScreenHeader title={feedCopy.titles.feed} navigation={navigation} />
      <Text style={styles.subtitle}>{feedCopy.subtitle}</Text>

      <SegmentedControl
        options={filterOptions}
        value={activeFilter}
        onChange={handleChangeFilter}
        style={styles.filtersRow}
      />

      <ListContainer
        loading={false}
        error={loadError}
        isEmpty={!loadError && filteredEvents.length === 0}
        emptyIcon={<Icon name="inbox" size={34} color={COLORS.textSecondary} />}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        style={styles.listContainer}
      >
        {filteredEvents.length > 0 ? (
          <FlatList
            ref={listRef}
            data={filteredEvents}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : null}
      </ListContainer>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: -4,
    marginBottom: 12,
  },
  filtersRow: {
    marginBottom: 12,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    gap: 8,
    paddingBottom: 24,
  },
});

export default FeedScreen;
