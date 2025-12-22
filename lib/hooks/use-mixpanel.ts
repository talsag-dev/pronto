import mixpanel from "mixpanel-browser";
import { useEffect } from "react";

export const useMixpanel = () => {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      // Initialize if not already initialized
      // @ts-ignore - mixpanel-browser doesn't have a public 'initialized' prop, but we can check if init was called
      if (!mixpanel.__loaded) {
        console.log("Initializing Mixpanel via hook...");
        mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
          debug: true,
          track_pageview: false,
          persistence: "localStorage",
          api_host: "https://api-eu.mixpanel.com",
          ignore_dnt: true,
        });
        
        mixpanel.track("Mixpanel Initialized", {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        });
        
        mixpanel.track_pageview();
      }
    }
  }, []);

  const track = (name: string, props?: Record<string, any>) => {
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      try {
        mixpanel.track(name, props);
      } catch (err) {
        console.error("Mixpanel track error:", err);
      }
    }
  };

  return { track, mixpanel };
};
