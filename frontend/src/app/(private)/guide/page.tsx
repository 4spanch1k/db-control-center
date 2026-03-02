import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card/Card";
import styles from "./page.module.css";

const steps = [
  {
    title: "1. Подключите инфраструктуру",
    text: "Перейдите в настройки, заполните мастер подключения и нажмите «Проверить и сохранить».",
    href: "/settings",
    action: "Открыть настройки",
  },
  {
    title: "2. Сделайте первый бэкап",
    text: "На дашборде нажмите «Сделать бэкап», затем проверьте запись в истории.",
    href: "/dashboard",
    action: "Открыть дашборд",
  },
  {
    title: "3. Проверьте восстановление",
    text: "В истории выберите бэкап, пройдите шаги проверки и подтвердите имя файла перед запуском восстановления.",
    href: "/dashboard#history",
    action: "Открыть историю",
  },
  {
    title: "4. Настройте тариф",
    text: "На странице тарифа выберите Free/Pro/Max под ваш режим нагрузки и команду.",
    href: "/billing",
    action: "Открыть тарифы",
  },
];

export default function GuidePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Как пользоваться DB Control Center</h1>
      <p className={styles.subtitle}>
        Короткий гайд для новых пользователей: 5 минут и сервис готов к рабочему использованию.
      </p>

      <section className={styles.grid}>
        {steps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={styles.text}>{step.text}</p>
              <Link href={step.href} className={styles.actionLink}>
                {step.action}
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className={styles.faqList}>
            <li>
              <strong>Почему действие не запускается?</strong>:
              Скорее всего исчерпан лимит тарифа за день. Проверяйте блок «Лимиты тарифа» на дашборде.
            </li>
            <li>
              <strong>Как убрать лимиты?</strong>:
              Переключитесь на тариф Max в разделе «Тариф».
            </li>
            <li>
              <strong>Где смотреть историю операций?</strong>:
              На дашборде в таблице истории бэкапов.
            </li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
