import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/constants';
import { useAction } from './useAction';
import ScreenFeedback from '@/components/ScreenFeedback';

/** A consistent deliberate deletion step on native and web. Cancel never mutates records. */
export function useConfirmDelete() {
  const [action, setAction] = useState<(() => Promise<void>) | null>(null);
  const mutation = useAction();
  const { colors } = useTheme();
  return {
    ask: (next: () => Promise<void>) => {
      mutation.clearError();
      setAction(() => next);
    },
    dialog: (
      <Modal
        transparent
        visible={action !== null}
        animationType="fade"
        onRequestClose={() => {
          if (!mutation.pending) setAction(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{ padding: 24, borderRadius: 24, backgroundColor: colors.card, gap: 16 }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, fontWeight: '700', color: colors.text }}
            >
              Delete this record?
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: colors.lightText }}>
              This cannot be undone. Cancel to keep the record.
            </Text>
            <ScreenFeedback error={mutation.error} />
            <TouchableOpacity
              accessibilityRole="button"
              disabled={mutation.pending}
              style={{ minHeight: 48, justifyContent: 'center' }}
              onPress={() => {
                setAction(null);
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Keep record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={mutation.pending}
              style={{ minHeight: 48, justifyContent: 'center' }}
              onPress={() =>
                mutation.run(async () => {
                  if (action) await action();
                  setAction(null);
                })
              }
            >
              <Text style={{ color: colors.dangerText, fontWeight: '700' }}>
                {mutation.pending ? 'Deleting…' : 'Delete record'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ),
  };
}
