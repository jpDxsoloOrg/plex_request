import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { admin } from '@/services/api';
import { toast } from 'sonner';
import type { IntegrationSetting, QualityProfile, RootFolder } from '@/types';
import { Save, Plug, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

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
  const [languageProfileId, setLanguageProfileId] = useState(
    initial?.languageProfileId?.toString() ?? ''
  );
  const [rootFolderPath, setRootFolderPath] = useState(initial?.rootFolderPath ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [languageProfiles, setLanguageProfiles] = useState<QualityProfile[]>([]);
  const [folders, setFolders] = useState<RootFolder[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const maskedKey = initial?.apiKey ?? '';

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const promises: [Promise<QualityProfile[]>, Promise<RootFolder[]>] = [
        admin.settings.getQualityProfiles(serviceKey),
        admin.settings.getRootFolders(serviceKey),
      ];
      const [p, f] = await Promise.all(promises);
      setProfiles(p);
      setFolders(f);

      // Load language profiles for Sonarr (v3 requires them)
      if (serviceKey === 'sonarr') {
        try {
          const lp = await admin.settings.getLanguageProfiles('sonarr');
          setLanguageProfiles(lp);
        } catch {
          // Sonarr v4 removed language profiles — ignore the error
          setLanguageProfiles([]);
        }
      }
    } catch (err) {
      toast.error(`Failed to load ${label} options: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingOptions(false);
    }
  };

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
        loadOptions();
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
        apiKey: apiKey || undefined,
        qualityProfileId: qualityProfileId ? Number(qualityProfileId) : undefined,
        languageProfileId: languageProfileId ? Number(languageProfileId) : undefined,
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

  useEffect(() => {
    if (initial?.baseUrl && initial?.apiKey) {
      loadOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <label className="mb-1 block text-sm text-muted-foreground">
              Quality Profile
              {loadingOptions && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
            </label>
            {profiles.length > 0 ? (
              <select
                value={qualityProfileId}
                onChange={(e) => setQualityProfileId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="">Select a profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="number"
                value={qualityProfileId}
                onChange={(e) => setQualityProfileId(e.target.value)}
                placeholder="Test connection to load profiles"
              />
            )}
          </div>
          {serviceKey === 'sonarr' && languageProfiles.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Language Profile
                {loadingOptions && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
              </label>
              <select
                value={languageProfileId}
                onChange={(e) => setLanguageProfileId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="">Select a language profile...</option>
                {languageProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Root Folder
              {loadingOptions && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
            </label>
            {folders.length > 0 ? (
              <select
                value={rootFolderPath}
                onChange={(e) => setRootFolderPath(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="">Select a folder...</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.path}>
                    {f.path} ({(f.freeSpace / 1073741824).toFixed(1)} GB free)
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={rootFolderPath}
                onChange={(e) => setRootFolderPath(e.target.value)}
                placeholder="Test connection to load folders"
              />
            )}
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
          {(profiles.length > 0 || folders.length > 0) && (
            <Button variant="outline" onClick={loadOptions} disabled={loadingOptions}>
              {loadingOptions ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Options
            </Button>
          )}
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
