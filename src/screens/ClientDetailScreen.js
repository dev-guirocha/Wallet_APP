import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import {
  AppScreen,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  MoneyText,
  ReceivableCard,
  ScreenHeader,
  SectionHeader,
  StatusPill,
} from '../components';
import { useClientStore } from '../store/useClientStore';
import { getMonthKey } from '../utils/dateUtils';
import { buildPhoneE164FromRaw, openWhatsAppWithMessage } from '../utils/whatsapp';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
};

const buildMonthDueDate = (dueDay) => {
  const day = Number(dueDay);
  if (!Number.isFinite(day) || day <= 0) return null;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  return new Date(now.getFullYear(), now.getMonth(), safeDay, 12, 0, 0, 0);
};

const resolveReceivableItem = (client, monthKey) => {
  if (!client) return null;

  const dueDate = buildMonthDueDate(client?.dueDay);
  const amount = Number(client?.value || 0);
  const paid = normalizePaymentStatus(client?.payments?.[monthKey]) === 'paid';

  return {
    id: `${client.id || 'client'}-${monthKey}`,
    clientId: client.id,
    name: client.name || 'Cliente',
    amount,
    paid,
    dueDate,
    dueDateKey: dueDate ? monthKey : '',
    hasCharge: true,
    receivable: {
      monthKey,
      amount,
      paid,
      dueDate,
      dueDateKey: dueDate ? monthKey : '',
      clientId: client.id,
      clientName: client.name,
    },
  };
};

const ClientDetailScreen = ({ route, navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const isLoading = useClientStore((state) => Boolean(state.isLoading));
  const clientTerm = useClientStore((state) => state.clientTerm);
  const togglePayment = useClientStore((state) => state.togglePayment);
  const deleteClient = useClientStore((state) => state.deleteClient);

  const [isCharging, setIsCharging] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [chargeError, setChargeError] = useState('');

  const clientIdFromRoute = route?.params?.clientId || route?.params?.client?.id;
  const fallbackClient = route?.params?.client || null;
  const monthKey = getMonthKey();

  const activeClient = useMemo(() => {
    const source = Array.isArray(clients) ? clients : [];
    const fromStore = source.find((item) => item.id === clientIdFromRoute);
    return fromStore || fallbackClient || null;
  }, [clientIdFromRoute, clients, fallbackClient]);

  const receivableItem = useMemo(
    () => resolveReceivableItem(activeClient, monthKey),
    [activeClient, monthKey]
  );

  const isPaidThisMonth = normalizePaymentStatus(activeClient?.payments?.[monthKey]) === 'paid';
  const agendaRows = useMemo(
    () => {
      const days = Array.isArray(activeClient?.days) ? activeClient.days : [];
      const dayTimes = activeClient?.dayTimes && typeof activeClient.dayTimes === 'object'
        ? activeClient.dayTimes
        : {};
      const defaultTime = activeClient?.time || '--:--';

      return days.map((day) => ({ day, time: dayTimes[day] || defaultTime }));
    },
    [activeClient]
  );

  const handleCharge = async () => {
    if (!activeClient) return;
    setChargeError('');
    setIsCharging(true);

    try {
      const phoneE164 =
        activeClient.phoneE164 ||
        buildPhoneE164FromRaw(activeClient.phoneRaw || activeClient.phone || '');

      if (!phoneE164) {
        setChargeError('Cliente sem telefone válido para cobrança.');
        return;
      }

      const dueDate = receivableItem?.dueDate;
      const dueLabel =
        dueDate instanceof Date && !Number.isNaN(dueDate.getTime())
          ? dueDate.toLocaleDateString('pt-BR')
          : 'data não definida';

      const message = `Olá, ${activeClient.name || 'cliente'}!\n\nLembrete da sua mensalidade de ${dueLabel}.`;
      await openWhatsAppWithMessage({ phoneE164, message });
    } catch (_error) {
      setChargeError('Não foi possível enviar a cobrança agora.');
    } finally {
      setIsCharging(false);
    }
  };

  const handleReceive = async () => {
    if (!activeClient?.id) return;

    setIsReceiving(true);
    setChargeError('');

    try {
      await togglePayment(activeClient.id, monthKey);
    } catch (_error) {
      setChargeError('Não foi possível atualizar o recebimento.');
    } finally {
      setIsReceiving(false);
    }
  };

  const handleReschedule = () => {
    navigation.navigate('Agenda', { clientId: activeClient?.id });
  };

  const handleDeleteClient = () => {
    if (!activeClient?.id) return;

    Alert.alert(
      `Excluir ${clientTerm || 'cliente'}`,
      `Tem certeza que deseja excluir ${activeClient.name || 'este cliente'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteClient(activeClient.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.content}>
        <ScreenHeader title="Cliente" navigation={navigation} />
        <ListSkeleton count={3} variant="card" />
      </AppScreen>
    );
  }

  if (!activeClient) {
    return (
      <AppScreen style={styles.safeArea} contentContainerStyle={styles.content}>
        <ScreenHeader title="Cliente" navigation={navigation} />
        <ErrorState
          title="Cliente não encontrado"
          message="Não foi possível carregar os dados deste cliente."
          onRetry={() => navigation.goBack()}
          style={styles.stateBlock}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.content}>
      <ScreenHeader
        title={activeClient.name || 'Cliente'}
        navigation={navigation}
        actionLabel="Editar"
        onActionPress={() => navigation.navigate('AddClient', { clientId: activeClient.id })}
      />

      <View style={styles.section}>
        <SectionHeader title="Dados" style={styles.sectionHeader} />
        <Card>
          <View style={styles.detailRow}>
            <Icon name="phone" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailLabel}>Telefone</Text>
            <Text style={styles.detailValue}>{activeClient.phone || 'Não informado'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="map-pin" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailLabel}>Local</Text>
            <Text style={styles.detailValue}>{activeClient.location || 'Não informado'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="credit-card" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailLabel}>Vencimento</Text>
            <Text style={styles.detailValue}>
              {activeClient?.dueDay ? `Dia ${activeClient.dueDay}` : 'Não informado'}
            </Text>
          </View>

          <View style={[styles.detailRow, styles.detailRowNoBorder]}>
            <Icon name="dollar-sign" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailLabel}>Mensalidade</Text>
            <MoneyText value={Number(activeClient.value || 0)} variant="sm" tone="neutral" />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Cobranças" style={styles.sectionHeader} />

        <Card style={styles.highlightActionsCard}>
          <View style={styles.highlightActionsRow}>
            <Button
              label="Cobrar"
              onPress={handleCharge}
              loading={isCharging}
              disabled={isCharging}
              style={styles.highlightButton}
              textStyle={styles.highlightButtonText}
              accessibilityLabel={`Cobrar ${activeClient.name || 'cliente'}`}
            />
            <Button
              label={isPaidThisMonth ? 'Desfazer recebimento' : 'Registrar recebimento'}
              variant="secondary"
              onPress={handleReceive}
              loading={isReceiving}
              disabled={isReceiving}
              style={styles.highlightButton}
              textStyle={styles.highlightButtonText}
              accessibilityLabel={`${isPaidThisMonth ? 'Desfazer recebimento de' : 'Registrar recebimento de'} ${activeClient.name || 'cliente'}`}
            />
            <Button
              label="Reagendar"
              variant="secondary"
              onPress={handleReschedule}
              style={styles.highlightButton}
              textStyle={styles.highlightButtonText}
              accessibilityLabel={`Reagendar ${activeClient.name || 'cliente'}`}
            />
          </View>

          {chargeError ? (
            <ErrorState
              title="Atenção"
              message={chargeError}
              onRetry={() => setChargeError('')}
              style={styles.inlineError}
            />
          ) : null}
        </Card>

        {receivableItem ? (
          <ReceivableCard
            item={receivableItem}
            mode="default"
            onCharge={handleCharge}
            onReceive={handleReceive}
            onReschedule={handleReschedule}
            onEdit={() => navigation.navigate('AddClient', { clientId: activeClient.id })}
            isCharging={isCharging}
            isReceiving={isReceiving}
          />
        ) : (
          <Card>
            <EmptyState
              title="Sem cobrança ativa"
              message="Defina valor e vencimento para gerenciar cobranças deste cliente."
              ctaLabel="Editar cliente"
              onCtaPress={() => navigation.navigate('AddClient', { clientId: activeClient.id })}
              style={styles.emptyState}
            />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Agenda" style={styles.sectionHeader} />
        <Card>
          {agendaRows.length === 0 ? (
            <EmptyState
              title="Sem agenda definida"
              message="Configure dias e horários para este cliente."
              ctaLabel="Configurar agenda"
              onCtaPress={() => navigation.navigate('AddClient', { clientId: activeClient.id })}
              style={styles.emptyState}
            />
          ) : (
            <View style={styles.agendaList}>
              {agendaRows.map((row, index) => (
                <View
                  key={`${row.day}-${row.time}-${index}`}
                  style={[styles.agendaRow, index === agendaRows.length - 1 && styles.agendaRowLast]}
                >
                  <Text style={styles.agendaDay}>{row.day}</Text>
                  <View style={styles.agendaMeta}>
                    <Text style={styles.agendaTime}>{row.time}</Text>
                    <StatusPill status="SCHEDULED" label="Agendado" />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Excluir ${activeClient.name || 'cliente'}`}
        onPress={handleDeleteClient}
        style={({ pressed }) => [styles.deleteButton, pressed ? styles.deleteButtonPressed : null]}
      >
        <Icon name="trash-2" size={16} color={COLORS.danger} />
        <Text style={styles.deleteButtonText}>Excluir {clientTerm || 'cliente'}</Text>
      </Pressable>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  stateBlock: {
    marginTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
    gap: 8,
  },
  detailRowNoBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    textAlign: 'right',
    maxWidth: '55%',
  },
  highlightActionsCard: {
    marginBottom: 10,
  },
  highlightActionsRow: {
    gap: 8,
  },
  highlightButton: {
    minHeight: 40,
    paddingVertical: 8,
  },
  highlightButtonText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  inlineError: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  emptyState: {
    alignItems: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  agendaList: {
    gap: 8,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  agendaRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  agendaDay: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  agendaMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  agendaTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(185,28,28,0.35)',
    backgroundColor: 'rgba(185,28,28,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonPressed: {
    opacity: 0.8,
  },
  deleteButtonText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.danger,
  },
});

export default ClientDetailScreen;
