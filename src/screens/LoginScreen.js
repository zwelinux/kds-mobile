import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { loginWithPassword } from "../lib/auth";
import tw from "../lib/tw";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const auth = await loginWithPassword(username.trim(), password);
      onLogin(auth);
    } catch (err) {
      setError(err.message || "Unable to login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={tw`flex-1 bg-slate-950 px-6 py-10`}>
      <View style={tw`mt-12 rounded-[32px] border border-slate-800 bg-slate-900 p-6`}>
        <Text style={tw`text-[11px] font-black uppercase tracking-[3px] text-indigo-300`}>KDS Mobile</Text>
        <Text style={tw`mt-3 text-4xl font-black tracking-tight text-white`}>Kitchen Login</Text>
        <Text style={tw`mt-3 text-sm font-medium leading-6 text-slate-400`}>
          Sign in with the same POS account and open the live kitchen board.
        </Text>

        <View style={tw`mt-8`}>
          <View style={tw`mb-4`}>
            <Text style={tw`mb-2 text-[11px] font-black uppercase tracking-[2px] text-slate-400`}>Username</Text>
            <TextInput
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              placeholder="staff"
              placeholderTextColor="#64748b"
              style={tw`rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-base font-semibold text-white`}
            />
          </View>

          <View style={tw`mb-4`}>
            <Text style={tw`mb-2 text-[11px] font-black uppercase tracking-[2px] text-slate-400`}>Password</Text>
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              style={tw`rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-base font-semibold text-white`}
            />
          </View>

          {error ? (
            <View style={tw`mb-4 rounded-2xl border border-rose-800 bg-rose-950 px-4 py-3`}>
              <Text style={tw`text-sm font-bold text-rose-200`}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={[tw`mt-2 min-h-[56px] flex-row items-center justify-center rounded-2xl bg-indigo-600`, busy ? tw`opacity-70` : null]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={tw`text-[12px] font-black uppercase tracking-[2px] text-white`}>Enter KDS</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
