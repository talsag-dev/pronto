/**
 * Client Exports
 *
 * Central export point for all external service clients.
 */

export { BaileysClient, baileysClient } from './baileys.client';
export type {
  SendMessageParams as BaileysSendMessageParams,
  SendMessageResponse as BaileysSendMessageResponse,
  InitSessionParams,
  SessionStatusResponse,
  PairingCodeParams,
  PairingCodeResponse,
} from './baileys.client';

export { OpenAIClient, openAIClient } from './openai.client';
export type {
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionResponse,
} from './openai.client';

export { MixpanelClient, mixpanelClient } from './mixpanel.client';
export type {
  TrackEventParams,
  UserProperties,
} from './mixpanel.client';
