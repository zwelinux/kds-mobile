import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import OrderCard from "../components/OrderCard";
import { authedFetch, clearAuth } from "../lib/auth";
import { groupTicketsIntoOrders, todayInBangkok, toDateOnly } from "../lib/kds";
import {
  cleanStationSlug,
  ENABLE_COMPLETED_SOUND,
  ENABLE_COMPLETED_VOICE,
  ENABLE_ORDER_SOUND,
  ENABLE_ORDER_VOICE,
  getWsCandidates,
  ORDER_VOICE_LANGUAGE,
} from "../config";
import tw from "../lib/tw";

export default function KDSScreen({ auth, onLogout }) {
  const { width, height } = useWindowDimensions();
  const [tickets, setTickets] = useState([]);
  const [stations, setStations] = useState([{ slug: "ALL", name: "ALL" }]);
  const [selectedStation, setSelectedStation] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState([]);
  const [statusText, setStatusText] = useState("Connecting");
  const socketsRef = useRef({});
  const reconnectTimersRef = useRef({});
  const spokenIdsRef = useRef(new Set());
  const completedIdsRef = useRef(new Set());
  const knownTicketIdsRef = useRef(new Set());
  const hasLoadedTicketsRef = useRef(false);
  const today = todayInBangkok();
  const orderAlertPlayer = useAudioPlayer(require("../../assets/sounds/neworder.mp3"));
  const completedAlertPlayer = useAudioPlayer(require("../../assets/sounds/completed.mp3"));

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
  }, []);

  function playOrderSound() {
    if (!ENABLE_ORDER_SOUND) return;

    try {
      orderAlertPlayer.seekTo(0);
      orderAlertPlayer.play();
    } catch {}
  }

  function playCompletedSound() {
    if (!ENABLE_COMPLETED_SOUND) return;

    try {
      completedAlertPlayer.seekTo(0);
      completedAlertPlayer.play();
    } catch {}
  }

  async function speakNewOrder(ticket) {
    if (!ENABLE_ORDER_VOICE) return;

    const key = `${ticket.id}`;
    if (spokenIdsRef.current.has(key)) return;
    spokenIdsRef.current.add(key);

    const qty = Number(ticket.qty || 1);
    const table = ticket.table_name || "Takeaway";
    const item = ticket.product_name || "item";
    const order = ticket.order_number || ticket.order_id || "";
    const quantityText = qty > 1 ? `${qty} ${item}` : item;
    const message = `New order for ${table}. ${quantityText}. Order ${order}.`;

    try {
      await Speech.stop();
      Speech.speak(message, {
        language: ORDER_VOICE_LANGUAGE,
        pitch: 1,
        rate: 0.95,
      });
    } catch {}
  }

  async function triggerOrderAlert(ticket) {
    playOrderSound();
    await speakNewOrder(ticket);
  }

  async function speakCompletedOrder(ticket) {
    if (!ENABLE_COMPLETED_VOICE) return;

    const key = `done-${ticket.id}`;
    if (completedIdsRef.current.has(key)) return;
    completedIdsRef.current.add(key);

    const table = ticket.table_name || "Takeaway";
    const order = ticket.order_number || ticket.order_id || "";
    const message = `Order completed for ${table}. Order ${order}.`;

    try {
      await Speech.stop();
      Speech.speak(message, {
        language: ORDER_VOICE_LANGUAGE,
        pitch: 1,
        rate: 0.95,
      });
    } catch {}
  }

  async function triggerCompletedAlert(ticket) {
    playCompletedSound();
    await speakCompletedOrder(ticket);
  }

  async function loadStations() {
    const response = await authedFetch("/kitchen-stations/", auth);
    const json = await response.json().catch(() => ({}));
    const unique = new Map();
    [{ slug: "ALL", name: "ALL" }, ...(json.stations || [])].forEach((station) => {
      const slug = station?.slug ? cleanStationSlug(station.slug) : "ALL";
      unique.set(slug, { ...station, slug });
    });
    setStations([...unique.values()]);
  }

  async function loadTickets({ silent = false, alertOnNew = false } = {}) {
    if (!silent) setLoading(true);
    const response = await authedFetch(`/kitchen-tickets/?date=${today}`, auth);
    const data = await response.json().catch(() => []);
    const nextTickets = Array.isArray(data) ? data : [];

    if (!hasLoadedTicketsRef.current) {
      knownTicketIdsRef.current = new Set(nextTickets.map((ticket) => ticket.id));
      hasLoadedTicketsRef.current = true;
    } else if (alertOnNew) {
      const newTickets = nextTickets.filter(
        (ticket) =>
          !knownTicketIdsRef.current.has(ticket.id) &&
          ticket.status !== "done" &&
          ticket.status !== "cancelled" &&
          !ticket.isVoided
      );

      for (const ticket of newTickets) {
        await triggerOrderAlert(ticket);
      }

      knownTicketIdsRef.current = new Set(nextTickets.map((ticket) => ticket.id));
    } else {
      knownTicketIdsRef.current = new Set(nextTickets.map((ticket) => ticket.id));
    }

    setTickets(nextTickets);
    setLoading(false);
    setRefreshing(false);
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      await Promise.all([loadStations(), loadTickets({ silent: true })]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadStations(), loadTickets()]);
      } catch {
        setStatusText("Load failed");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadTickets({ silent: true, alertOnNew: true }).catch(() => {});
    }, 10000);

    return () => clearInterval(timer);
  }, [auth]);

  useEffect(() => {
    const connectStation = (slug, candidateIndex = 0) => {
      const normalizedSlug = cleanStationSlug(slug);
      const existing = socketsRef.current[normalizedSlug];
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const candidates = getWsCandidates(`/ws/kitchen/${encodeURIComponent(normalizedSlug)}/`);
      const targetUrl = candidates[candidateIndex];
      if (!targetUrl) {
        setStatusText(`No socket target for ${normalizedSlug}`);
        return;
      }

      const ws = new WebSocket(targetUrl);
      socketsRef.current[normalizedSlug] = ws;

      ws.onopen = () => {
        setStatusText(`Live: ${normalizedSlug}`);
        ws.__opened = true;
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (!msg?.type || !msg?.data) return;

        if (msg.type === "ticket") {
          setTickets((prev) => (prev.some((ticket) => ticket.id === msg.data.id) ? prev : [msg.data, ...prev]));
          await triggerOrderAlert(msg.data);
          return;
        }

        if (msg.type === "update") {
          setTickets((prev) => prev.map((ticket) => (ticket.id === msg.data.id ? { ...ticket, ...msg.data } : ticket)));
          if (msg.data.status === "done") {
            await triggerCompletedAlert(msg.data);
          }
          return;
        }

        if (msg.type === "cancel") {
          setTickets((prev) =>
            prev.map((ticket) =>
              ticket.id === msg.data.id
                ? { ...ticket, isVoided: true, status: "cancelled", updated_at: new Date().toISOString() }
                : ticket
            )
          );
        }
      };

      ws.onerror = () => {
        setStatusText(`Socket error: ${normalizedSlug} • Polling fallback`);
      };

      ws.onclose = () => {
        delete socketsRef.current[normalizedSlug];

        if (!ws.__opened && candidateIndex + 1 < getWsCandidates(`/ws/kitchen/${encodeURIComponent(normalizedSlug)}/`).length) {
          connectStation(normalizedSlug, candidateIndex + 1);
          return;
        }

        setStatusText(`Socket closed: ${normalizedSlug} • Polling fallback`);
        reconnectTimersRef.current[normalizedSlug] = setTimeout(() => connectStation(normalizedSlug), 1500);
      };
    };

    stations
      .filter((station) => station.slug !== "ALL")
      .forEach((station) => connectStation(station.slug));

    return () => {
      Object.values(reconnectTimersRef.current).forEach(clearTimeout);
      reconnectTimersRef.current = {};
      Object.values(socketsRef.current).forEach((socket) => {
        try {
          socket.close();
        } catch {}
      });
      socketsRef.current = {};
    };
  }, [stations]);

  const visibleTickets = useMemo(() => {
    return tickets
      .filter((ticket) => (selectedStation === "ALL" ? true : cleanStationSlug(ticket.station) === selectedStation))
      .filter((ticket) => toDateOnly(ticket.created_at || ticket.started_at) === today);
  }, [tickets, selectedStation, today]);

  const groupedOrders = useMemo(() => groupTicketsIntoOrders(visibleTickets), [visibleTickets]);
  const isLandscape = width > height;
  const numColumns = isLandscape ? 3 : width >= 700 ? 3 : 2;

  const gridData = useMemo(() => {
    const rows = [];
    for (let i = 0; i < groupedOrders.length; i += numColumns) {
      rows.push(groupedOrders.slice(i, i + numColumns));
    }
    return rows;
  }, [groupedOrders, numColumns]);

  async function markDone(ticketIds) {
    const ids = Array.isArray(ticketIds) ? ticketIds : [ticketIds];
    const completedTicket = tickets.find((ticket) => ids.includes(ticket.id));
    setBusyIds((current) => [...current, ...ids]);
    setTickets((prev) =>
      prev.map((ticket) => (ids.includes(ticket.id) ? { ...ticket, status: "done", done_at: new Date().toISOString() } : ticket))
    );
    if (completedTicket) {
      await triggerCompletedAlert({ ...completedTicket, status: "done" });
    }

    try {
      await Promise.all(
        ids.map((ticketId) =>
          authedFetch(`/kitchen-tickets/${ticketId}/`, auth, {
            method: "PATCH",
            body: JSON.stringify({ status: "done" }),
          })
        )
      );
    } finally {
      setBusyIds((current) => current.filter((id) => !ids.includes(id)));
    }
  }

  async function doLogout() {
    await clearAuth();
    onLogout();
  }

  return (
    <View style={tw`flex-1 bg-slate-950`}>
      <View style={tw`border-b border-slate-800 bg-slate-900 px-5 py-4`}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-1 pr-3`}>
            <Text style={tw`text-[11px] font-black uppercase tracking-[3px] text-indigo-300`}>KDS Mobile</Text>
            <Text style={tw`mt-2 text-3xl font-black tracking-tight text-white`}>By Table</Text>
            <Text style={tw`mt-2 text-sm font-semibold text-slate-400`}>{auth?.username} • {statusText}</Text>
            <Text style={tw`mt-1 text-[11px] font-bold text-slate-500`}>
              Alert: {ENABLE_ORDER_SOUND ? "Sound" : "Off"}{ENABLE_ORDER_VOICE ? " + Voice" : ""}
            </Text>
          </View>
          <Pressable onPress={doLogout} style={tw`rounded-2xl border border-slate-700 px-4 py-3`}>
            <Text style={tw`text-[11px] font-black uppercase tracking-[2px] text-slate-200`}>Logout</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-4`}>
          <View style={tw`flex-row`}>
            {stations.map((station) => {
              const active = selectedStation === station.slug;
              return (
                <Pressable
                  key={station.slug}
                  onPress={() => setSelectedStation(station.slug)}
                  style={[tw`mr-2 rounded-2xl px-4 py-3`, active ? tw`bg-indigo-600` : tw`bg-slate-800`]}
                >
                  <Text style={[tw`text-[11px] font-black uppercase tracking-[2px]`, active ? tw`text-white` : tw`text-slate-300`]}>
                    {station.name || station.slug}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator color="#818cf8" size="large" />
        </View>
      ) : (
        <FlatList
          data={groupedOrders.length === 0 ? [] : gridData}
          key={numColumns}
          style={tw`flex-1 px-4 pt-4`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor="#818cf8" />}
          keyExtractor={(_, index) => `row-${numColumns}-${index}`}
          renderItem={({ item: row }) => (
            <View style={tw`mb-4 flex-row`}>
              {Array.from({ length: numColumns }).map((_, index) => {
                const group = row[index];
                return (
                  <View
                    key={group?.key || `empty-${index}`}
                    style={[
                      tw`mr-3 flex-1`,
                      index === numColumns - 1 ? tw`mr-0` : null,
                    ]}
                  >
                    {group ? (
                      <OrderCard
                        group={group}
                        busy={group.activeTicketIds.some((id) => busyIds.includes(id))}
                        onDone={() => markDone(group.activeTicketIds)}
                      />
                    ) : (
                      <View />
                    )}
                  </View>
                );
              })}
            </View>
          )}
          ListEmptyComponent={
            <View style={tw`mt-8 rounded-[28px] border border-slate-800 bg-slate-900 px-6 py-10`}>
              <Text style={tw`text-center text-2xl font-black text-white`}>Queue Open</Text>
              <Text style={tw`mt-2 text-center text-sm font-semibold text-slate-400`}>No kitchen orders right now.</Text>
            </View>
          }
          ListFooterComponent={<View style={tw`h-6`} />}
          contentContainerStyle={groupedOrders.length === 0 ? tw`pb-6` : undefined}
        />
      )}
    </View>
  );
}
