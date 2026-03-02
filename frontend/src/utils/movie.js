export function imageUrl(thumb, w = 400, h = 600) {
  if (!thumb) return null;
  return `/api/proxy/image?path=${encodeURIComponent(thumb)}&w=${w}&h=${h}`;
}

export function formatDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
