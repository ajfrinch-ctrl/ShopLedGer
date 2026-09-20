import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "কর্ণফুলী সেলস সেন্টার";
const APP_DESCRIPTION = "কর্ণফুলী সেলস সেন্টার — গবাদি পশুর খাদ্য সরবরাহ ও দোকানের হিসাব";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#04795a" },
      { name: "description", content: APP_DESCRIPTION },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:image", content: "/og.jpg" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        {/* টোস্ট ফিক্সড টপবারের নিচে নামে (`--topbar-h` top-bar.tsx বসায়); টপবার না থাকলে (লগইন) সাধারণ অফসেট */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          offset={{
            top: "calc(var(--topbar-h, 16px) + 8px)",
            right: "24px",
            bottom: "24px",
            left: "24px",
          }}
          mobileOffset={{
            top: "calc(var(--topbar-h, 8px) + 8px)",
            right: "16px",
            bottom: "16px",
            left: "16px",
          }}
          style={{ fontFamily: "var(--font-sans)" }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
