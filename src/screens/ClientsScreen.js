// /src/screens/ClientsScreen.js

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, TouchableHighlight } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwipeListView } from 'react-native-swipe-list-view';
import { Feather as Icon } from '@expo/vector-icons';

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

const ClientsScreen = ({ clientTerm, navigation, clients }) => { 
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = useMemo(() => 
    // A lógica de filtro agora usa a prop 'clients'
    clients.filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery, clients]);

  const renderClientCard = ({ item }) => (
    <TouchableHighlight style={styles.card} underlayColor={'rgba(30,30,30,0.1)'} onPress={() => console.log('Card Pressionado')}>
      <View style={styles.cardVisibleContent}>
        <View style={[styles.statusIndicator, { backgroundColor: item.statusColor }]} />
        <View style={styles.cardContent}>
          <Text style={styles.clientName}>{item.name}</Text>
          <Text style={styles.clientStatus}>{item.status}</Text>
        </View>
        {/* Usamos o campo 'value' que vem do objeto do cliente */}
        <Text style={styles.clientValue}>R$ {item.value}</Text>
      </View>
    </TouchableHighlight>
  );

  const renderHiddenActions = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.backBtnGreen]} onPress={() => console.log('Pagou')}>
        <Icon name="check" size={24} color="#FFF" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.backBtnBlue]} onPress={() => console.log('Editar')}>
        <Icon name="edit-2" size={24} color="#FFF" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.backBtnRed]} onPress={() => console.log('Apagar')}>
        <Icon name="trash-2" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

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
      <SwipeListView
        data={filteredClients}
        renderItem={renderClientCard}
        renderHiddenItem={renderHiddenActions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>Nenhum {clientTerm.toLowerCase()} encontrado. Adicione um novo no botão +</Text>}
        rightOpenValue={-180}
        disableRightSwipe
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddClient')}>
        <Icon name="user-plus" size={24} color={COLORS.background} />
      </TouchableOpacity>
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
  listContainer: { paddingHorizontal: 30, paddingTop: 20 },
  card: {
    borderRadius: 20,
    marginBottom: 15,
    overflow: 'hidden',
  },
  cardVisibleContent: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground, 
  },
  statusIndicator: { width: 8, height: '100%', alignSelf: 'stretch' },
  cardContent: { flex: 1, paddingVertical: 20, paddingHorizontal: 20 },
  clientName: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  clientStatus: { fontSize: 14, marginTop: 4, color: COLORS.accent },
  clientValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, paddingRight: 20 },
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.placeholder },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { height: 2, width: 0 } },
  rowBack: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 60,
    bottom: 0,
  },
  backBtnGreen: {
    backgroundColor: COLORS.status.paid,
    right: 120,
  },
  backBtnBlue: {
    backgroundColor: COLORS.actions.edit,
    right: 60,
  },
  backBtnRed: {
    backgroundColor: COLORS.actions.delete,
    right: 0,
  },
});

export default ClientsScreen;
