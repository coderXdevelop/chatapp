import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export const ShimmerItem: React.FC<{ style?: any }> = ({ style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#101622', '#1E293B'],
  });

  return <Animated.View style={[style, { backgroundColor }]} />;
};

/**
 * Loading Skeleton for Chat List Screen (home.tsx)
 */
export const ChatListSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <View key={key} style={styles.chatRow}>
          <ShimmerItem style={styles.avatarCircle} />
          <View style={styles.chatTextCol}>
            <View style={styles.titleRow}>
              <ShimmerItem style={styles.nameLine} />
              <ShimmerItem style={styles.timeLine} />
            </View>
            <ShimmerItem style={styles.msgLine} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Loading Skeleton for Chat Room Screen (chat/[id].tsx)
 */
export const ChatMessageSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Received Message */}
      <View style={[styles.msgWrapper, styles.msgLeft]}>
        <ShimmerItem style={[styles.msgBubble, { width: 210, height: 48, borderRadius: 16 }]} />
      </View>

      {/* Sent Message */}
      <View style={[styles.msgWrapper, styles.msgRight]}>
        <ShimmerItem style={[styles.msgBubble, { width: 160, height: 40, borderRadius: 16 }]} />
      </View>

      {/* Received Media Message */}
      <View style={[styles.msgWrapper, styles.msgLeft]}>
        <ShimmerItem style={[styles.msgBubble, { width: 240, height: 160, borderRadius: 16 }]} />
      </View>

      {/* Sent Message */}
      <View style={[styles.msgWrapper, styles.msgRight]}>
        <ShimmerItem style={[styles.msgBubble, { width: 220, height: 54, borderRadius: 16 }]} />
      </View>

      {/* Received Short Message */}
      <View style={[styles.msgWrapper, styles.msgLeft]}>
        <ShimmerItem style={[styles.msgBubble, { width: 130, height: 38, borderRadius: 16 }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#162235',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  chatTextCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameLine: {
    width: 140,
    height: 14,
    borderRadius: 4,
  },
  timeLine: {
    width: 45,
    height: 10,
    borderRadius: 4,
  },
  msgLine: {
    width: '80%',
    height: 12,
    borderRadius: 4,
  },
  msgWrapper: {
    marginVertical: 8,
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  msgRight: {
    alignSelf: 'flex-end',
  },
  msgBubble: {
    backgroundColor: '#101622',
  },
});
