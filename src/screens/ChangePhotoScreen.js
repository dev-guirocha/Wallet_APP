import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { launchImageLibrary } from 'react-native-image-picker';

import { Button, Card, FormScreen } from '../components';
import { useClientStore } from '../store/useClientStore';
import { updateUserPhoto, uploadUserProfilePhoto } from '../utils/firestoreService';
import { COLORS } from '../theme/legacy';
import { photoCopy } from '../utils/uiCopy';

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
      Alert.alert('Foto', photoCopy.pickError);
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
    Alert.alert('Foto', photoCopy.pickDataError);
  };

  const handleSave = async () => {
    if (!selectedImage) {
      Alert.alert('Foto', photoCopy.selectFirstError);
      return;
    }
    if (selectedImage.startsWith('http') && !selectedFileName) {
      Alert.alert('Foto', photoCopy.selectNewError);
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
    } catch (_error) {
      Alert.alert('Erro', photoCopy.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormScreen
      title={photoCopy.title}
      navigation={navigation}
      onSubmit={handleSave}
      submitLabel={photoCopy.submit}
      loading={isSaving}
    >
      <Card style={styles.card}>
        <View style={styles.preview}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          ) : (
            <Icon name="user" size={48} color={COLORS.textSecondary} />
          )}
        </View>

        <Button
          label={photoCopy.pick}
          onPress={handlePickImage}
          accessibilityLabel={photoCopy.pick}
          style={styles.pickButton}
        />
      </Card>
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
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
    minWidth: 180,
  },
});

export default ChangePhotoScreen;
