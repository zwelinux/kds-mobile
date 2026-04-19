import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { groupModifierLines, prettyAge } from "../lib/kds";
import tw from "../lib/tw";

export default function OrderCard({ group, busy, onDone }) {
  const isDone = group.activeCount === 0;
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={tw`mb-4 overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900`}>
      <View style={[tw`flex-row items-center justify-between px-5 py-4`, isDone ? tw`bg-emerald-800` : tw`bg-indigo-600`]}>
        <View style={tw`flex-1 pr-3`}>
          <Text style={tw`text-2xl font-black text-white`}>{group.tableName}</Text>
          <Text style={tw`mt-1 text-[11px] font-bold uppercase tracking-[2px] text-indigo-100`}>
            Order {group.orderNumber}
          </Text>
        </View>
        <Text style={tw`text-sm font-black text-white`}>{prettyAge(group.createdAt, isDone ? group.completedAt : null)}</Text>
      </View>

      <View style={tw`px-4 py-4`}>
        {group.items.map((item) => (
          <View key={item.key} style={tw`mb-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3`}>
            <View style={tw`flex-row items-start justify-between`}>
              <View style={tw`flex-1 pr-3`}>
                <Text style={tw`text-base font-black leading-tight text-white`}>
                  {item.productName} x {item.qty}
                </Text>
                {item.variantName ? (
                  <Text style={tw`mt-1 text-[11px] font-bold uppercase tracking-[2px] text-indigo-300`}>
                    {item.variantName}
                  </Text>
                ) : null}
                {groupModifierLines(item.modifiers).map((line, index) => (
                  <Text key={`${item.key}-${index}`} style={tw`mt-1 text-xs font-semibold text-slate-300`}>
                    {line}
                  </Text>
                ))}
              </View>
              <View style={[tw`mt-1 h-3 w-3 rounded-full`, item.activeCount > 0 ? tw`bg-amber-400` : tw`bg-emerald-400`]} />
            </View>
          </View>
        ))}

        <Pressable
          disabled={isDone || busy}
          onPress={onDone}
          style={[tw`items-center rounded-2xl px-4 py-4`, isDone ? tw`bg-emerald-700` : tw`bg-white`, busy ? tw`opacity-60` : null]}
        >
          <Text style={[tw`text-[12px] font-black uppercase tracking-[2px]`, isDone ? tw`text-emerald-100` : tw`text-indigo-700`]}>
            {isDone ? "Completed" : "Mark As Done"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
