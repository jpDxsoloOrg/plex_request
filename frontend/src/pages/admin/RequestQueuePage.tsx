import { useCallback, useEffect, useState } from 'react';
import { RequestCard } from '@/components/RequestCard';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { admin } from '@/services/api';
import type { MediaRequest, RequestStatus } from '@/types';
import { InboxIcon } from 'lucide-react';

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'downloading', label: 'Downloading' },
  { value: 'complete', label: 'Complete' },
  { value: 'rejected', label: 'Rejected' },
];

export function RequestQueuePage() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState<MediaRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async (status?: RequestStatus) => {
    try {
      const data = await admin.requests.list(status);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    const status = tab === 'all' ? undefined : (tab as RequestStatus);
    fetchRequests(status);
  }, [tab, fetchRequests]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Request Queue</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <RequestSkeleton key={i} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((req) => (
            <RequestCard key={req.requestId} request={req} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <InboxIcon className="h-12 w-12" />
          <p>No requests found.</p>
        </div>
      )}
    </div>
  );
}
