import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "godalz_msg_queue";
const SEND_DELAY_MS = 500;
const REMOVE_ON_SUCCESS_MS = 2000;

export type QueuedSendStatus = "queued" | "sending" | "sent" | "failed";

export interface QueuedMessage {
  id: string;
  conversationId: string;
  phone: string;
  text: string;
  replyToMessageId?: string | null;
  sendStatus: QueuedSendStatus;
  attemptCount: number;
  errorMessage?: string;
  createdAt: number;
}

function loadQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedMessage[];
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch {
    // ignore quota errors
  }
}

function newId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type QueueSendFn = (
  item: QueuedMessage,
) => Promise<{ ok: boolean; error?: string }>;

export type QueueStatusListener = (
  item: QueuedMessage,
  status: QueuedSendStatus,
) => void;

export function useMessageQueue() {
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueue());
  const processingRef = useRef(false);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setQueue(loadQueue());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const enqueue = useCallback(
    (msg: Omit<QueuedMessage, "id" | "sendStatus" | "attemptCount" | "createdAt">) => {
      const item: QueuedMessage = {
        id: newId(),
        sendStatus: "queued",
        attemptCount: 0,
        createdAt: Date.now(),
        ...msg,
      };
      setQueue((q) => [...q, item]);
      return item;
    },
    [],
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const retryMessage = useCallback((id: string) => {
    setQueue((q) =>
      q.map((x) =>
        x.id === id ? { ...x, sendStatus: "queued", errorMessage: undefined } : x,
      ),
    );
  }, []);

  const getQueuedForConversation = useCallback(
    (conversationId: string) =>
      queue.filter((x) => x.conversationId === conversationId),
    [queue],
  );

  const getPendingCount = useCallback(
    () => queue.filter((x) => x.sendStatus !== "sent").length,
    [queue],
  );

  const processQueue = useCallback(
    async (sendFn: QueueSendFn, onStatusUpdate?: QueueStatusListener) => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        // snapshot & FIFO
        const snapshot = [...loadQueue()]
          .filter((x) => x.sendStatus === "queued" || x.sendStatus === "failed")
          .sort((a, b) => a.createdAt - b.createdAt);

        for (const item of snapshot) {
          // mark sending
          setQueue((q) =>
            q.map((x) =>
              x.id === item.id
                ? { ...x, sendStatus: "sending", attemptCount: x.attemptCount + 1 }
                : x,
            ),
          );
          onStatusUpdate?.(item, "sending");

          let res: { ok: boolean; error?: string };
          try {
            res = await sendFn(item);
          } catch (err) {
            res = { ok: false, error: err instanceof Error ? err.message : String(err) };
          }

          if (res.ok) {
            setQueue((q) =>
              q.map((x) =>
                x.id === item.id ? { ...x, sendStatus: "sent", errorMessage: undefined } : x,
              ),
            );
            onStatusUpdate?.(item, "sent");
            setTimeout(() => {
              setQueue((q) => q.filter((x) => x.id !== item.id));
            }, REMOVE_ON_SUCCESS_MS);
          } else {
            setQueue((q) =>
              q.map((x) =>
                x.id === item.id
                  ? { ...x, sendStatus: "failed", errorMessage: res.error || "Falha ao enviar" }
                  : x,
              ),
            );
            onStatusUpdate?.(item, "failed");
          }

          await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
        }
      } finally {
        processingRef.current = false;
      }
    },
    [],
  );

  return {
    queue,
    enqueue,
    getQueuedForConversation,
    getPendingCount,
    retryMessage,
    removeFromQueue,
    processQueue,
  };
}
