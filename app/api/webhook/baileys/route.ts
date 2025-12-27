/**
 * Baileys Test Webhook
 * GET/POST /api/webhook/baileys
 *
 * Manual webhook trigger for testing Baileys message handling.
 * Used for development and testing purposes only.
 */

import { successResponse, withErrorHandler, commonErrors } from '@/lib/api';
import { handleIncomingMessage } from '@/lib/services/message-handler';
import { logger } from '@/lib/shared/utils';
import { z } from 'zod';

const testMessageSchema = z.object({
  orgId: z.string().uuid(),
  from: z.string().min(1),
  message: z.string().min(1),
});

export async function GET() {
  // Handlers are initialized in worker service
  return successResponse({
    status: 'handlers_managed_by_worker',
    message: 'Message handlers are managed by the worker service',
  });
}

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Parse and validate request body
  const body = await request.json();
  const validation = testMessageSchema.safeParse(body);

  if (!validation.success) {
    return commonErrors.validation(
      validation.error.issues.map((i) => i.message).join(', ')
    );
  }

  const { orgId, from, message } = validation.data;

  logger.info('Test webhook triggered', { orgId, from });

  // 2. Process message through handler
  await handleIncomingMessage(orgId, from, message);

  logger.info('Test message processed', { orgId, from });

  // 3. Return success
  return successResponse({ status: 'processed' });
});
