import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import {
  Eye,
  X as XIcon,
  Send,
  Pause,
  Play,
  TrendingUp,
  TrendingDown,
  Paperclip,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { SaudiRiyalSymbol } from '@/components/ui/SaudiRiyalSymbol';
import { TransactionFlowWidget } from './TransactionFlowWidget';
import { formatHeadlineAmount } from '../utils/previewFields';

interface PreviewField {
  label: string;
  value: string | number | null | undefined;
  highlight?: 'error' | 'success' | 'warning';
}

interface SubmissionPreviewDialogProps {
  visible: boolean;
  fields: PreviewField[];
  amount?: string | number | null;
  currency?: string;
  partnerLabel?: string | null;
  otherPartyLabel?: string | null;
  receiptCount?: number;
  countdownSeconds?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmissionPreviewDialog({
  visible,
  fields,
  amount,
  currency = 'SAR',
  partnerLabel,
  otherPartyLabel,
  receiptCount = 0,
  countdownSeconds = 10,
  onConfirm,
  onCancel,
}: SubmissionPreviewDialogProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(countdownSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Amount display logic
  const amountStr = amount != null ? String(amount) : null;
  const { display: amountDisplay, isExpense } = formatHeadlineAmount(amount);
  const amountColor = isExpense ? colors.error : colors.success;
  const isSAR = currency === 'SAR' || currency === 'ريال سعودي';

  // Animation on open
  useEffect(() => {
    if (visible) {
      setCountdown(countdownSeconds);
      setIsPaused(false);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible, countdownSeconds, scaleAnim, opacityAnim]);

  // Countdown timer
  useEffect(() => {
    if (!visible) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (isPaused) return prev;
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, isPaused]);

  // Fire onConfirm when countdown reaches 0 (outside of setState)
  useEffect(() => {
    if (visible && countdown === 0) {
      onConfirm();
    }
  }, [visible, countdown, onConfirm]);

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  }, [onCancel]);

  const handleSendNow = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    onConfirm();
  }, [onConfirm]);

  const formatValue = (val: string | number | null | undefined): string => {
    if (val == null || String(val).trim() === '') return t('undefined');
    return String(val);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.primary,
                borderTopStartRadius: radius.xl,
                borderTopEndRadius: radius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Eye size={20} color={colors.onPrimary} />
              <Text
                style={[
                  typography.headingSmall,
                  {
                    color: colors.onPrimary,
                    marginStart: spacing.sm,
                    flex: 1,
                  },
                ]}
              >
                {t('confirm')}
              </Text>
              <Pressable onPress={handleCancel} hitSlop={8}>
                <XIcon size={20} color={colors.onPrimary} />
              </Pressable>
            </View>

            {/* Countdown row */}
            <View style={[styles.countdownRow, { marginTop: spacing.md }]}>
              <View style={styles.countdownInfo}>
                {isPaused ? (
                  <Pause size={14} color={withAlpha('#ffffff', 0.8)} />
                ) : (
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: withAlpha('#ffffff', 0.8) },
                    ]}
                  >
                    {countdown}s
                  </Text>
                )}
              </View>
              <View style={styles.countdownActions}>
                <Pressable
                  onPress={() => setIsPaused((p) => !p)}
                  style={[
                    styles.countdownButton,
                    {
                      backgroundColor: withAlpha('#ffffff', 0.2),
                      borderRadius: radius.sm,
                    },
                  ]}
                >
                  {isPaused ? (
                    <Play size={14} color="#ffffff" />
                  ) : (
                    <Pause size={14} color="#ffffff" />
                  )}
                </Pressable>
                {isPaused && (
                  <Pressable
                    onPress={handleSendNow}
                    style={[
                      styles.sendNowButton,
                      {
                        backgroundColor: colors.green,
                        borderRadius: radius.sm,
                        marginStart: spacing.sm,
                      },
                    ]}
                  >
                    <Send size={14} color="#ffffff" />
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: '#ffffff', marginStart: spacing.xs },
                      ]}
                    >
                      {t('submit')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Progress bar */}
            {!isPaused && (
              <View
                style={[
                  styles.progressBg,
                  {
                    backgroundColor: withAlpha('#ffffff', 0.2),
                    borderRadius: radius.full,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: '#ffffff',
                      borderRadius: radius.full,
                      width: `${(countdown / countdownSeconds) * 100}%`,
                    },
                  ]}
                />
              </View>
            )}
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ padding: spacing.base }}
          >
            {/* Amount display */}
            {amountStr && (
              <View
                style={[
                  styles.amountCard,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <View style={styles.amountRow}>
                  {isExpense ? (
                    <TrendingDown size={18} color={amountColor} />
                  ) : (
                    <TrendingUp size={18} color={amountColor} />
                  )}
                  <Text
                    style={[
                      typography.headingMedium,
                      {
                        color: amountColor,
                        marginStart: spacing.sm,
                      },
                    ]}
                  >
                    {amountDisplay}
                  </Text>
                  {isSAR && (
                    <View style={{ marginStart: spacing.xs }}>
                      <SaudiRiyalSymbol size={16} color={amountColor} />
                    </View>
                  )}
                  {!isSAR && (
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: colors.foregroundSecondary,
                          marginStart: spacing.xs,
                        },
                      ]}
                    >
                      {currency}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Field rows */}
            {fields.map((field, index) => {
              const val = formatValue(field.value);
              const isEmpty = val === t('undefined');
              const highlightColor =
                field.highlight === 'error'
                  ? colors.error
                  : field.highlight === 'success'
                    ? colors.success
                    : field.highlight === 'warning'
                      ? colors.warning
                      : null;

              return (
                <View
                  key={index}
                  style={[
                    styles.fieldRow,
                    {
                      backgroundColor: highlightColor
                        ? withAlpha(highlightColor, 0.08)
                        : colors.muted,
                      borderRadius: radius.sm,
                      padding: spacing.sm,
                      marginBottom: spacing.sm,
                      borderStartWidth: highlightColor ? 3 : 0,
                      borderStartColor: highlightColor ?? 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: highlightColor ?? colors.foregroundSecondary,
                        fontWeight: '500',
                      },
                    ]}
                  >
                    {field.label}
                  </Text>
                  <Text
                    style={[
                      typography.bodyMedium,
                      {
                        color: isEmpty
                          ? colors.foregroundSecondary
                          : colors.foreground,
                        fontWeight: isEmpty ? '400' : '600',
                        fontStyle: isEmpty ? 'italic' : 'normal',
                        marginTop: 2,
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {val}
                  </Text>
                </View>
              );
            })}

            {/* Transaction flow */}
            {(partnerLabel || otherPartyLabel) && (
              <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
                <TransactionFlowWidget
                  partnerLabel={partnerLabel ?? null}
                  otherPartyLabel={otherPartyLabel ?? null}
                  isExpense={!!isExpense}
                />
              </View>
            )}

            {/* Receipt count */}
            {receiptCount > 0 && (
              <View
                style={[
                  styles.receiptBadge,
                  {
                    backgroundColor: withAlpha(colors.green, 0.1),
                    borderRadius: radius.sm,
                    padding: spacing.sm,
                  },
                ]}
              >
                <Paperclip size={14} color={colors.green} />
                <Text
                  style={[
                    typography.label,
                    { color: colors.green, marginStart: spacing.xs },
                  ]}
                >
                  {receiptCount} {t('attachments')}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.muted,
                borderBottomStartRadius: radius.xl,
                borderBottomEndRadius: radius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  borderColor: colors.error,
                  borderRadius: radius.md,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <XIcon size={16} color={colors.error} />
              <Text
                style={[
                  typography.button,
                  { color: colors.error, marginStart: spacing.xs },
                ]}
              >
                {t('cancel')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countdownInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownButton: {
    padding: 6,
  },
  sendNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  progressBg: {
    height: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
  },
  content: {
    flexGrow: 0,
  },
  amountCard: {},
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldRow: {},
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  footer: {},
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    height: 44,
  },
});
