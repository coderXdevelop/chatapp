import { useState, useCallback, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'blocked';

export interface UseCallPermissionsReturn {
  hasCameraPermission: boolean;
  hasMicPermission: boolean;
  permissionStatus: PermissionStatus;
  isChecking: boolean;
  requestPermissions: (isVideoCall: boolean) => Promise<boolean>;
  retryPermissions: (isVideoCall: boolean) => Promise<boolean>;
}

export function useCallPermissions(): UseCallPermissionsReturn {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const [isChecking, setIsChecking] = useState<boolean>(false);

  /**
   * Check current microphone and camera permissions
   */
  const checkPermissions = useCallback(async () => {
    setIsChecking(true);
    try {
      if (Platform.OS === 'android') {
        const hasMic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        const hasCam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);

        setHasMicPermission(hasMic);
        setHasCameraPermission(hasCam);

        if (hasMic && hasCam) {
          setPermissionStatus('granted');
        } else if (!hasMic && !hasCam) {
          setPermissionStatus('prompt');
        } else {
          setPermissionStatus('denied');
        }
      } else {
        // iOS and Web handle permission prompts during getUserMedia stream request
        setHasMicPermission(true);
        setHasCameraPermission(true);
        setPermissionStatus('granted');
      }
    } catch (error) {
      console.warn('[useCallPermissions] Error checking permissions:', error);
      setPermissionStatus('prompt');
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Request microphone and optional camera permissions
   */
  const requestPermissions = useCallback(async (isVideoCall: boolean): Promise<boolean> => {
    setIsChecking(true);
    try {
      if (Platform.OS === 'android') {
        const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (isVideoCall) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

        const micGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const camGranted = isVideoCall
          ? granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
          : true;

        setHasMicPermission(micGranted);
        if (isVideoCall) setHasCameraPermission(camGranted);

        if (micGranted && camGranted) {
          setPermissionStatus('granted');
          return true;
        }

        const micNeverAskAgain = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
        const camNeverAskAgain = isVideoCall && granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

        if (micNeverAskAgain || camNeverAskAgain) {
          setPermissionStatus('blocked');
        } else {
          setPermissionStatus('denied');
        }

        return false;
      }

      setHasMicPermission(true);
      setHasCameraPermission(true);
      setPermissionStatus('granted');
      return true;
    } catch (error) {
      console.error('[useCallPermissions] Permission request failed:', error);
      setPermissionStatus('denied');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const retryPermissions = useCallback(
    async (isVideoCall: boolean): Promise<boolean> => {
      return requestPermissions(isVideoCall);
    },
    [requestPermissions]
  );

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    hasCameraPermission,
    hasMicPermission,
    permissionStatus,
    isChecking,
    requestPermissions,
    retryPermissions,
  };
}
