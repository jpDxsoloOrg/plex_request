import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <Settings className="h-12 w-12" />
        <p>Integration settings will be implemented in Step 13 (Issue #31).</p>
      </div>
    </div>
  );
}
