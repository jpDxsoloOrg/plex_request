import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { admin } from '@/services/api';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/types';
import { Save, Plug, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ServiceFormProps {
  serviceKey: 'radarr' | 'sonarr';
  label: string;
  initial?: Partial<IntegrationSetting>;
  onSaved: () => void;
}

function ServiceForm({ serviceKey, label, initial, onSaved }: ServiceFormProps) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [qualityProfileId, setQualityProfileId] = useState(
    initial?.qualityProfileId?.toString() ?? ''
  );
  const [rootFolderPath, setRootFolderPath] = useState(initial?.rootFolderPath ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const maskedKey = initial?.apiKey ?? '';

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const key = apiKey || undefined;
      const result = key
        ? await admin.settings.testConnection(serviceKey, { baseUrl, apiKey: key })
        : await admin.settings.testConnection(serviceKey);
      if (result.connected) {
        setTestResult({ ok: true, message: `Connected! v${result.version}` });
      } else {
        setTestResult({ ok: false, message: result.error ?? 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await admin.settings.update(serviceKey, {
        baseUrl,
        apiKey: apiKey || maskedKey,
        qualityProfileId: qualityProfileId ? Number(qualityProfileId) : undefined,
        rootFolderPath: rootFolderPath || undefined,
        enabled,
      });
      toast.success(`${label} settings saved`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {label}
          <span
            className={`ml-auto inline-block h-2 w-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-muted-foreground'}`}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={`http://localhost:${serviceKey === 'radarr' ? '7878' : '8989'}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              API Key {maskedKey && <span className="text-xs">({maskedKey})</span>}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter new key or leave blank to keep existing"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Quality Profile ID</label>
            <Input
              type="number"
              value={qualityProfileId}
              onChange={(e) => setQualityProfileId(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Root Folder Path</label>
            <Input
              value={rootFolderPath}
              onChange={(e) => setRootFolderPath(e.target.value)}
              placeholder="/movies or /tv"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          Enabled
        </label>

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-md p-2 text-sm ${
              testResult.ok
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !baseUrl}>
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-2 h-4 w-4" />
            )}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || !baseUrl}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, IntegrationSetting>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await admin.settings.getAll();
      setSettings(data.settings);
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ServiceForm
        serviceKey="radarr"
        label="Radarr"
        initial={settings.radarr}
        onSaved={fetchSettings}
      />
      <ServiceForm
        serviceKey="sonarr"
        label="Sonarr"
        initial={settings.sonarr}
        onSaved={fetchSettings}
      />
    </div>
  );
}
