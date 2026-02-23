import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Text, useTheme, Searchbar, TextInput, IconButton } from 'react-native-paper';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore } from '@/stores';
import {
  getUserConversations,
  subscribeToMessages,
  sendMessage,
} from '@/services/firebase/firestore';
import { Card, UserAvatar, EmptyState, LoadingScreen } from '@/components/ui';
import type { Conversation, Message } from '@/types';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

export default function MessagesScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;

      try {
        const userConversations = await getUserConversations(user.id);
        setConversations(userConversations);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [user?.id]);

  // Subscribe to messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation?.id) return;

    const unsubscribe = subscribeToMessages(selectedConversation.id, (newMessages) => {
      setMessages(newMessages);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return unsubscribe;
  }, [selectedConversation?.id]);

  const handleSendMessage = async () => {
    if (!selectedConversation?.id || !user?.id || !newMessage.trim()) return;

    setIsSending(true);
    try {
      await sendMessage(selectedConversation.id, user.id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = searchQuery
    ? conversations.filter((conv) =>
        conv.participantIds.some((id) =>
          id.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : conversations;

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participantIds.find((id) => id !== user?.id) || 'Unknown';
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const otherParticipant = getOtherParticipant(item);
    const isSelected = selectedConversation?.id === item.id;

    return (
      <Pressable
        onPress={() => setSelectedConversation(item)}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      >
        <Card
          style={isSelected ? [styles.conversationCard, { borderColor: theme.colors.primary, borderWidth: 2 }] : styles.conversationCard}
        >
          <View style={styles.conversationContent}>
            <UserAvatar
              displayName={otherParticipant}
              size={48}
            />
            <View style={styles.conversationInfo}>
              <Text variant="titleSmall" numberOfLines={1}>
                {otherParticipant}
              </Text>
              {item.lastMessage && (
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={{ color: theme.colors.outline }}
                >
                  {item.lastMessage.content}
                </Text>
              )}
            </View>
            {item.lastMessage && (
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                {formatTime(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === user?.id;

    return (
      <View
        style={[
          styles.messageRow,
          isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? { backgroundColor: theme.colors.primary }
              : { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text
            variant="bodyMedium"
            style={{
              color: isOwnMessage ? '#fff' : theme.colors.onSurface,
            }}
          >
            {item.content}
          </Text>
          <Text
            variant="labelSmall"
            style={[
              styles.messageTime,
              {
                color: isOwnMessage
                  ? 'rgba(255,255,255,0.7)'
                  : theme.colors.outline,
              },
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <LoadingScreen message="Loading messages..." />;
  }

  // Inbox view
  if (!selectedConversation) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}
      >
        <View style={styles.inboxHeader}>
          <Searchbar
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />
        </View>

        {filteredConversations.length === 0 ? (
          <EmptyState
            icon="message-text-outline"
            title="No messages yet"
            message="Start a conversation with committee members or staff"
          />
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.conversationList}
          />
        )}
      </SafeAreaView>
    );
  }

  // Conversation view
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.conversationView}
        keyboardVerticalOffset={100}
      >
        {/* Conversation Header */}
        <View style={[styles.conversationHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
          <IconButton
            icon="arrow-left"
            onPress={() => setSelectedConversation(null)}
          />
          <UserAvatar
            displayName={getOtherParticipant(selectedConversation)}
            size={40}
          />
          <View style={styles.headerInfo}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
              {getOtherParticipant(selectedConversation)}
            </Text>
          </View>
          <IconButton icon="dots-vertical" onPress={() => {}} />
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Message Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            style={styles.textInput}
            multiline
            maxLength={1000}
          />
          <IconButton
            icon="send"
            mode="contained"
            disabled={!newMessage.trim() || isSending}
            onPress={handleSendMessage}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inboxHeader: {
    padding: 16,
  },
  searchbar: {
    elevation: 0,
  },
  conversationList: {
    padding: 16,
    paddingTop: 0,
  },
  conversationCard: {
    marginBottom: 12,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationView: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  messageList: {
    padding: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  ownMessageRow: {
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageTime: {
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
});
