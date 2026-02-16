import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Divider } from '../ui/Divider';
import { MoneyText } from '../ui/MoneyText';
import { StatusPill } from '../ui/StatusPill';
import { getClientRiskLevel } from '../../utils/riskAnalysis';
import { receivableToPillStatus } from '../../utils/statusMapping';
import {
  actionLabels,
  chargeContextLabels,
  getChargeLabel,
  getChargeSecondaryLabel,
} from '../../utils/uiCopy';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

const formatDueDateLabel = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return chargeContextLabels.missingDueDateLabel;
  return `Vence em ${value.toLocaleDateString('pt-BR')}`;
};

const resolveStatusLabel = (item) => {
  if (!item?.dueDate) return 'Sem venc.';
  const status = receivableToPillStatus(item);
  if (status === 'OVERDUE') return 'Atrasado';
  if (status === 'PAID') return 'Pago';
  if (status === 'SCHEDULED') return 'Agendado';
  return 'Pendente';
};

function ReceivableCardComponent({
  item,
  mode = 'default',
  onCharge,
  onReceive,
  onReschedule,
  onEdit,
  onRetry,
  isReceiving = false,
  isCharging = false,
  syncState = 'idle',
}) {
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const hasCharge = Boolean(
    item?.hasCharge ||
      item?.lastChargeSentAt ||
      item?.chargeDate ||
      (item?.receivable?.chargeHistory?.length || 0) > 0
  );
  const isReceiveMode = mode === 'receive';
  const primaryLabel = getChargeLabel({ hasCharge, mode });
  const secondaryLabel = getChargeSecondaryLabel({ hasCharge, mode });
  const canCharge = Boolean(item?.dueDate);
  const canReceive = Boolean(item?.dueDate) && (!isReceiveMode || hasCharge);
  const status = receivableToPillStatus(item);
  const riskLevel = useMemo(() => {
    if (item?.riskLevel) return item.riskLevel;
    const history = Array.isArray(item?.receivableHistory)
      ? item.receivableHistory
      : [item?.receivable || item];
    return getClientRiskLevel(history);
  }, [item]);
  const showRisk = riskLevel === 'MEDIUM' || riskLevel === 'HIGH';
  const riskColor = riskLevel === 'HIGH' ? COLORS.danger : COLORS.warning;
  const riskLabel = riskLevel === 'HIGH' ? 'Risco alto' : 'Risco médio';
  const quickActions = useMemo(
    () => [
      {
        key: 'receive',
        label: actionLabels.receive,
        iconName: 'check-circle',
        iconColor: COLORS.success,
        disabled: !canReceive || isReceiving,
        onPress: onReceive,
      },
      {
        key: 'charge',
        label: hasCharge ? `${actionLabels.resend} cobrança` : actionLabels.charge,
        iconName: 'message-circle',
        iconColor: COLORS.warning,
        disabled: !canCharge || isCharging,
        onPress: onCharge,
      },
      {
        key: 'reschedule',
        label: actionLabels.reschedule,
        iconName: 'calendar',
        iconColor: COLORS.primary,
        disabled: false,
        onPress: onReschedule,
      },
      {
        key: 'edit',
        label: `${actionLabels.edit} cliente`,
        iconName: 'edit-2',
        iconColor: COLORS.primary,
        disabled: false,
        onPress: onEdit,
      },
    ],
    [canCharge, canReceive, hasCharge, isCharging, isReceiving, onCharge, onEdit, onReceive, onReschedule]
  );

  const handleQuickActionPress = (handler) => {
    setQuickActionsVisible(false);
    requestAnimationFrame(() => handler?.(item));
  };

  const isSyncSaving = syncState === 'saving';
  const isSyncError = syncState === 'error';
  const isSyncSaved = syncState === 'saved';

  return (
    <>
      <Pressable
        onLongPress={() => setQuickActionsVisible(true)}
        delayLongPress={260}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ações rápidas de ${item?.name || 'cliente'}`}
        accessibilityHint="Segure para abrir ações rápidas"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Card style={styles.card}>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{item?.name || 'Cliente'}</Text>
              {showRisk ? (
                <View style={styles.riskMeta}>
                  <Icon name="alert-circle" size={12} color={riskColor} />
                  <Text style={[styles.riskLabel, { color: riskColor }]}>{riskLabel}</Text>
                </View>
              ) : null}
            </View>
            <MoneyText value={item?.amount || 0} variant="md" tone="neutral" />
            <Text style={[styles.subLabel, !item?.dueDate && styles.warningLabel]}>
              {formatDueDateLabel(item?.dueDate)}
            </Text>
            {item?.chargeDate ? (
              <Text style={styles.subLabel}>
                Última cobrança: {item.chargeDate.toLocaleString('pt-BR')}
              </Text>
            ) : null}
            {!item?.dueDate ? (
              <Text style={styles.warningLabel}>{chargeContextLabels.missingDueDate}</Text>
            ) : null}
            {isReceiveMode && !hasCharge ? (
              <Text style={styles.subLabel}>{chargeContextLabels.sendBeforeReceive}</Text>
            ) : null}
            <StatusPill status={status} label={resolveStatusLabel(item)} style={styles.statusPill} />
            {isSyncSaving ? (
              <View style={styles.syncRow}>
                <ActivityIndicator size="small" color={COLORS.info || COLORS.primary} />
                <Text style={styles.syncText}>Sincronizando...</Text>
              </View>
            ) : null}
            {isSyncSaved ? (
              <View style={styles.syncRow}>
                <Icon name="check-circle" size={13} color={COLORS.success} />
                <Text style={styles.syncText}>Sincronizado</Text>
              </View>
            ) : null}
            {isSyncError ? (
              <View style={styles.syncRow}>
                <Icon name="alert-circle" size={13} color={COLORS.danger} />
                <Text style={[styles.syncText, styles.syncErrorText]}>Falha ao sincronizar</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tentar sincronizar novamente"
                  accessibilityState={{ disabled: false }}
                  onPress={() => onRetry?.(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryButtonText}>{actionLabels.retry}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <View style={styles.row}>
              <Button
                label={primaryLabel}
                loading={isReceiveMode ? isReceiving : isCharging}
                disabled={isReceiveMode ? !canReceive || isReceiving : !canCharge || isCharging}
                onPress={() => (isReceiveMode ? onReceive?.(item) : onCharge?.(item))}
                accessibilityLabel={`${primaryLabel} ${item?.name || 'cliente'}`}
                style={styles.button}
                textStyle={styles.buttonText}
              />
              <Button
                label={secondaryLabel}
                loading={!isReceiveMode ? isReceiving : isCharging}
                disabled={isReceiveMode ? !canCharge || isCharging : !canReceive || isReceiving}
                onPress={() => (isReceiveMode ? onCharge?.(item) : onReceive?.(item))}
                accessibilityLabel={`${secondaryLabel} ${item?.name || 'cliente'}`}
                variant="secondary"
                style={styles.button}
                textStyle={styles.buttonText}
              />
            </View>
            <View style={styles.row}>
              <Button
                label={actionLabels.reschedule}
                variant="secondary"
                onPress={() => onReschedule?.(item)}
                accessibilityLabel={`${actionLabels.reschedule} ${item?.name || 'cliente'}`}
                style={styles.button}
                textStyle={styles.buttonText}
              />
              <Button
                label={actionLabels.edit}
                variant="secondary"
                onPress={() => onEdit?.(item)}
                accessibilityLabel={`${actionLabels.edit} ${item?.name || 'cliente'}`}
                style={styles.button}
                textStyle={styles.buttonText}
              />
            </View>
          </View>
        </Card>
      </Pressable>

      <BottomSheet
        visible={quickActionsVisible}
        onClose={() => setQuickActionsVisible(false)}
        title={item?.name || 'Ações rápidas'}
      >
        <View>
          {quickActions.map((action, index) => (
            <View key={action.key}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${action.label} ${item?.name || 'cliente'}`}
                accessibilityState={{ disabled: Boolean(action.disabled) }}
                disabled={action.disabled}
                onPress={() => handleQuickActionPress(action.onPress)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [
                  styles.quickActionItem,
                  pressed && !action.disabled ? styles.quickActionItemPressed : null,
                  action.disabled ? styles.quickActionItemDisabled : null,
                ]}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name={action.iconName} size={18} color={action.iconColor} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </Pressable>
              {index < quickActions.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

const asDateMs = (value) => {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value?.toDate && typeof value.toDate === 'function') {
    const converted = value.toDate();
    if (converted instanceof Date) {
      const ms = converted.getTime();
      return Number.isFinite(ms) ? ms : 0;
    }
  }
  return 0;
};

const receivableCardPropsAreEqual = (prev, next) => {
  const prevItem = prev?.item || {};
  const nextItem = next?.item || {};

  return (
    prevItem.id === nextItem.id &&
    prevItem.hasCharge === nextItem.hasCharge &&
    asDateMs(prevItem.chargeDate) === asDateMs(nextItem.chargeDate) &&
    asDateMs(prevItem.dueDate) === asDateMs(nextItem.dueDate) &&
    prevItem.amount === nextItem.amount &&
    prevItem.riskLevel === nextItem.riskLevel &&
    prev.mode === next.mode &&
    prev.isReceiving === next.isReceiving &&
    prev.isCharging === next.isCharging &&
    prev.syncState === next.syncState &&
    prev.onCharge === next.onCharge &&
    prev.onReceive === next.onReceive &&
    prev.onReschedule === next.onReschedule &&
    prev.onEdit === next.onEdit &&
    prev.onRetry === next.onRetry
  );
};

export const ReceivableCard = memo(ReceivableCardComponent, receivableCardPropsAreEqual);
ReceivableCard.displayName = 'ReceivableCard';

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  info: {
    marginBottom: 12,
  },
  name: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  riskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  riskLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  subLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  warningLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    marginTop: 4,
  },
  statusPill: {
    marginTop: 8,
  },
  actions: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
  },
  buttonText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  quickActionItemPressed: {
    backgroundColor: COLORS.background,
  },
  quickActionItemDisabled: {
    opacity: 0.45,
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(43,108,176,0.1)',
  },
  quickActionLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  syncRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  syncText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  syncErrorText: {
    color: COLORS.danger,
  },
  retryButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  retryButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
});
