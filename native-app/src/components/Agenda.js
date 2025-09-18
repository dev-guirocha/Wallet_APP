import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function Agenda() {
  const { clients, payments } = useApp();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Agenda</Text>
      {!clients.length && <Text style={styles.empty}>Nenhum cliente cadastrado ainda.</Text>}
      {clients.map((client) => (
        <View key={client.id} style={styles.item}>
          <Text style={styles.itemTitle}>
            {client.name} — {client.time} ({client.frequency})
          </Text>
          <Text style={styles.itemStatus}>
            Status: {payments[client.id] ? 'Pago' : 'Pendente'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a',
  },
  empty: {
    fontSize: 14,
    color: '#64748b',
  },
  item: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  itemStatus: {
    fontSize: 13,
    color: '#475569',
  },
});
