import { Badge } from '@/components/ui/badge';
import type { RequestStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<RequestStatus, { label: string; className: string }> = {
  requested: { label: 'Requested', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  approved: { label: 'Approved', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  downloading: { label: 'Downloading', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  complete: { label: 'Complete', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  );
}
