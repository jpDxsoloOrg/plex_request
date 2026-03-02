import { useEffect, useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { RequestCard } from '@/components/RequestCard';
import { StatSkeleton, RequestSkeleton } from '@/components/LoadingSkeleton';
import { admin } from '@/services/api';
import type { DashboardStats } from '@/types';
import { Clock, CheckCircle, Download, XCircle, BarChart3 } from 'lucide-react';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.requests
      .stats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <RequestSkeleton key={i} />
            ))}
          </div>
        </>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Pending" value={stats.counts.requested} icon={Clock} />
            <StatCard label="Approved" value={stats.counts.approved} icon={CheckCircle} />
            <StatCard label="Downloading" value={stats.counts.downloading} icon={Download} />
            <StatCard label="Complete" value={stats.counts.complete} icon={BarChart3} />
          </div>

          {stats.counts.rejected > 0 && (
            <StatCard label="Rejected" value={stats.counts.rejected} icon={XCircle} />
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Pending Requests</h2>
            {stats.recentPending.length > 0 ? (
              <div className="space-y-3">
                {stats.recentPending.map((req) => (
                  <RequestCard key={req.requestId} request={req} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No pending requests.</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Failed to load dashboard data.</p>
      )}
    </div>
  );
}
