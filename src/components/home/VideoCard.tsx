import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Text } from 'react-native-paper';

import { Card } from '@/components/ui';

const VIMEO_EMBED_ID = '1184918235';
const VIMEO_EMBED_URL = `https://player.vimeo.com/video/${VIMEO_EMBED_ID}?title=0&byline=0&portrait=0`;

// Lazy-load WebView only on native to avoid web bundle issues
const WebView = Platform.OS !== 'web'
  ? require('react-native-webview').default
  : null;

export default function VideoCard() {
  // On web, embed the Vimeo player inline via iframe
  if (Platform.OS === 'web') {
    return (
      <Card style={styles.card}>
        <View style={styles.embedContainer}>
          <iframe
            src={VIMEO_EMBED_URL}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' } as any}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </View>
        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.title}>
            A Brand New Way
          </Text>
        </View>
      </Card>
    );
  }

  // On native, embed the Vimeo player via WebView using HTML to avoid ATS/SSL issues
  const htmlContent = `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>*{margin:0;padding:0}body{background:#000}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}</style>
    </head><body>
      <iframe src="${VIMEO_EMBED_URL}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
    </body></html>
  `;

  return (
    <Card style={styles.card}>
      <View style={styles.embedContainer}>
        <WebView
          source={{ html: htmlContent }}
          style={StyleSheet.absoluteFill}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          scrollEnabled={false}
        />
      </View>
      <View style={styles.info}>
        <Text variant="titleMedium" style={styles.title}>
          A Brand New Way
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  embedContainer: {
    aspectRatio: 16 / 9,
    position: 'relative' as const,
    margin: 4,
    marginBottom: 0,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  info: {
    padding: 16,
    paddingTop: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
});
