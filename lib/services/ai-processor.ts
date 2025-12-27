/**
 * AI Processor Service
 *
 * Centralized service for processing messages with OpenAI GPT-4o.
 * Handles conversation history, tool calls (calendar availability), and response generation.
 */

import { openai } from '@/lib/ai/config';
import { checkAvailability } from '@/lib/integrations/cal';
import { SYSTEM_PROMPTS } from '@/lib/ai/agents';
import { logger } from '@/lib/shared/utils';

export interface AIProcessorOptions {
  organizationId: string;
  organizationName: string;
  systemPrompt?: string;
  calAccessToken?: string | null;
  conversationHistory: Array<{ role: string; content: string }>;
  userMessage: string;
}

export interface AIProcessorResult {
  response: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
}

/**
 * Process a message with OpenAI and return AI response
 */
export async function processMessageWithAI(
  options: AIProcessorOptions
): Promise<AIProcessorResult> {
  const {
    organizationId,
    organizationName,
    systemPrompt,
    calAccessToken,
    conversationHistory,
    userMessage,
  } = options;

  // Use provided system prompt or default to SALES prompt
  const effectiveSystemPrompt = systemPrompt || (SYSTEM_PROMPTS.SALES as string);

  // Define available tools (currently only calendar availability)
  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'check_availability',
        description: 'Check calendar availability for scheduling meetings',
        parameters: {
          type: 'object',
          properties: {
            startTime: {
              type: 'string',
              description: 'Start time in ISO 8601 format',
            },
            endTime: {
              type: 'string',
              description: 'End time in ISO 8601 format',
            },
          },
          required: ['startTime', 'endTime'],
        },
      },
    },
  ];

  // Build message context for AI
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: effectiveSystemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  logger.debug('Processing message with AI', {
    orgId: organizationId,
    orgName: organizationName,
    messageCount: messages.length,
    hasCalIntegration: !!calAccessToken,
  });

  // Call OpenAI with tool support
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: messages as any,
    tools: tools as any,
    tool_choice: 'auto',
  });

  const aiMessage = completion.choices[0].message;
  let finalResponse = aiMessage.content || '';
  const toolCallResults: Array<{
    name: string;
    arguments: any;
    result: any;
  }> = [];

  // Handle tool calls if AI wants to check availability
  if (aiMessage.tool_calls && calAccessToken) {
    logger.debug('AI requested tool calls', {
      orgId: organizationId,
      toolCallCount: aiMessage.tool_calls.length,
    });

    for (const toolCall of aiMessage.tool_calls) {
      const tc = toolCall as any;
      if (tc.function?.name === 'check_availability') {
        try {
          const args = JSON.parse(tc.function.arguments);
          const availabilityResult = await checkAvailability(
            args.startTime,
            args.endTime,
            calAccessToken
          );

          // Update response with availability information
          finalResponse = `Based on the calendar: ${JSON.stringify(availabilityResult)}`;

          toolCallResults.push({
            name: 'check_availability',
            arguments: args,
            result: availabilityResult,
          });

          logger.info('Calendar availability checked', {
            orgId: organizationId,
            available: availabilityResult,
            startTime: args.startTime,
            endTime: args.endTime,
          });
        } catch (error) {
          logger.error('Calendar availability check failed', {
            error,
            orgId: organizationId,
          });
          // Don't throw - continue with original response
        }
      }
    }
  }

  logger.info('AI response generated', {
    orgId: organizationId,
    responseLength: finalResponse.length,
    toolCallCount: toolCallResults.length,
  });

  return {
    response: finalResponse,
    toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
  };
}

/**
 * Generate a nudge message for a stale lead
 */
export async function generateNudgeMessage(
  organizationName: string,
  systemPrompt: string,
  leadStatus: string
): Promise<string> {
  const messages = [
    {
      role: 'system' as const,
      content: `You are an assistant for ${organizationName}. ${systemPrompt}. The user hasn't replied in 3 days. Send a gentle, short bump message.`,
    },
    {
      role: 'user' as const,
      content: `Last status: ${leadStatus}`,
    },
  ];

  logger.debug('Generating nudge message', {
    orgName: organizationName,
    leadStatus,
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: messages as any,
  });

  const nudgeMessage = completion.choices[0].message.content || '';

  logger.debug('Nudge message generated', {
    orgName: organizationName,
    messageLength: nudgeMessage.length,
  });

  return nudgeMessage;
}
