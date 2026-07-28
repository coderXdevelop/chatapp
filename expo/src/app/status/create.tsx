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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useChatStore } from '../../store/chatStore';
import { uploadToCloudinary, getCloudinarySignature } from '../../services/mediaUpload';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';

const BG_COLORS = ['#0F172A', '#4C1D95', '#831843', '#065F46', '#1E3A8A', '#78350F'];

export interface StatusMediaItem {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
  caption: string;
}

export default function CreateStatusScreen() {
  const router = useRouter();
  const { postStatus } = useChatStore();

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive' | 'primary'; onPress: () => void }>;
  }>({
    visible: false,
    title: '',
    buttons: [],
  });

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    setConfirmModalConfig({
      visible: true,
      title,
      message,
      buttons: [{ text: 'OK', style: 'primary', onPress: () => onOk?.() }],
    });
  };

  const [textStatus, setTextStatus] = useState('');
  const [selectedItems, setSelectedItems] = useState<StatusMediaItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const handlePickMedia = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
        videoMaxDuration: 40,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const validAssets: StatusMediaItem[] = [];
        let skippedCount = 0;

        for (const asset of res.assets) {
          const isVideo = asset.type === 'video';
          let durationSec = 0;

          if (asset.duration) {
            durationSec = asset.duration > 1000 ? Math.round(asset.duration / 1000) : Math.round(asset.duration);
          }

          if (isVideo && durationSec > 40) {
            skippedCount++;
            continue;
          }

          validAssets.push({
            uri: asset.uri,
            type: isVideo ? 'video' : 'image',
            duration: durationSec,
            caption: '',
          });
        }

        if (skippedCount > 0) {
          showAlert(
            'Video Length Limit (30-40s)',
            `${skippedCount} video(s) exceeded the 40-second limit and were excluded. Status videos must be 40s or less.`
          );
        }

        if (validAssets.length > 0) {
          setSelectedItems((prev) => {
            const updated = [...prev, ...validAssets];
            if (activeIdx === -1) setActiveIdx(0);
            return updated;
          });
        }
      }
    } catch (e) {
      showAlert('Error', 'Could not select photos or videos.');
    }
  };

  const handleRemoveItem = (index: number) => {
    const updated = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updated);

    if (updated.length === 0) {
      setActiveIdx(-1);
    } else if (activeIdx >= updated.length) {
      setActiveIdx(updated.length - 1);
    }
  };

  const handleUpdateCaption = (val: string) => {
    if (activeIdx < 0 || activeIdx >= selectedItems.length) return;
    const updated = [...selectedItems];
    updated[activeIdx].caption = val;
    setSelectedItems(updated);
  };

  const handlePost = async () => {
    if (selectedItems.length === 0 && !textStatus.trim()) {
      showAlert('Empty Status', 'Please enter text or select photos/videos.');
      return;
    }

    setIsPosting(true);
    try {
      if (selectedItems.length > 0) {
        const signatureData = await getCloudinarySignature();
        const itemsToPost: Array<{ mediaUrl: string; mediaType: 'image' | 'video'; caption?: string; backgroundColor?: string }> = [];

        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          setUploadProgressText(`Uploading ${i + 1} of ${selectedItems.length}...`);

          const mediaUrl = await uploadToCloudinary(
            item.uri,
            item.type === 'video' ? 'video/mp4' : 'image/jpeg',
            signatureData,
            () => {}
          );

          itemsToPost.push({
            mediaUrl,
            mediaType: item.type,
            caption: item.caption.trim() || undefined,
            backgroundColor: '#0F172A',
          });
        }

        setUploadProgressText('Sharing updates...');
        const success = await postStatus({ items: itemsToPost });

        if (success) {
          router.back();
        } else {
          showAlert('Error', 'Failed to post status updates.');
        }
      } else {
        // Text status
        const success = await postStatus({
          text: textStatus.trim(),
          backgroundColor: bgColor,
        });

        if (success) {
          router.back();
        } else {
          showAlert('Error', 'Failed to post text status.');
        }
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to post status update.');
    } finally {
      setIsPosting(false);
      setUploadProgressText('');
    }
  };

  const currentItem = activeIdx >= 0 && activeIdx < selectedItems.length ? selectedItems[activeIdx] : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentItem ? '#030712' : bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.mediaBtn} onPress={handlePickMedia}>
            <Text style={styles.mediaBtnText}>
              {selectedItems.length > 0 ? `+ Add (${selectedItems.length})` : '🖼️ Add Media'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={isPosting}>
            {isPosting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color="#0F172A" />
                {uploadProgressText ? (
                  <Text style={[styles.postBtnText, { fontSize: 11 }]}>{uploadProgressText}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.postBtnText}>
                {selectedItems.length > 1 ? `Share All (${selectedItems.length})` : 'Share Status'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Preview Area */}
      <View style={styles.content}>
        {currentItem ? (
          <View style={styles.mediaWrapper}>
            <Image source={{ uri: currentItem.uri }} style={styles.previewImage} resizeMode="contain" />

            {currentItem.type === 'video' ? (
              <View style={styles.videoBadge}>
                <Text style={styles.videoBadgeText}>
                  🎥 Video {currentItem.duration ? `(${currentItem.duration}s / max 40s)` : '(max 40s)'}
                </Text>
              </View>
            ) : null}

            <TextInput
              style={styles.captionInput}
              placeholder={`Add caption for item ${activeIdx + 1} of ${selectedItems.length}...`}
              placeholderTextColor="#94A3B8"
              value={currentItem.caption}
              onChangeText={handleUpdateCaption}
              multiline
            />
          </View>
        ) : (
          <TextInput
            style={styles.textInput}
            placeholder="Type a status update..."
            placeholderTextColor="rgba(248, 250, 252, 0.5)"
            value={textStatus}
            onChangeText={setTextStatus}
            multiline
            autoFocus
          />
        )}
      </View>

      {/* Multi-Media Selection Thumbnails Row */}
      {selectedItems.length > 0 ? (
        <View style={styles.thumbnailsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {selectedItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.thumbItem, activeIdx === idx && styles.thumbItemActive]}
                onPress={() => setActiveIdx(idx)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                {item.type === 'video' ? (
                  <View style={styles.thumbVideoTag}>
                    <Text style={styles.thumbVideoTagText}>🎥</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.removeBadge} onPress={() => handleRemoveItem(idx)}>
                  <Text style={styles.removeBadgeText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.addMoreThumb} onPress={handlePickMedia}>
              <Text style={styles.addMoreThumbText}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : (
        /* Background Color Picker for Text status */
        <View style={styles.colorPalette}>
          {BG_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorCircle, { backgroundColor: c }, bgColor === c && styles.colorCircleSelected]}
              onPress={() => setBgColor(c)}
            />
          ))}
        </View>
      )}

      {/* Dark Confirm Dialog Modal */}
      <CustomConfirmModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        buttons={confirmModalConfig.buttons}
        onClose={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />
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
    paddingHorizontal: 14,
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
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '70%',
    borderRadius: 16,
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  videoBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  captionInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 15,
    width: '100%',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  thumbnailsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  thumbItem: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbItemActive: {
    borderColor: '#F59E0B',
    transform: [{ scale: 1.05 }],
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbVideoTag: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    padding: 2,
  },
  thumbVideoTagText: {
    fontSize: 10,
  },
  removeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addMoreThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreThumbText: {
    color: '#F59E0B',
    fontSize: 24,
    fontWeight: 'bold',
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
