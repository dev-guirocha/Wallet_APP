import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { OutlineButton } from './Button';
import { useApp } from '../context/AppContext';
import { currencyBRL } from '../utils/money';

export default function FinanceSummary() {
  const { totals } = useApp();

  const handleExport = () => {
    Alert.alert(
      'Exportar CSV',
      'No app nativo esta função ainda não está implementada. Considere integrar com Share ou FileSystem em um próximo passo.',
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Resumo Financeiro</Text>
      <View style={styles.valueBlock}>
        <Text style={styles.label}>Total Recebido</Text>
        <Text style={[styles.value, styles.paid]}>{currencyBRL(totals.totalPaid)}</Text>
      </View>
      <View style={styles.valueBlock}>
        <Text style={styles.label}>Total a Receber</Text>
        <Text style={[styles.value, styles.pending]}>{currencyBRL(totals.totalToReceive)}</Text>
      </View>
      <OutlineButton title="Exportar CSV" onPress={handleExport} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  valueBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
  },
  paid: {
    color: '#16a34a',
  },
  pending: {
    color: '#dc2626',
  },
});
