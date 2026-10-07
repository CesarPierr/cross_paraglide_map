/**
 * User contributions: quick feedback on a documented item, corrections and
 * new local phenomena. The same TypeBox schema validates requests on the API
 * and types the web client.
 */
import { Type, type Static } from '@sinclair/typebox';

export const ContributionKind = Type.Union([
  Type.Literal('confirm'),
  Type.Literal('dispute'),
  Type.Literal('correct'),
  Type.Literal('new'),
  Type.Literal('comment'),
]);

export const PhenomenonCategory = Type.Union([
  Type.Literal('breeze'),
  Type.Literal('convergence'),
  Type.Literal('hazard'),
  Type.Literal('thermal'),
  Type.Literal('soaring'),
  Type.Literal('takeoff'),
  Type.Literal('landing'),
  Type.Literal('other'),
]);

const LonLat = Type.Tuple([Type.Number({ minimum: -180, maximum: 180 }), Type.Number({ minimum: -90, maximum: 90 })]);

export const ContributionInput = Type.Object(
  {
    kind: ContributionKind,
    /** Item concerned, e.g. "atlas:chartreuse/brise-gresivaudan" (absent for a new phenomenon). */
    targetRef: Type.Optional(Type.String({ maxLength: 200 })),
    category: Type.Optional(PhenomenonCategory),
    title: Type.Optional(Type.String({ maxLength: 160 })),
    message: Type.String({ minLength: 2, maxLength: 4000 }),
    /** Point, or a path in the direction of the flow for a breeze. */
    geometry: Type.Optional(
      Type.Union([
        Type.Object({ type: Type.Literal('Point'), coordinates: LonLat }),
        Type.Object({ type: Type.Literal('LineString'), coordinates: Type.Array(LonLat, { minItems: 2, maxItems: 50 }) }),
      ]),
    ),
    /** Free structured details: hours, strength, wind directions, altitude… */
    details: Type.Optional(Type.Record(Type.String({ maxLength: 40 }), Type.String({ maxLength: 300 }), { maxProperties: 20 })),
    sourceUrl: Type.Optional(Type.String({ format: 'uri', maxLength: 500 })),
    /** Context the user saw (simulated hour, synoptic wind…), helps moderation. */
    context: Type.Optional(Type.Record(Type.String({ maxLength: 40 }), Type.Union([Type.String({ maxLength: 120 }), Type.Number()]), { maxProperties: 20 })),
    author: Type.Optional(Type.String({ maxLength: 80 })),
    email: Type.Optional(Type.String({ format: 'email', maxLength: 160 })),
  },
  { additionalProperties: false },
);
export type ContributionInput = Static<typeof ContributionInput>;

export const ContributionStatus = Type.Union([Type.Literal('pending'), Type.Literal('accepted'), Type.Literal('rejected')]);
export type ContributionStatus = Static<typeof ContributionStatus>;

export const Contribution = Type.Intersect([
  Type.Omit(ContributionInput, ['email']),
  Type.Object({
    id: Type.String(),
    status: ContributionStatus,
    createdAt: Type.String(),
  }),
]);
export type Contribution = Static<typeof Contribution>;

/** Aggregated quick feedback for one item. */
export const FeedbackSummary = Type.Object({
  targetRef: Type.String(),
  confirm: Type.Integer(),
  dispute: Type.Integer(),
  correct: Type.Integer(),
  comment: Type.Integer(),
});
export type FeedbackSummary = Static<typeof FeedbackSummary>;
