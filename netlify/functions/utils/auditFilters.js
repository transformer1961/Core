function buildAuditFilter(query = {}) {
  const filter = {};
  if (query.actorId && /^[a-zA-Z0-9:_-]{1,100}$/.test(query.actorId)) filter.actorId = query.actorId;
  if (query.targetType && /^[a-z_]{1,30}$/.test(query.targetType)) filter.targetType = query.targetType;
  if (query.targetId && /^[a-zA-Z0-9:_-]{1,100}$/.test(query.targetId)) filter.targetId = query.targetId;
  if (query.action && /^[a-z_.]{1,50}$/.test(query.action)) filter.action = query.action;
  if (query.result && /^[a-zA-Z0-9 _-]{1,80}$/.test(query.result)) filter['details.result'] = query.result;
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && !Number.isNaN(from.getTime())) filter.createdAt = { $gte: from };
  if (to && !Number.isNaN(to.getTime())) filter.createdAt = { ...(filter.createdAt || {}), $lte: to };
  return filter;
}

module.exports = { buildAuditFilter };