import { z } from 'zod';

export const taskTypeSchema = z.enum([
  'procedure',
  'housework',
  'study',
  'work',
  'health',
  'misc',
]);

export const urgencySchema = z.enum(['high', 'mid', 'low']);

export const horizonSchema = z.enum([
  'same_day',
  'weekly',
  'monthly',
  'long_term',
]);

export const intakeNormalizedSchema = z.object({
  intent: z.string(),
  type: taskTypeSchema,
  deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  urgency_suggested: urgencySchema,
  urgency_final: urgencySchema.optional(),
  horizon: horizonSchema,
  constraints: z.object({
    time_limit: z.string().nullable().optional(),
    place: z.string().nullable().optional(),
    resources: z.array(z.string()),
  }),
  notes: z.string().nullable().optional(),
});

export type TaskType = z.infer<typeof taskTypeSchema>;
export type Urgency = z.infer<typeof urgencySchema>;
export type Horizon = z.infer<typeof horizonSchema>;
export type IntakeNormalized = z.infer<typeof intakeNormalizedSchema>;

export const intakeStepOutputSchema = z.object({
  normalized: intakeNormalizedSchema,
  heuristics: z.object({
    detectedKeywords: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    rationale: z.array(z.string()),
  }),
});

export type IntakeStepOutput = z.infer<typeof intakeStepOutputSchema>;

export const workflowInputSchema = z.object({
  task: z.string().min(1, 'task cannot be empty'),
  userDeadline: z
    .union([
      z.string().datetime({ offset: true }),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ])
    .nullable()
    .optional(),
  userUrgency: urgencySchema.optional(),
  timezone: z.string().optional(),
  minutesAvailable: z.number().int().positive().max(480).optional(),
  preferredPlace: z.string().optional(),
  requiredResources: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
