import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { libraryBrowser } from '@/services/api';
import { ArrowLeft, ChevronDown, ChevronRight, CheckCircle, XCircle, Tv } from 'lucide-react';
import type { LibraryShow, LibraryEpisode } from '@/types';

function SeasonRow({
  show,
  season,
}: {
  show: LibraryShow;
  season: LibraryShow['seasons'][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const [episodes, setEpisodes] = useState<LibraryEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const toggle = async () => {
    if (!expanded && !fetched) {
      setLoading(true);
      try {
        const data = await libraryBrowser.getEpisodes(show.sonarrId, season.seasonNumber);
        setEpisodes(data.episodes);
        setFetched(true);
      } catch {
        setEpisodes([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  const percent = season.episodeCount > 0
    ? Math.round((season.episodeFileCount / season.episodeCount) * 100)
    : 0;

  const progressColor =
    percent >= 100
      ? 'bg-green-500'
      : percent > 0
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={toggle}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium">Season {season.seasonNumber}</span>
        <div className="flex flex-1 items-center gap-3">
          <div className="relative h-1.5 flex-1 max-w-48 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${progressColor} transition-all`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {season.episodeFileCount}/{season.episodeCount}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/30">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : episodes.length > 0 ? (
            <div className="divide-y divide-border">
              {episodes.map((ep) => (
                <div
                  key={ep.episodeId}
                  className="flex items-center gap-3 px-4 py-2 pl-12"
                >
                  {ep.hasFile ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <span className="w-10 shrink-0 text-sm text-muted-foreground">
                    E{String(ep.episodeNumber).padStart(2, '0')}
                  </span>
                  <span className="flex-1 truncate text-sm">{ep.title}</span>
                  {ep.airDate && (
                    <span className="text-xs text-muted-foreground">{ep.airDate}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No episodes found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function LibraryShowDetailPage() {
  const { sonarrId } = useParams<{ sonarrId: string }>();
  const [show, setShow] = useState<LibraryShow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShow = useCallback(async () => {
    if (!sonarrId) return;
    setLoading(true);
    try {
      // Fetch all shows and find the matching one
      // (Sonarr returns all series in one call; we reuse the same endpoint)
      const data = await libraryBrowser.getShows({ pageSize: 1000 });
      const found = data.shows.find((s) => s.sonarrId === parseInt(sonarrId, 10));
      setShow(found ?? null);
    } catch {
      setShow(null);
    } finally {
      setLoading(false);
    }
  }, [sonarrId]);

  useEffect(() => {
    fetchShow();
  }, [fetchShow]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-6">
          <Skeleton className="h-72 w-48 rounded-lg" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/library">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>
        </Button>
        <p className="text-muted-foreground">Show not found.</p>
      </div>
    );
  }

  const overallPercent = show.episodeCount > 0
    ? Math.round((show.episodeFileCount / show.episodeCount) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/library">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Library
        </Link>
      </Button>

      <div className="flex gap-6">
        <div className="h-72 w-48 shrink-0 overflow-hidden rounded-lg bg-muted">
          {show.posterUrl ? (
            <img src={show.posterUrl} alt={show.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Tv className="h-12 w-12" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold">{show.title}</h1>
            <p className="text-muted-foreground">{show.year}</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={
                show.status === 'downloaded'
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : show.status === 'partial'
                    ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
              }
            >
              {show.status === 'downloaded' ? 'Complete' : show.status === 'partial' ? 'Partial' : 'Missing'}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Episodes</span>
              <span className="text-muted-foreground">
                {show.episodeFileCount} / {show.episodeCount} ({overallPercent}%)
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  overallPercent >= 100 ? 'bg-green-500' : overallPercent > 0 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {show.seasons.length > 0 ? (
            show.seasons.map((season) => (
              <SeasonRow key={season.seasonNumber} show={show} season={season} />
            ))
          ) : (
            <p className="p-4 text-muted-foreground">No seasons available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
