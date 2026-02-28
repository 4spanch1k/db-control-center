import type { Metadata } from "next";
import "./globals.css";
import styles from "./layout.module.css";
import Sidebar from "@/components/Sidebar/Sidebar";

export const metadata: Metadata = { title: "DB Control Center", description: "DB Control Center dashboard" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="ru">
      <body className={styles.body}>
        <div className={styles.shell}>
          <Sidebar />
          <main className={styles.main}>{children}</main>
        </div>
      </body>
    </html>
  );
}
