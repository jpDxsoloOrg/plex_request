import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { admin } from '@/services/api';
import { toast } from 'sonner';
import { Users, Zap } from 'lucide-react';
import type { AdminUser } from '@/types';

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await admin.users.list();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleToggleClick(user: AdminUser) {
    setConfirmUser(user);
  }

  async function confirmToggle() {
    if (!confirmUser) return;
    setToggling(true);
    try {
      const newValue = !confirmUser.autoApprove;
      await admin.users.updateAutoApprove(confirmUser.userId, newValue);
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === confirmUser.userId ? { ...u, autoApprove: newValue } : u
        )
      );
      toast.success(
        newValue
          ? `Auto-approve enabled for ${confirmUser.email}`
          : `Auto-approve disabled for ${confirmUser.email}`
      );
    } catch (err) {
      toast.error('Failed to update auto-approve setting');
      console.error(err);
    } finally {
      setToggling(false);
      setConfirmUser(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="mb-3 h-10 w-10" />
          <p>No registered users</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Requests</TableHead>
                <TableHead className="text-center">Auto-Approve</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.status === 'CONFIRMED'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{user.requestCount}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={user.autoApprove}
                        onCheckedChange={() => handleToggleClick(user)}
                      />
                      {user.autoApprove && (
                        <Zap className="h-4 w-4 text-yellow-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmUser?.autoApprove ? 'Disable' : 'Enable'} Auto-Approve
            </DialogTitle>
            <DialogDescription>
              {confirmUser?.autoApprove
                ? `Disable auto-approve for ${confirmUser.email}? Their future requests will require manual admin approval.`
                : `Enable auto-approve for ${confirmUser?.email}? Their future requests will skip the approval queue and be sent directly to Radarr/Sonarr.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUser(null)} disabled={toggling}>
              Cancel
            </Button>
            <Button onClick={confirmToggle} disabled={toggling}>
              {toggling ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
