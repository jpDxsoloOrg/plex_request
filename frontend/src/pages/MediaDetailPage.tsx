import { useCallback, useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Film, Tv, Send, Check, Loader2, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { search as searchApi, requests as requestsApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { MediaSearchResult, MediaRequest, MediaType } from '@/types';

export function MediaDetailPage() {
  const { mediaType, id } = useParams<{ mediaType: string; id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [media, setMedia] = useState<MediaSearchResult | null>(null);
  const [existingRequest, setExistingRequest] = useState<MediaRequest | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<{ exists: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectAllSeasons, setSelectAllSeasons] = useState(true);
  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(new Set());

  const fetchMedia = useCallback(async () => {
    if (!mediaType || !id) return;

    // Use media data passed via router state from search results
    const stateMedia = (location.state as { media?: MediaSearchResult } | null)?.media;
    if (stateMedia && String(stateMedia.id) === id) {
      setMedia(stateMedia);
      setLoading(false);
      return;
    }

    // Fallback: search by title won't work with just an ID, so show not found
    // This handles direct URL navigation without state
    try {
      const results = await searchApi.query(id, mediaType as MediaType);
      const match = results.find((r) => String(r.id) === id);
      setMedia(match ?? null);
    } catch {
      setMedia(null);
    } finally {
      setLoading(false);
    }
  }, [mediaType, id, location.state]);

  const checkExistingRequest = useCallback(async () => {
    if (!user) return;
    try {
      const myRequests = await requestsApi.list();
      const match = myRequests.find(
        (r) => String(r.tmdbId) === id && r.mediaType === mediaType
      );
      setExistingRequest(match ?? null);
    } catch {
      // Ignore — user might not be logged in
    }
  }, [user, id, mediaType]);

  const checkLibrary = useCallback(async () => {
    if (!id || !mediaType || !user) return;
    try {
      const result = await requestsApi.checkMedia(Number(id), mediaType as 'movie' | 'tv');
      setLibraryStatus(result);
    } catch {
      // Ignore — non-critical check
    }
  }, [id, mediaType, user]);

  useEffect(() => {
    fetchMedia();
    checkExistingRequest();
    checkLibrary();
  }, [fetchMedia, checkExistingRequest, checkLibrary]);

  const isTvWithSeasons = media?.mediaType === 'tv' && media.seasons && media.seasons.length > 0;

  const handleRequest = async () => {
    if (!media) return;
    setRequesting(true);
    try {
      const seasons = isTvWithSeasons && !selectAllSeasons
        ? [...selectedSeasons].sort((a, b) => a - b)
        : undefined;
      const req = await requestsApi.create({
        mediaType: media.mediaType,
        tmdbId: media.id,
        title: media.title,
        year: media.year,
        overview: media.overview,
        posterPath: media.posterUrl,
        seasons,
      });
      setExistingRequest(req);
      setDialogOpen(false);
      toast.success(`Requested "${media.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <Skeleton className="h-72 w-48 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <p>Media not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-6">
      {/* Backdrop blur hero */}
      {media.posterUrl && (
        <div className="relative -mx-4 -mt-6 mb-6 h-48 overflow-hidden md:-mx-6">
          <img
            src={media.posterUrl}
            alt=""
            className="h-full w-full object-cover blur-2xl brightness-30 saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Poster */}
        <div className="h-72 w-48 shrink-0 overflow-hidden rounded-lg bg-muted shadow-lg">
          {media.posterUrl ? (
            <img
              src={media.posterUrl}
              alt={media.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {media.mediaType === 'movie' ? (
                <Film className="h-16 w-16" />
              ) : (
                <Tv className="h-16 w-16" />
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{media.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground">{media.year}</span>
              <Badge variant="secondary">
                {media.mediaType === 'movie' ? 'Movie' : 'TV Show'}
              </Badge>
            </div>
          </div>

          {media.overview && (
            <p className="leading-relaxed text-muted-foreground">{media.overview}</p>
          )}

          {/* Request action */}
          {libraryStatus?.exists ? (
            <div className="flex items-center gap-3 rounded-md bg-green-500/10 p-3 text-green-400">
              <Library className="h-5 w-5 shrink-0" />
              <p className="text-sm">{libraryStatus.message}</p>
            </div>
          ) : existingRequest ? (
            <div className="flex items-center gap-3">
              <Button disabled variant="outline">
                <Check className="mr-2 h-4 w-4" />
                Already Requested
              </Button>
              <StatusBadge status={existingRequest.status} />
            </div>
          ) : user ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="mr-2 h-4 w-4" />
                  Request This Title
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Request</DialogTitle>
                  <DialogDescription>
                    Request &quot;{media.title}&quot; ({media.year}) to be added to Plex?
                  </DialogDescription>
                </DialogHeader>

                {isTvWithSeasons && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Seasons</span>
                      <Button
                        size="sm"
                        variant={selectAllSeasons ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectAllSeasons(!selectAllSeasons);
                          if (!selectAllSeasons) {
                            setSelectedSeasons(new Set());
                          }
                        }}
                      >
                        {selectAllSeasons ? 'All Seasons' : 'Select Seasons'}
                      </Button>
                    </div>

                    {!selectAllSeasons && (
                      <div className="flex flex-wrap gap-2">
                        {media.seasons!.map((s) => {
                          const selected = selectedSeasons.has(s.seasonNumber);
                          return (
                            <Button
                              key={s.seasonNumber}
                              size="sm"
                              variant={selected ? 'default' : 'outline'}
                              className="min-w-[4rem]"
                              onClick={() => {
                                const next = new Set(selectedSeasons);
                                if (selected) {
                                  next.delete(s.seasonNumber);
                                } else {
                                  next.add(s.seasonNumber);
                                }
                                setSelectedSeasons(next);
                              }}
                            >
                              S{s.seasonNumber}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRequest}
                    disabled={requesting || (isTvWithSeasons && !selectAllSeasons && selectedSeasons.size === 0)}
                  >
                    {requesting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {requesting ? 'Requesting...' : 'Confirm'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <p className="text-sm text-muted-foreground">
              Log in to request this title.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
