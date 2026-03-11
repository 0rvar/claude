import { getAccessToken } from "./auth";

const BASE = "https://www.googleapis.com/drive/v3";

async function headers(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request(
  path: string,
  opts: {
    method?: string;
    params?: Record<string, string>;
    body?: any;
  } = {}
): Promise<any> {
  const url = new URL(`${BASE}${path}`);
  // Always support shared drives
  url.searchParams.set("supportsAllDrives", "true");

  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method || "GET",
    headers: await headers(),
    ...(opts.body && { body: JSON.stringify(opts.body) }),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Drive API error (${res.status}): ${text}`);
    (err as any).code = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// --- Files API ---

export interface ListFilesOpts {
  q?: string;
  pageSize?: number;
  orderBy?: string;
  fields?: string;
}

export async function listFiles(opts: ListFilesOpts = {}) {
  const params: Record<string, string> = {
    includeItemsFromAllDrives: "true",
  };
  if (opts.q) params.q = opts.q;
  if (opts.pageSize) params.pageSize = String(opts.pageSize);
  if (opts.orderBy) params.orderBy = opts.orderBy;
  if (opts.fields) params.fields = opts.fields;

  return request("/files", { params });
}

export async function getFile(
  fileId: string,
  fields: string
) {
  return request(`/files/${encodeURIComponent(fileId)}`, {
    params: { fields },
  });
}

export async function createFile(metadata: Record<string, any>, fields = "id,name,webViewLink") {
  return request("/files", {
    method: "POST",
    params: { fields },
    body: metadata,
  });
}

export async function updateFile(
  fileId: string,
  metadata: Record<string, any>,
  extraParams?: Record<string, string>
) {
  const params: Record<string, string> = {
    fields: "id,name,parents,webViewLink",
    ...extraParams,
  };
  return request(`/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    params,
    body: metadata,
  });
}

export async function deleteFile(fileId: string) {
  return request(`/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}

export async function copyFile(
  fileId: string,
  metadata: Record<string, any>,
  fields = "id,name,mimeType,webViewLink"
) {
  return request(`/files/${encodeURIComponent(fileId)}/copy`, {
    method: "POST",
    params: { fields },
    body: metadata,
  });
}

// --- Download / Export ---

const GOOGLE_WORKSPACE_MIMES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.drawing": "image/png",
};

export async function downloadFile(
  fileId: string,
  exportMimeType?: string
): Promise<string> {
  const token = (await getAccessToken());
  const hdrs = { Authorization: `Bearer ${token}` };

  // First get the file's mime type to decide download vs export
  const meta = await getFile(fileId, "mimeType,name,size");
  const isWorkspace = meta.mimeType in GOOGLE_WORKSPACE_MIMES;

  let url: string;
  if (isWorkspace) {
    const targetMime = exportMimeType || GOOGLE_WORKSPACE_MIMES[meta.mimeType];
    url = `${BASE}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(targetMime)}&supportsAllDrives=true`;
  } else {
    url = `${BASE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  }

  const res = await fetch(url, { headers: hdrs });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download failed (${res.status}): ${text}`);
  }

  return res.text();
}

export async function downloadFileBuffer(fileId: string): Promise<{
  buffer: ArrayBuffer;
  mimeType: string;
  name: string;
}> {
  const token = await getAccessToken();
  const hdrs = { Authorization: `Bearer ${token}` };
  const meta = await getFile(fileId, "mimeType,name");
  const url = `${BASE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: hdrs });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download failed (${res.status}): ${text}`);
  }
  return { buffer: await res.arrayBuffer(), mimeType: meta.mimeType, name: meta.name };
}

// --- Permissions API ---

export async function createPermission(
  fileId: string,
  permission: Record<string, any>,
  sendNotification = true
) {
  return request(`/files/${encodeURIComponent(fileId)}/permissions`, {
    method: "POST",
    params: {
      sendNotificationEmail: String(sendNotification),
      fields: "id,role,type,emailAddress",
    },
    body: permission,
  });
}
