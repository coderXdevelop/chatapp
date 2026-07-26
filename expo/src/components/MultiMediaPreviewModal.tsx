import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MultiMediaPreviewModalProps {
  visible: boolean;
  assets: ImagePicker.ImagePickerAsset[];
  onClose: () => void;
  onSendBatch: (assets: ImagePicker.ImagePickerAsset[], caption: string) => void;
  onAddMoreCamera: () => void;
  onAddMoreGallery: () => void;
}

export const MultiMediaPreviewModal: React.FC<MultiMediaPreviewModalProps> = ({
  visible,
  assets,
  onClose,
  onSendBatch,
  onAddMoreCamera,
  onAddMoreGallery,
}) => {
  const [items, setItems] = useState<ImagePicker.ImagePickerAsset[]>(assets);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [caption, setCaption] = useState<string>('');

  useEffect(() => {
    setItems(assets);
    if (assets.length > 0) {
      setSelectedIndex(0);
    }
  }, [assets, visible]);

  const activeItem = items[selectedIndex] || items[0];

  const handleRemoveItem = (indexToRemove: number) => {
    const updated = items.filter((_, idx) => idx !== indexToRemove);
    if (updated.length === 0) {
      onClose();
    } else {
      setItems(updated);
      setSelectedIndex((prev) => Math.min(prev, updated.length - 1));
    }
  };

  const handleAddMorePrompt = () => {
    Alert.alert(
      'Add More Media',
      'Choose how you want to add more photos or videos:',
      [
        {
          text: '📷 Camera',
          onPress: onAddMoreCamera,
        },
        {
          text: '🖼️ Gallery / Photos',
          onPress: onAddMoreGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleSend = () => {
    if (items.length === 0) return;
    onSendBatch(items, caption);
    setCaption('');
  };

  if (!visible || items.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.titleText}>
            {selectedIndex + 1} of {items.length} selected
          </Text>

          <TouchableOpacity
            onPress={() => handleRemoveItem(selectedIndex)}
            style={styles.headerButton}
          >
            <Ionicons name="trash-outline" size={22} color="#FCA5A5" />
          </TouchableOpacity>
        </View>

        {/* Central Active Preview Container */}
        <View style={styles.previewContainer}>
          {activeItem && activeItem.type === 'video' ? (
            <VideoPreviewPlayer uri={activeItem.uri} />
          ) : (
            <Image
              source={{ uri: activeItem?.uri }}
              style={styles.mainImage}
              contentFit="contain"
            />
          )}
        </View>

        {/* Thumbnail Carousel & Add More Strip */}
        <View style={styles.thumbnailStripContainer}>
          <FlatList
            horizontal
            data={items}
            keyExtractor={(item, idx) => `${item.uri}_${idx}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailListContent}
            renderItem={({ item, index }) => {
              const isSelected = index === selectedIndex;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedIndex(index)}
                  activeOpacity={0.8}
                  style={[
                    styles.thumbnailWrapper,
                    isSelected && styles.thumbnailWrapperSelected,
                  ]}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumbnailImage} contentFit="cover" />
                  {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons name="play" size={10} color="#FFFFFF" />
                    </View>
                  )}
                  {items.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(index)}
                      style={styles.thumbnailDeleteBtn}
                    >
                      <Ionicons name="close" size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              <TouchableOpacity
                onPress={handleAddMorePrompt}
                style={styles.addMoreThumbnailBtn}
              >
                <Ionicons name="add" size={24} color={COLORS.primary} />
                <Text style={styles.addMoreText}>Add More</Text>
              </TouchableOpacity>
            }
          />
        </View>

        {/* Caption & Batch Send Bar */}
        <View style={styles.captionBarContainer}>
          <TextInput
            placeholder="Add a caption..."
            placeholderTextColor={COLORS.textSecondary}
            value={caption}
            onChangeText={setCaption}
            style={styles.captionInput}
            multiline
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendBatchBtn}>
            <Ionicons name="send" size={20} color={COLORS.primaryText} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const VideoPreviewPlayer: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.mainVideo}
      nativeControls
      contentFit="contain"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b13',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  mainVideo: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  thumbnailStripContainer: {
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
  },
  thumbnailListContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  thumbnailWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbnailWrapperSelected: {
    borderColor: COLORS.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 6,
    padding: 2,
  },
  thumbnailDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreThumbnailBtn: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  addMoreText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  captionBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  captionInput: {
    flex: 1,
    backgroundColor: '#03050a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    maxHeight: 100,
    fontSize: 15,
  },
  sendBatchBtn: {
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
