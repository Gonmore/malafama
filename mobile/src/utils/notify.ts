import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export async function notifySuccess() {
  try {
    // Haptic feedback siempre funciona bien
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Multiple short vibrations for success feel
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 100);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
  } catch {}
}

export async function notifyWarning() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

export async function notifyError() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}
