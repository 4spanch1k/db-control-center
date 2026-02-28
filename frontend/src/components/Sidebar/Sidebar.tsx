"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart, Database, History, Settings, PanelLeftClose, PanelLeftOpen, LogIn, UserPlus, type LucideIcon } from "lucide-react";
import styles from "./Sidebar.module.css";

type MenuItem = { label: string; href: string; icon: LucideIcon; };
const menuItems: MenuItem[] = [
    { label: "Управление БД", href: "/", icon: Database },
    { label: "Аналитика", href: "/analytics", icon: BarChart },
    { label: "История бэкапов", href: "/#history", icon: History },
    { label: "Настройки", href: "/settings", icon: Settings },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
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
                        const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
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
                    <Link href="/login" className={styles.navItem} title={collapsed ? "Вход" : undefined}>
                        <LogIn className={styles.icon} size={18} />
                        <span className={styles.label}>Вход</span>
                    </Link>
                    <Link href="/register" className={styles.navItem} title={collapsed ? "Регистрация" : undefined}>
                        <UserPlus className={styles.icon} size={18} />
                        <span className={styles.label}>Регистрация</span>
                    </Link>
                </div>
                <button type="button" className={styles.toggleButton} onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Развернуть боковое меню" : "Свернуть боковое меню"} title={collapsed ? "Развернуть" : "Свернуть"}>
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>
        </aside>
    );
}
