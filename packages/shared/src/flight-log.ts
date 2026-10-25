/**
 * Flight logs of the game: what a flight did (track, controls, the air at the pilot and its
 * parts, the wing's incidents, the messages shown, the end), sent to the API in chunks so the
 * problems players meet can be replayed and diagnosed afterwards (scripts/dev/flight-logs.ts).
 *
 * Anonymous: a random id per browser (to follow one player's flights), no name, no room code,
 * no address; the player can turn it off in the game's menu. The API keeps them 180 days.
 */
import { Type, type Static } from '@sinclair/typebox';

/** Game seconds between two rows. */
export const FLIGHT_LOG_PERIOD_S = 0.5;

/**
 * Columns of a row, in order. Positions in metres in the take-off's local frame (east, north;
 * origin at `FlightLogStart.lon/lat`), angles in degrees, speeds in m/s. The air's vertical
 * speed at the pilot is `airW` = relief + rotor + lee + thermal + gust + max(anabatic, plume).
 */
export const FLIGHT_LOG_COLUMNS = [
  't', // game seconds since the log's start
  'phase', // 0 flying, 1 on the take-off (launch), 2 landing run
  'x',
  'y',
  'z',
  'agl',
  'heading',
  'bank',
  'pitch',
  'airspeed',
  'vz',
  'vario', // what the vario shows (filtered)
  'brakeL',
  'brakeR',
  'weight',
  'speedbar',
  'ears',
  'collapse',
  'frontal',
  'stall',
  'spin',
  'windU', // the air's horizontal speed at the pilot (east, north)
  'windV',
  'airW',
  'relief', // the relief's lift (wind over the fine terrain)
  'anabatic', // the upslope breeze along the nearest surface
  'plume', // the crest plume above a crest
  'thermal', // the air mass: thermals, background, convergences
  'gust', // turbulence (vertical)
  'sigmaW', // turbulence σw
  'rotor',
  'view', // 0 first person, 1 third person
  'fps',
] as const;
export type FlightLogColumn = (typeof FLIGHT_LOG_COLUMNS)[number];

const Scalar = Type.Union([Type.Number(), Type.String({ maxLength: 200 }), Type.Boolean(), Type.Null()]);
const Bag = Type.Record(Type.String({ maxLength: 40 }), Scalar, { maxProperties: 40 });

export const FlightLogStart = Type.Object(
  {
    /** Random id kept by the browser (no account, no name). */
    client: Type.String({ pattern: '^[a-z0-9]{8,32}$' }),
    /** Build of the game (date and commit). */
    build: Type.String({ maxLength: 60 }),
    takeoffId: Type.String({ maxLength: 200 }),
    takeoffName: Type.String({ maxLength: 200 }),
    /** Origin of the local frame (the take-off). */
    lon: Type.Number({ minimum: -180, maximum: 180 }),
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    /** The day's scenario (month, hour, wind, air mass, seed…) and the player's options (wing, start, view…). */
    scenario: Bag,
    options: Bag,
    /** Screen and device: size, pixel ratio, touch, the GPU's name. */
    device: Bag,
  },
  { additionalProperties: false },
);
export type FlightLogStart = Static<typeof FlightLogStart>;

export const FlightLogEvent = Type.Object(
  {
    t: Type.Number(),
    /** 'collapse-left', 'stall', 'message', 'liftoff', 'end', 'error', 'slow'… */
    kind: Type.String({ maxLength: 32 }),
    text: Type.Optional(Type.String({ maxLength: 300 })),
    data: Type.Optional(Bag),
  },
  { additionalProperties: false },
);
export type FlightLogEvent = Static<typeof FlightLogEvent>;

export const FlightLogChunk = Type.Object(
  {
    /** 0, 1, 2… in order; a chunk sent twice is kept once. */
    seq: Type.Integer({ minimum: 0, maximum: 20000 }),
    rows: Type.Array(Type.Array(Type.Number(), { maxItems: FLIGHT_LOG_COLUMNS.length }), { maxItems: 240 }),
    events: Type.Array(FlightLogEvent, { maxItems: 200 }),
    /** The flight's end (kind, reason, speeds), on the last chunk. */
    end: Type.Optional(Bag),
  },
  { additionalProperties: false },
);
export type FlightLogChunk = Static<typeof FlightLogChunk>;
