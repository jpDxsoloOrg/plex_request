import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/Pagination';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { libraryBrowser } from '@/services/api';
import { Search, Film, Tv, HardDrive } from 'lucide-react';
import type { LibraryMovie, LibraryShow } from '@/types';

const PAGE_SIZE = 48;

function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function MovieCard({ movie }: { movie: LibraryMovie }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50">
      <div className="aspect-[2/3] bg-muted">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={movie.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Film className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{movie.title}</p>
            <p className="text-xs text-gray-300">{movie.year}</p>
          </div>
          <Badge
            variant="outline"
            className={
              movie.status === 'downloaded'
                ? 'shrink-0 border-green-500/30 bg-green-500/10 text-green-400'
                : 'shrink-0 border-red-500/30 bg-red-500/10 text-red-400'
            }
          >
            {movie.status === 'downloaded' ? 'Downloaded' : 'Missing'}
          </Badge>
        </div>
        {movie.status === 'downloaded' && movie.sizeOnDisk > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <HardDrive className="h-3 w-3" />
            {formatSize(movie.sizeOnDisk)}
          </p>
        )}
      </div>
    </div>
  );
}

function ShowCard({ show }: { show: LibraryShow }) {
  const progressColor =
    show.percentComplete >= 100
      ? 'bg-green-500'
      : show.percentComplete > 0
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <Link
      to={`/library/shows/${show.sonarrId}`}
      className="group relative block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
    >
      <div className="aspect-[2/3] bg-muted">
        {show.posterUrl ? (
          <img src={show.posterUrl} alt={show.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Tv className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
        <p className="truncate text-sm font-medium text-white">{show.title}</p>
        <p className="text-xs text-gray-300">{show.year}</p>
        <div className="mt-2">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className={`h-full rounded-full ${progressColor} transition-all`}
              style={{ width: `${Math.min(100, show.percentComplete)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-300">
            {show.episodeFileCount}/{show.episodeCount} episodes
          </p>
        </div>
      </div>
    </Link>
  );
}

export function LibraryPage() {
  const [tab, setTab] = useState('movies');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Movies state
  const [movies, setMovies] = useState<LibraryMovie[]>([]);
  const [movieTotal, setMovieTotal] = useState(0);
  const [moviesLoading, setMoviesLoading] = useState(true);

  // Shows state
  const [shows, setShows] = useState<LibraryShow[]>([]);
  const [showTotal, setShowTotal] = useState(0);
  const [showsLoading, setShowsLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, tab]);

  const fetchMovies = useCallback(async (searchTerm: string, status: string, pg: number) => {
    setMoviesLoading(true);
    try {
      const data = await libraryBrowser.getMovies({ search: searchTerm || undefined, status, page: pg, pageSize: PAGE_SIZE });
      setMovies(data.movies);
      setMovieTotal(data.total);
    } catch {
      setMovies([]);
      setMovieTotal(0);
    } finally {
      setMoviesLoading(false);
    }
  }, []);

  const fetchShows = useCallback(async (searchTerm: string, status: string, pg: number) => {
    setShowsLoading(true);
    try {
      const data = await libraryBrowser.getShows({ search: searchTerm || undefined, status, page: pg, pageSize: PAGE_SIZE });
      setShows(data.shows);
      setShowTotal(data.total);
    } catch {
      setShows([]);
      setShowTotal(0);
    } finally {
      setShowsLoading(false);
    }
  }, []);

  // Debounced fetch
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (tab === 'movies') {
        fetchMovies(search, statusFilter, page);
      } else {
        fetchShows(search, statusFilter, page);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [tab, search, statusFilter, page, fetchMovies, fetchShows]);

  const moviePages = Math.ceil(movieTotal / PAGE_SIZE);
  const showPages = Math.ceil(showTotal / PAGE_SIZE);

  const movieStatusOptions = [
    { value: 'all', label: 'All' },
    { value: 'downloaded', label: 'Downloaded' },
    { value: 'missing', label: 'Missing' },
  ];

  const showStatusOptions = [
    { value: 'all', label: 'All' },
    { value: 'downloaded', label: 'Complete' },
    { value: 'partial', label: 'Partial' },
    { value: 'missing', label: 'Missing' },
  ];

  const statusOptions = tab === 'movies' ? movieStatusOptions : showStatusOptions;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-bold">Library</h1>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setStatusFilter('all'); }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="movies">
              <Film className="mr-2 h-4 w-4" />
              Movies
            </TabsTrigger>
            <TabsTrigger value="shows">
              <Tv className="mr-2 h-4 w-4" />
              TV Shows
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="movies" className="mt-6">
          {moviesLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : movies.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{movieTotal} movies</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {movies.map((m) => (
                  <MovieCard key={m.radarrId} movie={m} />
                ))}
              </div>
              <div className="mt-6">
                <Pagination page={page} totalPages={moviePages} onPageChange={setPage} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
              <Film className="h-12 w-12" />
              <p>No movies found.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="shows" className="mt-6">
          {showsLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : shows.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{showTotal} shows</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {shows.map((s) => (
                  <ShowCard key={s.sonarrId} show={s} />
                ))}
              </div>
              <div className="mt-6">
                <Pagination page={page} totalPages={showPages} onPageChange={setPage} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
              <Tv className="h-12 w-12" />
              <p>No shows found.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
