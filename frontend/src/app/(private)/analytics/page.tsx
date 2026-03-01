import AnalyticsDashboard from '@/components/AnalyticsDashboard/AnalyticsDashboard';

export const metadata = {
  title: 'Аналитический дашборд | DB Control Center',
  description: 'Мониторинг состояния БД и управление бэкапами',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard refreshInterval={60000} />;
}
