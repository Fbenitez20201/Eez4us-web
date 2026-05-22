import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text
        className="text-4xl text-brand-blue"
        style={{ fontFamily: 'Nunito-Black' }}
      >
        EZ4us
      </Text>
      <Text
        className="mt-2 text-base text-gray-500"
        style={{ fontFamily: 'Nunito' }}
      >
        Iniciar sesión
      </Text>
      <Link href="/(app)" className="mt-8 text-brand-blue" style={{ fontFamily: 'Nunito-Bold' }}>
        Entrar
      </Link>
    </View>
  );
}
