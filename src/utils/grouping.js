const BUCKET_ORDER = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'];

const BUCKET_LABELS = {
  today: 'Hoje',
  yesterday: 'Ontem',
  thisWeek: 'Esta semana',
  thisMonth: 'Este mês',
  older: 'Mais antigos',
};

const toValidDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) return converted;
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  return null;
};

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const getWeekStart = (referenceDate) => {
  const now = startOfDay(referenceDate);
  const weekDay = now.getDay();
  const mondayOffset = weekDay === 0 ? 6 : weekDay - 1;
  now.setDate(now.getDate() - mondayOffset);
  return now;
};

export const bucketByDate = (dateValue, referenceDate = new Date()) => {
  const date = toValidDate(dateValue);
  if (!date) return 'older';

  const referenceStart = startOfDay(referenceDate);
  const yesterdayStart = new Date(referenceStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = getWeekStart(referenceStart);
  const itemStart = startOfDay(date);

  if (itemStart.getTime() === referenceStart.getTime()) return 'today';
  if (itemStart.getTime() === yesterdayStart.getTime()) return 'yesterday';
  if (itemStart.getTime() >= weekStart.getTime()) return 'thisWeek';

  if (
    itemStart.getFullYear() === referenceStart.getFullYear() &&
    itemStart.getMonth() === referenceStart.getMonth()
  ) {
    return 'thisMonth';
  }

  return 'older';
};

export const groupByBucket = (items = [], referenceDate = new Date()) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const normalized = items
    .map((item) => {
      const parsedDate = toValidDate(item?.date);
      return parsedDate ? { ...item, date: parsedDate } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (normalized.length === 0) return [];

  const groups = normalized.reduce((acc, item) => {
    const bucket = bucketByDate(item.date, referenceDate);
    if (!acc[bucket]) {
      acc[bucket] = {
        key: bucket,
        label: BUCKET_LABELS[bucket] || bucket,
        items: [],
      };
    }
    acc[bucket].items.push(item);
    return acc;
  }, {});

  return BUCKET_ORDER.filter((bucket) => Boolean(groups[bucket])).map((bucket) => groups[bucket]);
};
