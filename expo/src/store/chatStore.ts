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
  text?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaDuration?: number;
  mediaSize?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyTo?: {
    _id: string;
    sender: {
      _id: string;
      displayName: string;
    };
    text: string;
  } | null;
  isForwarded?: boolean;
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
    connectId?: string;
    age?: number;
    isOnline?: boolean;
    lastSeen?: string;
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
  typingStates: Record<string, string[]>;

  fetchChats: () => Promise<void>;
  createChat: (participantId: string) => Promise<Chat | null>;
  fetchMessages: (chatId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (
    chatId: string,
    text: string,
    replyTo?: string,
    media?: {
      url: string;
      type: 'image' | 'video' | 'audio';
      duration?: number;
      size?: number;
      width?: number;
      height?: number;
    }
  ) => Promise<void>;
  editMessage: (chatId: string, messageId: string, newText: string) => Promise<boolean>;
  deleteMessage: (chatId: string, messageId: string, type: 'me' | 'everyone') => Promise<boolean>;
  forwardMessages: (messageIds: string[], chatIds: string[], searchContacts?: string[]) => Promise<boolean>;
  markAsRead: (chatId: string) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
  sendTypingStart: (chatId: string) => void;
  sendTypingStop: (chatId: string) => void;
  addOptimisticMessage: (chatId: string, message: Message) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  sendFinalizedMessage: (
    chatId: string,
    tempId: string,
    mediaPayload: {
      url: string;
      type: 'image' | 'video' | 'audio' | 'document';
      duration?: number;
      size?: number;
      width?: number;
      height?: number;
      text?: string;
    }
  ) => Promise<void>;
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
  typingStates: {},

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

  sendMessage: async (chatId, text, replyTo, media) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    let replyToObj: any = null;
    if (replyTo) {
      const originalMsg = (get().messages[chatId] || []).find((m) => m._id === replyTo);
      if (originalMsg) {
        replyToObj = {
          _id: originalMsg._id,
          sender: {
            _id: originalMsg.sender._id,
            displayName: originalMsg.sender.displayName,
          },
          text: originalMsg.text,
        };
      }
    }

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
      text: text || '',
      status: 'sending',
      replyTo: replyToObj,
      mediaUrl: media?.url,
      mediaType: media?.type,
      mediaDuration: media?.duration,
      mediaSize: media?.size,
      mediaWidth: media?.width,
      mediaHeight: media?.height,
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
        const res = await api.post(`/api/chats/${chatId}/messages`, {
          text,
          tempId,
          replyTo,
          mediaUrl: media?.url,
          mediaType: media?.type,
          mediaDuration: media?.duration,
          mediaSize: media?.size,
          mediaWidth: media?.width,
          mediaHeight: media?.height,
        });
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
        {
          chatId,
          text,
          tempId,
          replyTo,
          mediaUrl: media?.url,
          mediaType: media?.type,
          mediaDuration: media?.duration,
          mediaSize: media?.size,
          mediaWidth: media?.width,
          mediaHeight: media?.height,
        },
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

  editMessage: async (chatId, messageId, newText) => {
    const socket = get().socket;
    if (socket && get().socketConnected) {
      return new Promise<boolean>((resolve) => {
        socket.emit(
          'edit_message',
          { chatId, messageId, text: newText },
          (ack: { success: boolean; message?: Message; error?: string }) => {
            if (ack && ack.success && ack.message) {
              set((state) => {
                const list = state.messages[chatId] || [];
                const updated = list.map((m) => (m._id === messageId ? ack.message! : m));
                return {
                  messages: { ...state.messages, [chatId]: updated },
                };
              });
              resolve(true);
            } else {
              console.warn('Socket edit_message ack failed:', ack?.error);
              resolve(false);
            }
          }
        );
      });
    }
    return false;
  },

  deleteMessage: async (chatId, messageId, type) => {
    const socket = get().socket;
    if (socket && get().socketConnected) {
      return new Promise<boolean>((resolve) => {
        socket.emit(
          'delete_message',
          { chatId, messageId, type },
          (ack: { success: boolean; messageId?: string; type?: 'me' | 'everyone'; error?: string }) => {
            if (ack && ack.success) {
              set((state) => {
                const list = state.messages[chatId] || [];
                if (type === 'me') {
                  // Filter out the message for me locally
                  const updated = list.filter((m) => m._id !== messageId);
                  return {
                    messages: { ...state.messages, [chatId]: updated },
                  };
                } else {
                  // Update message text for everyone locally
                  const updated = list.map((m) =>
                    m._id === messageId
                      ? { ...m, text: 'This message was deleted', isDeleted: true }
                      : m
                  );
                  return {
                    messages: { ...state.messages, [chatId]: updated },
                  };
                }
              });
              resolve(true);
            } else {
              console.warn('Socket delete_message ack failed:', ack?.error);
              resolve(false);
            }
          }
        );
      });
    }
    return false;
  },

  forwardMessages: async (messageIds, chatIds, searchContacts = []) => {
    try {
      const res = await api.post('/api/chats/forward', {
        messageIds,
        chatIds,
        searchContacts,
      });
      if (res.data && res.data.success) {
        await get().fetchChats();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Forward messages error:', e);
      return false;
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

    newSocket.on('message_edited', (editedMsg: Message) => {
      set((state) => {
        const list = state.messages[editedMsg.chat] || [];
        const updated = list.map((m) => (m._id === editedMsg._id ? editedMsg : m));
        return {
          messages: {
            ...state.messages,
            [editedMsg.chat]: updated,
          },
        };
      });
    });

    newSocket.on('message_deleted', (data: { chatId: string; messageId: string; text: string; isDeleted: boolean }) => {
      set((state) => {
        const list = state.messages[data.chatId] || [];
        const updated = list.map((m) =>
          m._id === data.messageId
            ? { ...m, text: data.text, isDeleted: data.isDeleted }
            : m
        );
        return {
          messages: {
            ...state.messages,
            [data.chatId]: updated,
          },
        };
      });
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

    newSocket.on('presence_change', (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      set((state) => ({
        chats: state.chats.map((c) => {
          const updatedParticipants = c.participants.map((p) => {
            if (p._id === data.userId) {
              return {
                ...p,
                isOnline: data.isOnline,
                lastSeen: data.lastSeen || p.lastSeen,
              };
            }
            return p;
          });
          return { ...c, participants: updatedParticipants };
        }),
      }));
    });

    newSocket.on('typing_start', (data: { chatId: string; userId: string }) => {
      set((state) => {
        const currentTyping = state.typingStates[data.chatId] || [];
        if (currentTyping.includes(data.userId)) return {};
        return {
          typingStates: {
            ...state.typingStates,
            [data.chatId]: [...currentTyping, data.userId],
          },
        };
      });
    });

    newSocket.on('typing_stop', (data: { chatId: string; userId: string }) => {
      set((state) => {
        const currentTyping = state.typingStates[data.chatId] || [];
        return {
          typingStates: {
            ...state.typingStates,
            [data.chatId]: currentTyping.filter((id) => id !== data.userId),
          },
        };
      });
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, socketConnected: false, typingStates: {} });
    }
  },

  sendTypingStart: (chatId: string) => {
    const socket = get().socket;
    if (socket && get().socketConnected) {
      socket.emit('typing_start', { chatId });
    }
  },

  sendTypingStop: (chatId: string) => {
    const socket = get().socket;
    if (socket && get().socketConnected) {
      socket.emit('typing_stop', { chatId });
    }
  },

  addOptimisticMessage: (chatId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [message, ...(state.messages[chatId] || [])],
      },
    }));
  },

  removeMessage: (chatId, messageId) => {
    set((state) => {
      const updated = (state.messages[chatId] || []).filter((m) => m._id !== messageId && m.tempId !== messageId);
      return {
        messages: { ...state.messages, [chatId]: updated },
      };
    });
  },

  sendFinalizedMessage: async (chatId, tempId, mediaPayload) => {
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
      try {
        const res = await api.post(`/api/chats/${chatId}/messages`, {
          text: mediaPayload.text || '',
          tempId,
          mediaUrl: mediaPayload.url,
          mediaType: mediaPayload.type,
          mediaDuration: mediaPayload.duration,
          mediaSize: mediaPayload.size,
          mediaWidth: mediaPayload.width,
          mediaHeight: mediaPayload.height,
        });
        handleSuccess(res.data.message);
      } catch (err) {
        set((state) => {
          const updated = (state.messages[chatId] || []).map((m) =>
            m.tempId === tempId ? { ...m, status: 'sending' as any } : m
          );
          return { messages: { ...state.messages, [chatId]: updated } };
        });
      }
    };

    if (socket && get().socketConnected) {
      socket.emit(
        'send_message',
        {
          chatId,
          text: mediaPayload.text || '',
          tempId,
          mediaUrl: mediaPayload.url,
          mediaType: mediaPayload.type,
          mediaDuration: mediaPayload.duration,
          mediaSize: mediaPayload.size,
          mediaWidth: mediaPayload.width,
          mediaHeight: mediaPayload.height,
        },
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
}));
