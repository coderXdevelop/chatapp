import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChatStore } from '../../store/chatStore';

const { width } = Dimensions.get('window');

export default function ViewStatusScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { activeStatuses, deleteStatus } = useChatStore();

  const userStoryGroup = activeStatuses.find((group) => group.user?._id === userId);
  const items = userStoryGroup?.items || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (items.length === 0) return;

    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        if (currentIndex < items.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          router.back();
        }
      }
    });
  }, [currentIndex, items]);

  if (!userStoryGroup || items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Status update unavailable or expired.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentItem = items[currentIndex];

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentItem.mediaUrl ? '#030712' : currentItem.backgroundColor || '#0F172A' }]}>
      {/* Top Progress Bars */}
      <View style={styles.progressContainer}>
        {items.map((st, idx) => {
          let flexWidth: any = 0;
          if (idx < currentIndex) flexWidth = 1;
          else if (idx === currentIndex) flexWidth = progressAnim;
          else flexWidth = 0;

          return (
            <View key={st._id} style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: idx === currentIndex
                      ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                      : idx < currentIndex ? '100%' : '0%',
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: userStoryGroup.user?.avatarUrl || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>{userStoryGroup.user?.displayName || 'User'}</Text>
            <Text style={styles.timeAgo}>
              {new Date(currentItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeIcon} onPress={() => router.back()}>
          <Text style={styles.closeIconText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Main Story Content */}
      <View style={styles.storyContent}>
        {currentItem.mediaUrl ? (
          <Image source={{ uri: currentItem.mediaUrl }} style={styles.storyImage} resizeMode="contain" />
        ) : (
          <Text style={styles.storyText}>{currentItem.text}</Text>
        )}

        {currentItem.caption ? (
          <View style={styles.captionBox}>
            <Text style={styles.captionText}>{currentItem.caption}</Text>
          </View>
        ) : null}
      </View>

      {/* Touch Navigation Overlay */}
      <View style={styles.touchOverlay}>
        <TouchableOpacity style={styles.touchLeft} onPress={handlePrev} />
        <TouchableOpacity style={styles.touchRight} onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  timeAgo: {
    color: 'rgba(248, 250, 252, 0.7)',
    fontSize: 11,
  },
  closeIcon: {
    padding: 6,
  },
  closeIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '80%',
    borderRadius: 16,
  },
  storyText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  captionBox: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '90%',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    zIndex: 10,
  },
  touchLeft: {
    width: '35%',
    height: '100%',
  },
  touchRight: {
    width: '65%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
  },
  closeBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
