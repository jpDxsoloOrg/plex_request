import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequestSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { admin } from '@/services/api';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import type { MediaIssue, IssueStatus } from '@/types';
import {
  Film,
  Tv,
  CheckCircle,
  Eye,
  InboxIcon,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

const ISSUE_TYPE_LABELS: Record<string, string> = {
  wrong_language: 'Wrong Language',
  corrupt: 'Corrupt File',
  missing_subtitles: 'Missing Subtitles',
  wrong_content: 'Wrong Content',
  other: 'Other',
};

const STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  acknowledged: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
};

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

function IssueRow({
  issue,
  onStatusChange,
}: {
  issue: MediaIssue;
  onStatusChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adminNote, setAdminNote] = useState(issue.adminNote ?? '');
  const [updating, setUpdating] = useState<IssueStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateStatus = async (status: IssueStatus) => {
    setUpdating(status);
    try {
      await admin.issues.updateStatus(issue.issueId, status, adminNote || undefined);
      toast.success(`Issue ${status}`);
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
      await admin.issues.delete(issue.issueId);
      toast.success('Issue deleted');
      onStatusChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const date = new Date(issue.reportedAt).toLocaleDateString();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
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
                <Badge variant="outline" className={STATUS_COLORS[issue.status]}>
                  {issue.status}
                </Badge>
                <Badge variant="secondary">{ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {issue.year} &middot; {issue.mediaType === 'movie' ? 'Movie' : 'TV'}
                {issue.episodeNumber !== undefined && (
                  <span> &middot; S{issue.seasonNumber}E{issue.episodeNumber}</span>
                )}
                {' '}&middot; {issue.userName} &middot; {date}
              </p>
              {issue.description && (
                <p className="mt-1 text-sm text-muted-foreground">&ldquo;{issue.description}&rdquo;</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {issue.status === 'open' && (
              <Button
                size="sm"
                variant="outline"
                className="text-blue-400 hover:bg-blue-500/10"
                onClick={() => updateStatus('acknowledged')}
                disabled={updating !== null}
              >
                {updating === 'acknowledged' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
            {(issue.status === 'open' || issue.status === 'acknowledged') && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-400 hover:bg-green-500/10"
                onClick={() => updateStatus('resolved')}
                disabled={updating !== null}
              >
                {updating === 'resolved' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={handleDelete}
              disabled={isDeleting || updating !== null}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
              placeholder="Add a note for this issue..."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 15;

export function IssueQueuePage() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState<MediaIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchIssues = useCallback(async (status?: IssueStatus) => {
    try {
      const data = await admin.issues.list(status);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    const status = tab === 'all' ? undefined : (tab as IssueStatus);
    fetchIssues(status);
  }, [tab, fetchIssues]);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setPage(1);
    const status = tab === 'all' ? undefined : (tab as IssueStatus);
    fetchIssues(status);
  }, [tab, fetchIssues]);

  usePolling(reload, 5 * 60 * 1000);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paged = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Issue Queue</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
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
            {paged.map((issue) => (
              <IssueRow key={issue.issueId} issue={issue} onStatusChange={reload} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <InboxIcon className="h-12 w-12" />
          <p>No issues found.</p>
        </div>
      )}
    </div>
  );
}
