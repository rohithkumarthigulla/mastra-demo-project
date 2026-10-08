import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../ui';
import type { VoiceState } from './voice';

const CAPTION: Record<VoiceState['phase'], string> = {
  idle: '',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking… tap to interrupt',
};

/** The tap area stays above the 44pt minimum; the dot inside leaves room to grow while it pulses. */
const HIT_SIZE = 56;
const DOT_SIZE = 40;

/**
 * The call's animated indicator. Its size follows the real microphone level while listening,
 * it pulses while the agent works, and it breathes while speaking.
 */
export function VoiceIndicator({
  state,
  onTap,
  onEnd,
}: {
  state: VoiceState;
  onTap: () => void;
  onEnd: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const level = state.phase === 'listening' ? state.level : 0;

  useEffect(() => {
    if (state.phase === 'listening') {
      Animated.timing(scale, {
        toValue: 1 + level * 0.6,
        duration: 90,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (state.phase === 'idle') {
      scale.setValue(1);
      return;
    }
    const range = state.phase === 'thinking' ? 0.12 : 0.25;
    const period = state.phase === 'thinking' ? 600 : 380;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1 + range,
          duration: period,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: period,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state.phase, level, scale]);

  const caption = state.phase === 'thinking' ? state.label : CAPTION[state.phase];
  const color = state.phase === 'speaking' ? theme.colors.link : theme.colors.text;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state.phase === 'speaking' ? 'Interrupt the reply' : 'End voice'}
        onPress={onTap}
        style={{
          width: HIT_SIZE,
          height: HIT_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: theme.colors.primary,
            opacity: state.phase === 'thinking' ? 0.6 : 1,
            transform: [{ scale }],
          }}
        />
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={{ flex: 1, color, fontSize: theme.fontSize.md }}
      >
        {caption}
      </Text>
      <Button title="End voice" variant="secondary" onPress={onEnd} />
    </View>
  );
}
