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
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Phone Demo Frame Styles */
              #phone-demo-page {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #5a3977 0%, #1a0a30 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                overflow: hidden;
              }

              #phone-branding {
                text-align: center;
                margin-bottom: 24px;
                user-select: none;
              }
              #phone-branding h1 {
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 22px;
                font-weight: 700;
                margin: 0 0 4px 0;
                letter-spacing: 0.5px;
              }
              #phone-branding p {
                color: rgba(255, 255, 255, 0.5);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                font-weight: 400;
                margin: 0;
                letter-spacing: 0.3px;
              }

              #phone-frame {
                position: relative;
                width: 375px;
                height: 812px;
                background: #000000;
                border-radius: 50px;
                padding: 12px;
                box-shadow:
                  0 0 0 2px #1a1a1a,
                  0 0 0 4px #333333,
                  0 20px 60px rgba(0, 0, 0, 0.5),
                  0 0 80px rgba(90, 57, 119, 0.3);
                flex-shrink: 0;
              }

              /* Side buttons - volume */
              #phone-frame::before {
                content: '';
                position: absolute;
                left: -3px;
                top: 140px;
                width: 3px;
                height: 32px;
                background: #333333;
                border-radius: 2px 0 0 2px;
                box-shadow:
                  0 40px 0 0 #333333,
                  0 40px 0 0 #333333;
              }

              /* Side button - power */
              #phone-frame::after {
                content: '';
                position: absolute;
                right: -3px;
                top: 180px;
                width: 3px;
                height: 60px;
                background: #333333;
                border-radius: 0 2px 2px 0;
              }

              #phone-notch {
                position: absolute;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                width: 160px;
                height: 30px;
                background: #000000;
                border-radius: 0 0 20px 20px;
                z-index: 10;
              }

              /* Camera dot */
              #phone-notch::before {
                content: '';
                position: absolute;
                right: 40px;
                top: 8px;
                width: 12px;
                height: 12px;
                background: #111111;
                border-radius: 50%;
                border: 2px solid #1a1a1a;
              }

              /* Speaker grille */
              #phone-notch::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 10px;
                transform: translateX(-50%);
                width: 40px;
                height: 6px;
                background: #111111;
                border-radius: 3px;
              }

              #phone-screen {
                width: 100%;
                height: 100%;
                border-radius: 38px;
                overflow: hidden;
                background: #ffffff;
                position: relative;
              }

              #phone-screen > #root {
                height: 100% !important;
                width: 100% !important;
              }

              #phone-home-indicator {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: 134px;
                height: 5px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                z-index: 10;
              }

              #phone-caption {
                text-align: center;
                margin-top: 20px;
                user-select: none;
              }
              #phone-caption p {
                color: rgba(255, 255, 255, 0.35);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                margin: 0;
              }

              /* Responsive: medium height screens */
              @media screen and (min-width: 501px) and (max-height: 950px) and (min-height: 800px) {
                #phone-frame {
                  transform: scale(0.85);
                }
                #phone-branding {
                  margin-bottom: 12px;
                }
                #phone-branding h1 {
                  font-size: 20px;
                }
                #phone-caption {
                  margin-top: 12px;
                }
              }

              /* Responsive: short screens */
              @media screen and (min-width: 501px) and (max-height: 799px) and (min-height: 701px) {
                #phone-frame {
                  transform: scale(0.75);
                }
                #phone-branding {
                  margin-bottom: 8px;
                }
                #phone-branding h1 {
                  font-size: 18px;
                }
                #phone-caption {
                  margin-top: 8px;
                }
              }

              /* Responsive: mobile / very small screens — hide frame, full-screen app */
              @media screen and (max-width: 500px), screen and (max-height: 700px) {
                #phone-demo-page {
                  display: contents;
                }
                #phone-branding,
                #phone-notch,
                #phone-home-indicator,
                #phone-caption {
                  display: none;
                }
                #phone-frame {
                  display: contents;
                }
                #phone-screen {
                  border-radius: 0;
                  width: 100vw;
                  height: 100vh;
                }
              }
            `,
          }}
        />
      </head>
      <body>
        <div id="phone-demo-page">
          <div id="phone-branding">
            <h1>America&#39;s Main Street Party</h1>
            <p>App Demo Preview</p>
          </div>
          <div id="phone-frame">
            <div id="phone-notch" />
            <div id="phone-screen">
              {children}
            </div>
            <div id="phone-home-indicator" />
          </div>
          <div id="phone-caption">
            <p>Best viewed on a mobile device</p>
          </div>
        </div>
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
