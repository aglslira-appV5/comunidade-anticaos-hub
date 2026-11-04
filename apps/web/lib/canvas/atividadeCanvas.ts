export function ehCanvasDoKit(activity: any): boolean {
  if (!activity || typeof activity !== 'object') return false;
  if (activity.activity_sub_type !== 'SUBTYPE_DYNAMIC_EMBED') return false;
  const embedUrl = activity.content?.embed_url;
  if (!embedUrl || typeof embedUrl !== 'string') return false;
  try {
    const parsed = new URL(embedUrl);
    return parsed.hostname === 'canvas.souanticaos.app';
  } catch {
    return false;
  }
}
