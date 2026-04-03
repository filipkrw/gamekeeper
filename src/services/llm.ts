import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { config } from "../config.ts";
import { log } from "../logger.ts";

const client = new OpenAI({
  apiKey: config.ai.apiKey || "unused",
  baseURL: config.ai.baseUrl,
});

export type { ChatCompletionMessageParam, ChatCompletionTool };

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string>;

export async function chatCompletion(
  messages: ChatCompletionMessageParam[],
  tools?: ChatCompletionTool[],
  executeTool?: ToolExecutor,
): Promise<string | null> {
  try {
    const response = await client.chat.completions.create({
      model: config.ai.model,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
    });

    let choice = response.choices[0];
    if (!choice) return null;

    // Handle tool calls (single round)
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0 && executeTool) {
      const toolMessages: ChatCompletionMessageParam[] = [
        ...messages,
        choice.message,
      ];

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        let result: string;
        try {
          result = await executeTool(toolCall.function.name, args);
        } catch (error) {
          result = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Get final response after tool execution
      const followUp = await client.chat.completions.create({
        model: config.ai.model,
        messages: toolMessages,
      });

      choice = followUp.choices[0];
      if (!choice) return null;
    }

    return choice.message.content;
  } catch (error) {
    log.error("LLM API call failed", { error: String(error) });
    return null;
  }
}
