// /src/screens/ClientsScreen.js

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { formatCurrency } from '../utils/dateUtils';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
  cardBackground: '#DAD8D3',
  status: {
    paid: '#5CB85C',
    pending: '#F0AD4E',
  },
  actions: {
    edit: '#2E86C1',
    delete: '#C70039',
  }
};

// O array de dados de exemplo 'allClients' foi REMOVIDO daqui.

const ClientsScreen = ({ clientTerm, navigation, clients, onToggleClientPayment, onDeleteClient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const notify = (message) => {
    if (!message) return;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Atualização', message);
    }
  };

  const filteredClients = useMemo(
    () =>
      clients.filter((client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery, clients],
  );

  const renderClientCard = ({ item }) => {
    const formattedValue = formatCurrency(item.value || 0);
    const paymentStatusLabel = item.paymentStatus === 'paid' ? 'Pago' : 'Pendente';
    const locationLabel = item.location ? item.location : 'Local não informado';

    const openMenu = () => {
      setSelectedClient(item);
      setMenuVisible(true);
    };

    return (
      <TouchableHighlight
        style={styles.cardWrapper}
        underlayColor={'rgba(30,30,30,0.08)'}
        onPress={openMenu}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.clientName}>{item.name}</Text>
              <View
                style={[styles.statusBadge, item.paymentStatus === 'paid' ? styles.statusBadgePaid : styles.statusBadgePending]}
              >
                <Text style={styles.statusBadgeText}>{paymentStatusLabel}</Text>
              </View>
            </View>
            <View style={styles.valuePill}>
              <Icon name="dollar-sign" size={16} color="#1E1E1E" />
              <Text style={styles.valuePillText}>R$ {formattedValue}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Icon name="map-pin" size={16} color="rgba(30,30,30,0.6)" />
              <Text style={styles.infoText}>{locationLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="calendar" size={16} color="rgba(30,30,30,0.6)" />
              <Text style={styles.infoText}>{item.status}</Text>
            </View>
          </View>
        </View>
      </TouchableHighlight>
    );
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedClient(null);
  };

  const handleMarkPayment = () => {
    if (!selectedClient) return;
    const toggledToPaid = selectedClient.paymentStatus !== 'paid';
    const updated = onToggleClientPayment ? onToggleClientPayment(selectedClient.id) : true;
    if (updated === false) {
      Alert.alert('Pagamento já registrado', 'Este cliente já está marcado como pago neste mês.');
      return;
    }
    notify(toggledToPaid ? 'Pagamento marcado como pago.' : 'Pagamento marcado como pendente.');
    closeMenu();
  };

  const handleEdit = () => {
    if (!selectedClient) return;
    closeMenu();
    navigation.navigate('AddClient', { clientTerm, client: selectedClient });
  };

  const handleDelete = () => {
    if (!selectedClient) return;
    Alert.alert(
      'Remover registro',
      `Tem certeza que deseja remover ${selectedClient.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            onDeleteClient?.(selectedClient.id);
            closeMenu();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{clientTerm}s</Text>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={COLORS.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Buscar por nome...`}
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.listContainer}>
        {filteredClients.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhum {clientTerm.toLowerCase()} encontrado. Adicione um novo no botão +
          </Text>
        ) : (
          filteredClients.map((client) => (
            <View key={client.id} style={styles.cardWrapper}>
              {renderClientCard({ item: client })}
            </View>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddClient')}>
        <Icon name="user-plus" size={24} color={COLORS.background} />
      </TouchableOpacity>
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.menuContainer}>
                <Text style={styles.menuTitle}>Ações para {selectedClient?.name}</Text>
                <TouchableOpacity style={styles.menuItem} onPress={handleMarkPayment}>
                  <Icon
                    name={selectedClient?.paymentStatus === 'paid' ? 'rotate-ccw' : 'check'}
                    size={18}
                    color="#5CB85C"
                  />
                  <Text style={styles.menuItemText}>
                    {selectedClient?.paymentStatus === 'paid' ? 'Desmarcar pagamento' : 'Registrar pagamento'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Icon name="edit-2" size={18} color="#2E86C1" />
                  <Text style={styles.menuItemText}>Editar cadastro</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={handleDelete}
                >
                  <Icon name="trash-2" size={18} color="#C70039" />
                  <Text style={[styles.menuItemText, styles.menuItemDangerText]}>Excluir cadastro</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuCancel} onPress={closeMenu}>
                  <Text style={styles.menuCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 30, paddingBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,30,0.05)', borderRadius: 10, paddingHorizontal: 15 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 50, fontSize: 16, color: COLORS.text },
  listContainer: { paddingHorizontal: 30, paddingTop: 20, paddingBottom: 120 },
  cardWrapper: { borderRadius: 22, marginBottom: 18 },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    minHeight: 120,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleBlock: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  clientName: { fontSize: 18, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  statusBadge: { marginLeft: 12, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgePaid: { backgroundColor: COLORS.status.paid },
  statusBadgePending: { backgroundColor: COLORS.status.pending },
  statusBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  valuePillText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardBody: {},
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { marginLeft: 8, fontSize: 14, color: COLORS.accent, flexShrink: 1 },
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.placeholder },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { height: 2, width: 0 } },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  menuTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,30,30,0.08)',
  },
  menuItemText: { marginLeft: 12, fontSize: 15, color: COLORS.text, fontWeight: '600' },
  menuItemDanger: { borderBottomWidth: 0 },
  menuItemDangerText: { color: COLORS.actions.delete },
  menuCancel: { marginTop: 16, alignItems: 'center' },
  menuCancelText: { fontSize: 14, color: COLORS.accent },
});

export default ClientsScreen;
