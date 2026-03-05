import type { Metadata } from "next";
import "./globals.css";
import styles from "./layout.module.css";
import { I18nProvider } from "@/i18n";

export const metadata: Metadata = {
  title: "DB Control Center",
  description: "Платформа управления бэкапами и аналитикой БД",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
