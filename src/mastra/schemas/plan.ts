import { z } from "zod";
import { MAX_PLAN_STEP_MINUTES, MAX_TASK_MINUTES } from "../constants/time";
import { intakeNormalizedSchema } from "./intake";

export const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  definitionOfDone: z.string(),
  estimatedMinutes: z.number().int().positive().max(MAX_PLAN_STEP_MINUTES),
  dependsOn: z.array(z.string()).default([]),
});

export type PlanStep = z.infer<typeof planStepSchema>;

export const planSchema = z.object({
  steps: z.array(planStepSchema).min(1),
  summary: z.string(),
  focus: z.array(z.string()),
});

export type Plan = z.infer<typeof planSchema>;

export const interviewQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  purpose: z.string(),
  field: z.enum([
    "deadline",
    "scope",
    "resources",
    "time_allocation",
    "place",
    "stakeholders",
    "calendar",
  ]),
  suggestedAnswer: z.string().nullable().optional(),
});

export const interviewSchema = z.object({
  summary: z.string(),
  goal: z.string(),
  assumptions: z.array(z.string()),
  questions: z.array(interviewQuestionSchema).min(1),
  status: z.enum(["needs_input", "ready"]),
  confidence: z.number().min(0).max(1),
  gaps: z.array(z.string()),
  followUps: z.array(z.string()).default([]),
  nextQuestion: z.string().nullable().optional(),
});

export type Interview = z.infer<typeof interviewSchema>;

export const criticReportSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]),
  issues: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning", "error"]),
      suggestion: z.string().nullable(),
    })
  ),
  approvals: z.array(z.string()),
});

export type CriticReport = z.infer<typeof criticReportSchema>;

export const coachingPlanSchema = z.object({
  script: z.string(),
  nudges: z.array(z.string()),
  checkpoints: z.array(
    z.object({
      label: z.string(),
      minutesOffset: z.number().int().nonnegative(),
    })
  ),
});

export type CoachingPlan = z.infer<typeof coachingPlanSchema>;

export const schedulingSlotSchema = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  label: z.string(),
  reason: z.string(),
});

export const schedulingPlanSchema = z.object({
  title: z.string(),
  timezone: z.string(),
  durationMinutes: z.number().int().positive().max(MAX_TASK_MINUTES),
  primary: schedulingSlotSchema,
  fallbacks: z.array(schedulingSlotSchema),
  preparation: z.array(z.string()),
  calendarNote: z.string(),
  followUps: z.array(z.string()).default([]),
});

export type SchedulingPlan = z.infer<typeof schedulingPlanSchema>;

export const workflowOutputSchema = z.object({
  normalized: intakeNormalizedSchema,
  interview: interviewSchema,
  plan: planSchema,
  review: criticReportSchema,
  scheduling: schedulingPlanSchema,
  coaching: coachingPlanSchema,
});

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
