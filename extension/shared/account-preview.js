// 只用于恢复弹窗外观，不能作为登录凭据或扣费依据。原始连接码不写入快照。
export async function accountPreviewKey({ relayUrl, token }) {
  const bytes = new TextEncoder().encode(JSON.stringify([relayUrl, token]));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validAccountPreview(preview, key, now = Date.now()) {
  return preview?.key === key && Number.isFinite(preview.seconds) && preview.seconds >= 0
    && Number.isFinite(preview.updatedAt) && preview.updatedAt <= now && now - preview.updatedAt < 3600_000;
}
