import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import { useAuthStore } from './authStore';

export interface Message {
  _id: string;
  tempId?: string;
  chat: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  text: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    status: string;
  }>;
  lastMessage?: Message;
  unreadCounts: Record<string, number>;
  updatedAt: string;
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  loadingMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  socket: Socket | null;
  socketConnected: boolean;

  fetchChats: () => Promise<void>;
  createChat: (participantId: string) => Promise<Chat | null>;
  fetchMessages: (chatId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  markAsRead: (chatId: string) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

// Extract base URL from Axios instance configuration
const SOCKET_URL = api.defaults.baseURL || 'https://chatapp-4cpr.onrender.com';

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  loadingMessages: {},
  hasMoreMessages: {},
  socket: null,
  socketConnected: false,

  fetchChats: async () => {
    try {
      const res = await api.get('/api/chats');
      set({ chats: res.data.chats });
    } catch (e) {
      console.error('Fetch chats error:', e);
    }
  },

  createChat: async (participantId) => {
    try {
      const res = await api.post('/api/chats', { participantId });
      const newChat: Chat = res.data.chat;

      // Update chats list in local state
      const currentChats = get().chats;
      if (!currentChats.find((c) => c._id === newChat._id)) {
        set({ chats: [newChat, ...currentChats] });
      }
      return newChat;
    } catch (e) {
      console.error('Create chat error:', e);
      return null;
    }
  },

  fetchMessages: async (chatId, loadMore = false) => {
    const isAlreadyLoading = get().loadingMessages[chatId];
    if (isAlreadyLoading) return;

    const currentMessages = get().messages[chatId] || [];
    const hasMore = get().hasMoreMessages[chatId] !== false; // default to true
    if (loadMore && !hasMore) return;

    set((state) => ({
      loadingMessages: { ...state.loadingMessages, [chatId]: true },
    }));

    try {
      // Use oldest message timestamp as cursor
      const before =
        loadMore && currentMessages.length > 0
          ? currentMessages[currentMessages.length - 1].createdAt
          : undefined;

      const res = await api.get(`/api/chats/${chatId}/messages`, {
        params: { before, limit: 20 },
      });

      const fetchedMessages: Message[] = res.data.messages;
      const reachedEnd = fetchedMessages.length < 20;

      set((state) => {
        const combined = loadMore
          ? [...(state.messages[chatId] || []), ...fetchedMessages]
          : fetchedMessages; // Replace if fresh load (not paginating)

        return {
          messages: { ...state.messages, [chatId]: combined },
          hasMoreMessages: { ...state.hasMoreMessages, [chatId]: !reachedEnd },
          loadingMessages: { ...state.loadingMessages, [chatId]: false },
        };
      });
    } catch (e) {
      console.error('Fetch messages error:', e);
      set((state) => ({
        loadingMessages: { ...state.loadingMessages, [chatId]: false },
      }));
    }
  },

  sendMessage: async (chatId, text) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: Message = {
      _id: tempId,
      tempId,
      chat: chatId,
      sender: {
        _id: currentUser.id,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
      },
      text,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    // 1. Insert optimistically at the beginning of the messages list (which translates to the bottom of inverted list)
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [optimisticMessage, ...(state.messages[chatId] || [])],
      },
    }));

    const socket = get().socket;

    const handleSuccess = (savedMsg: Message) => {
      set((state) => {
        const updated = (state.messages[chatId] || []).map((m) =>
          m.tempId === tempId ? savedMsg : m
        );
        return {
          messages: { ...state.messages, [chatId]: updated },
        };
      });
    };

    const handleFail = async () => {
      // Offline fallback: attempt HTTP post request directly
      try {
        const res = await api.post(`/api/chats/${chatId}/messages`, { text, tempId });
        handleSuccess(res.data.message);
      } catch (err) {
        set((state) => {
          // Revert or mark message status if network fails completely
          const updated = (state.messages[chatId] || []).map((m) =>
            m.tempId === tempId ? { ...m, status: 'sending' as any } : m // retry can be triggered later
          );
          return { messages: { ...state.messages, [chatId]: updated } };
        });
      }
    };

    // 2. Try socket connection emit first, fallback to HTTP if offline or unacknowledged
    if (socket && get().socketConnected) {
      socket.emit(
        'send_message',
        { chatId, text, tempId },
        (ack: { success: boolean; message?: Message; error?: string }) => {
          if (ack && ack.success && ack.message) {
            handleSuccess(ack.message);
          } else {
            console.warn('Socket ack failed, trying REST fallback:', ack?.error);
            handleFail();
          }
        }
      );
    } else {
      console.warn('Socket not connected, trying REST fallback directly');
      handleFail();
    }
  },

  markAsRead: (chatId) => {
    const socket = get().socket;
    if (socket && get().socketConnected) {
      socket.emit('read_messages', { chatId });
    }
    // Update local unread status for current user
    const currentUserId = useAuthStore.getState().user?.id;
    if (!currentUserId) return;

    set((state) => ({
      chats: state.chats.map((c) => {
        if (c._id === chatId) {
          const updatedCounts = { ...c.unreadCounts };
          updatedCounts[currentUserId] = 0;
          return { ...c, unreadCounts: updatedCounts };
        }
        return c;
      }),
    }));
  },

  connectSocket: () => {
    if (get().socket) return; // Socket is already initialized

    const token = useAuthStore.getState().token;
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      set({ socketConnected: true });
    });

    newSocket.on('disconnect', () => {
      set({ socketConnected: false });
    });

    newSocket.on('new_message', (msg: Message) => {
      // Append message only if messages have been loaded for this room
      const activeChatLoaded = get().messages[msg.chat] !== undefined;

      if (activeChatLoaded) {
        set((state) => {
          const list = state.messages[msg.chat] || [];
          // Avoid duplicate inserts
          if (list.find((m) => m._id === msg._id || (m.tempId && m.tempId === msg.tempId))) {
            return {};
          }
          return {
            messages: {
              ...state.messages,
              [msg.chat]: [msg, ...list],
            },
          };
        });
      }

      // Update chats list lastMessage preview
      set((state) => ({
        chats: state.chats
          .map((c) =>
            c._id === msg.chat ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      }));
    });

    newSocket.on('messages_read', (data: { chatId: string; userId: string }) => {
      const activeChatLoaded = get().messages[data.chatId] !== undefined;
      if (activeChatLoaded) {
        set((state) => {
          const chatMsgs = state.messages[data.chatId] || [];
          const updated = chatMsgs.map((m) =>
            m.sender._id !== data.userId ? { ...m, status: 'read' as const } : m
          );
          return {
            messages: { ...state.messages, [data.chatId]: updated },
          };
        });
      }
    });

    newSocket.on('chat_created', (newChat: Chat) => {
      set((state) => {
        if (state.chats.find((c) => c._id === newChat._id)) return {};
        return { chats: [newChat, ...state.chats] };
      });
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, socketConnected: false });
    }
  },
}));
