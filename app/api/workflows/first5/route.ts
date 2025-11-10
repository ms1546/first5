qimport;
{
  NextResponse;
}
from;
("next/server");

import { workflowInputSchema } from "@/src/mastra/schemas/intake";
import { agentPipelineWorkflow } from "@/src/mastra/workflows/agentPipeline";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = workflowInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "入力内容の検証に失敗しました。",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const run = await agentPipelineWorkflow.createRunAsync();
    const result = await run.start({ inputData: parsed.data });

    return NextResponse.json(result, { status: 200 });
  } catch (_error) {
    return NextResponse.json(
      {
        error: "サーバー内部でエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}
