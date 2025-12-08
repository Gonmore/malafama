import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, Animated, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../src/store/auth';
import { useThemeStore } from '../../src/store/theme';
import { PRIMARY } from '../../src/constants/colors';

type Props = {
  title?: string;
  localLogo?: string | null;
  // Optional override: if provided, forces the back button visibility (true/false)
  showBack?: boolean | null;
  // Optional callback: if provided, TopNav will invoke this instead of the default Alert menu
  onOpenSettings?: () => void;
};

const initialsFromName = (name?: string) => {
  if (!name) return '';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
};

export default function TopNav({ title = '', localLogo = null, showBack = null, onOpenSettings }: Props) {
  // Do not fall back to the developer/company logo. We should show the local's logo only.
  const [logoErrored, setLogoErrored] = useState(false);
  const [resolvedLogoUri, setResolvedLogoUri] = useState<string | null>(null);

  // Reset any previous logo error when localLogo changes (so the component can retry)
  React.useEffect(() => {
    setLogoErrored(false);
    setResolvedLogoUri(null);
  }, [localLogo]);


  // If the server stores a base64 string (with or without the data: prefix), write it to a cached file
  // and use file:// URI so the native Image component can render reliably.
  React.useEffect(() => {
    let canceled = false;
    const prepare = async () => {
      try {
        if (!localLogo || typeof localLogo !== 'string') return;

        // If the string looks like an http url or already a data URI, attempt to use it directly first
        if (/^https?:\/\//i.test(localLogo) || /^data:/i.test(localLogo)) {
          // try to use directly — native image components support data: URIs, but some platforms are flaky
          setResolvedLogoUri(localLogo);
          return;
        }

        // Otherwise treat as raw base64 (no prefix) — write to cache
        const raw = localLogo.trim();
        // Heuristic: ensure we have reasonable length for base64
        if (raw.length < 100) {
          // probably not a valid image
          return;
        }

        // Build deterministic filename (short slice to avoid overly long names)
        const id = raw.slice(0, 16).replace(/[^a-z0-9]/gi, '');
        const fileName = `local_logo_${id || 'x'}.png`;
        const fileUri = `${(FileSystem as any).cacheDirectory}${fileName}`;

        // If the file already exists, reuse it
        try {
          const stat = await FileSystem.getInfoAsync(fileUri);
          if (stat.exists) {
            if (!canceled) setResolvedLogoUri(fileUri);
            return;
          }
        } catch (e) {
          // ignore
        }

        // localLogo might still be a data URL (data:image/png;base64,...) or raw base64.
        const base64 = localLogo.includes(',') ? localLogo.split(',')[1] : localLogo;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64' });
        if (!canceled) setResolvedLogoUri(fileUri);
      } catch (err) {
        // If writing or reading fails, we'll fall back to the inline URI attempt and rely on onError handler
        // console.warn('TopNav logo preparation failed', err);
      }
    };

    prepare();

    return () => {
      canceled = true;
    };
  }, [localLogo]);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [uploading, setUploading] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const avatarHandAnim = useRef(new Animated.Value(0)).current;
  const modalHandAnim = useRef(new Animated.Value(0)).current;
  const AVATAR_SIZE = 56; // unified size for logo and avatar

  const doUpdateWithResult = async (result: any) => {
    if (!result || result.canceled || !result.assets || !result.assets[0]) return;
    try {
      const asset = result.assets[0];
      // If we already got base64 from the picker, use it; otherwise compress & convert to base64
      let base64Data: string | null = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;

      setUploading(true);

      if (!base64Data && asset.uri) {
        try {
          // Fallback: read file as base64 via expo-file-system
          const b = await FileSystem.readAsStringAsync(asset.uri, { encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64' });
          if (b) base64Data = `data:image/jpeg;base64,${b}`;
        } catch (err) {
          // Fallback to using the uri if read fails
          base64Data = asset.uri as string;
        }
      }

      if (!base64Data) {
        throw new Error('No se pudo procesar la imagen');
      }

      const { userService } = await import('../../src/services/user');
      if (!user?.id) throw new Error('No user id available');
      const resp = await userService.update((user?.id as any), { foto: base64Data });
      let newUserData = (resp?.data || resp || {});
      // Normalize server response: prefer fotoUrl/foto_url/foto and map to `photo` for the client
      let normalizedPhoto = newUserData.fotoUrl || newUserData.foto_url || newUserData.foto || asset.uri || null;
      // If the server returns a relative path like `/uploads/...`, make it absolute using EXPO_PUBLIC_API_URL
      try {
        const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
        const host = rawApi.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
        if (typeof normalizedPhoto === 'string' && normalizedPhoto.length > 0 && !/^https?:\/\//i.test(normalizedPhoto) && !/^data:/i.test(normalizedPhoto) && !/^file:/i.test(normalizedPhoto) && !/^content:/i.test(normalizedPhoto)) {
          const leading = normalizedPhoto.startsWith('/') ? '' : '/';
          normalizedPhoto = `${host}${leading}${normalizedPhoto}`;
        }
        // Bust cache so new avatar URL is fetched immediately after upload
        if (typeof normalizedPhoto === 'string' && /^https?:\/\//i.test(normalizedPhoto)) {
          const sep = normalizedPhoto.includes('?') ? '&' : '?';
          normalizedPhoto = `${normalizedPhoto}${sep}t=${Date.now()}`;
        }
      } catch (err) {
        // ignore and keep the raw value
      }
      setAuth(token as string, { ...(user || {}), ...newUserData, photo: normalizedPhoto });
      Alert.alert('Avatar', 'Avatar actualizado');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar avatar');
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const permLib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        // keep modal open so user can act
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, quality: 0.8, base64: true });
      await doUpdateWithResult(result);
      setShowMenuModal(false);
    } catch (e: any) {
      // swallow and keep modal open
    }
  };

  const openGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, quality: 0.8, base64: true });
      await doUpdateWithResult(result);
      setShowMenuModal(false);
    } catch (e: any) {
      // swallow
    }
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    setShowMenuModal(false);
    router.replace('/login');
  };

  const showActions = () => {
    if (typeof onOpenSettings === 'function') {
      try {
        onOpenSettings();
        return;
      } catch (err) {}
    }
    // open our custom modal
    setShowMenuModal(true);
  };

  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';

  const navigation = useNavigation();
  // Respect an explicit override if provided; if not provided, fall back to navigation.canGoBack()
  const navCanGoBack = typeof (navigation as any)?.canGoBack === 'function' ? (navigation as any).canGoBack() : false;
  const canGoBack = typeof showBack === 'boolean' ? showBack : navCanGoBack;

  // Avatar hand: vertical bounce when user has no photo (hint to tap avatar)
  useEffect(() => {
    let loop: any = null;
    const shouldAvatarAnimate = !((user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto);
    if (shouldAvatarAnimate && avatarHandAnim && typeof (avatarHandAnim as any).setValue === 'function') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(avatarHandAnim, { toValue: -8, duration: 700, useNativeDriver: true }),
          Animated.timing(avatarHandAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else if (avatarHandAnim && typeof (avatarHandAnim as any).setValue === 'function') {
      avatarHandAnim.setValue(0);
      if (loop && typeof loop.stop === 'function') loop.stop();
    }
    return () => { if (loop && typeof loop.stop === 'function') loop.stop(); };
  }, [user?.photo, user?.fotoUrl, user?.foto, avatarHandAnim]);

  // Modal hand: horizontal movement between buttons when modal is open and user has no photo
  useEffect(() => {
    let loop: any = null;
    const shouldModalAnimate = showMenuModal && !((user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto);
    if (shouldModalAnimate && modalHandAnim && typeof (modalHandAnim as any).setValue === 'function') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(modalHandAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(modalHandAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else if (modalHandAnim && typeof (modalHandAnim as any).setValue === 'function') {
      modalHandAnim.setValue(0);
      if (loop && typeof loop.stop === 'function') loop.stop();
    }
    return () => { if (loop && typeof loop.stop === 'function') loop.stop(); };
  }, [showMenuModal, user?.photo, user?.fotoUrl, user?.foto, modalHandAnim]);

  // compute safe transforms
  const avatarHandTransform = avatarHandAnim ? [{ translateY: avatarHandAnim }] : undefined;
  const modalHandTransform = (modalHandAnim && typeof (modalHandAnim as any).interpolate === 'function')
    ? [{ translateX: modalHandAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] }) }]
    : undefined;

  const primaryText = dark ? '#FFFFFF' : PRIMARY;
  const modalBg = dark ? '#0b0f13' : '#FFFFFF';

  return (
    <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: dark ? '#0b0f13' : '#FFFFFF' }}>
      {/* left: local logo (tap could go home) */}
      <TouchableOpacity onPress={() => router.push('/home')} style={{ width: AVATAR_SIZE + 16, height: AVATAR_SIZE + 8, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
          {resolvedLogoUri && !logoErrored ? (
            <Image source={{ uri: resolvedLogoUri }} style={{ width: '100%', height: '100%' }} resizeMode='contain' onError={() => setLogoErrored(true)} />
          ) : (localLogo && typeof localLogo !== 'string') ? (
            <Image source={localLogo as any} style={{ width: '100%', height: '100%' }} resizeMode='contain' />
          ) : (
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          )}
        </View>
      </TouchableOpacity>

      {/* center: title */}
      <Text style={{ fontSize: 18, fontWeight: '700', color: primaryText }}>{title}</Text>

      {/* right: avatar and actions */}
      <TouchableOpacity onPress={showActions} style={{ width: AVATAR_SIZE + 24, height: AVATAR_SIZE + 8, alignItems: 'center', justifyContent: 'center' }}>
        {uploading && (
          <View style={{ position: 'absolute', left: -6, top: -6, zIndex: 15 }}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        )}
              {(user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto ? (
          <Image
            key={(user as any).photo || (user as any).fotoUrl || (user as any).foto}
            source={{ uri: (user as any).photo || (user as any).fotoUrl || (user as any).foto }}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 2, borderColor: dark ? 'white' : primaryText }}
            onError={() => {
              useAuthStore.getState().updateUser({ photo: null });
            }}
          />
        ) : (
          <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: dark ? 'white' : primaryText }}>
            <Text style={{ color: dark ? 'white' : primaryText, fontWeight: '700', fontSize: 18 }}>{initialsFromName(user?.nombre)}</Text>
            {/* hand bounce to hint touch when no photo */}
                  <Animated.View style={{ position: 'absolute', right: -20, bottom: -10, ...(avatarHandTransform ? { transform: avatarHandTransform } : {}) }}>
                    <Text style={{ fontSize: 26 }}>👆🏽</Text>
            </Animated.View>
          </View>
        )}
        {/* dropdown arrow intentionally removed */}
      </TouchableOpacity>

      {/* Custom modal for account actions: upload avatar / logout */}
      <Modal visible={showMenuModal} transparent animationType="fade" onRequestClose={() => setShowMenuModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '88%', maxWidth: 420, backgroundColor: dark ? '#0b1220' : 'white', padding: 18, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: dark ? 'white' : '#111827', marginBottom: 12 }}>{user?.nombre || 'Cuenta'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <TouchableOpacity onPress={openCamera} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openGallery} style={{ flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Seleccionar de la galería</Text>
              </TouchableOpacity>
            </View>

            {/* animated hand that alternates between the two photo buttons when user has no photo */}
            {!((user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto) && (
              <Animated.View style={{ marginTop: 12, alignItems: 'center' }}>
                <Animated.Text style={{ fontSize: 28, ...(modalHandTransform ? { transform: modalHandTransform } : {}) }}>👆🏽</Animated.Text>
                <Text style={{ color: dark ? '#9CA3AF' : '#6B7280', marginTop: 6, textAlign: 'center' }}>Toca para subir o tomar una foto</Text>
              </Animated.View>
            )}

            <View style={{ marginTop: 16 }}>
                <TouchableOpacity onPress={() => setShowMenuModal(false)} style={{ position: 'absolute', right: 12, top: 12, zIndex: 20 }}>
                  <Text style={{ fontSize: 18, color: '#ef4444', fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Cerrar sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowMenuModal(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: dark ? '#9CA3AF' : '#6B7280' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
