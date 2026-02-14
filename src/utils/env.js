import Constants from 'expo-constants';

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';

  const lowered = normalized.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') return '';

  return normalized;
};

const getExpoExtraValue = (key) => {
  const extras = [
    Constants?.expoConfig?.extra,
    Constants?.manifest2?.extra,
    Constants?.manifest?.extra,
  ];

  for (const extra of extras) {
    if (!extra || typeof extra !== 'object') continue;
    const value = normalizeEnvValue(extra[key]);
    if (value) return value;
  }

  return '';
};

export const readEnv = (...keys) => {
  for (const key of keys) {
    const value = normalizeEnvValue(process?.env?.[key]);
    if (value) return value;

    const extraValue = getExpoExtraValue(key);
    if (extraValue) return extraValue;
  }
  return '';
};
