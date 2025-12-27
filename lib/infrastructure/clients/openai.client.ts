/**
 * OpenAI Client
 *
 * Wrapper for OpenAI API calls.
 * Encapsulates chat completions and token tracking.
 */

import OpenAI from 'openai';
import { env } from '@/lib/shared/config';
import { logger } from '@/lib/shared/utils';
import { ExternalServiceError } from '@/lib/shared/utils/errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

export class OpenAIClient {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || env.OPENAI_API_KEY,
    });
    this.defaultModel = defaultModel || 'gpt-4o-mini';
  }

  /**
   * Get chat completion from OpenAI
   */
  async getChatCompletion(
    params: ChatCompletionParams
  ): Promise<ChatCompletionResponse> {
    try {
      logger.info('Requesting OpenAI chat completion', {
        model: params.model || this.defaultModel,
        messageCount: params.messages.length,
      });

      const completion = await this.client.chat.completions.create({
        model: params.model || this.defaultModel,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        stream: false, // Always false for non-streaming requests
      });

      // Type guard: completion is ChatCompletion when stream is false
      if (!('choices' in completion)) {
        throw new ExternalServiceError(
          'OpenAI',
          'Invalid response format from OpenAI'
        );
      }

      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new ExternalServiceError(
          'OpenAI',
          'No response from OpenAI'
        );
      }

      const response: ChatCompletionResponse = {
        content: choice.message.content || '',
        tokenUsage: {
          prompt: completion.usage?.prompt_tokens || 0,
          completion: completion.usage?.completion_tokens || 0,
          total: completion.usage?.total_tokens || 0,
        },
        model: completion.model,
        finishReason: choice.finish_reason,
      };

      logger.info('OpenAI chat completion received', {
        model: response.model,
        tokens: response.tokenUsage.total,
        finishReason: response.finishReason,
      });

      return response;
    } catch (error) {
      logger.error('OpenAI chat completion failed', error);

      if (error instanceof OpenAI.APIError) {
        throw new ExternalServiceError(
          'OpenAI',
          error.message,
          {
            status: error.status,
            code: error.code,
            type: error.type,
          }
        );
      }

      throw new ExternalServiceError(
        'OpenAI',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Generate AI response for lead conversation
   */
  async generateLeadResponse(
    conversationHistory: ChatMessage[],
    systemPrompt: string,
    options: {
      model?: string;
      temperature?: number;
    } = {}
  ): Promise<ChatCompletionResponse> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    return this.getChatCompletion({
      messages,
      model: options.model || this.defaultModel,
      temperature: options.temperature ?? 0.7,
      maxTokens: 1000,
    });
  }

  /**
   * Generate conversation summary
   */
  async generateSummary(
    conversationHistory: ChatMessage[],
    maxLength: number = 200
  ): Promise<string> {
    const summaryPrompt = `Summarize the following conversation in ${maxLength} characters or less. Focus on key points and action items.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: summaryPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    const response = await this.getChatCompletion({
      messages,
      model: 'gpt-4o-mini', // Use cheaper model for summaries
      temperature: 0.5,
      maxTokens: 150,
    });

    return response.content;
  }

  /**
   * Analyze conversation sentiment
   */
  async analyzeSentiment(
    message: string
  ): Promise<'positive' | 'neutral' | 'negative'> {
    const sentimentPrompt = `Analyze the sentiment of the following message. Respond with only one word: "positive", "neutral", or "negative".

Message: ${message}`;

    try {
      const response = await this.getChatCompletion({
        messages: [{ role: 'user', content: sentimentPrompt }],
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 10,
      });

      const sentiment = response.content.toLowerCase().trim();

      if (['positive', 'neutral', 'negative'].includes(sentiment)) {
        return sentiment as 'positive' | 'neutral' | 'negative';
      }

      return 'neutral';
    } catch (error) {
      logger.error('Failed to analyze sentiment', error);
      return 'neutral';
    }
  }

  /**
   * Generate nudge message for inactive lead
   */
  async generateNudgeMessage(
    leadName: string | null,
    conversationHistory: ChatMessage[],
    languagePreference: 'he' | 'en' = 'he'
  ): Promise<string> {
    const language = languagePreference === 'he' ? 'Hebrew' : 'English';
    const nudgePrompt = `Generate a friendly follow-up message in ${language} for a lead${
      leadName ? ` named ${leadName}` : ''
    } who hasn't responded in a while.

Keep it short, natural, and contextual based on the conversation history.
Don't be pushy. Make it sound human and conversational.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: nudgePrompt },
      ...conversationHistory.slice(-5), // Last 5 messages for context
    ];

    const response = await this.getChatCompletion({
      messages,
      model: this.defaultModel,
      temperature: 0.8,
      maxTokens: 150,
    });

    return response.content;
  }

  /**
   * Check if message needs moderation
   */
  async checkModeration(content: string): Promise<boolean> {
    try {
      const moderation = await this.client.moderations.create({
        input: content,
      });

      const flagged = moderation.results[0]?.flagged || false;

      if (flagged) {
        logger.warn('Content flagged by OpenAI moderation', {
          categories: moderation.results[0]?.categories,
        });
      }

      return flagged;
    } catch (error) {
      logger.error('Moderation check failed', error);
      // Fail open - don't block on moderation errors
      return false;
    }
  }
}

// Singleton instance
let openAIClientInstance: OpenAIClient | null = null;

/**
 * Get or create OpenAI client instance
 */
export function openAIClient(): OpenAIClient {
  if (!openAIClientInstance) {
    openAIClientInstance = new OpenAIClient();
  }
  return openAIClientInstance;
}
