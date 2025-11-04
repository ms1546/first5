import { z } from 'zod';
import { intakeNormalizedSchema } from './intake';

export const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  definitionOfDone: z.string(),
  estimatedMinutes: z.number().int().positive().max(240),
  dependsOn: z.array(z.string()).default([]),
});

export type PlanStep = z.infer<typeof planStepSchema>;

export const planSchema = z.object({
  steps: z.array(planStepSchema).min(1),
  summary: z.string(),
  focus: z.array(z.string()),
});

export type Plan = z.infer<typeof planSchema>;

export const criticReportSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']),
  issues: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'error']),
      suggestion: z.string().nullable(),
    }),
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
    }),
  ),
});

export type CoachingPlan = z.infer<typeof coachingPlanSchema>;

export const workflowOutputSchema = z.object({
  normalized: intakeNormalizedSchema,
  plan: planSchema,
  review: criticReportSchema,
  coaching: coachingPlanSchema,
});

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
