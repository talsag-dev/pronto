/**
 * WhatsApp Worker Webhook
 * POST /api/webhooks/whatsapp
 *
 * Receives WhatsApp messages from the Baileys worker service.
 * Validates worker secret and processes messages asynchronously.
 */

import { successResponse, withErrorHandler, commonErrors } from '@/lib/api';
import { handleIncomingMessage } from '@/lib/services/message-handler';
import { logger } from '@/lib/shared/utils';

export const maxDuration = 60; // Allow 60s timeout for long-running AI processing

function validateWorkerSecret(request: Request): boolean {
  const secret = request.headers.get('x-worker-secret');
  const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';
  return secret === WORKER_SECRET;
}

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Validate worker secret
  if (!validateWorkerSecret(request)) {
    logger.warn('Unauthorized worker webhook attempt');
    return commonErrors.unauthorized();
  }

  // 2. Parse request body
  const { orgId, message, type } = await request.json();

  if (!orgId || !message) {
    return commonErrors.badRequest('Missing orgId or message');
  }

  // 3. Extract message details
  const whatsappMessageId = message?.key?.id;
  const senderPn = message.senderPn;
  const from = message.key.remoteJid!;
  const isFromMe = message.key.fromMe || false;
  const pushName = message.pushName || '';

  // Extract text from various message types
  const messageText =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    '';

  if (!messageText) {
    logger.info('No text content in message, skipping', {
      orgId,
      from,
      whatsappMessageId,
    });
    return successResponse({ success: true, skipped: true });
  }

  logger.info('Worker webhook received', {
    orgId,
    from,
    pushName,
    isFromMe,
    whatsappMessageId,
  });

  // 4. Process message asynchronously (don't block worker)
  handleIncomingMessage(
    orgId,
    from,
    messageText,
    isFromMe,
    pushName,
    whatsappMessageId,
    senderPn
  ).catch((err) => {
    logger.error('Async message handler error', {
      error: err,
      orgId,
      from,
      whatsappMessageId,
    });
  });

  // 5. Return immediate success (processing continues in background)
  return successResponse({ success: true });
});
