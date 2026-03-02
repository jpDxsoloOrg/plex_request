import { useState } from 'react';
import { SearchInput } from '@/components/SearchInput';
import { MediaCard } from '@/components/MediaCard';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { search as searchApi } from '@/services/api';
import type { MediaSearchResult, MediaType } from '@/types';
import { Film, Tv } from 'lucide-react';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (term: string) => {
    setQuery(term);
    if (!term.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchApi.query(term, mediaType);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setMediaType(type as MediaType);
    if (query.trim()) {
      setLoading(true);
      searchApi.query(query, type as MediaType).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Search</h1>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <SearchInput value={query} onChange={handleSearch} />
          </div>
          <Tabs value={mediaType} onValueChange={handleTypeChange}>
            <TabsList>
              <TabsTrigger value="movie" className="gap-1.5">
                <Film className="h-4 w-4" />
                Movies
              </TabsTrigger>
              <TabsTrigger value="tv" className="gap-1.5">
                <Tv className="h-4 w-4" />
                TV Shows
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((media) => (
            <MediaCard key={`${media.mediaType}-${media.id}`} media={media} />
          ))}
        </div>
      ) : searched ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <p>No results found for &quot;{query}&quot;</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <p>Search for movies or TV shows to request</p>
        </div>
      )}
    </div>
  );
}
