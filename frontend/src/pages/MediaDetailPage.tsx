import { useParams } from 'react-router-dom';
import { Film, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MediaType } from '@/types';

export function MediaDetailPage() {
  const { mediaType, id } = useParams<{ mediaType: MediaType; id: string }>();

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex h-72 w-48 shrink-0 items-center justify-center rounded-lg bg-muted">
          {mediaType === 'movie' ? (
            <Film className="h-16 w-16 text-muted-foreground" />
          ) : (
            <Tv className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Media Detail</h1>
          <p className="text-muted-foreground">
            {mediaType === 'movie' ? 'Movie' : 'TV Show'} ID: {id}
          </p>
          <p className="text-sm text-muted-foreground">
            Full detail page will be implemented in Step 10 (Issue #20).
          </p>
          <Button>Request This Title</Button>
        </div>
      </div>
    </div>
  );
}
