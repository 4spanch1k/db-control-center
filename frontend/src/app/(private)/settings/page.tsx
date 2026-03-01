import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card/Card";
import styles from "@/app/(private)/dashboard/dashboard.module.css";

export const metadata = {
    title: "Настройки | DB Control Center",
    description: "Настройки DB Control Center",
};

export default function SettingsPage() {
    return (
        <main className={styles.main}>
            <h1 className={styles.title}>Настройки</h1>
            <div className={styles.actions}>
                <Card>
                    <CardHeader>
                        <CardTitle>Общие настройки</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={styles.serverName}>Настройки скоро появятся в будущих обновлениях.</p>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
