import { useState } from 'react';
import { AudioModule, useAudioRecorder, RecordingPresets, setAudioModeAsync } from 'expo-audio';

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordUri, setRecordUri] = useState<string | null>(null);
  
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        alert('Microphone permission is required to record voice messages.');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      setRecordUri(null);
      await recorder.prepareToRecordAsync();
      await recorder.record();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start audio recording:', error);
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      await recorder.stop();
      setIsRecording(false);
      
      const uri = recorder.uri;
      setRecordUri(uri);
      
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      return uri;
    } catch (error) {
      console.error('Failed to stop audio recording:', error);
      setIsRecording(false);
      return null;
    }
  };

  return {
    isRecording,
    recordUri,
    startRecording,
    stopRecording,
  };
};
