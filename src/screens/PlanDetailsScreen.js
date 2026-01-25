import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { COLORS as THEME, TYPOGRAPHY } from '../constants/theme';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  accent: THEME.textSecondary,
  highlight: THEME.primary,
  border: THEME.border,
  textOnPrimary: THEME.textOnPrimary,
};

const FEATURES = [
  'Clientes ilimitados e histórico completo',
  'Relatórios financeiros com exportação',
  'Lembretes automáticos de agenda e pagamento',
  'Suporte prioritário e roadmap colaborativo',
];

const PlanDetailsScreen = ({ navigation, onUpgradePlan, planTier = 'free' }) => {
  const handleUpgrade = () => {
    onUpgradePlan?.();
    Alert.alert('Plano atualizado', 'Você agora faz parte do Wallet Pro!', [
      {
        text: 'Entendi',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Wallet Pro</Text>
        <Text style={styles.subtitle}>Tudo o que você precisa para crescer sem limites.</Text>

        <View style={styles.priceCard}>
          <Text style={styles.price}>R$ 24,90</Text>
          <Text style={styles.priceSuffix}>/mês</Text>
          <Text style={styles.priceInfo}>Cancele quando quiser</Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Por que migrar para o Pro?</Text>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Icon name="check" size={18} color={COLORS.highlight} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Suporte dedicado</Text>
          <Text style={styles.supportText}>
            Conte com atendimento prioritário e materiais exclusivos para organizar sua rotina e
            fortalecer o relacionamento com seus clientes.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.ctaButton, planTier !== 'free' && styles.ctaButtonDisabled]}
          onPress={handleUpgrade}
          disabled={planTier !== 'free'}
        >
          <Text
            style={[styles.ctaButtonText, planTier !== 'free' && styles.ctaButtonTextDisabled]}
          >
            {planTier === 'free' ? 'Quero migrar para o Pro' : 'Plano Pro ativado'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingBottom: 60 },
  title: { ...TYPOGRAPHY.display, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.accent, marginTop: 8, marginBottom: 20 },
  priceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  price: { ...TYPOGRAPHY.hero, color: COLORS.text },
  priceSuffix: { ...TYPOGRAPHY.subtitle, color: COLORS.accent },
  priceInfo: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginTop: 6 },
  featureCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  featureTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.text, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  featureText: { marginLeft: 12, color: COLORS.accent, ...TYPOGRAPHY.body, flexShrink: 1 },
  supportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  supportTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.text, marginBottom: 8 },
  supportText: { ...TYPOGRAPHY.body, color: COLORS.accent, lineHeight: 20 },
  ctaButton: {
    backgroundColor: COLORS.highlight,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  ctaButtonDisabled: { backgroundColor: 'rgba(26,32,44,0.2)' },
  ctaButtonText: { ...TYPOGRAPHY.button, color: COLORS.textOnPrimary },
  ctaButtonTextDisabled: { color: 'rgba(255,255,255,0.7)' },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.accent },
});

export default PlanDetailsScreen;
