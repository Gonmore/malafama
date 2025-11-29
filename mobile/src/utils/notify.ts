import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export async function notifySuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
  try {
    const { sound } = await Audio.Sound.createAsync(
      // Minimal click beep using Expo asset-less tone is not available, use short duration silence if needed
      // For now attempt to load a system sound URI is not supported; skip sound if fails
      require('../../assets/empty.mp3')
    );
    await sound.playAsync();
    setTimeout(() => sound.unloadAsync(), 1500);
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
