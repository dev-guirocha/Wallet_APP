import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { currencyBRL } from '../utils/money';

export default function ClientList() {
  const { clients, payments, togglePaid } = useApp();

  if (!clients.length) {
    return <Text style={styles.empty}>Nenhum cliente cadastrado ainda.</Text>;
  }

  return (
    <View style={styles.list}>
      {clients.map((client) => {
        const isPaid = !!payments[client.id];
        return (
          <View key={client.id} style={styles.card}>
            <View>
              <Text style={styles.name}>{client.name}</Text>
              <Text style={styles.detail}>
                {client.frequency} • {client.time}
              </Text>
              <Text style={styles.detail}>{currencyBRL(client.price)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.status}>{isPaid ? 'Pago' : 'Pendente'}</Text>
              <Switch value={isPaid} onValueChange={() => togglePaid(client.id)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: '#475569',
  },
  right: {
    alignItems: 'flex-end',
  },
  status: {
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 6,
  },
  empty: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
});
