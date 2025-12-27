/**
 * Daily Summary Cron Job
 * GET /api/cron/summary
 *
 * Automated job that sends daily summary reports to organization owners.
 * Includes metrics like new leads, meetings booked, etc.
 * Runs daily via Vercel Cron or external scheduler.
 * Secured with CRON_SECRET bearer token.
 */

import { successResponse, withErrorHandler, commonErrors } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
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
    logger.warn('Unauthorized summary cron attempt');
    return commonErrors.unauthorized();
  }

  logger.info('Summary cron job started');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results: Array<{ org: string; summary: string }> = [];

  // 2. Fetch all organizations
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);
  const orgs = await orgsRepo.listAll();

  if (!orgs || orgs.length === 0) {
    logger.info('No organizations found for summary cron');
    return successResponse({
      success: true,
      message: 'No organizations found',
      results: [],
    });
  }

  logger.info('Processing summaries for organizations', { count: orgs.length });

  // 3. Process each organization
  for (const org of orgs) {
    try {
      logger.debug('Processing summary for organization', {
        orgId: org.id,
        orgName: org.name,
      });

      // 4. Fetch metrics for today
      const { count: newLeadsCount } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .gte('created_at', today.toISOString());

      // 5. Generate summary message
      const summary = `🚀 *Daily Update for ${org.name}*
📅 Date: ${today.toLocaleDateString()}

- New Leads: ${newLeadsCount || 0}
- Meetings Booked: (Check Dashboard)

Good job!`;

      logger.info('Summary generated', {
        orgName: org.name,
        businessPhone: org.business_phone,
        newLeadsCount: newLeadsCount || 0,
      });

      results.push({
        org: org.name,
        summary,
      });

      // TODO: Send summary via WhatsApp to business owner
      // Options:
      // 1. Send to org.business_phone via WAHA
      // 2. Send to org.owner_phone (if we add this field) via WhatsApp Cloud API
      // 3. Send via email integration
      // await sendSummaryMessage(org, summary);
    } catch (error) {
      logger.error('Failed to process summary for organization', {
        error,
        orgId: org.id,
      });
    }
  }

  logger.info('Summary cron job completed', {
    totalSummaries: results.length,
  });

  return successResponse({ success: true, results });
});
