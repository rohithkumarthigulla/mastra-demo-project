import { useEffect, useState } from 'react';
import { Image, Platform, View, type ImageStyle, type StyleProp } from 'react-native';
import { useSession } from '../auth';
import { useTheme } from '../theme';

interface AuthImageProps {
  /** API-relative photo path, e.g. `/equipment-listings/:id/media/:mediaId`. */
  path: string;
  /**
   * Send the signed-in user's access token. Required for photos on draft or
   * inactive listings, which only their owner may see.
   */
  authenticated?: boolean;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export function AuthImage({
  path,
  authenticated = false,
  style,
  accessibilityLabel,
}: AuthImageProps) {
  const { api } = useSession();
  const theme = useTheme();
  const url = `${api.baseUrl}${path}`;
  const [token, setToken] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      const accessToken = await api.accessToken();
      if (cancelled || !accessToken) return;
      if (Platform.OS !== 'web') {
        setToken(accessToken);
        return;
      }
      // Browsers cannot attach headers to <img> requests, so fetch the bytes ourselves.
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (cancelled || !response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (cancelled) URL.revokeObjectURL(objectUrl);
      else setBlobUrl(objectUrl);
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, url, authenticated]);

  const source = !authenticated
    ? { uri: url }
    : blobUrl
      ? { uri: blobUrl }
      : token
        ? { uri: url, headers: { Authorization: `Bearer ${token}` } }
        : null;

  if (!source) return <View style={[{ backgroundColor: theme.colors.border }, style]} />;
  return (
    <Image
      source={source}
      style={[{ backgroundColor: theme.colors.border }, style]}
      resizeMode="cover"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
