import { Link } from 'react-router-dom';
import { Film, Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 py-20 text-center">
      <div className="rounded-2xl bg-primary/10 p-6">
        <Film className="h-16 w-16 text-primary" />
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Plex Request</h1>
        <p className="text-lg text-muted-foreground">
          Search for movies and TV shows, then request them to be added to your Plex server.
        </p>
      </div>
      <Button asChild size="lg">
        <Link to="/search">
          <Search className="mr-2 h-5 w-5" />
          Start Searching
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}
