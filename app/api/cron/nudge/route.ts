/**
 * Nudge Cron Job
 * GET /api/cron/nudge
 *
 * Automated job that sends gentle nudge messages to stale leads.
 * Runs daily via Vercel Cron or external scheduler.
 * Secured with CRON_SECRET bearer token.
 */

import { successResponse, withErrorHandler, commonErrors } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase';
import {
  OrganizationsRepository,
  LeadsRepository,
  MessagesRepository,
} from '@/lib/infrastructure/repositories';
import { generateNudgeMessage } from '@/lib/services/ai-processor';
import { SYSTEM_PROMPTS } from '@/lib/ai/agents';
import { logger } from '@/lib/shared/utils';

/**
 * Verify cron request authorization
 */
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  return authHeader === expectedAuth;
}

export const GET = withErrorHandler(async (request: Request) => {
  // 1. Verify cron authorization
  if (!verifyCronSecret(request)) {
    logger.warn('Unauthorized nudge cron attempt');
    return commonErrors.unauthorized();
  }

  logger.info('Nudge cron job started');

  const results: Array<{ org: string; lead: string; status: string }> = [];

  // 2. Fetch all organizations
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);
  const leadsRepo = new LeadsRepository(supabaseAdmin);
  const messagesRepo = new MessagesRepository(supabaseAdmin);

  const orgs = await orgsRepo.listAll();

  if (!orgs || orgs.length === 0) {
    logger.info('No organizations found for nudge cron');
    return successResponse({ message: 'No organizations found', results: [] });
  }

  logger.info('Processing nudges for organizations', { count: orgs.length });

  // 3. Process each organization
  for (const org of orgs) {
    try {
      logger.debug('Processing nudge for organization', {
        orgId: org.id,
        orgName: org.name,
      });

      // Get system prompt for this org
      const orgConfig = org.config as Record<string, any> | null;
      const systemPrompt =
        orgConfig?.system_prompt || (SYSTEM_PROMPTS.SALES as string);

      // 4. Find stale leads (no message in 3 days)
      const staleLeads = await leadsRepo.getLeadsForNudge(org.id, 72); // 72 hours = 3 days

      if (!staleLeads || staleLeads.length === 0) {
        logger.debug('No stale leads found for organization', {
          orgId: org.id,
        });
        continue;
      }

      logger.info('Found stale leads for nudge', {
        orgId: org.id,
        leadsCount: staleLeads.length,
      });

      // 5. Process each stale lead (limit to 5 per org)
      const leadsToProcess = staleLeads.slice(0, 5);

      for (const lead of leadsToProcess) {
        try {
          // Generate org-specific nudge message using AI processor
          const nudgeMessage = await generateNudgeMessage(
            org.name,
            systemPrompt,
            lead.status || 'new'
          );

          if (!nudgeMessage || nudgeMessage.trim() === '') {
            logger.warn('Empty nudge message generated', {
              orgId: org.id,
              leadId: lead.id,
            });
            continue;
          }

          // Save nudge message to database
          await messagesRepo.createMessage({
            organizationId: org.id,
            leadId: lead.id,
            role: 'assistant',
            content: nudgeMessage,
          });

          // Update lead's last message timestamp
          await leadsRepo.updateLastMessageAt(lead.id);

          logger.info('Nudge sent successfully', {
            orgName: org.name,
            leadPhone: lead.phone,
            messageLength: nudgeMessage.length,
          });

          results.push({
            org: org.name,
            lead: lead.phone,
            status: 'nudged',
          });

          // TODO: Send actual WhatsApp message via WAHA or WhatsApp Cloud API
          // await sendNudgeMessage(org, lead, nudgeMessage);
        } catch (error) {
          logger.error('Failed to process nudge for lead', {
            error,
            orgId: org.id,
            leadId: lead.id,
          });
          results.push({
            org: org.name,
            lead: lead.phone,
            status: 'failed',
          });
        }
      }
    } catch (error) {
      logger.error('Failed to process nudges for organization', {
        error,
        orgId: org.id,
      });
    }
  }

  logger.info('Nudge cron job completed', {
    totalNudges: results.filter((r) => r.status === 'nudged').length,
    totalFailed: results.filter((r) => r.status === 'failed').length,
  });

  return successResponse({ results });
});
