import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { admin } from '@/services/api';
import { toast } from 'sonner';
import type { MediaRequest, RequestStatus } from '@/types';
import {
  Film,
  Tv,
  CheckCircle,
  XCircle,
  Download,
  InboxIcon,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'downloading', label: 'Downloading' },
  { value: 'complete', label: 'Complete' },
  { value: 'rejected', label: 'Rejected' },
];

function RequestRow({
  request,
  onStatusChange,
}: {
  request: MediaRequest;
  onStatusChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adminNote, setAdminNote] = useState(request.adminNote ?? '');
  const [updating, setUpdating] = useState<RequestStatus | null>(null);

  const updateStatus = async (status: RequestStatus) => {
    setUpdating(status);
    try {
      await admin.requests.updateStatus(request.requestId, status, adminNote || undefined);
      toast.success(`Request ${status}`);
      onStatusChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const date = new Date(request.requestedAt).toLocaleDateString();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
            {request.posterPath ? (
              <img
                src={request.posterPath}
                alt={request.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {request.mediaType === 'movie' ? (
                  <Film className="h-6 w-6" />
                ) : (
                  <Tv className="h-6 w-6" />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{request.title}</h3>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {request.year} &middot; {request.mediaType === 'movie' ? 'Movie' : 'TV'} &middot;{' '}
                {request.userName} &middot; {date}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {request.status === 'requested' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-400 hover:bg-green-500/10"
                  onClick={() => updateStatus('approved')}
                  disabled={updating !== null}
                >
                  {updating === 'approved' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-400 hover:bg-red-500/10"
                  onClick={() => updateStatus('rejected')}
                  disabled={updating !== null}
                >
                  {updating === 'rejected' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
            {request.status === 'approved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus('downloading')}
                disabled={updating !== null}
              >
                {updating === 'downloading' ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Downloading
              </Button>
            )}
            {request.status === 'downloading' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus('complete')}
                disabled={updating !== null}
              >
                {updating === 'complete' ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1 h-4 w-4" />
                )}
                Complete
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 border-t border-border pt-3">
            <label className="mb-1 block text-xs text-muted-foreground">Admin Note</label>
            <Input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Add a note for this request..."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

  const reload = useCallback(() => {
    setLoading(true);
    const status = tab === 'all' ? undefined : (tab as RequestStatus);
    fetchRequests(status);
  }, [tab, fetchRequests]);

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
            <RequestRow key={req.requestId} request={req} onStatusChange={reload} />
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
