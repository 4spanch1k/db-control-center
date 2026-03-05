import AnalyticsDashboard from '@/components/AnalyticsDashboard/AnalyticsDashboard';

export const metadata = {
  title: 'Аналитика | DB Control Center',
  description: 'Метрики и история состояния базы данных',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard refreshInterval={60000} />;
}
