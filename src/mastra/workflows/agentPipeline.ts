import { createWorkflow } from "@mastra/core/workflows";
import { workflowInputSchema } from "../schemas/intake";
import { workflowOutputSchema } from "../schemas/plan";
import { coachStep } from "../steps/coachStep";
import { criticStep } from "../steps/criticStep";
import { intakeStep } from "../steps/intakeStep";
import { interviewStep } from "../steps/interviewStep";
import { plannerStep } from "../steps/plannerStep";
import { schedulerStep } from "../steps/schedulerStep";

export const agentPipelineWorkflow = createWorkflow({
  id: "first5-agent-pipeline",
  description: "Route a task through Intake -> Planner -> Critic -> Coach.",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(intakeStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    history: getStepResult(intakeStep).history ?? [],
  }))
  .then(interviewStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    history: getStepResult(intakeStep).history ?? [],
    interview: getStepResult(interviewStep).interview,
  }))
  .then(plannerStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    history: getStepResult(intakeStep).history ?? [],
    interview: getStepResult(interviewStep).interview,
    plan: getStepResult(plannerStep).plan,
  }))
  .then(criticStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    history: getStepResult(intakeStep).history ?? [],
    interview: getStepResult(interviewStep).interview,
    plan: getStepResult(plannerStep).plan,
    review: getStepResult(criticStep).review,
  }))
  .then(schedulerStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    history: getStepResult(intakeStep).history ?? [],
    interview: getStepResult(interviewStep).interview,
    plan: getStepResult(plannerStep).plan,
    review: getStepResult(criticStep).review,
    scheduling: getStepResult(schedulerStep).scheduling,
  }))
  .then(coachStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    interview: getStepResult(interviewStep).interview,
    plan: getStepResult(plannerStep).plan,
    review: getStepResult(criticStep).review,
    scheduling: getStepResult(schedulerStep).scheduling,
    coaching: getStepResult(coachStep).coaching,
  }))
  .commit();
