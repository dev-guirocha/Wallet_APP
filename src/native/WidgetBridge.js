import { NativeModules, Platform } from 'react-native';

const { WidgetBridge } = NativeModules;

export const updateWidget = ({ totalToday = 'R$ 0,00', appointments = [] }) => {
  if (Platform.OS !== 'android') return;
  if (!WidgetBridge?.updateWidget) return;
  const payload = JSON.stringify(appointments);
  WidgetBridge.updateWidget(String(totalToday), payload);
};

export default { updateWidget };
