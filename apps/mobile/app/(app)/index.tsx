import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text
        className="text-3xl text-brand-blue"
        style={{ fontFamily: 'Nunito-Black' }}
      >
        Voy en camino
      </Text>
      <Text
        className="mt-2 text-base text-gray-500"
        style={{ fontFamily: 'Nunito' }}
      >
        Pantalla principal del padre de familia
      </Text>
    </View>
  );
}
