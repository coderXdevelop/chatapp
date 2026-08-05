import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

export interface UseCallTimerReturn {
  seconds: number;
  formattedTime: string;
  isRunning: boolean;
  startTimer: () => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
}

export function useCallTimer(initialSeconds: number = 0): UseCallTimerReturn {
  const [seconds, setSeconds] = useState<number>(initialSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSeconds(0);
    setIsRunning(true);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const resumeTimer = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
  }, [isRunning]);

  const resetTimer = useCallback(() => {
    stopTimer();
    setSeconds(0);
  }, [stopTimer]);

  const formattedTime = useMemo(() => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num: number) => (num < 10 ? `0${num}` : `${num}`);

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }, [seconds]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    seconds,
    formattedTime,
    isRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  };
}
