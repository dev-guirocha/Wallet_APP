import { Alert, Linking } from 'react-native';

const onlyDigits = (value = '') => String(value).replace(/\D+/g, '');

export const buildPhoneE164FromRaw = (raw, countryCode = '55') => {
  const digits = onlyDigits(raw);
  if (digits.length < 10 || digits.length > 11) return '';
  return `+${countryCode}${digits}`;
};

export const isValidPhoneE164 = (value) => {
  const normalized = String(value || '').trim();
  return /^\+\d{10,15}$/.test(normalized);
};

export const openWhatsAppWithMessage = async ({ phoneE164, message }) => {
  if (!isValidPhoneE164(phoneE164)) {
    Alert.alert('Telefone inválido', 'Cadastre um telefone válido no formato E.164 antes de abrir o WhatsApp.');
    return false;
  }

  const normalized = phoneE164.replace('+', '');
  const encoded = encodeURIComponent(message || '');
  const appUrl = `whatsapp://send?phone=${normalized}&text=${encoded}`;
  const webUrl = `https://wa.me/${normalized}?text=${encoded}`;

  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
      return true;
    }
    await Linking.openURL(webUrl);
    return true;
  } catch (error) {
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (finalError) {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp neste dispositivo.');
      return false;
    }
  }
};

export const applyTemplateVariables = (template = '', variables = {}) => {
  const safeTemplate = String(template || '');
  return safeTemplate.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
};
