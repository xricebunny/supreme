"use client";

import { MagicProvider } from "@/contexts/MagicProvider";
import { AuthProvider } from "@/contexts/AuthProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MagicProvider>
      <AuthProvider>{children}</AuthProvider>
    </MagicProvider>
  );
}
