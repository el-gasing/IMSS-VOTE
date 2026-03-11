import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { TabSessionGuard } from "@/components/tab-session-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMSS Voting",
  description: "Website voting IMSS dengan SSO UI"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>
          <TabSessionGuard />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
