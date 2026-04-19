import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getStoredAuth } from "./src/lib/auth";
import LoginScreen from "./src/screens/LoginScreen";
import KDSScreen from "./src/screens/KDSScreen";
import tw from "./src/lib/tw";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await getStoredAuth();
      setAuth(stored?.token ? stored : null);
      setBooting(false);
    })();
  }, []);

  if (booting) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={["top", "bottom"]} style={tw`flex-1 items-center justify-center bg-slate-950`}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <View style={tw`items-center`}>
            <ActivityIndicator size="large" color="#818cf8" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={["top", "bottom"]} style={tw`flex-1 bg-slate-950`}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        {auth?.token ? (
          <KDSScreen auth={auth} onLogout={() => setAuth(null)} />
        ) : (
          <LoginScreen onLogin={setAuth} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
