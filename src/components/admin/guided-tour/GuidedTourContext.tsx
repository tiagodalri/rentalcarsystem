import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TOUR_STEPS } from "./tourSteps";

const STORAGE_KEY = "admin.guidedTour.v1";

type PersistedState = {
  active: boolean;
  overlay: boolean;
  index: number;
};

interface GuidedTourContextValue {
  active: boolean;
  overlayVisible: boolean;
  index: number;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  goTo: (i: number) => void;
  hideOverlay: () => void;
  showOverlay: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);

function loadState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { active: false, overlay: false, index: 0 };
    const p = JSON.parse(raw) as PersistedState;
    return {
      active: Boolean(p.active),
      overlay: Boolean(p.overlay),
      index: Math.max(0, Math.min(TOUR_STEPS.length - 1, Number(p.index) || 0)),
    };
  } catch {
    return { active: false, overlay: false, index: 0 };
  }
}

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const initial = useRef<PersistedState>(loadState());
  const [active, setActive] = useState(initial.current.active);
  const [overlayVisible, setOverlayVisible] = useState(initial.current.overlay);
  const [index, setIndex] = useState(initial.current.index);
  const navigate = useNavigate();
  const location = useLocation();

  // Persistir para sobreviver a navegações
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ active, overlay: overlayVisible, index } satisfies PersistedState),
      );
    } catch {
      /* ignore */
    }
  }, [active, overlayVisible, index]);

  const navigateToStep = useCallback(
    (i: number) => {
      const step = TOUR_STEPS[i];
      if (!step) return;
      if (location.pathname !== step.route) {
        navigate(step.route);
      }
    },
    [navigate, location.pathname],
  );

  const start = useCallback(() => {
    setActive(true);
    setOverlayVisible(true);
    setIndex(0);
    navigateToStep(0);
  }, [navigateToStep]);

  const stop = useCallback(() => {
    setActive(false);
    setOverlayVisible(false);
    setIndex(0);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, i));
      setIndex(clamped);
      setOverlayVisible(true);
      navigateToStep(clamped);
    },
    [navigateToStep],
  );

  const next = useCallback(() => {
    if (index >= TOUR_STEPS.length - 1) {
      stop();
      return;
    }
    goTo(index + 1);
  }, [index, goTo, stop]);

  const prev = useCallback(() => goTo(Math.max(0, index - 1)), [goTo, index]);

  const hideOverlay = useCallback(() => setOverlayVisible(false), []);
  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    navigateToStep(index);
  }, [navigateToStep, index]);

  const value = useMemo(
    () => ({ active, overlayVisible, index, start, stop, next, prev, goTo, hideOverlay, showOverlay }),
    [active, overlayVisible, index, start, stop, next, prev, goTo, hideOverlay, showOverlay],
  );

  return <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>;
}

const NOOP_CTX: GuidedTourContextValue = {
  active: false,
  overlayVisible: false,
  index: 0,
  start: () => {},
  stop: () => {},
  next: () => {},
  prev: () => {},
  goTo: () => {},
  hideOverlay: () => {},
  showOverlay: () => {},
};

export function useGuidedTour() {
  return useContext(GuidedTourContext) ?? NOOP_CTX;
}
