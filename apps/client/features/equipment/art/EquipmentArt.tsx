import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from '../../design';
import { useTheme } from '../../theme';
import { artAccessibilityLabel, artKindFor, artScale, artTint } from './categoryArt';
import { Machine } from './machines';

const ENTER_MS = 420;
/** One full float: up and back down. */
const FLOAT_MS = 6000;
const FLOAT_PX = 4;
const useNativeDriver = Platform.OS !== 'web';

interface EquipmentArtProps {
  categoryCode?: string | null;
  /** Read for the machine when there is no category, and named in the accessibility label. */
  title?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * The drawing a machine shows when nobody has photographed it, on its category's tint.
 * It rises in once, then floats gently; with Reduce Motion on it stays still. Only
 * opacity and transforms animate.
 */
export function EquipmentArt({ categoryCode, title, style }: EquipmentArtProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const kind = artKindFor({ categoryCode, title });
  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      float.setValue(0);
      return;
    }
    const half = { duration: FLOAT_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver };
    const animation = Animated.sequence([
      Animated.timing(enter, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, ...half }),
          Animated.timing(float, { toValue: 0, ...half }),
        ]),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, enter, float]);

  const scale = artScale(kind);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={artAccessibilityLabel(kind, title)}
      style={[
        {
          backgroundColor: artTint(kind, theme.dark),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: `${88 * scale}%`,
          aspectRatio: 640 / 400,
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_PX] }) },
          ],
        }}
      >
        <Machine kind={kind} />
      </Animated.View>
    </View>
  );
}
