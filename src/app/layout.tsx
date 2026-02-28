import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNIZA Student",
  description: "Premium student portal for Žilinská univerzita",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UNIZA",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <head>
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
                      console.log('Unregistered stuck service worker in development mode.');
                    }
                  });
                }
              `,
            }}
          />
        )}

      </head>
      <body>
        <div id="app-wrapper">
          {children}
        </div>
        <GoogleAnalytics gaId="G-PBTXW0SJSY" />
      </body>
    </html>
  );
}
