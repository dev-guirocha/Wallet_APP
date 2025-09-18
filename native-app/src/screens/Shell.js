import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Agenda from '../components/Agenda';
import ClientForm from '../components/ClientForm';
import ClientList from '../components/ClientList';
import FinanceSummary from '../components/FinanceSummary';
import NotificationsBanner from '../components/NotificationsBanner';
import OnboardingWizard from '../components/OnboardingWizard';
import Tabs from '../components/Tabs';

const TAB_ITEMS = [
  { value: 'clientes', label: 'Clientes' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'config', label: 'Configurações' },
];

export default function Shell() {
  const [activeTab, setActiveTab] = useState('clientes');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Wallet.A — MVP</Text>

      <OnboardingWizard />
      <NotificationsBanner />

      <View style={styles.summaryWrapper}>
        <FinanceSummary />
      </View>

      <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'clientes' && (
        <View style={styles.section}>
          <ClientForm />
          <ClientList />
        </View>
      )}

      {activeTab === 'agenda' && (
        <View style={styles.section}>
          <Agenda />
        </View>
      )}

      {activeTab === 'config' && (
        <View style={styles.card}>
          <Text style={styles.configTitle}>Configurações</Text>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              Preferências de notificação (mock atual: alerta por minuto se horário coincidir)
            </Text>
          </View>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Planos e assinatura (definir gateway)</Text>
          </View>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              Backup/exportação de dados (CSV disponível na versão web; integrar Share/FileSystem aqui)
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    color: '#0f172a',
  },
  summaryWrapper: {
    marginBottom: 24,
  },
  section: {
    marginTop: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
    marginTop: 16,
  },
  configTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a',
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletDot: {
    marginRight: 8,
    color: '#2563eb',
    fontSize: 16,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    color: '#475569',
    fontSize: 14,
  },
});
