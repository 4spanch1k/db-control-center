import Sidebar from "@/components/Sidebar/Sidebar";
import styles from "./private-layout.module.css";

export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
