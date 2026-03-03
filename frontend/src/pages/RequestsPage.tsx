import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequestCard } from '@/components/RequestCard';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { requests as requestsApi } from '@/services/api';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import type { MediaRequest } from '@/types';
import { Search, InboxIcon, Trash2, Loader2 } from 'lucide-react';

const PAGE_SIZE = 10;
const DELETABLE_STATUSES = ['complete', 'completed', 'rejected'];

export function RequestsPage() {
  const [items, setItems] = useState<MediaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    requestsApi
      .list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  usePolling(fetchRequests, 5 * 60 * 1000);

  const handleDelete = async (requestId: string) => {
    setDeleting(requestId);
    try {
      await requestsApi.delete(requestId);
      setItems((prev) => prev.filter((r) => r.requestId !== requestId));
      toast.success('Request deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete request');
    } finally {
      setDeleting(null);
    }
  };

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paged = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page]
  );

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
        <>
          <div className="space-y-3">
            {paged.map((req) => (
              <RequestCard
                key={req.requestId}
                request={req}
                actions={
                  DELETABLE_STATUSES.includes(req.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => handleDelete(req.requestId)}
                      disabled={deleting === req.requestId}
                    >
                      {deleting === req.requestId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
          <InboxIcon className="h-12 w-12" />
          <p>No requests yet — search for something to watch!</p>
          <Button asChild variant="outline">
            <Link to="/search">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
