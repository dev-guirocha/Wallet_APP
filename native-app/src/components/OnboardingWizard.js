import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OutlineButton, PrimaryButton } from './Button';
import { useApp } from '../context/AppContext';

const steps = [
  {
    title: 'Bem-vindo ao Wallet.A',
    text: 'Gestor de agenda e finanças para autônomos. Vamos te guiar em 3 passos rápidos.',
  },
  {
    title: 'Como funciona',
    text: 'Cadastre clientes com frequência, horário e valor. Marque como pago quando receber para atualizar seus totais.',
  },
  {
    title: 'Cadastre o primeiro cliente',
    text: 'Vá na aba Clientes, preencha o formulário e toque em Adicionar Cliente.',
  },
];

export default function OnboardingWizard() {
  const { onboardingDone, markOnboardingDone } = useApp();
  const [index, setIndex] = useState(0);

  if (onboardingDone) {
    return null;
  }

  const isLast = index === steps.length - 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{steps[index].title}</Text>
      <Text style={styles.text}>{steps[index].text}</Text>
      <View style={styles.actions}>
        <PrimaryButton
          title={isLast ? 'Concluir' : 'Próximo'}
          onPress={isLast ? markOnboardingDone : () => setIndex((value) => value + 1)}
        />
        <OutlineButton title="Pular" onPress={markOnboardingDone} style={styles.secondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2563eb33',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  text: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondary: {
    marginLeft: 12,
  },
});
