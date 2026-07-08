import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

interface SplashScreenProps {
    isReady: boolean;
    onAnimationComplete: () => void;
}

export function UnityStyleSplash({ isReady, onAnimationComplete }: SplashScreenProps) {
    const logoScale = useSharedValue(0.3);
    const logoOpacity = useSharedValue(0);
    const glowOpacity = useSharedValue(0.2);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(20);
    const spinnerRotation = useSharedValue(0);
    const screenOpacity = useSharedValue(1);

    useEffect(() => {
        logoScale.value = withSpring(1, { damping: 12 });
        logoOpacity.value = withTiming(1, { duration: 600 });
        glowOpacity.value = withRepeat(withTiming(0.7, { duration: 1000 }), -1, true);
        textOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
        textTranslateY.value = withDelay(400, withSpring(0));
        spinnerRotation.value = withRepeat(withTiming(360, { duration: 1200 }), -1, false);
    }, []);

    useEffect(() => {
        if (isReady) {
            screenOpacity.value = withTiming(0, { duration: 500 }, (isFinished) => {
                if (isFinished) {
                    runOnJS(onAnimationComplete)();
                }
            });
        }
    }, [isReady]);

    const animatedLogo = useAnimatedStyle(() => ({
        transform: [{ scale: logoScale.value }],
        opacity: logoOpacity.value,
    }));

    const animatedGlow = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
    const animatedText = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }],
    }));
    const animatedSpinner = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinnerRotation.value}deg` }] }));
    const animatedScreen = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

    return (
        <Animated.View style={[styles.overlay, animatedScreen]}>
            <Animated.View style={[styles.radialGlow, animatedGlow]} />

            <View style={styles.centerContent}>
                <Animated.View style={[styles.logoContainer, animatedLogo]}>
                    <Svg width="90" height="90" viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                            stroke="#0e72e6ff"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round" />
                    </Svg>
                </Animated.View>

                <Animated.View style={[styles.textContainer, animatedText]}>
                    <Text style={styles.titleText}>INSTITUTE</Text>
                    <Text style={styles.subtitleText}>MANAGEMENT SYSTEM</Text>
                    <Text style={styles.loadingText}>POWERED BY HAHIR KHAN</Text>
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <Animated.View style={[styles.spinner, animatedSpinner]} />
            </View>
        </Animated.View>
    );
}

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#030303ff', zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
    radialGlow: { position: 'absolute', width: width * 0.8, height: width * 0.8, borderRadius: (width * 0.8) / 2, backgroundColor: 'rgba(245, 166, 35, 0.06)', shadowColor: "#0e72e6ff", shadowRadius: 100, shadowOpacity: 1, elevation: 5 },
    centerContent: { alignItems: 'center', justifyContent: 'center' },
    logoContainer: { marginBottom: 24 },
    textContainer: { alignItems: 'center' },
    titleText: { color: '#ffffffff', fontSize: 26, fontWeight: '300', letterSpacing: 10, textAlign: 'center' },
    subtitleText: { color: '#fbfbfbff', fontSize: 12, fontWeight: '600', letterSpacing: 4, marginTop: 6, textAlign: 'center' },
    loadingText: { color: '#6d788aff', fontSize: 10, letterSpacing: 1.5, marginTop: 24, textTransform: 'uppercase' },
    footer: { position: 'absolute', bottom: height * 0.08 },
    spinner: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(245, 166, 35, 0.1)', borderTopColor: "#0e72e6ff" },
});

export default UnityStyleSplash;