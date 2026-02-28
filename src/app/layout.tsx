import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

const GA_ID = "G-PBTXW0SJSY";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || "";

  return (
    <html lang="sk" className={inter.variable}>
      <head>
        {process.env.NODE_ENV === "development" && (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
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
        {/* Google Analytics with nonce for CSP compliance */}
        <script
          nonce={nonce}
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                page_path: window.location.pathname,
                anonymize_ip: true,
                cookie_flags: 'SameSite=Strict;Secure'
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
