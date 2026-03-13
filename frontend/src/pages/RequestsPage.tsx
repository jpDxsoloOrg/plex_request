import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequestCard } from '@/components/RequestCard';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { requests as requestsApi, issues as issuesApi } from '@/services/api';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import type { MediaRequest, MediaIssue, IssueStatus, DownloadStatus } from '@/types';
import { Search, InboxIcon, Trash2, Loader2, Film, Tv, AlertTriangle } from 'lucide-react';

const PAGE_SIZE = 10;
const DELETABLE_STATUSES = ['complete', 'completed', 'rejected'];

const ISSUE_STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  acknowledged: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  wrong_language: 'Wrong Language',
  corrupt: 'Corrupt File',
  missing_subtitles: 'Missing Subtitles',
  wrong_content: 'Wrong Content',
  other: 'Other',
};

export function RequestsPage() {
  const [items, setItems] = useState<MediaRequest[]>([]);
  const [myIssues, setMyIssues] = useState<MediaIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<string | null>(null);
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({});

  const fetchRequests = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    requestsApi
      .list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchIssues = useCallback((silent = false) => {
    if (!silent) setIssuesLoading(true);
    issuesApi
      .list()
      .then(setMyIssues)
      .catch(() => setMyIssues([]))
      .finally(() => setIssuesLoading(false));
  }, []);

  const fetchDownloadStatus = useCallback(() => {
    requestsApi
      .getDownloadStatus()
      .then((data) => setDownloadStatuses(data.statuses))
      .catch(() => {/* ignore */});
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchIssues();
    fetchDownloadStatus();
  }, [fetchRequests, fetchIssues, fetchDownloadStatus]);

  usePolling(() => { fetchRequests(true); fetchIssues(true); fetchDownloadStatus(); }, 15 * 1000);

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

  const handleDeleteIssue = async (issueId: string) => {
    setDeletingIssue(issueId);
    try {
      await issuesApi.delete(issueId);
      setMyIssues((prev) => prev.filter((i) => i.issueId !== issueId));
      toast.success('Issue deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete issue');
    } finally {
      setDeletingIssue(null);
    }
  };

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paged = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Tabs defaultValue="requests">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="requests">My Requests</TabsTrigger>
            <TabsTrigger value="issues">
              My Issues
              {myIssues.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{myIssues.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="requests" className="mt-4 space-y-3">
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
                    downloadStatus={downloadStatuses[req.requestId]}
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
        </TabsContent>

        <TabsContent value="issues" className="mt-4 space-y-3">
          {issuesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <RequestSkeleton key={i} />
              ))}
            </div>
          ) : myIssues.length > 0 ? (
            <div className="space-y-3">
              {myIssues.map((issue) => (
                <Card key={issue.issueId}>
                  <CardContent className="flex gap-4 p-4">
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {issue.posterPath ? (
                        <img src={issue.posterPath} alt={issue.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          {issue.mediaType === 'movie' ? <Film className="h-6 w-6" /> : <Tv className="h-6 w-6" />}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{issue.title}</h3>
                          <Badge variant="outline" className={ISSUE_STATUS_COLORS[issue.status]}>
                            {issue.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                          {issue.episodeNumber !== undefined && (
                            <span> &middot; S{issue.seasonNumber}E{issue.episodeNumber}</span>
                          )}
                        </p>
                        {issue.adminNote && (
                          <p className="mt-1 text-sm text-muted-foreground">Admin: {issue.adminNote}</p>
                        )}
                      </div>
                    </div>
                    {issue.status === 'open' && (
                      <div className="flex shrink-0 items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                          onClick={() => handleDeleteIssue(issue.issueId)}
                          disabled={deletingIssue === issue.issueId}
                        >
                          {deletingIssue === issue.issueId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
              <AlertTriangle className="h-12 w-12" />
              <p>No reported issues.</p>
              <Button asChild variant="outline">
                <Link to="/report-issue">Report an Issue</Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
