import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { useThemeStore } from '../../src/store/theme';
import { userService } from '../../src/services/user';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountModal({ visible, onClose }: Props) {
  const router = useRouter();
  const authStateAny: any = (useAuthStore as any).getState ? (useAuthStore as any).getState() : {};
  const user: any = authStateAny.user || authStateAny.usuario || null;
  const updateUserStore = useAuthStore((s) => s.updateUser);
  const logoutStore = useAuthStore((s) => s.logout);

  const themeStateAny: any = (useThemeStore as any).getState ? (useThemeStore as any).getState() : {};
  const dark = themeStateAny.theme === 'dark' || themeStateAny.dark === true;
  const setTheme = (t: string) => {
    try {
      const s: any = (useThemeStore as any);
      if (s.getState && s.getState().set) s.getState().set(t);
    } catch (e) {}
  };

  const bg = dark ? '#1F2937' : 'white';
  const fg = dark ? '#F9FAFB' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

  const [tempNombre, setTempNombre] = useState(user?.nombre || '');
  const modalHandAnimY = useRef(new Animated.Value(0)).current;
  const modalHandAnimX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTempNombre(user?.nombre || '');
  }, [user?.nombre]);

  useEffect(() => {
    let mounted = true;
    if (!mounted) return;
    if (!((user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto)) {
      // Show the hand on the left (Tomar Foto) + bounce -> pause -> teleport to right (Subir Foto) + bounce -> pause -> repeat
      const seq = Animated.sequence([
        // Place at left and bounce
        Animated.timing(modalHandAnimX, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(modalHandAnimY, { toValue: -8, duration: 180, useNativeDriver: true }),
        Animated.timing(modalHandAnimY, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
        // Teleport to right and bounce again
        Animated.timing(modalHandAnimX, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(modalHandAnimY, { toValue: -8, duration: 180, useNativeDriver: true }),
        Animated.timing(modalHandAnimY, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
      ]);
      Animated.loop(seq).start();
    }
    return () => { mounted = false; };
  }, []);

  const pickImage = async (fromCamera = false) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) return;

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
        if (base64Data && user?.id) {
          try {
            const resp = await userService.update(user.id, { foto: base64Data });
            const newUser = (resp?.data || resp || {});
            let normalizedPhoto = newUser.fotoUrl || newUser.foto_url || newUser.foto || asset.uri || null;
            // try to normalize relative paths
            try {
              const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
              const host = rawApi.replace(/\/api\/v1/i, '').replace(/\/+$/, '');
              if (typeof normalizedPhoto === 'string' && normalizedPhoto.length > 0 && !/^https?:\/\//i.test(normalizedPhoto) && !/^data:/i.test(normalizedPhoto)) {
                const leading = normalizedPhoto.startsWith('/') ? '' : '/';
                normalizedPhoto = `${host}${leading}${normalizedPhoto}`;
              }
            } catch (err) { /* ignore */ }
            updateUserStore({ photo: normalizedPhoto });
            onClose();
            return;
          } catch (err) {
            // If server upload fails, fallback to asset uri
            updateUserStore({ photo: asset.uri });
            onClose();
            return;
          }
        }

        // Fallback: set local uri
        updateUserStore({ photo: asset.uri });
        onClose();
      }
    } catch (err) {
      console.error('pickImage error', err);
    }
  };

  const handleLogout = () => {
    try { logoutStore(); } catch (e) {}
    onClose();
    router.replace('/login');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: bg, borderRadius: 12, padding: 20, width: '90%', maxWidth: 400 }}>
          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', right: 12, top: 12, zIndex: 30 }}>
            <Text style={{ fontSize: 18, color: '#ef4444', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 10 }} />
            ) : (
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Text style={{ color: fg, fontSize: 32, fontWeight: '700' }}>{user?.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
            )}
            <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>{user?.nombre || 'Usuario'}</Text>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: muted, marginBottom: 6 }}>Nombre</Text>
              <TextInput
                value={tempNombre}
                onChangeText={setTempNombre}
                placeholder="Tu nombre"
                placeholderTextColor={muted}
                style={{ borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', borderRadius: 8, padding: 12, color: fg, backgroundColor: dark ? '#0b1220' : 'white' }}
              />
              <TouchableOpacity onPress={async () => {
                try {
                  if (user?.id) {
                    await userService.update(user.id, { nombre: tempNombre });
                  }
                } catch (err) {
                  console.error('Error updating name', err);
                }
                updateUserStore({ nombre: tempNombre });
                onClose();
              }} style={{ marginTop: 8, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Guardar Nombre</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={{ color: muted, marginBottom: 6 }}>Foto de Perfil</Text>
              <View style={{ flexDirection: 'row', gap: 8, position: 'relative', alignItems: 'center' }}>
                {!((user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto) && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: '50%',
                      transform: [
                        // translateX interpolates from left to right relative to center
                        { translateX: modalHandAnimX.interpolate({ inputRange: [0, 1], outputRange: [-72, 72] }) },
                        { translateY: modalHandAnimY },
                      ],
                      marginLeft: -12,
                      zIndex: 50,
                      elevation: 50,
                    }}
                    pointerEvents="none"
                  >
                    <Text style={{ fontSize: 26 }}>👆🏽</Text>
                  </Animated.View>
                )}
                <TouchableOpacity onPress={() => pickImage(true)} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Tomar Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pickImage(false)} style={{ flex: 1, backgroundColor: '#10B981', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Subir Foto</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={{ color: muted, marginBottom: 6 }}>Tema</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 0, gap: 12 }}>
                <TouchableOpacity onPress={() => setTheme('dark')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: dark ? '#1E3A8A' : 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: dark ? 0 : 1, borderColor: dark ? 'transparent' : '#E5E7EB' }}>
                  <Text style={{ fontSize: 18 }}>🌙</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTheme('light')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: !dark ? '#FDE68A' : 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: !dark ? 0 : 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 18 }}>☀️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={async () => {
                try {
                  if (user?.id) await userService.update(user.id, { nombre: tempNombre });
                } catch (err) { console.error('save error', err); }
                updateUserStore({ nombre: tempNombre });
                onClose();
              }} style={{ backgroundColor: '#22c55e', padding: 12, borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: '#EF4444', padding: 12, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
}
