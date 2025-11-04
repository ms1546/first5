import { createWorkflow } from '@mastra/core/workflows';
import { workflowInputSchema } from '../schemas/intake';
import { workflowOutputSchema } from '../schemas/plan';
import { intakeStep } from '../steps/intakeStep';
import { plannerStep } from '../steps/plannerStep';
import { criticStep } from '../steps/criticStep';
import { coachStep } from '../steps/coachStep';

export const agentPipelineWorkflow = createWorkflow({
  id: 'first5-agent-pipeline',
  description: 'Route a task through Intake -> Planner -> Critic -> Coach.',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(intakeStep)
  .map(async ({ inputData }) => ({
    normalized: inputData.normalized,
  }))
  .then(plannerStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    plan: getStepResult(plannerStep).plan,
  }))
  .then(criticStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    plan: getStepResult(plannerStep).plan,
    review: getStepResult(criticStep).review,
  }))
  .then(coachStep)
  .map(async ({ getStepResult }) => ({
    normalized: getStepResult(intakeStep).normalized,
    plan: getStepResult(plannerStep).plan,
    review: getStepResult(criticStep).review,
    coaching: getStepResult(coachStep).coaching,
  }))
  .commit();
