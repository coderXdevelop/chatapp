import { StyleSheet, Platform } from 'react-native';

export const COLORS = {
  background: '#070b13',      // Extremely dark slate/black as seen in the mockup
  cardBackground: '#101622',  // Deep slate card container
  border: '#1f293d',          // Muted border color
  borderFocus: '#CCFF00',     // Neon lime green border color when focused
  textPrimary: '#FFFFFF',     // Pure white text
  textSecondary: '#64748B',   // Muted slate text
  accent: '#F59E0B',          // Warm Amber OTP accent
  primary: '#CCFF00',         // Lime neon button background
  primaryText: '#070b13',     // Dark slate text for the neon button
  errorBackground: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.3)',
  errorText: '#FCA5A5',
  successBackground: 'rgba(16, 185, 129, 0.12)',
  successBorder: 'rgba(16, 185, 129, 0.3)',
  successText: '#A7F3D0',
};

export const globalStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  // Mockup card style
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  // Mockup Input Group Styling
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#03050a', // Ultra dark input background
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: COLORS.borderFocus,
  },
  // Mockup Neon Pill Button
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Secondary links
  secondaryButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonTextActive: {
    color: COLORS.primary,
  },
  // System feedback states
  errorBox: {
    backgroundColor: COLORS.errorBackground,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 13,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: COLORS.successBackground,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    color: COLORS.successText,
    fontSize: 13,
    textAlign: 'center',
  },
});
