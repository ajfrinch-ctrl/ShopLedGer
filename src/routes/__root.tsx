import { ClientOnly, createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { useShop } from "@/lib/store";
import appCss from "../styles.css?url";

const APP_NAME = "স্টক রেজিস্টার";
const APP_DESCRIPTION = "স্টক রেজিস্টার — দোকানের হিসাব";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function InstallPrompt() {
  const user = useShop((state) => state.user);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const installPrompt = event as BeforeInstallPromptEvent;
      setInstallEvent(installPrompt);
      if (useShop.getState().user && localStorage.getItem("stock-register-install-dismissed") !== "1") setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);
  useEffect(() => {
    if (user && installEvent && localStorage.getItem("stock-register-install-dismissed") !== "1") setVisible(true);
  }, [user, installEvent]);
  if (!visible || !installEvent) return null;
  const dismiss = () => { localStorage.setItem("stock-register-install-dismissed", "1"); setVisible(false); };
  return <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-line bg-card p-4 shadow-card" role="dialog" aria-label="অ্যাপ ইনস্টল করুন">
    <h2 className="font-bold text-heading">অ্যাপ ইনস্টল করুন</h2>
    <p className="my-2 text-body text-muted">আপনার ডিভাইসে অ্যাপটি ইনস্টল করতে চান?</p>
    <div className="flex gap-2"><button className="flex-1 rounded-md bg-primary py-2.5 font-bold text-card" onClick={async () => { await installEvent.prompt(); dismiss(); }}>ইনস্টল করুন</button><button className="flex-1 rounded-md border border-line py-2.5 font-bold" onClick={dismiss}>বাতিল</button></div>
  </div>;
}

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
      { property: "og:image", content: `${import.meta.env.BASE_URL}og.jpg` },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: `${import.meta.env.BASE_URL}icon-192.png?v=2`,
      },
      { rel: "icon", type: "image/svg+xml", href: `${import.meta.env.BASE_URL}favicon.svg` },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: `${import.meta.env.BASE_URL}manifest.webmanifest?v=2` },
      { rel: "apple-touch-icon", href: `${import.meta.env.BASE_URL}icon-180.png?v=2` },
    ],
  }),
  component: () => (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* All pages use browser-local state; keep the static shell hydration stable. */}
        <ClientOnly fallback={null}>
          <><Outlet /><InstallPrompt /></>
        </ClientOnly>
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
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              lineHeight: "var(--text-body--line-height)",
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
