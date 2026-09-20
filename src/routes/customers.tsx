import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell, RequireAuth } from "@/components/app-shell";

// The customer list is an index route; details render in this shared outlet.
export const Route = createFileRoute("/customers")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  ),
});
