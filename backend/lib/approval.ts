import { getServiceSetting } from './settings';
import * as radarr from './integrations/radarr';
import * as sonarr from './integrations/sonarr';
import type { MediaRequest } from '../types';

export async function handleApproval(request: MediaRequest): Promise<{ radarrId?: number; sonarrId?: number }> {
  if (request.mediaType === 'movie') {
    const setting = await getServiceSetting('radarr');

    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      throw new Error('Radarr is not configured or disabled');
    }
    if (!setting.qualityProfileId || !setting.rootFolderPath) {
      throw new Error('Radarr quality profile and root folder must be configured in Settings');
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
    const movie = await radarr.addMovie(
      config,
      request.tmdbId,
      setting.qualityProfileId,
      setting.rootFolderPath
    );

    return { radarrId: movie.id };
  }

  if (request.mediaType === 'tv') {
    const setting = await getServiceSetting('sonarr');

    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      throw new Error('Sonarr is not configured or disabled');
    }
    if (!setting.qualityProfileId || !setting.rootFolderPath) {
      throw new Error('Sonarr quality profile and root folder must be configured in Settings');
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };

    // Sonarr lookup accepts tmdb:<id> format — find the correct match
    const results = await sonarr.lookupSeries(config, `tmdb:${request.tmdbId}`);
    if (!results.length) {
      throw new Error(`Series not found in Sonarr for TMDB ID ${request.tmdbId}`);
    }

    // Match by tmdbId first, fall back to title match, then first result
    const match = results.find((r) => r.tmdbId === request.tmdbId)
      ?? results.find((r) => r.title.toLowerCase() === request.title.toLowerCase())
      ?? results[0];

    const series = await sonarr.addSeries(
      config,
      match.tvdbId,
      setting.qualityProfileId,
      setting.rootFolderPath,
      request.seasons,
      setting.languageProfileId
    );

    return { sonarrId: series.id };
  }

  return {};
}
