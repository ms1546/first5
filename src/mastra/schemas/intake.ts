import { z } from "zod";
import { MAX_TASK_MINUTES } from "../constants/time";

export const taskTypeSchema = z.enum([
  "procedure",
  "housework",
  "study",
  "work",
  "health",
  "misc",
]);

export const urgencySchema = z.enum(["high", "mid", "low"]);

export const horizonSchema = z.enum([
  "same_day",
  "weekly",
  "monthly",
  "long_term",
]);

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

export const intakeNormalizedSchema = z.object({
  intent: z.string(),
  type: taskTypeSchema,
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  timezone: z.string().nullable().optional(),
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
  history: z.array(conversationMessageSchema).optional(),
});

export type IntakeStepOutput = z.infer<typeof intakeStepOutputSchema>;

export const workflowInputSchema = z.object({
  task: z.string().min(1, "task cannot be empty"),
  userDeadline: z
    .union([
      z.string().datetime({ offset: true }),
      z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    ])
    .nullable()
    .optional(),
  userUrgency: urgencySchema.optional(),
  timezone: z.string().optional(),
  minutesAvailable: z
    .number()
    .int()
    .positive()
    .max(MAX_TASK_MINUTES)
    .optional(),
  preferredPlace: z.string().optional(),
  requiredResources: z.array(z.string()).optional(),
  notes: z.string().optional(),
  history: z.array(conversationMessageSchema).optional(),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
