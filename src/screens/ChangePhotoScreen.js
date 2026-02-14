import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useClientStore } from '../store/useClientStore';
import { updateUserPhoto, uploadUserProfilePhoto } from '../utils/firestoreService';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const ChangePhotoScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const photoURL = useClientStore((state) => state.userPhotoURL);
  const setUserDoc = useClientStore((state) => state.setUserDoc);

  const [selectedImage, setSelectedImage] = useState(photoURL || '');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedBase64, setSelectedBase64] = useState('');
  const [selectedMimeType, setSelectedMimeType] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      selectionLimit: 1,
      includeBase64: true,
      assetRepresentationMode: 'compatible',
    });

    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Foto', 'Não foi possível selecionar a imagem.');
      return;
    }
    const asset = result.assets?.[0];
    if (asset?.uri) {
      setSelectedImage(asset.uri);
      setSelectedFileName(asset.fileName || '');
      setSelectedBase64(asset.base64 || '');
      setSelectedMimeType(asset.type || '');
      return;
    }
    Alert.alert('Foto', 'Não foi possível obter a imagem selecionada.');
  };

  const handleSave = async () => {
    if (!selectedImage) {
      Alert.alert('Foto', 'Selecione uma imagem.');
      return;
    }
    if (selectedImage.startsWith('http') && !selectedFileName) {
      Alert.alert('Foto', 'Escolha uma nova imagem antes de salvar.');
      return;
    }
    if (!currentUserId) {
      Alert.alert('Conta', 'Não foi possível identificar o usuário.');
      return;
    }

    setIsSaving(true);
    try {
      const downloadUrl = await uploadUserProfilePhoto({
        uid: currentUserId,
        uri: selectedImage,
        fileName: selectedFileName || selectedImage,
        base64Data: selectedBase64,
        mimeType: selectedMimeType,
      });
      if (!downloadUrl) {
        throw new Error('upload_failed');
      }

      await updateUserPhoto({ uid: currentUserId, photoURL: downloadUrl });
      setUserDoc({ photoURL: downloadUrl });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível atualizar a foto.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Alterar foto</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.card}>
        <View style={styles.preview}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          ) : (
            <Icon name="user" size={48} color={COLORS.textSecondary} />
          )}
        </View>
        <TouchableOpacity style={styles.pickButton} onPress={handlePickImage}>
          <Icon name="image" size={18} color={COLORS.textOnPrimary} />
          <Text style={styles.pickButtonText}>Escolher foto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  headerSpacer: { width: 36 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
    alignItems: 'center',
  },
  preview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  pickButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary, marginLeft: 8 },
  saveButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
});

export default ChangePhotoScreen;
