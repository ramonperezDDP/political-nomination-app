import React from 'react';
import { StyleSheet, View, ViewStyle, ScrollView } from 'react-native';
import { Modal as PaperModal, Portal, Text, IconButton, useTheme } from 'react-native-paper';

interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  title?: string;
  showCloseButton?: boolean;
  dismissable?: boolean;
  contentStyle?: ViewStyle;
}

export function Modal({
  visible,
  onDismiss,
  children,
  title,
  showCloseButton = true,
  dismissable = true,
  contentStyle,
}: ModalProps) {
  const theme = useTheme();

  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={dismissable ? onDismiss : undefined}
        contentContainerStyle={StyleSheet.flatten([
          styles.modal,
          { backgroundColor: theme.colors.surface },
          contentStyle,
        ])}
      >
        {(title || showCloseButton) && (
          <View style={styles.header}>
            {title && (
              <Text variant="titleLarge" style={styles.title}>
                {title}
              </Text>
            )}
            {showCloseButton && (
              <IconButton
                icon="close"
                onPress={onDismiss}
                style={styles.closeButton}
              />
            )}
          </View>
        )}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </PaperModal>
    </Portal>
  );
}

interface ConfirmModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDestructive?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  visible,
  onDismiss,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDestructive = false,
  loading = false,
}: ConfirmModalProps) {
  const theme = useTheme();

  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={StyleSheet.flatten([
          styles.confirmModal,
          { backgroundColor: theme.colors.surface },
        ])}
      >
        <Text variant="titleLarge" style={styles.confirmTitle}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={styles.confirmMessage}>
          {message}
        </Text>
        <View style={styles.confirmActions}>
          <View style={styles.confirmButton}>
            <Text
              onPress={onDismiss}
              style={StyleSheet.flatten([styles.cancelText, { color: theme.colors.primary }])}
            >
              {cancelLabel}
            </Text>
          </View>
          <View style={styles.confirmButton}>
            <Text
              onPress={loading ? undefined : onConfirm}
              style={StyleSheet.flatten([
                styles.confirmText,
                { color: confirmDestructive ? theme.colors.error : theme.colors.primary },
                loading && styles.disabledText,
              ])}
            >
              {loading ? 'Loading...' : confirmLabel}
            </Text>
          </View>
        </View>
      </PaperModal>
    </Portal>
  );
}

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  title?: string;
}

export function BottomSheet({
  visible,
  onDismiss,
  children,
  title,
}: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={StyleSheet.flatten([
          styles.bottomSheet,
          { backgroundColor: theme.colors.surface },
        ])}
      >
        <View style={styles.bottomSheetHandle} />
        {title && (
          <Text variant="titleMedium" style={styles.bottomSheetTitle}>
            {title}
          </Text>
        )}
        {children}
      </PaperModal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    margin: -8,
  },
  content: {
    padding: 16,
  },
  confirmModal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  confirmTitle: {
    marginBottom: 12,
  },
  confirmMessage: {
    marginBottom: 24,
    opacity: 0.8,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmButton: {
    marginLeft: 16,
  },
  cancelText: {
    fontWeight: '600',
    fontSize: 16,
  },
  confirmText: {
    fontWeight: '600',
    fontSize: 16,
  },
  disabledText: {
    opacity: 0.5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
});
