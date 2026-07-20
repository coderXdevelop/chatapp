import { useRouter } from 'expo-router';
import { ApplicationVerifier, ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithFirebaseToken, isLoading: isAuthLoading } = useAuthStore();

  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (errorMessage) setErrorMessage('');
  }, [phoneNumber, otpCode]);

  const initRecaptcha = () => {
    if (Platform.OS === 'web') {
      try {
        if (!recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {},
          });
        }
      } catch (err) {
        console.warn('Recaptcha init warning:', err);
      }
    }
  };

  const getAppVerifier = (): ApplicationVerifier => {
    if (Platform.OS === 'web' && recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    // Fallback ApplicationVerifier for Native & Test Phone Numbers
    // Note: Firebase Auth internally calls `verifier._reset()` in _verifyPhoneNumber line 8125
    return {
      type: 'recaptcha',
      verify: async () => 'mock-recaptcha-token',
      _reset: () => {},
    } as any;
  };

  const handleSendOTP = async () => {
    const cleanNumber = phoneNumber.trim().replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 7) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const fullPhoneNumber = `${countryCode.trim()}${cleanNumber}`;

    try {
      if (Platform.OS === 'web') {
        initRecaptcha();
      }

      const verifier = getAppVerifier();

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        fullPhoneNumber,
        verifier
      );

      confirmationResultRef.current = confirmationResult;
      setStep('OTP');
      setLoading(false);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setLoading(false);
      const msg = err.message || 'Failed to send OTP. Please check phone number.';
      setErrorMessage(msg);
      Alert.alert('Authentication Error', msg);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    if (!confirmationResultRef.current) {
      setErrorMessage('Session expired. Please request OTP again.');
      setStep('PHONE');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const userCredential = await confirmationResultRef.current.confirm(otpCode.trim());
      const idToken = await userCredential.user.getIdToken();

      const success = await loginWithFirebaseToken(idToken, displayName.trim() || undefined);

      if (success) {
        router.replace('/profile' as any);
      } else {
        setErrorMessage('Failed to establish server session. Please try again.');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setErrorMessage(err.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Invisible Recaptcha container for Web */}
        {Platform.OS === 'web' && <div id="recaptcha-container" />}

        <View style={styles.content}>
          {/* Header section */}
          <View style={styles.header}>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>ChatConnect Auth</Text>
            </View>
            <Text style={styles.title}>
              {step === 'PHONE' ? 'Sign In with Phone' : 'Enter Security Code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'PHONE'
                ? 'Enter your mobile number to receive a secure OTP code.'
                : `Enter the 6-digit verification code sent to ${countryCode} ${phoneNumber}`}
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {step === 'PHONE' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>DISPLAY NAME (OPTIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Alex Morgan"
                    placeholderTextColor="#64748B"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>MOBILE PHONE NUMBER</Text>
                  <View style={styles.phoneInputRow}>
                    <TextInput
                      style={[styles.input, styles.countryInput]}
                      value={countryCode}
                      onChangeText={setCountryCode}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={[styles.input, styles.flexInput]}
                      placeholder="9480397504"
                      placeholderTextColor="#64748B"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, (loading || isAuthLoading) && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading || isAuthLoading}
                >
                  {loading || isAuthLoading ? (
                    <ActivityIndicator color="#0F172A" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP Code →</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>6-DIGIT VERIFICATION CODE</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="123456"
                    placeholderTextColor="#64748B"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, (loading || isAuthLoading) && styles.buttonDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading || isAuthLoading}
                >
                  {loading || isAuthLoading ? (
                    <ActivityIndicator color="#0F172A" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Login</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep('PHONE')}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>← Change Phone Number</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>
            Secured by Firebase Phone Auth & MongoDB Session Encryption
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 32,
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 16,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryInput: {
    width: 80,
    textAlign: 'center',
    fontWeight: '600',
  },
  flexInput: {
    flex: 1,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  button: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 24,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
  },
});
