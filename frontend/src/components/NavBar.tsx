import { Link, useNavigate } from 'react-router-dom';
import { Film, Search, List, AlertTriangle, Shield, LogIn, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

function NavLinks({ onClick }: { onClick?: () => void }) {
  const { user, isAdmin } = useAuth();

  return (
    <>
      <Link
        to="/search"
        className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        onClick={onClick}
      >
        <Search className="h-4 w-4" />
        Search
      </Link>
      {user && (
        <>
          <Link
            to="/requests"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClick}
          >
            <List className="h-4 w-4" />
            My Requests
          </Link>
          <Link
            to="/report-issue"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClick}
          >
            <AlertTriangle className="h-4 w-4" />
            Report Issue
          </Link>
        </>
      )}
      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClick}
        >
          <Shield className="h-4 w-4" />
          Admin
        </Link>
      )}
    </>
  );
}

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-primary">
          <Film className="h-5 w-5" />
          <span className="hidden sm:inline">Plex Request</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <NavLinks />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="hidden md:flex"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="hidden md:flex">
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          )}

          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-4 pt-8">
                <NavLinks onClick={() => setOpen(false)} />
                <Separator />
                {user ? (
                  <button
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => {
                      logout();
                      navigate('/');
                      setOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
