import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Steam OpenID Callback Handler
 * Steam redirects here after user approves the login
 */
export default function SteamCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    handleSteamCallback();
  }, []);

  async function handleSteamCallback() {
    const urlParams = new URLSearchParams(window.location.search);

    // Parse OpenID response from Steam
    const claimedId = urlParams.get('openid.claimed_id');
    const identity = urlParams.get('openid.identity');

    if (!claimedId || !identity) {
      // Invalid callback
      window.opener?.postMessage({ type: 'STEAM_ERROR', error: 'Invalid Steam response' }, '*');
      window.close();
      return;
    }

    // Extract Steam ID from the URL
    // Format: https://steamcommunity.com/openid/id/STEAM_ID
    const steamIdMatch = claimedId.match(/id\/(\d+)$/);
    if (!steamIdMatch) {
      window.opener?.postMessage({ type: 'STEAM_ERROR', error: 'Could not extract Steam ID' }, '*');
      window.close();
      return;
    }

    const steamId = steamIdMatch[1];

    // Fetch Steam profile info
    try {
      // Note: You need to add your Steam API key to .env
      const STEAM_API_KEY = import.meta.env.VITE_STEAM_API_KEY || '';

      let profileData = {
        steamId,
        personaName: 'Steam User',
        profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
        avatarUrl: null as string | null,
      };

      if (STEAM_API_KEY) {
        const response = await fetch(
          `/api/steam/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
        );

        if (response.ok) {
          const data = await response.json();
          const player = data.response?.players?.[0];
          if (player) {
            profileData = {
              steamId,
              personaName: player.personaname,
              profileUrl: player.profileurl,
              avatarUrl: player.avatarfull,
            };
          }
        }
      }

      // Send success message to parent window
      window.opener?.postMessage({
        type: 'STEAM_LINKED',
        ...profileData,
      }, '*');

      // Close this popup window
      setTimeout(() => window.close(), 500);
    } catch (error) {
      console.error('Steam callback error:', error);
      window.opener?.postMessage({
        type: 'STEAM_ERROR',
        error: 'Failed to fetch Steam profile'
      }, '*');
      window.close();
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p className="text-muted-foreground">Connecting to Steam...</p>
    </div>
  );
}
