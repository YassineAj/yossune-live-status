let cachedToken = null;
let tokenExpiresAt = 0;

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const channelLogin = process.env.TWITCH_CHANNEL_LOGIN;

    if (!clientId || !clientSecret || !channelLogin) {
      response.status(500).json({ error: "Variables Twitch manquantes" });
      return;
    }

    const token = await getAppAccessToken(clientId, clientSecret);
    const twitchResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channelLogin)}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!twitchResponse.ok) {
      response.status(twitchResponse.status).json({ error: "Erreur Twitch Helix" });
      return;
    }

    const payload = await twitchResponse.json();
    const stream = payload.data?.[0];

    response.status(200).json({
      isLive: Boolean(stream),
      title: stream?.title ?? "",
      gameName: stream?.game_name ?? "",
      viewerCount: stream?.viewer_count ?? 0,
      startedAt: stream?.started_at ?? ""
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}

async function getAppAccessToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const tokenUrl = new URL("https://id.twitch.tv/oauth2/token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("grant_type", "client_credentials");

  const tokenResponse = await fetch(tokenUrl, { method: "POST" });
  if (!tokenResponse.ok) {
    throw new Error("Impossible de recuperer le token Twitch");
  }

  const tokenPayload = await tokenResponse.json();
  cachedToken = tokenPayload.access_token;
  tokenExpiresAt = now + tokenPayload.expires_in * 1000;

  return cachedToken;
}
