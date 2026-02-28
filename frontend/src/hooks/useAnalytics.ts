import { useState, useEffect } from 'react';
import { DashboardSummary, AnalyticsDelta, AnalyticRecord } from '@/lib/types';

export function useAnalytics(refreshInterval = 60000) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [delta, setDelta] = useState<AnalyticsDelta | null>(null);
    const [recentData, setRecentData] = useState<AnalyticRecord[]>([]);

    const fetchData = async () => {
        try {
            setError(null);
            setLoading(true);

            const [summaryRes, deltaRes, recentRes] = await Promise.all([
                fetch('/api/analytics/summary'),
                fetch('/api/analytics/delta'),
                fetch('/api/analytics/recent'),
            ]);

            const errors = [];

            if (!summaryRes.ok) errors.push('Ошибка загрузки итогов');
            else {
                const data = await summaryRes.json();
                setSummary(data.data);
            }

            if (!deltaRes.ok) errors.push('Ошибка загрузки дельты');
            else {
                const data = await deltaRes.json();
                setDelta(data.data);
            }

            if (!recentRes.ok) errors.push('Ошибка загрузки истории');
            else {
                const data = await recentRes.json();
                setRecentData(data.data || []);
            }

            if (errors.length > 0) setError(errors.join(', '));
        } catch (err) {
            setError(`Ошибка подключения: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval]);

    return { loading, error, summary, delta, recentData, refetch: fetchData };
}
