import { useCallback, useState } from 'react';
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
import { search as searchApi, issues as issuesApi, requests as requestsApi } from '@/services/api';
import { toast } from 'sonner';
import type { MediaSearchResult, EpisodeInfo, IssueType } from '@/types';
import { Search, Film, Tv, AlertTriangle, Loader2, Check } from 'lucide-react';

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  wrong_language: 'Wrong Language',
  corrupt: 'Corrupt File',
  missing_subtitles: 'Missing Subtitles',
  wrong_content: 'Wrong Content',
  other: 'Other',
};

type Step = 'search' | 'select-episode' | 'details' | 'done';

export function ReportIssuePage() {
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'movie' | 'tv'>('movie');
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaSearchResult | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeInfo | null>(null);
  const [issueType, setIssueType] = useState<IssueType | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const all = await searchApi.query(query, searchType);
      // Filter to items that exist in the library
      const inLibrary: MediaSearchResult[] = [];
      for (const item of all.slice(0, 20)) {
        try {
          const check = await requestsApi.checkMedia(item.id, item.mediaType);
          if (check.exists) {
            inLibrary.push(item);
          }
        } catch {
          // skip items we can't check
        }
      }
      setResults(inLibrary);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, searchType]);

  const handleSelectMedia = async (media: MediaSearchResult) => {
    setSelectedMedia(media);
    if (media.mediaType === 'tv') {
      setLoadingEpisodes(true);
      try {
        // We need the Sonarr series ID — use the tmdbId from search
        // The checkMedia endpoint returns info, but we need episodes
        // Try fetching via the search ID (which is tvdbId for Sonarr)
        const eps = await issuesApi.episodes(media.id);
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
    if (!selectedMedia || !issueType) return;
    if (issueType === 'other' && !description.trim()) {
      toast.error('Please describe the issue');
      return;
    }
    setSubmitting(true);
    try {
      await issuesApi.create({
        mediaType: selectedMedia.mediaType,
        tmdbId: selectedMedia.id,
        title: selectedMedia.title,
        year: selectedMedia.year,
        posterPath: selectedMedia.posterUrl,
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
    setStep('search');
    setQuery('');
    setResults([]);
    setSelectedMedia(null);
    setEpisodes([]);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setIssueType('');
    setDescription('');
  };

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Report an Issue</h1>

      {/* Step 1: Search */}
      {step === 'search' && (
        <>
          <div className="flex gap-2">
            <Select
              value={searchType}
              onValueChange={(v) => setSearchType(v as 'movie' | 'tv')}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="tv">TV Show</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Search for a title in your library..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !query.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {searching && (
            <p className="text-sm text-muted-foreground">Searching library...</p>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{results.length} found in library</p>
              {results.map((item) => (
                <Card
                  key={`${item.mediaType}-${item.id}`}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => handleSelectMedia(item)}
                >
                  <CardContent className="flex gap-3 p-3">
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                      {item.posterUrl ? (
                        <img src={item.posterUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          {item.mediaType === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.year} &middot; {item.mediaType === 'movie' ? 'Movie' : 'TV Show'}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!searching && results.length === 0 && query && (
            <p className="py-8 text-center text-muted-foreground">No matching items found in your library.</p>
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
      {step === 'select-episode' && selectedMedia && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reporting issue for: <strong>{selectedMedia.title}</strong>
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
            <Button variant="outline" onClick={() => { setStep('search'); setSelectedMedia(null); }}>
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
      {step === 'details' && selectedMedia && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex gap-3 p-3">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                {selectedMedia.posterUrl ? (
                  <img src={selectedMedia.posterUrl} alt={selectedMedia.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">{selectedMedia.title} ({selectedMedia.year})</p>
                {selectedEpisode ? (
                  <p className="text-sm text-muted-foreground">
                    S{selectedEpisode.seasonNumber}E{selectedEpisode.episodeNumber} &mdash; {selectedEpisode.title}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedMedia.mediaType === 'movie' ? 'Movie' : 'Entire series'}
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
                if (selectedMedia.mediaType === 'tv' && episodes.length > 0) {
                  setStep('select-episode');
                } else {
                  setStep('search');
                  setSelectedMedia(null);
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
