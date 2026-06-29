import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { bindAuthLogging, logActivity } from "@/lib/activityLogger";

/**
 * Mounts inside <BrowserRouter> and logs:
 *  - auth events (sign in / sign out)
 *  - page views on every route change
 *  - time spent on previous page (duration_ms)
 */
export default function ActivityTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);
  const lastAt = useRef<number>(Date.now());

  useEffect(() => {
    bindAuthLogging();
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    const now = Date.now();
    const duration = lastPath.current ? now - lastAt.current : undefined;
    logActivity({
      event_type: "pageview",
      event_name: document.title || path,
      path,
      duration_ms: duration,
      metadata: { previous: lastPath.current },
    });
    lastPath.current = path;
    lastAt.current = now;
  }, [location.pathname, location.search]);

  return null;
}
