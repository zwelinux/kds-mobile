import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
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
      <SafeAreaView style={tw`flex-1 items-center justify-center bg-slate-950`}>
        <StatusBar style="light" hidden />
        <View style={tw`items-center`}>
          <ActivityIndicator size="large" color="#818cf8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-950`}>
      <StatusBar style="light" hidden />
      {auth?.token ? (
        <KDSScreen auth={auth} onLogout={() => setAuth(null)} />
      ) : (
        <LoginScreen onLogin={setAuth} />
      )}
    </SafeAreaView>
  );
}
