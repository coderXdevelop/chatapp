import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useChatStore } from '../../store/chatStore';
import { uploadToCloudinary, getCloudinarySignature } from '../../services/mediaUpload';

const BG_COLORS = ['#0F172A', '#4C1D95', '#831843', '#065F46', '#1E3A8A', '#78350F'];

export default function CreateStatusScreen() {
  const router = useRouter();
  const { postStatus } = useChatStore();

  const [text, setText] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [isPosting, setIsPosting] = useState(false);

  const handlePickMedia = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });

      if (!res.canceled && res.assets[0]) {
        setMediaUri(res.assets[0].uri);
        setMediaType(res.assets[0].type === 'video' ? 'video' : 'image');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not select media.');
    }
  };

  const handlePost = async () => {
    if (!text.trim() && !mediaUri) {
      Alert.alert('Empty Status', 'Please enter text or select a photo.');
      return;
    }

    setIsPosting(true);
    try {
      let uploadedUrl: string | undefined = undefined;

      if (mediaUri && mediaType) {
        const signatureData = await getCloudinarySignature();
        uploadedUrl = await uploadToCloudinary(
          mediaUri,
          mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          signatureData,
          () => {}
        );
      }

      const success = await postStatus({
        text: text.trim(),
        mediaUrl: uploadedUrl,
        mediaType: uploadedUrl ? (mediaType || 'image') : undefined,
        backgroundColor: bgColor,
      });

      if (success) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to post status update.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post status.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: mediaUri ? '#030712' : bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.mediaBtn} onPress={handlePickMedia}>
            <Text style={styles.mediaBtnText}>📷 Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={isPosting}>
            {isPosting ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <Text style={styles.postBtnText}>Share Status</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {mediaUri ? (
          <View style={styles.mediaWrapper}>
            <Image source={{ uri: mediaUri }} style={styles.previewImage} resizeMode="contain" />
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={setText}
              multiline
            />
          </View>
        ) : (
          <TextInput
            style={styles.textInput}
            placeholder="Type a status update..."
            placeholderTextColor="rgba(248, 250, 252, 0.5)"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
        )}
      </View>

      {/* Background Color Picker (Text Status only) */}
      {!mediaUri ? (
        <View style={styles.colorPalette}>
          {BG_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorCircle, { backgroundColor: c }, bgColor === c && styles.colorCircleSelected]}
              onPress={() => setBgColor(c)}
            />
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mediaBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mediaBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  postBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  textInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    width: '100%',
  },
  mediaWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '75%',
    borderRadius: 16,
  },
  captionInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 15,
    width: '100%',
    marginTop: 12,
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
    gap: 12,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
});
