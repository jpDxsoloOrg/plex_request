import { Card, CardContent } from '@/components/ui/card';
import { Film, Tv } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { MediaRequest } from '@/types';

interface RequestCardProps {
  request: MediaRequest;
  actions?: React.ReactNode;
}

export function RequestCard({ request, actions }: RequestCardProps) {
  const date = new Date(request.requestedAt).toLocaleDateString();

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
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
            <h3 className="font-medium">{request.title}</h3>
            <p className="text-sm text-muted-foreground">
              {request.year} &middot; {request.mediaType === 'movie' ? 'Movie' : 'TV Show'}
              {request.mediaType === 'tv' && (
                <span>
                  {' '}&middot;{' '}
                  {request.seasons
                    ? `Seasons ${request.seasons.join(', ')}`
                    : 'All Seasons'}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} />
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center">{actions}</div>}
      </CardContent>
    </Card>
  );
}
