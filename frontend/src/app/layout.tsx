import type { Metadata } from "next";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "DB Control Center",
  description: "Платформа управления бэкапами и аналитикой БД",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="ru">
      <body className={styles.body}>{children}</body>
    </html>
  );
}
