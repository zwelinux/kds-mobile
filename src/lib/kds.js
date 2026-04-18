export function todayInBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function toDateOnly(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function prettyAge(startValue, endValue = null) {
  const start = new Date(startValue).getTime();
  const end = endValue ? new Date(endValue).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function buildItemKey(ticket) {
  const modifierKey = (ticket.modifiers || [])
    .map((modifier) =>
      [
        modifier?.group_name || "",
        modifier?.option_name || "",
        modifier?.include !== false ? "1" : "0",
        Number(modifier?.qty || 1),
        modifier?.show_title !== false ? "1" : "0",
      ].join("::")
    )
    .sort()
    .join("||");

  return [
    ticket.product_name || "",
    ticket.variant_name || "",
    modifierKey,
    ticket.status || "",
  ].join("__");
}

export function groupModifierLines(modifiers = []) {
  const groups = modifiers.reduce((acc, modifier, index) => {
    const showTitle = modifier?.show_title !== false;
    const title = showTitle ? modifier?.group_name || "OPTIONS" : null;
    const key = title || `__hidden__${index}`;
    if (!acc[key]) acc[key] = { title, items: [] };

    const qty = Number(modifier?.qty || 1);
    const prefix = modifier?.include ? "" : "No ";
    acc[key].items.push(`${prefix}${modifier?.option_name || ""}${qty > 1 ? ` x${qty}` : ""}`);
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => {
      const line = group.items.join(", ");
      return group.title ? `${group.title}: ${line}` : line;
    })
    .filter(Boolean);
}

export function groupTicketsIntoOrders(tickets) {
  const groups = new Map();

  for (const ticket of tickets) {
    const tableName = ticket.table_name || "Takeaway";
    const orderNumber = ticket.order_number || "Unknown";
    const key = `${tableName}__${orderNumber}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        orderId: ticket.order_id,
        tableName,
        orderNumber,
        createdAt: ticket.created_at,
        tickets: [],
      });
    }

    const group = groups.get(key);
    group.tickets.push(ticket);
    if (!group.orderId && ticket.order_id) group.orderId = ticket.order_id;
    if (ticket.created_at && new Date(ticket.created_at) < new Date(group.createdAt)) {
      group.createdAt = ticket.created_at;
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const itemMap = new Map();

      for (const ticket of group.tickets) {
        if (ticket.status === "cancelled" || ticket.isVoided) continue;

        const itemKey = buildItemKey(ticket);
        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, {
            key: itemKey,
            productName: ticket.product_name,
            variantName: ticket.variant_name,
            modifiers: ticket.modifiers || [],
            qty: 0,
            activeCount: 0,
            ticketIds: [],
          });
        }

        const item = itemMap.get(itemKey);
        item.qty += Number(ticket.qty || 1);
        item.ticketIds.push(ticket.id);
        if (ticket.status !== "done") item.activeCount += 1;
      }

      const activeTicketIds = group.tickets
        .filter((ticket) => ticket.status !== "done" && ticket.status !== "cancelled" && !ticket.isVoided)
        .map((ticket) => ticket.id);

      const completedAt =
        activeTicketIds.length === 0
          ? group.tickets
              .filter((ticket) => !ticket.isVoided && ticket.status !== "cancelled")
              .reduce((latest, ticket) => {
                const candidate = ticket.done_at || ticket.updated_at || ticket.created_at || null;
                if (!candidate) return latest;
                if (!latest) return candidate;
                return new Date(candidate) > new Date(latest) ? candidate : latest;
              }, null)
          : null;

      return {
        ...group,
        items: Array.from(itemMap.values()),
        activeTicketIds,
        activeCount: activeTicketIds.length,
        completedAt,
      };
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
