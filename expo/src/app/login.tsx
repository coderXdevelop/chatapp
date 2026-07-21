import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';

type Mode = 'LOGIN' | 'REGISTER';
type RegisterStep = 'CREDENTIALS' | 'OTP' | 'PROFILE';

export default function LoginScreen() {
  const router = useRouter();
  const { login, registerInit, verifyRegisterOtp, completeRegistration, isLoading: isAuthLoading } = useAuthStore();

  const [mode, setMode] = useState<Mode>('LOGIN');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('CREDENTIALS');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [status, setStatus] = useState('Hey there! I am using ChatConnect.');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (errorMessage) setErrorMessage('');
  }, [email, password, otpCode, displayName, age, mode, registerStep]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setRegisterStep('CREDENTIALS');
    setErrorMessage('');
  };

  // 1. Password Login Handler
  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await login(cleanEmail, password);
      if (res.success) {
        router.replace('/profile' as any);
      } else {
        setErrorMessage(res.message || 'Login failed.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'An unexpected login error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Register Step 1: Send OTP for Credentials
  const handleRegisterInit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await registerInit(cleanEmail, password);
      if (res.success) {
        setRegisterStep('OTP');
      } else {
        setErrorMessage(res.message || 'Failed to send OTP code.');
      }
    } catch (err: any) {
      console.error('Register init error:', err);
      setErrorMessage(err.message || 'Failed to initialize registration.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Register Step 2: Verify OTP
  const handleVerifyRegisterOTP = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await verifyRegisterOtp(email.trim().toLowerCase(), otpCode.trim());
      if (res.success) {
        setRegisterStep('PROFILE');
      } else {
        setErrorMessage(res.message || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setErrorMessage(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Register Step 3: Complete Registration Profile
  const handleCompleteRegistration = async () => {
    if (!displayName || !displayName.trim()) {
      setErrorMessage('Please enter your display name.');
      return;
    }

    if (age && (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120)) {
      setErrorMessage('Please enter a valid age between 1 and 120.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const success = await completeRegistration({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
        age: age ? Number(age) : undefined,
        status: status.trim() || undefined,
      });

      if (success) {
        router.replace('/profile' as any);
      } else {
        setErrorMessage('Failed to complete registration. Please try again.');
      }
    } catch (err: any) {
      console.error('Complete registration error:', err);
      setErrorMessage(err.message || 'Profile setup failed.');
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {/* Header section */}
            <View style={styles.header}>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>ChatConnect Auth</Text>
              </View>
              <Text style={styles.title}>
                {mode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'LOGIN'
                  ? 'Sign in to access your chats and messages.'
                  : registerStep === 'CREDENTIALS'
                  ? 'Enter your email & password to begin.'
                  : registerStep === 'OTP'
                  ? `Enter the 6-digit code sent to ${email.trim()}`
                  : 'Tell us a bit about yourself to finish.'}
              </Text>
            </View>

            {/* Mode Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, mode === 'LOGIN' && styles.tabButtonActive]}
                onPress={() => handleModeChange('LOGIN')}
              >
                <Text style={[styles.tabText, mode === 'LOGIN' && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, mode === 'REGISTER' && styles.tabButtonActive]}
                onPress={() => handleModeChange('REGISTER')}
              >
                <Text style={[styles.tabText, mode === 'REGISTER' && styles.tabTextActive]}>Register</Text>
              </TouchableOpacity>
            </View>

            {/* Form Card */}
            <View style={styles.card}>
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* MODE 1: LOGIN */}
              {mode === 'LOGIN' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>EMAIL ADDRESS</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="alex@example.com"
                      placeholderTextColor="#64748B"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>PASSWORD</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#64748B"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.button, (loading || isAuthLoading) && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading || isAuthLoading}
                  >
                    {loading || isAuthLoading ? (
                      <ActivityIndicator color="#0F172A" />
                    ) : (
                      <Text style={styles.buttonText}>Sign In →</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* MODE 2: REGISTER */}
              {mode === 'REGISTER' && (
                <>
                  {/* Stepper Indicator */}
                  <View style={styles.stepperContainer}>
                    <View style={[styles.stepDot, styles.stepDotActive]}>
                      <Text style={styles.stepNum}>1</Text>
                    </View>
                    <View style={[styles.stepLine, registerStep !== 'CREDENTIALS' && styles.stepLineActive]} />
                    <View style={[styles.stepDot, registerStep !== 'CREDENTIALS' && styles.stepDotActive]}>
                      <Text style={styles.stepNum}>2</Text>
                    </View>
                    <View style={[styles.stepLine, registerStep === 'PROFILE' && styles.stepLineActive]} />
                    <View style={[styles.stepDot, registerStep === 'PROFILE' && styles.stepDotActive]}>
                      <Text style={styles.stepNum}>3</Text>
                    </View>
                  </View>

                  {/* Register Step 1: Credentials */}
                  {registerStep === 'CREDENTIALS' && (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>EMAIL ADDRESS</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="alex@example.com"
                          placeholderTextColor="#64748B"
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>PASSWORD (MIN 6 CHARACTERS)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="••••••••"
                          placeholderTextColor="#64748B"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.button, (loading || isAuthLoading) && styles.buttonDisabled]}
                        onPress={handleRegisterInit}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color="#0F172A" />
                        ) : (
                          <Text style={styles.buttonText}>Send Security Code →</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Register Step 2: OTP */}
                  {registerStep === 'OTP' && (
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
                        onPress={handleVerifyRegisterOTP}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color="#0F172A" />
                        ) : (
                          <Text style={styles.buttonText}>Verify Code →</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setRegisterStep('CREDENTIALS')}
                        disabled={loading}
                      >
                        <Text style={styles.secondaryButtonText}>← Edit Email / Password</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Register Step 3: Profile Setup */}
                  {registerStep === 'PROFILE' && (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>FULL NAME / DISPLAY NAME *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Alex Morgan"
                          placeholderTextColor="#64748B"
                          value={displayName}
                          onChangeText={setDisplayName}
                          autoCapitalize="words"
                          autoFocus
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>AGE</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="24"
                          placeholderTextColor="#64748B"
                          value={age}
                          onChangeText={setAge}
                          keyboardType="number-pad"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>STATUS MESSAGE</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Hey there! I am using ChatConnect."
                          placeholderTextColor="#64748B"
                          value={status}
                          onChangeText={setStatus}
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.button, (loading || isAuthLoading) && styles.buttonDisabled]}
                        onPress={handleCompleteRegistration}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color="#0F172A" />
                        ) : (
                          <Text style={styles.buttonText}>Complete Registration</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>

            {/* Footer */}
            <Text style={styles.footerText}>
              Secured by Email OTP & JWT Session Encryption
            </Text>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 24,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#F59E0B',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#0F172A',
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#F59E0B',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#F59E0B',
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
    marginBottom: 18,
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

