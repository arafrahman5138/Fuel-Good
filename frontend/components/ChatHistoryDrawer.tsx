import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  FlatList,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

interface Session {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
}

interface ChatHistoryDrawerProps {
  visible: boolean;
  sessions: Session[];
  currentSessionId: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  { icon: 'flame-outline' as const, text: 'Healthify a pizza recipe' },
  { icon: 'nutrition-outline' as const, text: 'High-protein breakfast ideas' },
  { icon: 'leaf-outline' as const, text: 'Clean snacks under 200 cal' },
  { icon: 'swap-horizontal-outline' as const, text: 'Swap pasta for something healthier' },
];

function formatSessionDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function ChatHistoryDrawer({
  visible,
  sessions,
  currentSessionId,
  onClose,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onSelectPrompt,
}: ChatHistoryDrawerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer Panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            backgroundColor: theme.surface,
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.md,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Drawer Header */}
        <View style={[styles.drawerHeader, { borderBottomColor: theme.border }]}>
          <View style={styles.drawerTitleRow}>
            <View style={[styles.drawerIcon, { backgroundColor: theme.primary + '14' }]}>
              <Ionicons name="chatbubbles" size={14} color={theme.primary} />
            </View>
            <Text style={[styles.drawerTitle, { color: theme.text }]}>Chat History</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* New Chat Button */}
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: 'transparent', borderColor: theme.border }]}
          onPress={() => { onNewChat(); onClose(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
          <Text style={[styles.newChatText, { color: theme.text }]}>New Chat</Text>
        </TouchableOpacity>

        {/* Session List */}
        {sessions.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={theme.textTertiary} />
            <Text style={[styles.emptyHistoryText, { color: theme.textTertiary }]}>
              No conversations yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sessionList}
            renderItem={({ item: session }) => {
              const isActive = session.id === currentSessionId;
              return (
                <TouchableOpacity
                  style={[
                    styles.sessionItem,
                    {
                      backgroundColor: isActive ? theme.text + '08' : 'transparent',
                      borderColor: 'transparent',
                    },
                  ]}
                  onPress={() => { onSelectSession(session.id); onClose(); }}
                  activeOpacity={0.75}
                >
                  <View style={styles.sessionItemInner}>
                    <Ionicons
                      name={isActive ? 'chatbubble' : 'chatbubble-outline'}
                      size={15}
                      color={isActive ? theme.primary : theme.textTertiary}
                      style={styles.sessionIcon}
                    />
                    <View style={styles.sessionMeta}>
                      <Text
                        style={[styles.sessionTitle, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {session.title || 'Untitled'}
                      </Text>
                      <Text style={[styles.sessionSubtitle, { color: theme.textTertiary }]}>
                        {formatSessionDate(session.created_at)}
                        {session.message_count > 0 ? ` · ${session.message_count} msg${session.message_count !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => onDeleteSession(session.id)}
                    style={styles.deleteBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={14} color={theme.textTertiary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Suggested Prompts */}
        {onSelectPrompt && (
          <View style={[styles.suggestedSection, { borderTopColor: theme.border }]}>
            <Text style={[styles.suggestedTitle, { color: theme.textTertiary }]}>Try asking</Text>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestedItem, { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => { onSelectPrompt(prompt.text); onClose(); }}
                activeOpacity={0.7}
              >
                <Ionicons name={prompt.icon} size={14} color={theme.primary} />
                <Text style={[styles.suggestedText, { color: theme.text }]} numberOfLines={1}>
                  {prompt.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    boxShadow: '4px 0px 12px rgba(0, 0, 0, 0.3)',
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  drawerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  newChatText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  emptyHistory: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingBottom: 60,
  },
  emptyHistoryText: {
    fontSize: FontSize.sm,
  },
  sessionList: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 2,
    paddingRight: Spacing.sm,
  },
  sessionItemInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  sessionIcon: {
    flexShrink: 0,
  },
  sessionMeta: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  sessionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  deleteBtn: {
    padding: Spacing.sm,
  },
  suggestedSection: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.xs + 2,
  },
  suggestedTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  suggestedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  suggestedText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
});
