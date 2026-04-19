import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { ParsedLocation } from './sinotrackParser';

// Cache device IMEI -> car_id mappings to avoid repeated DB lookups
const deviceCache = new Map<string, { carId: string | null; label: string | null }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
let lastCacheRefresh = 0;

/**
 * Load all device-to-car mappings from gps_devices table.
 */
async function refreshDeviceCache(): Promise<void> {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL_MS && deviceCache.size > 0) return;

  const { data, error } = await supabaseAdmin
    .from('gps_devices')
    .select('device_imei, car_id, label')
    .eq('is_active', true);

  if (error) {
    logger.error({ error }, 'SinoTrack: failed to refresh device cache');
    return;
  }

  deviceCache.clear();
  for (const row of data || []) {
    deviceCache.set(row.device_imei, { carId: row.car_id, label: row.label });
  }

  lastCacheRefresh = now;
  logger.info({ deviceCount: deviceCache.size }, 'SinoTrack: device cache refreshed');
}

/**
 * Write a parsed GPS location to Supabase.
 *
 * 1. Look up car_id from gps_devices cache
 * 2. INSERT into vehicle_location_log
 * 3. UPDATE car.current_location_log_id (triggers real-time)
 * 4. UPDATE gps_devices.last_seen_at
 */
export async function writeLocation(location: ParsedLocation): Promise<void> {
  await refreshDeviceCache();

  const device = deviceCache.get(location.deviceId);

  if (!device) {
    logger.debug(
      { deviceId: location.deviceId },
      'SinoTrack: unknown device, skipping. Register it in gps_devices table.'
    );
    return;
  }

  if (!device.carId) {
    logger.debug(
      { deviceId: location.deviceId, label: device.label },
      'SinoTrack: device not assigned to a car, skipping.'
    );
    return;
  }

  if (!location.gpsValid) {
    logger.debug(
      { deviceId: location.deviceId },
      'SinoTrack: GPS fix invalid (V), skipping write.'
    );
    return;
  }

  try {
    // 1. Insert location log
    const { data: logEntry, error: insertError } = await supabaseAdmin
      .from('vehicle_location_log')
      .insert({
        car_id: device.carId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp.toISOString(),
        speed: location.speed,
        heading: location.heading,
        accuracy: null,
        reservation_id: null,
      })
      .select('log_id')
      .single();

    if (insertError) {
      logger.error({ insertError, deviceId: location.deviceId }, 'SinoTrack: insert failed');
      return;
    }

    // 2. Update car's current location pointer (triggers Supabase Realtime)
    const { error: updateCarError } = await supabaseAdmin
      .from('car')
      .update({ current_location_log_id: logEntry.log_id })
      .eq('car_id', device.carId);

    if (updateCarError) {
      logger.error({ updateCarError, carId: device.carId }, 'SinoTrack: car update failed');
    }

    // 3. Update device last-seen info
    const { error: updateDeviceError } = await supabaseAdmin
      .from('gps_devices')
      .update({
        last_seen_at: location.timestamp.toISOString(),
        last_latitude: location.latitude,
        last_longitude: location.longitude,
        last_speed: location.speed,
        updated_at: new Date().toISOString(),
      })
      .eq('device_imei', location.deviceId);

    if (updateDeviceError) {
      logger.error({ updateDeviceError }, 'SinoTrack: device update failed');
    }

    logger.debug(
      {
        deviceId: location.deviceId,
        carId: device.carId,
        lat: location.latitude,
        lon: location.longitude,
        speed: location.speed,
      },
      'SinoTrack: location written'
    );
  } catch (err) {
    logger.error({ err, deviceId: location.deviceId }, 'SinoTrack: writeLocation error');
  }
}
