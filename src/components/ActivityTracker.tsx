import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { bindAuthLogging, logActivity } from "@/lib/activityLogger";

/**
 * Mounts inside <BrowserRouter> and logs:
 *  - auth events (sign in / sign out)
 *  - page views on every route change (with duration of previous page)
 *  - meaningful clicks on buttons / links / menu items (with readable labels)
 *  - form submissions
 */

function readableLabel(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();
  const title = el.getAttribute("title");
  if (title) return title.trim();
  const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
  if (text) return text.length > 80 ? text.slice(0, 77) + "…" : text;
  const name = el.getAttribute("name") || el.getAttribute("id");
  return name || el.tagName.toLowerCase();
}

function findClickable(target: EventTarget | null): HTMLElement | null {
  let node = target as HTMLElement | null;
  while (node && node !== document.body) {
    if (
      node.tagName === "BUTTON" ||
      node.tagName === "A" ||
      node.getAttribute("role") === "button" ||
      node.getAttribute("role") === "menuitem" ||
      node.getAttribute("role") === "tab" ||
      node.getAttribute("role") === "option" ||
      node.hasAttribute("data-track")
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export default function ActivityTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);
  const lastAt = useRef<number>(Date.now());

  useEffect(() => {
    bindAuthLogging();
  }, []);

  // Page views
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

  // Clicks
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = findClickable(e.target);
      if (!el) return;
      const label = readableLabel(el);
      if (!label) return;
      const href = el.getAttribute("href");
      const role = el.getAttribute("role") || el.tagName.toLowerCase();
      logActivity({
        event_type: "click",
        event_name: label,
        metadata: {
          label,
          element: role,
          href: href || undefined,
          section: el.closest("[data-section]")?.getAttribute("data-section") || undefined,
        },
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Form submissions
  useEffect(() => {
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      if (!form || form.tagName !== "FORM") return;
      const label =
        form.getAttribute("aria-label") ||
        form.getAttribute("name") ||
        form.getAttribute("id") ||
        "Formulário";
      logActivity({
        event_type: "form.submit",
        event_name: label,
        metadata: { label },
      });
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return null;
}

