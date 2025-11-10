import { ConsoleLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { agentPipelineWorkflow as pipelineWorkflow } from "./workflows/agentPipeline";

export const mastra = new Mastra({
  workflows: {
    agentPipelineWorkflow: pipelineWorkflow,
  },
  logger: new ConsoleLogger(),
  storage: new LibSQLStore({
    url: ":memory:",
  }),
});

export type { WorkflowInput } from "./schemas/intake";
export type { WorkflowOutput } from "./schemas/plan";
export { agentPipelineWorkflow } from "./workflows/agentPipeline";
