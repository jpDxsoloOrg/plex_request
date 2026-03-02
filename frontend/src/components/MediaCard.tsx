import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Tv } from 'lucide-react';
import type { MediaSearchResult } from '@/types';

interface MediaCardProps {
  media: MediaSearchResult;
}

export function MediaCard({ media }: MediaCardProps) {
  return (
    <Link to={`/search/${media.mediaType}/${media.id}`}>
      <Card className="group overflow-hidden transition-colors hover:border-primary/50">
        <div className="relative aspect-[2/3] bg-muted">
          {media.posterUrl ? (
            <img
              src={media.posterUrl}
              alt={media.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {media.mediaType === 'movie' ? (
                <Film className="h-12 w-12" />
              ) : (
                <Tv className="h-12 w-12" />
              )}
            </div>
          )}
          <Badge className="absolute right-2 top-2 text-xs" variant="secondary">
            {media.mediaType === 'movie' ? 'Movie' : 'TV'}
          </Badge>
        </div>
        <CardContent className="p-3">
          <h3 className="line-clamp-1 text-sm font-medium">{media.title}</h3>
          <p className="text-xs text-muted-foreground">{media.year}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
