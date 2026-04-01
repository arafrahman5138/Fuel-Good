import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function CoachLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
