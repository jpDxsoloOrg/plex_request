import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { admin } from '@/services/api';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import type { MediaRequest, RequestStatus, DownloadStatus } from '@/types';
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
  Trash2,
} from 'lucide-react';

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'downloading', label: 'Downloading' },
  { value: 'complete', label: 'Complete' },
  { value: 'rejected', label: 'Rejected' },
];

const DL_STATE_LABELS: Record<string, string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  importing: 'Importing...',
  completed: 'Downloaded',
  failed: 'Failed',
  warning: 'Warning',
  pending: 'Waiting...',
};

function RequestRow({
  request,
  downloadStatus,
  onStatusChange,
}: {
  request: MediaRequest;
  downloadStatus?: DownloadStatus;
  onStatusChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adminNote, setAdminNote] = useState(request.adminNote ?? '');
  const [updating, setUpdating] = useState<RequestStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await admin.requests.delete(request.requestId);
      toast.success('Request deleted');
      onStatusChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
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
                {request.year} &middot; {request.mediaType === 'movie' ? 'Movie' : 'TV'}
                {request.mediaType === 'tv' && (
                  <span>
                    {' '}&middot;{' '}
                    {request.seasons
                      ? `S${request.seasons.join(', S')}`
                      : 'All Seasons'}
                  </span>
                )}
                {' '}&middot; {request.userName} &middot; {date}
              </p>
            </div>
            {downloadStatus && (request.status === 'approved' || request.status === 'downloading') && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Progress value={downloadStatus.percentComplete} className="h-1.5 flex-1 max-w-48" />
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {downloadStatus.percentComplete}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {DL_STATE_LABELS[downloadStatus.downloadState] ?? downloadStatus.downloadState}
                </p>
              </div>
            )}
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
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={handleDelete}
              disabled={isDeleting || updating !== null}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
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

const PAGE_SIZE = 15;

export function RequestQueuePage() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState<MediaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({});

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

  const fetchDownloadStatus = useCallback(() => {
    admin.requests
      .getDownloadStatus()
      .then((data) => setDownloadStatuses(data.statuses))
      .catch(() => {/* ignore */});
  }, []);

  const reload = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const status = tab === 'all' ? undefined : (tab as RequestStatus);
    fetchRequests(status);
    fetchDownloadStatus();
  }, [tab, fetchRequests, fetchDownloadStatus]);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setPage(1);
    const status = tab === 'all' ? undefined : (tab as RequestStatus);
    fetchRequests(status);
    fetchDownloadStatus();
  }, [tab, fetchRequests, fetchDownloadStatus]);

  usePolling(() => reload(true), 15 * 1000);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paged = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page]
  );

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
        <>
          <div className="space-y-3">
            {paged.map((req) => (
              <RequestRow key={req.requestId} request={req} downloadStatus={downloadStatuses[req.requestId]} onStatusChange={reload} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <InboxIcon className="h-12 w-12" />
          <p>No requests found.</p>
        </div>
      )}
    </div>
  );
}
