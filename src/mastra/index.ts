import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { agentPipelineWorkflow } from './workflows/agentPipeline';

export const mastra = new Mastra({
  workflows: {
    agentPipelineWorkflow,
  },
  logger: new ConsoleLogger(),
  storage: new LibSQLStore({
    url: ':memory:',
  }),
});

export type { WorkflowInput } from './schemas/intake';
export type { WorkflowOutput } from './schemas/plan';
export { agentPipelineWorkflow };
