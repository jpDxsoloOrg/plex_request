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

    // Search returns Sonarr's TVDB id for shows, so request.tmdbId holds a TVDB id
    const tvdbId = request.tmdbId;
    const results = await sonarr.lookupSeries(config, `tvdb:${tvdbId}`);
    const match = results.find((r) => r.tvdbId === tvdbId);
    if (!match) {
      throw new Error(`Series not found in Sonarr for TVDB ID ${tvdbId}`);
    }

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
