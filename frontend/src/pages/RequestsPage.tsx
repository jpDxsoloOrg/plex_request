import { useEffect, useState } from 'react';
import { RequestCard } from '@/components/RequestCard';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { requests as requestsApi } from '@/services/api';
import type { MediaRequest } from '@/types';
import { InboxIcon } from 'lucide-react';

export function RequestsPage() {
  const [items, setItems] = useState<MediaRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">My Requests</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
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
          <p>You haven&apos;t made any requests yet.</p>
        </div>
      )}
    </div>
  );
}
