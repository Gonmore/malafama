import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useThemeStore } from '../store/theme';

export default function ThemeSwitch() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  const dark = theme === 'dark';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TouchableOpacity
        onPress={() => !dark && toggle()}
        style={{ padding: 8 }}
        accessibilityLabel="dark-mode-moon"
      >
        <Text style={{ fontSize: 18 }}>{'🌙'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => dark && toggle()}
        style={{
          width: 54,
          height: 30,
          borderRadius: 999,
          backgroundColor: dark ? '#111827' : '#E5E7EB',
          padding: 3,
          justifyContent: 'center',
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: dark }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: dark ? '#FBBF24' : 'white',
            transform: [{ translateX: dark ? 24 : 0 }],
          }}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => dark && toggle()}
        style={{ padding: 8 }}
        accessibilityLabel="dark-mode-sun"
      >
        <Text style={{ fontSize: 18 }}>{'☀️'}</Text>
      </TouchableOpacity>
    </View>
  );
}
