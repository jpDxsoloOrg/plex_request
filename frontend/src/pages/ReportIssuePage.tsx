import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { library as libraryApi, issues as issuesApi } from '@/services/api';
import { toast } from 'sonner';
import type { LibraryItem, EpisodeInfo, IssueType } from '@/types';
import {
  Search,
  Film,
  Tv,
  AlertTriangle,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  wrong_language: 'Wrong Language',
  corrupt: 'Corrupt File',
  missing_subtitles: 'Missing Subtitles',
  wrong_content: 'Wrong Content',
  other: 'Other',
};

const PAGE_SIZE = 20;

type Step = 'browse' | 'select-episode' | 'details' | 'done';

export function ReportIssuePage() {
  const [step, setStep] = useState<Step>('browse');

  // Library browsing state
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [page, setPage] = useState(0);

  // Selection state
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeInfo | null>(null);

  // Issue details
  const [issueType, setIssueType] = useState<IssueType | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch library
  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const params: { mediaType?: 'movie' | 'tv'; search?: string } = {};
      if (mediaFilter !== 'all') params.mediaType = mediaFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const data = await libraryApi.list(params);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load library');
    } finally {
      setLoading(false);
    }
  }, [mediaFilter, debouncedSearch]);

  useEffect(() => {
    if (step === 'browse') {
      fetchLibrary();
    }
  }, [fetchLibrary, step]);

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSelectItem = async (item: LibraryItem) => {
    setSelectedItem(item);
    if (item.mediaType === 'tv' && item.tvdbId) {
      setLoadingEpisodes(true);
      try {
        const eps = await issuesApi.episodes(item.tvdbId);
        setEpisodes(eps);
        setStep('select-episode');
      } catch {
        toast.error('Could not load episodes. You can still report an issue for the whole series.');
        setStep('details');
      } finally {
        setLoadingEpisodes(false);
      }
    } else {
      setStep('details');
    }
  };

  const seasons = [...new Set(episodes.map((e) => e.seasonNumber))].sort((a, b) => a - b);
  const filteredEpisodes = selectedSeason !== null
    ? episodes.filter((e) => e.seasonNumber === selectedSeason)
    : [];

  const handleSubmit = async () => {
    if (!selectedItem || !issueType) return;
    if (issueType === 'other' && !description.trim()) {
      toast.error('Please describe the issue');
      return;
    }
    setSubmitting(true);
    try {
      await issuesApi.create({
        mediaType: selectedItem.mediaType,
        tmdbId: selectedItem.tmdbId ?? selectedItem.tvdbId ?? 0,
        title: selectedItem.title,
        year: String(selectedItem.year),
        posterPath: '',
        ...(selectedEpisode ? {
          seasonNumber: selectedEpisode.seasonNumber,
          episodeNumber: selectedEpisode.episodeNumber,
          episodeTitle: selectedEpisode.title,
        } : {}),
        issueType,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success('Issue reported successfully');
      setStep('done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to report issue');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('browse');
    setSelectedItem(null);
    setEpisodes([]);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setIssueType('');
    setDescription('');
  };

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Report an Issue</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Check className="h-12 w-12 text-green-400" />
          <p className="text-lg font-medium">Issue reported</p>
          <p className="text-muted-foreground">We'll look into it and update you.</p>
          <Button onClick={reset} variant="outline">Report Another Issue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Report an Issue</h1>

      {/* Step 1: Browse library */}
      {step === 'browse' && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              value={mediaFilter}
              onValueChange={(v) => { setMediaFilter(v as 'all' | 'movie' | 'tv'); setPage(0); }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="movie">Movies</SelectItem>
                <SelectItem value="tv">TV Shows</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pagedItems.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              {searchTerm ? 'No items match your filter.' : 'Library is empty. Wait for the next sync.'}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {total} item{total !== 1 ? 's' : ''} in library
                {totalPages > 1 && ` \u2022 Page ${page + 1} of ${totalPages}`}
              </p>

              <div className="space-y-1">
                {pagedItems.map((item) => (
                  <button
                    key={item.pk}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                    onClick={() => handleSelectItem(item)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      {item.mediaType === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.year} &middot; {item.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                      </p>
                    </div>
                    {item.mediaType === 'movie' && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        item.hasFile ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.hasFile ? 'Available' : 'Monitored'}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}

          {loadingEpisodes && (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading episodes...
            </div>
          )}
        </>
      )}

      {/* Step 2: Episode selection (TV only) */}
      {step === 'select-episode' && selectedItem && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reporting issue for: <strong>{selectedItem.title}</strong>
          </p>
          <p className="text-sm">Select the episode with the issue, or skip to report for the whole series.</p>

          <div className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={selectedSeason === s ? 'default' : 'outline'}
                onClick={() => { setSelectedSeason(s); setSelectedEpisode(null); }}
              >
                Season {s}
              </Button>
            ))}
          </div>

          {selectedSeason !== null && (
            <div className="max-h-60 space-y-1 overflow-y-auto rounded border border-border p-2">
              {filteredEpisodes.map((ep) => (
                <button
                  key={`${ep.seasonNumber}-${ep.episodeNumber}`}
                  className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50 ${
                    selectedEpisode?.episodeNumber === ep.episodeNumber && selectedEpisode?.seasonNumber === ep.seasonNumber
                      ? 'bg-accent'
                      : ''
                  }`}
                  onClick={() => setSelectedEpisode(ep)}
                >
                  <span className="font-medium">E{ep.episodeNumber}</span> &mdash; {ep.title}
                  {!ep.hasFile && <span className="ml-2 text-xs text-muted-foreground">(no file)</span>}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('browse'); setSelectedItem(null); setEpisodes([]); setSelectedSeason(null); }}>
              Back
            </Button>
            <Button variant="outline" onClick={() => { setSelectedEpisode(null); setStep('details'); }}>
              Skip (whole series)
            </Button>
            {selectedEpisode && (
              <Button onClick={() => setStep('details')}>
                Continue with S{selectedEpisode.seasonNumber}E{selectedEpisode.episodeNumber}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Issue details */}
      {step === 'details' && selectedItem && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex gap-3 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                {selectedItem.mediaType === 'movie' ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium">{selectedItem.title} ({selectedItem.year})</p>
                {selectedEpisode ? (
                  <p className="text-sm text-muted-foreground">
                    S{selectedEpisode.seasonNumber}E{selectedEpisode.episodeNumber} &mdash; {selectedEpisode.title}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.mediaType === 'movie' ? 'Movie' : 'Entire series'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <label className="text-sm font-medium">Issue Type</label>
            <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ISSUE_TYPE_LABELS) as [IssueType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description {issueType === 'other' ? '(required)' : '(optional)'}
            </label>
            <Textarea
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedItem.mediaType === 'tv' && episodes.length > 0) {
                  setStep('select-episode');
                } else {
                  setStep('browse');
                  setSelectedItem(null);
                }
              }}
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !issueType || (issueType === 'other' && !description.trim())}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              {submitting ? 'Submitting...' : 'Report Issue'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
