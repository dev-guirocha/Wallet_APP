import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from './Button';
import { useApp } from '../context/AppContext';

export default function ClientForm() {
  const { addClient } = useApp();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('');
  const [time, setTime] = useState('');
  const [price, setPrice] = useState('');

  const reset = () => {
    setName('');
    setFrequency('');
    setTime('');
    setPrice('');
  };

  const handleSubmit = () => {
    if (!name || !frequency || !time || !price) {
      return;
    }
    addClient({
      name: name.trim(),
      frequency: frequency.trim(),
      time: time.trim(),
      price: parseFloat(price.replace(',', '.')),
    });
    reset();
  };

  const isValid = name && frequency && time && price;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Cadastrar Cliente</Text>
      <View>
        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Frequência (ex: 2x/semana)"
          value={frequency}
          onChangeText={setFrequency}
        />
        <TextInput
          style={styles.input}
          placeholder="Dia e hora (ex: Seg 10:00)"
          value={time}
          onChangeText={setTime}
        />
        <TextInput
          style={styles.input}
          placeholder="Valor (R$)"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
      </View>
      <PrimaryButton title="Adicionar Cliente" onPress={handleSubmit} disabled={!isValid} />
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
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
});
