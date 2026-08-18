import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';

export interface SocketHandlers {}

export function useSocketEvents(handlers: SocketHandlers = {}) {
  const socket = useChatStore((state) => state.socket);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
}

