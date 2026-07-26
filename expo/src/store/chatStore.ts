import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import { useAuthStore } from './authStore';
import { presentLocalNotification } from '../services/notifications';

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
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'gif' | 'sticker';
  mediaDuration?: number;
  mediaSize?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  reactions?: Array<{ user: string; emoji: string }>;
  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  };
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
  starredByUsers?: string[];
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
  isGroup?: boolean;
  name?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  creator?: string;
  admins?: string[];
  isFavourite?: boolean;
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  loadingMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  socket: Socket | null;
  socketConnected: boolean;
  activeChatId: string | null;
  typingStates: Record<string, string[]>;
  blockedUsers: any[];
  starredMessages: Message[];
  activeStatuses: Array<{ user: any; items: any[] }>;

  enterChatRoom: (chatId: string) => void;
  leaveChatRoom: (chatId: string) => void;
  fetchChats: () => Promise<void>;
  createChat: (participantId: string) => Promise<Chat | null>;
  fetchMessages: (chatId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (
    chatId: string,
    text: string,
    replyTo?: string,
    media?: {
      url: string;
      type: 'image' | 'video' | 'audio' | 'document' | 'gif' | 'sticker';
      duration?: number;
      size?: number;
      width?: number;
      height?: number;
    },
    linkPreview?: {
      url: string;
      title?: string;
      description?: string;
      image?: string;
      domain?: string;
    }
  ) => Promise<void>;
  editMessage: (chatId: string, messageId: string, newText: string) => Promise<boolean>;
  sendReaction: (chatId: string, messageId: string, emoji: string) => Promise<boolean>;
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

  fetchBlockedUsers: () => Promise<void>;
  blockUser: (targetUserId: string) => Promise<void>;
  unblockUser: (targetUserId: string) => Promise<void>;
  submitReport: (payload: { reportedUserId?: string; reportedChatId?: string; category: string; reason: string }) => Promise<boolean>;
  createGroup: (name: string, participants: string[], avatarUrl?: string, avatarPublicId?: string) => Promise<Chat | null>;
  updateGroupSettings: (chatId: string, name?: string, avatarUrl?: string, avatarPublicId?: string) => Promise<Chat | null>;
  addGroupMembers: (chatId: string, userIds: string[]) => Promise<Chat | null>;
  removeGroupMember: (chatId: string, memberId: string) => Promise<Chat | null>;
  leaveGroup: (chatId: string) => Promise<boolean>;
  promoteGroupAdmin: (chatId: string, targetUserId: string, action: 'promote' | 'demote') => Promise<Chat | null>;
  searchMessages: (chatId: string | null, query: string) => Promise<Message[]>;
  clearChat: (chatId: string) => Promise<boolean>;
  toggleFavoriteChat: (chatId: string) => Promise<boolean>;
  deleteChats: (chatIds: string[]) => Promise<boolean>;
  toggleStarMessage: (chatId: string, messageId: string) => Promise<boolean>;
  togglePinMessage: (chatId: string, messageId: string) => Promise<any>;
  fetchStarredMessages: () => Promise<void>;
  fetchStatusFeed: () => Promise<void>;
  postStatus: (payload: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    caption?: string;
    backgroundColor?: string;
    items?: Array<{ text?: string; mediaUrl?: string; mediaType?: 'image' | 'video'; caption?: string; backgroundColor?: string }>;
  }) => Promise<boolean>;
  deleteStatus: (statusId: string) => Promise<boolean>;
  globalSearchAll: (query: string) => Promise<{ chats: Chat[]; messages: Message[] }>;
}

// Extract base URL from Axios instance configuration
const SOCKET_URL = api.defaults.baseURL || 'https://chatapp-4cpr.onrender.com';

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  chats: [],
  messages: {},
  loadingMessages: {},
  hasMoreMessages: {},
  socket: null,
  socketConnected: false,
  activeChatId: null,
  typingStates: {},
  blockedUsers: [],
  starredMessages: [],
  activeStatuses: [],

  enterChatRoom: (chatId: string) => {
    set({ activeChatId: chatId });
    const socket = get().socket;
    if (socket && socket.connected) {
      socket.emit('join_chat_room', { chatId });
    }
  },

  leaveChatRoom: (chatId: string) => {
    if (get().activeChatId === chatId) {
      set({ activeChatId: null });
    }
    const socket = get().socket;
    if (socket && socket.connected) {
      socket.emit('leave_chat_room', { chatId });
    }
  },


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

  sendMessage: async (chatId, text, replyTo, media, linkPreview) => {
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
      linkPreview,
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
          linkPreview,
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
          linkPreview,
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

  clearChat: async (chatId) => {
    try {
      await api.post(`/api/chats/${chatId}/clear`);
      set((state) => ({
        messages: { ...state.messages, [chatId]: [] },
      }));
      return true;
    } catch (error) {
      console.error('Failed to clear chat:', error);
      return false;
    }
  },

  toggleFavoriteChat: async (chatId) => {
    try {
      const res = await api.post(`/api/chats/${chatId}/favorite`);
      const { isFavourite } = res.data;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? { ...c, isFavourite } : c)),
      }));
      return true;
    } catch (error) {
      console.error('Failed to toggle favorite chat:', error);
      return false;
    }
  },

  deleteChats: async (chatIds) => {
    try {
      await api.post('/api/chats/delete-multiple', { chatIds });
      set((state) => ({
        chats: state.chats.filter((c) => !chatIds.includes(c._id)),
      }));
      return true;
    } catch (error) {
      console.error('Failed to delete chats:', error);
      return false;
    }
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
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      set({ socketConnected: true });
      const currentActiveId = get().activeChatId;
      if (currentActiveId) {
        newSocket.emit('join_chat_room', { chatId: currentActiveId });
      }
    });

    newSocket.on('disconnect', () => {
      set({ socketConnected: false });
    });

    newSocket.on('new_message', (msg: Message) => {
      const currentUser = useAuthStore.getState().user;
      const currentUserId = currentUser?.id;
      const activeChatId = get().activeChatId;

      // Present local notification if user is not currently in this chat room and sender is not current user
      if (msg.sender?._id !== currentUserId && msg.chat !== activeChatId) {
        const title = msg.sender?.displayName || 'New Message';
        let body = msg.text || '';
        if (!body && msg.mediaType) {
          const typeIcons: Record<string, string> = { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Voice note', document: '📄 Document', gif: '👾 GIF', sticker: '🎨 Sticker' };
          body = typeIcons[msg.mediaType] || 'Sent a file';
        }
        presentLocalNotification(title, body, { chatId: msg.chat, messageId: msg._id });
      }

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

    newSocket.on('message_delivered', (data: { chatId: string; messageId: string; status: 'delivered' }) => {
      set((state) => {
        const list = state.messages[data.chatId] || [];
        const updated = list.map((m) => (m._id === data.messageId ? { ...m, status: 'delivered' as const } : m));
        return { messages: { ...state.messages, [data.chatId]: updated } };
      });
    });

    newSocket.on('message_reaction_updated', (data: { chatId: string; messageId: string; reactions: Array<{ user: string; emoji: string }> }) => {
      set((state) => {
        const list = state.messages[data.chatId] || [];
        const updated = list.map((m) => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
        return { messages: { ...state.messages, [data.chatId]: updated } };
      });
    });

    newSocket.on('chat_created', (newChat: Chat) => {
      set((state) => {
        if (state.chats.find((c) => c._id === newChat._id)) return {};
        return { chats: [newChat, ...state.chats] };
      });
    });

    newSocket.on('group_updated', (updatedChat: Chat) => {
      set((state) => ({
        chats: state.chats.map((c) => (c._id === updatedChat._id ? updatedChat : c)),
      }));
    });

    newSocket.on('chat_deleted', (data: { chatId: string }) => {
      set((state) => ({
        chats: state.chats.filter((c) => c._id !== data.chatId),
      }));
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

  sendReaction: async (chatId, messageId, emoji) => {
    const socket = get().socket;
    if (socket && get().socketConnected) {
      return new Promise<boolean>((resolve) => {
        socket.emit(
          'send_reaction',
          { chatId, messageId, emoji },
          (ack: { success: boolean; reactions?: any[] }) => {
            if (ack && ack.success && ack.reactions) {
              set((state) => {
                const list = state.messages[chatId] || [];
                const updated = list.map((m) => (m._id === messageId ? { ...m, reactions: ack.reactions } : m));
                return { messages: { ...state.messages, [chatId]: updated } };
              });
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
      });
    }
    return false;
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

  fetchBlockedUsers: async () => {
    try {
      const res = await api.get('/api/users/blocked');
      set({ blockedUsers: res.data.blockedUsers || [] });
    } catch (e) {
      console.error('Fetch blocked users error:', e);
    }
  },

  blockUser: async (targetUserId) => {
    try {
      const res = await api.post(`/api/users/block/${targetUserId}`);
      set({ blockedUsers: res.data.blockedUsers || [] });
      await get().fetchChats(); // Refresh presence/chats lists
    } catch (e) {
      console.error('Block user error:', e);
    }
  },

  unblockUser: async (targetUserId) => {
    try {
      const res = await api.post(`/api/users/unblock/${targetUserId}`);
      set({ blockedUsers: res.data.blockedUsers || [] });
      await get().fetchChats(); // Refresh presence/chats lists
    } catch (e) {
      console.error('Unblock user error:', e);
    }
  },

  submitReport: async (payload) => {
    try {
      await api.post('/api/users/report', payload);
      return true;
    } catch (e) {
      console.error('Submit report error:', e);
      return false;
    }
  },

  createGroup: async (name, participants, avatarUrl, avatarPublicId) => {
    try {
      const res = await api.post('/api/chats/group', { name, participants, avatarUrl, avatarPublicId });
      const newChat: Chat = res.data.chat;
      set((state) => {
        if (state.chats.find((c) => c._id === newChat._id)) return {};
        return { chats: [newChat, ...state.chats] };
      });
      return newChat;
    } catch (e) {
      console.error('Create group error:', e);
      return null;
    }
  },

  updateGroupSettings: async (chatId, name, avatarUrl, avatarPublicId) => {
    try {
      const res = await api.put(`/api/chats/group/${chatId}/settings`, { name, avatarUrl, avatarPublicId });
      const updatedChat: Chat = res.data.chat;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? updatedChat : c)),
      }));
      return updatedChat;
    } catch (e) {
      console.error('Update group settings error:', e);
      return null;
    }
  },

  addGroupMembers: async (chatId, userIds) => {
    try {
      const res = await api.post(`/api/chats/group/${chatId}/members`, { userIds });
      const updatedChat: Chat = res.data.chat;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? updatedChat : c)),
      }));
      return updatedChat;
    } catch (e) {
      console.error('Add group members error:', e);
      return null;
    }
  },

  removeGroupMember: async (chatId, memberId) => {
    try {
      const res = await api.delete(`/api/chats/group/${chatId}/members/${memberId}`);
      const updatedChat: Chat = res.data.chat;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? updatedChat : c)),
      }));
      return updatedChat;
    } catch (e) {
      console.error('Remove group member error:', e);
      return null;
    }
  },

  leaveGroup: async (chatId) => {
    try {
      await api.post(`/api/chats/group/${chatId}/leave`);
      set((state) => ({
        chats: state.chats.filter((c) => c._id !== chatId),
      }));
      return true;
    } catch (e) {
      console.error('Leave group error:', e);
      return false;
    }
  },

  promoteGroupAdmin: async (chatId, targetUserId, action) => {
    try {
      const res = await api.put(`/api/chats/group/${chatId}/admins`, { userId: targetUserId, action });
      const updatedChat: Chat = res.data.chat;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? updatedChat : c)),
      }));
      return updatedChat;
    } catch (e) {
      console.error('Promote group admin error:', e);
      return null;
    }
  },

  searchMessages: async (chatId, query) => {
    try {
      const url = chatId ? `/api/chats/${chatId}/search` : '/api/chats/search';
      const res = await api.get(url, { params: { q: query } });
      return res.data.messages || [];
    } catch (e) {
      console.error('Search messages error:', e);
      return [];
    }
  },

  toggleStarMessage: async (chatId, messageId) => {
    try {
      const res = await api.post('/api/chats/star-message', { chatId, messageId });
      if (res.data.success) {
        get().fetchStarredMessages();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Toggle star message error:', e);
      return false;
    }
  },

  togglePinMessage: async (chatId, messageId) => {
    try {
      const res = await api.post('/api/chats/pin-message', { chatId, messageId });
      if (res.data.success) {
        return res.data;
      }
      return null;
    } catch (e) {
      console.error('Toggle pin message error:', e);
      return null;
    }
  },

  fetchStarredMessages: async () => {
    try {
      const res = await api.get('/api/chats/starred-messages');
      set({ starredMessages: res.data.starredMessages || [] });
    } catch (e) {
      console.error('Fetch starred messages error:', e);
    }
  },

  fetchStatusFeed: async () => {
    try {
      const res = await api.get('/api/status/feed');
      set({ activeStatuses: res.data.feed || [] });
    } catch (e) {
      console.error('Fetch status feed error:', e);
    }
  },

  postStatus: async (payload) => {
    try {
      const res = await api.post('/api/status', payload);
      if (res.status === 201) {
        get().fetchStatusFeed();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Post status error:', e);
      return false;
    }
  },

  deleteStatus: async (statusId) => {
    try {
      const res = await api.delete(`/api/status/${statusId}`);
      if (res.status === 200) {
        get().fetchStatusFeed();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Delete status error:', e);
      return false;
    }
  },

  globalSearchAll: async (query) => {
    try {
      const res = await api.get('/api/chats/global-search', { params: { query } });
      return res.data || { chats: [], messages: [] };
    } catch (e) {
      console.error('Global search error:', e);
      return { chats: [], messages: [] };
    }
  },
    }),
    {
      name: 'chatconnect_persistent_chat_store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        chats: state.chats,
        messages: state.messages,
        blockedUsers: state.blockedUsers,
      }),
    }
  )
);

