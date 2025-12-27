/**
 * Mixpanel Analytics Client
 *
 * Wrapper for Mixpanel browser SDK for tracking user events and analytics.
 * Used for understanding user behavior and product analytics.
 */

import mixpanel from 'mixpanel-browser';

export interface TrackEventParams {
  eventName: string;
  properties?: Record<string, any>;
}

export interface UserProperties {
  [key: string]: any;
}

/**
 * Mixpanel Client
 *
 * Provides methods for tracking events and user properties.
 */
export class MixpanelClient {
  private initialized = false;

  /**
   * Initialize Mixpanel with project token
   */
  init(token: string): void {
    if (this.initialized) {
      return;
    }

    mixpanel.init(token, {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: false,
      persistence: 'localStorage',
      api_host: 'https://api-eu.mixpanel.com',
      ignore_dnt: true,
    });

    this.initialized = true;
  }

  /**
   * Track an event
   */
  track(params: TrackEventParams): void {
    if (!this.initialized) {
      console.warn('Mixpanel not initialized');
      return;
    }

    try {
      mixpanel.track(params.eventName, params.properties);
    } catch (error) {
      console.error('Mixpanel track error:', error);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.initialized) {
      console.warn('Mixpanel not initialized');
      return;
    }

    try {
      mixpanel.people.set(properties);
    } catch (error) {
      console.error('Mixpanel set properties error:', error);
    }
  }

  /**
   * Identify user
   */
  identify(userId: string): void {
    if (!this.initialized) {
      console.warn('Mixpanel not initialized');
      return;
    }

    try {
      mixpanel.identify(userId);
    } catch (error) {
      console.error('Mixpanel identify error:', error);
    }
  }

  /**
   * Track page view
   */
  trackPageView(pageName?: string): void {
    if (!this.initialized) {
      console.warn('Mixpanel not initialized');
      return;
    }

    try {
      mixpanel.track_pageview(pageName ? { page: pageName } : undefined);
    } catch (error) {
      console.error('Mixpanel track pageview error:', error);
    }
  }

  /**
   * Reset user identity (on logout)
   */
  reset(): void {
    if (!this.initialized) {
      return;
    }

    try {
      mixpanel.reset();
    } catch (error) {
      console.error('Mixpanel reset error:', error);
    }
  }
}

// Singleton instance
export const mixpanelClient = new MixpanelClient();
