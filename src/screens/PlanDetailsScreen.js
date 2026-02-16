import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { AppScreen, Button, Card, ScreenHeader } from '../components';
import { useClientStore } from '../store/useClientStore';
import { COLORS as THEME, TYPOGRAPHY } from '../theme/legacy';
import { planCopy } from '../utils/uiCopy';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  accent: THEME.textSecondary,
  highlight: THEME.primary,
  border: THEME.border,
  textOnPrimary: THEME.textOnPrimary,
};

const PlanDetailsScreen = ({ navigation }) => {
  const planTier = useClientStore((state) => state.planTier);
  const setPlanTier = useClientStore((state) => state.setPlanTier);

  const handleUpgrade = () => {
    setPlanTier('pro');
    Alert.alert(planCopy.upgradeSuccessTitle, planCopy.upgradeSuccessMessage, [
      {
        text: planCopy.upgradeSuccessAction,
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  return (
    <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.container}>
      <ScreenHeader title={planCopy.title} navigation={navigation} />
      <Text style={styles.subtitle}>{planCopy.subtitle}</Text>

        <Card style={styles.priceCard}>
          <Text style={styles.price}>R$ 24,90</Text>
          <Text style={styles.priceSuffix}>{planCopy.priceSuffix}</Text>
          <Text style={styles.priceInfo}>{planCopy.cancelAnytime}</Text>
        </Card>

        <Card style={styles.featureCard}>
          <Text style={styles.featureTitle}>{planCopy.whyUpgrade}</Text>
          {planCopy.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Icon name="check" size={18} color={COLORS.highlight} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.supportCard}>
          <Text style={styles.supportTitle}>{planCopy.supportTitle}</Text>
          <Text style={styles.supportText}>{planCopy.supportText}</Text>
        </Card>

        <Button
          label={planTier === 'free' ? planCopy.upgradeCta : planCopy.activeCta}
          variant={planTier === 'free' ? 'primary' : 'secondary'}
          style={styles.ctaButton}
          textStyle={styles.ctaButtonText}
          onPress={handleUpgrade}
          disabled={planTier !== 'free'}
          accessibilityLabel={planTier === 'free' ? planCopy.upgradeCta : planCopy.activeCta}
        />

        <Button
          label={planCopy.back}
          variant="secondary"
          style={styles.secondaryButton}
          textStyle={styles.secondaryButtonText}
          onPress={() => navigation.goBack()}
          accessibilityLabel={planCopy.back}
        />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: 60 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.accent, marginTop: 6, marginBottom: 20 },
  priceCard: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  price: { ...TYPOGRAPHY.hero, color: COLORS.text },
  priceSuffix: { ...TYPOGRAPHY.subtitle, color: COLORS.accent },
  priceInfo: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginTop: 6 },
  featureCard: {
    padding: 18,
    marginBottom: 20,
  },
  featureTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.text, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  featureText: { marginLeft: 12, color: COLORS.accent, ...TYPOGRAPHY.body, flexShrink: 1 },
  supportCard: {
    padding: 18,
    marginBottom: 30,
  },
  supportTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.text, marginBottom: 8 },
  supportText: { ...TYPOGRAPHY.body, color: COLORS.accent, lineHeight: 20 },
  ctaButton: {
    minHeight: 52,
    marginBottom: 14,
  },
  ctaButtonText: { ...TYPOGRAPHY.button },
  secondaryButton: {
    minHeight: 48,
  },
  secondaryButtonText: { ...TYPOGRAPHY.buttonSmall },
});

export default PlanDetailsScreen;
