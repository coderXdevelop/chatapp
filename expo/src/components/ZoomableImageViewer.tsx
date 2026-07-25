import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZoomableImageViewerProps {
  visible: boolean;
  imageUri: string;
  title?: string;
  onClose: () => void;
  onDownload?: () => void;
}

export const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({
  visible,
  imageUri,
  title = 'Photo',
  onClose,
  onDownload,
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      backdropOpacity.value = 1;
    }
  }, [visible, imageUri]);

  // Double tap to zoom 1x <-> 2.5x
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  // Pinch-to-zoom gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture (pan when zoomed, or drag-down to dismiss when scale === 1)
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1.05) {
        // Panning inside zoomed image
        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;

        translateX.value = Math.max(
          -maxTranslateX,
          Math.min(maxTranslateX, savedTranslateX.value + event.translationX)
        );
        translateY.value = Math.max(
          -maxTranslateY,
          Math.min(maxTranslateY, savedTranslateY.value + event.translationY)
        );
      } else {
        // Drag-down to dismiss when not zoomed
        if (event.translationY > 0) {
          translateY.value = event.translationY;
          backdropOpacity.value = Math.max(0.2, 1 - event.translationY / 300);
        }
      }
    })
    .onEnd((event) => {
      if (scale.value > 1.05) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        if (event.translationY > 120 || event.velocityY > 600) {
          backdropOpacity.value = withTiming(0, { duration: 150 });
          runOnJS(onClose)();
        } else {
          translateY.value = withSpring(0);
          backdropOpacity.value = withSpring(1);
        }
      }
    });

  const composedGestures = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Race(pinchGesture, panGesture)
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.container, animatedBackdropStyle]}>
        {/* Header Bar Controls */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>

          {onDownload ? (
            <TouchableOpacity onPress={onDownload} style={styles.headerButton}>
              <Ionicons name="download-outline" size={24} color={COLORS.accent} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Zoomable Image Container */}
        <GestureDetector gesture={composedGestures}>
          <View style={styles.imageWrapper}>
            <Animated.View style={[styles.animatedImageContainer, animatedImageStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                contentFit="contain"
                transition={200}
                cachePolicy="disk"
              />
            </Animated.View>
          </View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  animatedImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
