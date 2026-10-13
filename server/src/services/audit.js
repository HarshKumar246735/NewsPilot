export function createAudit({ store, clock }) {
  const col = store.col('audit');
  return {
    async log(user, action, entity, entityId, summary = '', ip = '') {
      try { await col.insert({ userId: user?.id || 'system', userEmail: user?.email || 'system', action, entity, entityId: entityId || '', summary: String(summary).slice(0, 300), ip, createdAt: clock().toISOString() }); } catch { /* auditing must never break the request */ }
    },
    recent: (limit = 50, skip = 0) => col.find({}, { sort: { createdAt: -1 }, limit, skip }),
    count: () => col.count({}),
  };
}
