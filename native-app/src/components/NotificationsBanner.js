import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

const PT_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function nowHHMM(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function NotificationsBanner() {
  const { clients, payments } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [notifiedIds, setNotifiedIds] = useState([]);

  useEffect(() => {
    const tick = () => {
      const snapshot = new Date();
      const weekday = PT_WEEK[snapshot.getDay()];
      const hhmm = nowHHMM(snapshot);

      const dueNow = clients.filter((client) => {
        if (!client.time) return false;
        const [weekAbbreviation, time] = client.time.split(' ');
        const sameWeekday = weekAbbreviation?.toLowerCase() === weekday.toLowerCase();
        const pending = !payments[client.id];
        return sameWeekday && time === hhmm && pending;
      });

      if (!dueNow.length) return;

      setNotifiedIds((prev) => {
        const known = new Set(prev);
        const unseen = dueNow.filter((client) => !known.has(client.id));
        if (!unseen.length) {
          return prev;
        }

        setAlerts((prevAlerts) => [
          ...prevAlerts,
          ...unseen.map((client) => ({
            id: client.id,
            message: `Lembrete: ${client.name} tem cobrança agora (${client.time}).`,
          })),
        ]);

        unseen.forEach((client) => known.add(client.id));
        return Array.from(known);
      });
    };

    tick();
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, [clients, payments]);

  useEffect(() => {
    if (!alerts.length) return;
    setAlerts((prev) => prev.filter((alert) => !payments[alert.id]));
  }, [payments]);

  const dismiss = (alertId) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  if (!alerts.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {alerts.map((alert) => (
        <View key={alert.id} style={styles.card}>
          <Text style={styles.message}>{alert.message}</Text>
          <Pressable onPress={() => dismiss(alert.id)} style={styles.button}>
            <Text style={styles.buttonLabel}>OK</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fef9c3',
    borderWidth: 1,
    borderColor: '#facc15',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    marginRight: 12,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#92400e',
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
});
