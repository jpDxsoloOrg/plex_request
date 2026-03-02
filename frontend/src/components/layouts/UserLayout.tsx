import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/NavBar';

export function UserLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
