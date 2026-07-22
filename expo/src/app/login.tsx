import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { COLORS, globalStyles } from '../styles/theme';

type Mode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';
type RegisterStep = 'CREDENTIALS' | 'OTP' | 'PROFILE';
type ForgotPasswordStep = 'EMAIL' | 'OTP_RESET';

export default function LoginScreen() {
  const router = useRouter();
  const { 
    login, 
    registerInit, 
    verifyRegisterOtp, 
    completeRegistration, 
    forgotPassword,
    resetPassword,
    isLoading: isAuthLoading 
  } = useAuthStore();

  const [mode, setMode] = useState<Mode>('LOGIN');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('CREDENTIALS');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<ForgotPasswordStep>('EMAIL');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [status, setStatus] = useState('Hey there! I am using ChatConnect.');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Forgot password form states
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Password visibility states
  const [secureText, setSecureText] = useState(true);
  const [secureNewText, setSecureNewText] = useState(true);

  // Focus highlighting states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  }, [email, password, otpCode, displayName, age, mode, registerStep, forgotPasswordStep, resetOtpCode, newPassword]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setRegisterStep('CREDENTIALS');
    setForgotPasswordStep('EMAIL');
    setErrorMessage('');
    setSuccessMessage('');
    setPassword('');
    setNewPassword('');
    setOtpCode('');
    setResetOtpCode('');
  };

  // Back button handler matching mockup stack flow
  const handleBack = () => {
    if (mode === 'REGISTER') {
      if (registerStep === 'OTP') {
        setRegisterStep('CREDENTIALS');
      } else if (registerStep === 'PROFILE') {
        setRegisterStep('OTP');
      } else {
        handleModeChange('LOGIN');
      }
    } else if (mode === 'FORGOT_PASSWORD') {
      if (forgotPasswordStep === 'OTP_RESET') {
        setForgotPasswordStep('EMAIL');
      } else {
        handleModeChange('LOGIN');
      }
    }
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
        router.replace('/home' as any);
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
        setSuccessMessage(res.message || 'Verification code sent to your email.');
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
        avatarUrl: avatarUri || undefined,
      });

      if (success) {
        router.replace('/home' as any);
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

  // 5. Forgot Password Step 1: Send Reset OTP Code
  const handleForgotPasswordInit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPassword(cleanEmail);
      if (res.success) {
        setForgotPasswordStep('OTP_RESET');
        setSuccessMessage(res.message || 'Verification code sent to your email.');
      } else {
        setErrorMessage(res.message || 'Failed to request password reset.');
      }
    } catch (err: any) {
      console.error('Forgot password init error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Forgot Password Step 2: Verify OTP and Reset
  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!resetOtpCode || resetOtpCode.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await resetPassword(cleanEmail, resetOtpCode.trim(), newPassword);
      if (res.success) {
        Alert.alert('Success', 'Your password has been reset successfully. Please sign in.');
        handleModeChange('LOGIN');
      } else {
        setErrorMessage(res.message || 'Failed to reset password.');
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const showBackButton = mode !== 'LOGIN';

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <KeyboardAvoidingView
        style={globalStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={globalStyles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header Action Row (Back Button & Orb Globe) */}
          <View style={styles.topActionRow}>
            {showBackButton ? (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backPlaceholder} />
            )}
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>ChatConnect</Text>
            </View>
          </View>

          <View style={globalStyles.content}>
            {/* Mockup Central Green Glowing Orb Logo */}
            <View style={styles.orbContainer}>
              <Image
                source={require('../../assets/images/logo-glow.png')}
                style={styles.orbImage}
                resizeMode="contain"
              />
            </View>

            {/* Header titles matching mockup layout */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'LOGIN' && 'Welcome Back!'}
                {mode === 'REGISTER' && 'Create Your Account?'}
                {mode === 'FORGOT_PASSWORD' && (
                  forgotPasswordStep === 'EMAIL' ? 'Forgot Password?' : 'Reset Password'
                )}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'LOGIN' && 'Sign in to access smart, real-time messaging made for you.'}
                {mode === 'REGISTER' && (
                  registerStep === 'CREDENTIALS' ? 'Create your account to explore exciting features and connect with contacts.' :
                  registerStep === 'OTP' ? `Enter the 6-digit code sent to ${email.trim()}` :
                  'Tell us a bit about yourself to finish your profile setup.'
                )}
                {mode === 'FORGOT_PASSWORD' && (
                  forgotPasswordStep === 'EMAIL' ? "Enter your email and we'll send a 6-digit verification code instantly." :
                  `Enter the verification code sent to ${email.trim()} and your new password.`
                )}
              </Text>
            </View>

            {/* Form Card */}
            <View style={globalStyles.card}>
              {errorMessage ? (
                <View style={globalStyles.errorBox}>
                  <Text style={globalStyles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {successMessage ? (
                <View style={globalStyles.successBox}>
                  <Text style={globalStyles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {/* MODE 1: LOGIN */}
              {mode === 'LOGIN' && (
                <>
                  <View style={globalStyles.inputGroup}>
                    <Text style={globalStyles.label}>Email address*</Text>
                    <View style={[globalStyles.inputWrapper, focusedField === 'email' && globalStyles.inputFocused]}>
                      <TextInput
                        style={globalStyles.input}
                        placeholder="example@gmail.com"
                        placeholderTextColor={COLORS.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>

                  <View style={globalStyles.inputGroup}>
                    <Text style={globalStyles.label}>Password*</Text>
                    <View style={[globalStyles.inputWrapper, focusedField === 'password' && globalStyles.inputFocused]}>
                      <TextInput
                        style={globalStyles.input}
                        placeholder="@Sn123hsn#"
                        placeholderTextColor={COLORS.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={secureText}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeButton}>
                        <Text style={styles.eyeText}>{secureText ? '👁️' : '🙈'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Remember me & Forgot Password Row */}
                  <View style={styles.extraRow}>
                    <View style={styles.rememberMeContainer}>
                      <View style={styles.checkboxPlaceholder} />
                      <Text style={styles.rememberMeText}>Remember me</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleModeChange('FORGOT_PASSWORD')}>
                      <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[globalStyles.button, (loading || isAuthLoading) && globalStyles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading || isAuthLoading}
                  >
                    {loading || isAuthLoading ? (
                      <ActivityIndicator color={COLORS.primaryText} />
                    ) : (
                      <Text style={globalStyles.buttonText}>✨ Sign in</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* MODE 2: REGISTER */}
              {mode === 'REGISTER' && (
                <>
                  {/* Stepper Progress Bar */}
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
                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Email address*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'reg-email' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="example@gmail.com"
                            placeholderTextColor={COLORS.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            onFocus={() => setFocusedField('reg-email')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Password (Min 6 Characters)*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'reg-pass' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="@Sn123hsn#"
                            placeholderTextColor={COLORS.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={secureText}
                            onFocus={() => setFocusedField('reg-pass')}
                            onBlur={() => setFocusedField(null)}
                          />
                          <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeButton}>
                            <Text style={styles.eyeText}>{secureText ? '👁️' : '🙈'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[globalStyles.button, (loading || isAuthLoading) && globalStyles.buttonDisabled]}
                        onPress={handleRegisterInit}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color={COLORS.primaryText} />
                        ) : (
                          <Text style={globalStyles.buttonText}>✨ Send Code</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Register Step 2: OTP */}
                  {registerStep === 'OTP' && (
                    <>
                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>6-Digit Verification Code*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'reg-otp' && globalStyles.inputFocused]}>
                          <TextInput
                            style={[globalStyles.input, styles.otpInput]}
                            placeholder="123456"
                            placeholderTextColor={COLORS.textSecondary}
                            value={otpCode}
                            onChangeText={setOtpCode}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            onFocus={() => setFocusedField('reg-otp')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[globalStyles.button, (loading || isAuthLoading) && globalStyles.buttonDisabled]}
                        onPress={handleVerifyRegisterOTP}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color={COLORS.primaryText} />
                        ) : (
                          <Text style={globalStyles.buttonText}>✨ Verify Code</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Register Step 3: Profile Setup */}
                  {registerStep === 'PROFILE' && (
                    <>
                      {/* Avatar Selection Circle */}
                      <View style={styles.avatarPickerContainer}>
                        <TouchableOpacity style={styles.avatarCircle} onPress={async () => {
                          try {
                            const result = await ImagePicker.launchImageLibraryAsync({
                              mediaTypes: ['images'],
                              allowsEditing: true,
                              aspect: [1, 1],
                              quality: 0.7,
                              base64: true,
                            });
                            if (!result.canceled && result.assets && result.assets[0]) {
                              const asset = result.assets[0];
                              const base64Data = asset.base64
                                ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
                                : asset.uri;
                              setAvatarUri(base64Data);
                            }
                          } catch (e: any) {
                            Alert.alert('Error', 'Could not open image library.');
                          }
                        }}>
                          {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImagePreview} />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                              <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        <View style={styles.avatarActionRow}>
                          <TouchableOpacity onPress={async () => {
                            try {
                              const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ['images'],
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.7,
                                base64: true,
                              });
                              if (!result.canceled && result.assets && result.assets[0]) {
                                const asset = result.assets[0];
                                const base64Data = asset.base64
                                  ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
                                  : asset.uri;
                                setAvatarUri(base64Data);
                              }
                            } catch (e: any) {
                              Alert.alert('Error', 'Could not open image library.');
                            }
                          }}>
                            <Text style={styles.avatarActionText}>
                              {avatarUri ? 'Change Photo' : '+ Choose Profile Picture'}
                            </Text>
                          </TouchableOpacity>
                          {avatarUri ? (
                            <TouchableOpacity onPress={() => setAvatarUri(null)}>
                              <Text style={styles.avatarRemoveText}>Remove</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>

                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Full Name / Display Name*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'reg-name' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="Alex Smith"
                            placeholderTextColor={COLORS.textSecondary}
                            value={displayName}
                            onChangeText={setDisplayName}
                            autoCapitalize="words"
                            autoFocus
                            onFocus={() => setFocusedField('reg-name')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Age</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'reg-age' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="24"
                            placeholderTextColor={COLORS.textSecondary}
                            value={age}
                            onChangeText={setAge}
                            keyboardType="number-pad"
                            onFocus={() => setFocusedField('reg-age')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Status Message</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'reg-status' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="Hey there! I am using ChatConnect."
                            placeholderTextColor={COLORS.textSecondary}
                            value={status}
                            onChangeText={setStatus}
                            onFocus={() => setFocusedField('reg-status')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[globalStyles.button, (loading || isAuthLoading) && globalStyles.buttonDisabled]}
                        onPress={handleCompleteRegistration}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color={COLORS.primaryText} />
                        ) : (
                          <Text style={globalStyles.buttonText}>Complete Registration</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}

              {/* MODE 3: FORGOT_PASSWORD */}
              {mode === 'FORGOT_PASSWORD' && (
                <>
                  {forgotPasswordStep === 'EMAIL' && (
                    <>
                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Email address*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'forgot-email' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="example@gmail.com"
                            placeholderTextColor={COLORS.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            onFocus={() => setFocusedField('forgot-email')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[globalStyles.button, (loading || isAuthLoading) && globalStyles.buttonDisabled]}
                        onPress={handleForgotPasswordInit}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color={COLORS.primaryText} />
                        ) : (
                          <Text style={globalStyles.buttonText}>✨ Send Code</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {forgotPasswordStep === 'OTP_RESET' && (
                    <>
                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>Verification Code*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'forgot-otp' && globalStyles.inputFocused]}>
                          <TextInput
                            style={[globalStyles.input, styles.otpInput]}
                            placeholder="123456"
                            placeholderTextColor={COLORS.textSecondary}
                            value={resetOtpCode}
                            onChangeText={setResetOtpCode}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            onFocus={() => setFocusedField('forgot-otp')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <View style={globalStyles.inputGroup}>
                        <Text style={globalStyles.label}>New Password*</Text>
                        <View style={[globalStyles.inputWrapper, focusedField === 'forgot-pass' && globalStyles.inputFocused]}>
                          <TextInput
                            style={globalStyles.input}
                            placeholder="••••••••"
                            placeholderTextColor={COLORS.textSecondary}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={secureNewText}
                            onFocus={() => setFocusedField('forgot-pass')}
                            onBlur={() => setFocusedField(null)}
                          />
                          <TouchableOpacity onPress={() => setSecureNewText(!secureNewText)} style={styles.eyeButton}>
                            <Text style={styles.eyeText}>{secureNewText ? '👁️' : '🙈'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[globalStyles.button, (loading || isAuthLoading) && globalStyles.buttonDisabled]}
                        onPress={handleResetPassword}
                        disabled={loading || isAuthLoading}
                      >
                        {loading || isAuthLoading ? (
                          <ActivityIndicator color={COLORS.primaryText} />
                        ) : (
                          <Text style={globalStyles.buttonText}>✨ Reset Password</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>

            {/* Footer Navigation Link */}
            <View style={styles.footer}>
              {mode === 'LOGIN' && (
                <TouchableOpacity style={globalStyles.secondaryButton} onPress={() => handleModeChange('REGISTER')}>
                  <Text style={globalStyles.secondaryButtonText}>
                    Don't have an account? <Text style={globalStyles.secondaryButtonTextActive}>Sign up</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode === 'REGISTER' && (
                <TouchableOpacity style={globalStyles.secondaryButton} onPress={() => handleModeChange('LOGIN')}>
                  <Text style={globalStyles.secondaryButtonText}>
                    Already have an account? <Text style={globalStyles.secondaryButtonTextActive}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode === 'FORGOT_PASSWORD' && (
                <TouchableOpacity style={globalStyles.secondaryButton} onPress={() => handleModeChange('LOGIN')}>
                  <Text style={globalStyles.secondaryButtonText}>
                    Already have an account? <Text style={globalStyles.secondaryButtonTextActive}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.securedFooterText}>
              Secured by Email OTP & JWT Session Encryption
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    height: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backPlaceholder: {
    width: 40,
  },
  badgeContainer: {
    backgroundColor: 'rgba(204, 255, 0, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.25)',
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  orbImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  eyeButton: {
    padding: 10,
  },
  eyeText: {
    fontSize: 18,
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#03050a',
  },
  rememberMeText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  forgotPasswordLink: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f293d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryText,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#1f293d',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#03050a',
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  avatarImagePreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderIcon: {
    fontSize: 26,
    marginBottom: 2,
  },
  avatarPlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarActionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  avatarActionText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  avatarRemoveText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  securedFooterText: {
    marginTop: 20,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
  },
});
