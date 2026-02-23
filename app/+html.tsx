import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        {/* Global error handler to catch errors before React mounts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onerror = function(msg, url, line, col, error) {
                var el = document.createElement('div');
                el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:99999;padding:40px;font-family:monospace;overflow:auto;';
                el.innerHTML = '<h2 style="color:red;">JavaScript Error</h2>' +
                  '<p><b>' + msg + '</b></p>' +
                  '<p>File: ' + url + '</p>' +
                  '<p>Line: ' + line + ', Col: ' + col + '</p>' +
                  '<pre style="white-space:pre-wrap;font-size:12px;color:#333;">' + (error && error.stack ? error.stack : 'No stack trace') + '</pre>';
                document.body.appendChild(el);
              };
              window.addEventListener('unhandledrejection', function(event) {
                console.warn('Unhandled promise rejection:', event.reason);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
