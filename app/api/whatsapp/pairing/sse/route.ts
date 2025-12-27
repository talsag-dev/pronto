/**
 * WhatsApp Pairing SSE Stream
 * GET /api/whatsapp/pairing/sse
 *
 * Server-Sent Events (SSE) endpoint that streams WhatsApp session status updates.
 * Proxies SSE stream from the WhatsApp worker to the client for real-time updates.
 */

import { getAuthenticatedUser } from '@/lib/api';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user (can't use withErrorHandler for streaming)
    const user = await getAuthenticatedUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Initialize repository
    const orgsRepo = new OrganizationsRepository(supabaseAdmin);

    // 3. Get user's organization
    const org = await orgsRepo.getByOwnerId(user.id);
    if (!org) {
      return new Response('Organization not found', { status: 404 });
    }

    // 4. Setup worker connection
    const WORKER_URL =
      process.env.WHATSAPP_WORKER_URL || 'http://localhost:4000';
    const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';

    logger.info('Starting SSE stream proxy', {
      userId: user.id,
      orgId: org.id,
    });

    // 5. Fetch SSE stream from worker
    const response = await fetch(
      `${WORKER_URL}/session/${org.id}/sse?secret=${WORKER_SECRET}`
    );

    if (!response.ok) {
      logger.error('Worker SSE stream failed', {
        status: response.status,
        orgId: org.id,
      });
      return new Response('Worker error', { status: 500 });
    }

    // 6. Proxy stream from worker to client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          logger.error('SSE stream error', { error: err, orgId: org.id });
        } finally {
          reader.releaseLock();
          controller.close();
          logger.info('SSE stream closed', { orgId: org.id });
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('SSE endpoint error', { error });
    return new Response('Internal Server Error', { status: 500 });
  }
}
