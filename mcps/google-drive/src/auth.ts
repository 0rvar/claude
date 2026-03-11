import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { logger } from "./logger";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || path.join(os.homedir(), ".config");
  const baseDir = path.join(base, "google-drive-mcp");
  const profile = process.env.GOOGLE_MCP_PROFILE;
  return profile ? path.join(baseDir, profile) : baseDir;
}

function getTokenPath(): string {
  return path.join(getConfigDir(), "token.json");
}

function getClientSecrets(): { client_id: string; client_secret: string } {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    throw new Error(
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
    );
  }
  return { client_id, client_secret };
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let cachedToken: TokenData | null = null;

async function loadSavedToken(): Promise<TokenData | null> {
  try {
    const content = await fs.readFile(getTokenPath(), "utf8");
    return JSON.parse(content) as TokenData;
  } catch {
    return null;
  }
}

async function saveToken(token: TokenData): Promise<void> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getTokenPath(), JSON.stringify(token, null, 2));
  logger.info("Token saved to", getTokenPath());
}

async function refreshAccessToken(token: TokenData): Promise<TokenData> {
  const { client_id, client_secret } = getClientSecrets();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const updated: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  await saveToken(updated);
  return updated;
}

export async function getAccessToken(): Promise<string> {
  if (!cachedToken) {
    cachedToken = await loadSavedToken();
  }
  if (!cachedToken) {
    throw new Error(
      "No saved token. Run with 'auth' subcommand first to authenticate."
    );
  }

  if (Date.now() >= cachedToken.expires_at) {
    logger.info("Access token expired, refreshing...");
    cachedToken = await refreshAccessToken(cachedToken);
  }

  return cachedToken.access_token;
}

export async function runAuthFlow(): Promise<void> {
  const { client_id, client_secret } = getClientSecrets();

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        authReject?.(new Error(`Authorization error: ${error}`));
        return new Response(
          "<h1>Authorization failed</h1><p>You can close this tab.</p>",
          { headers: { "Content-Type": "text/html" } }
        );
      }

      if (code) {
        authResolve?.(code);
        return new Response(
          "<h1>Authorization successful!</h1><p>You can close this tab.</p>",
          { headers: { "Content-Type": "text/html" } }
        );
      }

      return new Response("Waiting for authorization...", { status: 400 });
    },
  });

  let authResolve: ((code: string) => void) | null = null;
  let authReject: ((err: Error) => void) | null = null;

  const codePromise = new Promise<string>((resolve, reject) => {
    authResolve = resolve;
    authReject = reject;
  });

  const redirectUri = `http://127.0.0.1:${server.port}`;
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  logger.info("Authorize this app by visiting:", authUrl.toString());

  const code = await codePromise;
  server.stop();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error("No refresh token received. Try revoking app access and re-authorizing.");
  }

  const token: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  await saveToken(token);
  logger.info("Authentication successful!");
}
