import { logger } from '../lib/logger';

// ---------- Types ----------

export interface ParsedLocation {
  deviceId: string;
  manufacturerCode: string;
  messageType: 'V1' | 'V4';
  timestamp: Date;
  gpsValid: boolean;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  vehicleStatus: string;
  alarms: ParsedAlarms;
}

export interface ParsedAlarms {
  sos: boolean;
  overspeed: boolean;
  geoFenceIn: boolean;
  geoFenceOut: boolean;
  powerOff: boolean;
  gpsAntennaCut: boolean;
  towAlert: boolean;
  doorOpen: boolean;
  accOff: boolean;
  engineOn: boolean;
}

// ---------- Coordinate Conversion ----------

/**
 * Convert SinoTrack DDMM.MMMM format to decimal degrees.
 * Latitude:  DDMM.MMMM  (DD = 2 digits)
 * Longitude: DDDMM.MMMM (DDD = 3 digits)
 */
function convertCoordinate(raw: string, type: 'lat' | 'lon'): number {
  const degreeDigits = type === 'lat' ? 2 : 3;
  const degrees = parseInt(raw.substring(0, degreeDigits), 10);
  const minutes = parseFloat(raw.substring(degreeDigits));
  return degrees + minutes / 60;
}

function knotsToKmh(knots: number): number {
  return Math.round(knots * 1.852 * 100) / 100;
}

/**
 * Combine HHMMSS + DDMMYY into a UTC Date object.
 */
function parseTimestamp(time: string, date: string): Date {
  const hours = parseInt(time.substring(0, 2), 10);
  const minutes = parseInt(time.substring(2, 4), 10);
  const seconds = parseInt(time.substring(4, 6), 10);
  const day = parseInt(date.substring(0, 2), 10);
  const month = parseInt(date.substring(2, 4), 10) - 1;
  let year = parseInt(date.substring(4, 6), 10);
  year += year < 80 ? 2000 : 1900;

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

// ---------- Vehicle Status Parsing ----------

/**
 * Parse the 8-character hex vehicle_status into alarm flags.
 * Bit = 0 means active (negative logic per SinoTrack spec).
 */
function parseAlarms(statusHex: string): ParsedAlarms {
  const defaults: ParsedAlarms = {
    sos: false, overspeed: false, geoFenceIn: false, geoFenceOut: false,
    powerOff: false, gpsAntennaCut: false, towAlert: false,
    doorOpen: false, accOff: false, engineOn: false,
  };

  if (!statusHex || statusHex.length < 8) return defaults;

  const value = parseInt(statusHex, 16);
  const byte1 = (value >> 24) & 0xFF;
  const byte2 = (value >> 16) & 0xFF;
  const byte3 = (value >> 8) & 0xFF;
  const byte4 = value & 0xFF;

  const bitActive = (byte: number, bit: number) => ((byte >> bit) & 1) === 0;

  return {
    sos: bitActive(byte4, 1),
    overspeed: bitActive(byte4, 2),
    geoFenceIn: bitActive(byte4, 4),
    geoFenceOut: bitActive(byte4, 7),
    powerOff: bitActive(byte1, 4),
    towAlert: bitActive(byte1, 1),
    gpsAntennaCut: bitActive(byte2, 5),
    doorOpen: bitActive(byte3, 0),
    accOff: bitActive(byte3, 2),
    engineOn: bitActive(byte3, 5),
  };
}

// ---------- Main Parser ----------

/**
 * Parse a single SinoTrack message string.
 * Returns null if the message is not a valid V1/V4 position message.
 */
export function parseMessage(raw: string): ParsedLocation | null {
  const message = raw.replace(/^\*/, '').replace(/#$/, '').trim();
  const parts = message.split(',');

  if (parts.length < 12) {
    logger.debug({ raw }, 'SinoTrack: message too short, skipping');
    return null;
  }

  const manufacturerCode = parts[0];
  const deviceId = parts[1];
  const messageType = parts[2];

  if (messageType === 'V1') return parseV1(parts, manufacturerCode, deviceId);
  if (messageType === 'V4') return parseV4(parts, manufacturerCode, deviceId);

  logger.debug({ messageType, deviceId }, 'SinoTrack: unhandled message type');
  return null;
}

function parseV1(parts: string[], mfr: string, deviceId: string): ParsedLocation | null {
  // V1: mfr, id, V1, HHMMSS, S, lat, D, lon, G, speed, dir, DDMMYY, status
  //     [0]  [1] [2]  [3]   [4] [5] [6] [7] [8]  [9]  [10]  [11]    [12]
  try {
    const timeStr = parts[3];
    const gpsValid = parts[4] === 'A';
    const latRaw = parts[5];
    const latDir = parts[6];
    const lonRaw = parts[7];
    const lonDir = parts[8];
    const speedKnots = parseFloat(parts[9]) || 0;
    const heading = parseInt(parts[10], 10) || 0;
    const dateStr = parts[11];
    const statusHex = parts[12] || 'FFFFFFFF';

    let latitude = convertCoordinate(latRaw, 'lat');
    if (latDir === 'S') latitude = -latitude;

    let longitude = convertCoordinate(lonRaw, 'lon');
    if (lonDir === 'W') longitude = -longitude;

    return {
      deviceId,
      manufacturerCode: mfr,
      messageType: 'V1',
      timestamp: parseTimestamp(timeStr, dateStr),
      gpsValid,
      latitude,
      longitude,
      speed: knotsToKmh(speedKnots),
      heading,
      vehicleStatus: statusHex,
      alarms: parseAlarms(statusHex),
    };
  } catch (err) {
    logger.warn({ err, parts }, 'SinoTrack: failed to parse V1 message');
    return null;
  }
}

function parseV4(parts: string[], mfr: string, deviceId: string): ParsedLocation | null {
  // V4: mfr, id, V4, CMD, hhmmss, HHMMSS, S, lat, D, lon, G, speed, dir, DDMMYY, status
  //     [0]  [1] [2] [3]   [4]     [5]   [6] [7] [8] [9] [10] [11] [12]  [13]    [14]
  try {
    const timeStr = parts[5];
    const gpsValid = parts[6] === 'A';
    const latRaw = parts[7];
    const latDir = parts[8];
    const lonRaw = parts[9];
    const lonDir = parts[10];
    const speedKnots = parseFloat(parts[11]) || 0;
    const heading = parseInt(parts[12], 10) || 0;
    const dateStr = parts[13];
    const statusHex = parts[14] || 'FFFFFFFF';

    let latitude = convertCoordinate(latRaw, 'lat');
    if (latDir === 'S') latitude = -latitude;

    let longitude = convertCoordinate(lonRaw, 'lon');
    if (lonDir === 'W') longitude = -longitude;

    return {
      deviceId,
      manufacturerCode: mfr,
      messageType: 'V4',
      timestamp: parseTimestamp(timeStr, dateStr),
      gpsValid,
      latitude,
      longitude,
      speed: knotsToKmh(speedKnots),
      heading,
      vehicleStatus: statusHex,
      alarms: parseAlarms(statusHex),
    };
  } catch (err) {
    logger.warn({ err, parts }, 'SinoTrack: failed to parse V4 message');
    return null;
  }
}

/**
 * Extract individual messages from a raw TCP data buffer.
 * Messages are delimited by * (start) and # (end).
 */
export function extractMessages(buffer: string): { messages: string[]; remainder: string } {
  const messages: string[] = [];
  let remainder = buffer;

  while (true) {
    const start = remainder.indexOf('*');
    if (start === -1) break;

    const end = remainder.indexOf('#', start);
    if (end === -1) {
      remainder = remainder.substring(start);
      break;
    }

    messages.push(remainder.substring(start, end + 1));
    remainder = remainder.substring(end + 1);
  }

  if (remainder.indexOf('*') === -1) {
    remainder = '';
  }

  return { messages, remainder };
}
