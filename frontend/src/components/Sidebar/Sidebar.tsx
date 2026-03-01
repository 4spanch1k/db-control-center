"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart, Database, History, Settings, PanelLeftClose, PanelLeftOpen, LogOut, Home, type LucideIcon } from "lucide-react";
import styles from "./Sidebar.module.css";

type MenuItem = { label: string; href: string; icon: LucideIcon; };
const menuItems: MenuItem[] = [
    { label: "Управление БД", href: "/dashboard", icon: Database },
    { label: "Аналитика", href: "/analytics", icon: BarChart },
    { label: "История бэкапов", href: "/dashboard#history", icon: History },
    { label: "Настройки", href: "/settings", icon: Settings },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        } finally {
            setIsLoggingOut(false);
            router.push("/");
            router.refresh();
        }
    };

    return (
        <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
            <div className={styles.top}>
                <div className={styles.brand} title="DB Control Center">
                    <span className={styles.brandIcon}><Database size={18} /></span>
                    <span className={styles.brandLabel}>DB Control Center</span>
                </div>
                <nav className={styles.nav} aria-label="Основная навигация">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(item.href);
                        return (
                            <Link key={item.label} href={item.href} className={`${styles.navItem} ${isActive ? styles.active : ""}`} title={collapsed ? item.label : undefined}>
                                <Icon className={styles.icon} size={18} />
                                <span className={styles.label}>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div className={styles.bottom}>
                <div className={styles.authGroup}>
                    <Link href="/" className={styles.navItem} title={collapsed ? "На главную" : undefined}>
                        <Home className={styles.icon} size={18} />
                        <span className={styles.label}>На главную</span>
                    </Link>
                    <button
                        type="button"
                        className={`${styles.navItem} ${styles.logoutButton}`}
                        title={collapsed ? "Выход" : undefined}
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                    >
                        <LogOut className={styles.icon} size={18} />
                        <span className={styles.label}>{isLoggingOut ? "Выходим..." : "Выход"}</span>
                    </button>
                </div>
                <button type="button" className={styles.toggleButton} onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Развернуть боковое меню" : "Свернуть боковое меню"} title={collapsed ? "Развернуть" : "Свернуть"}>
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>
        </aside>
    );
}
