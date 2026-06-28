// Local history (IndexedDB) of generated marketing posts.
// Stores full-resolution images so the user can revisit, download and copy later.

const DB_NAME = "zeus_marketing_history";
const STORE = "posts";
const VERSION = 1;

export type HistorySlide = {
  role: "cover" | "content" | "cta";
  imageBase64: string;
  headline: string;
  subheadline: string;
};

export type HistoryPost = {
  id: string;
  createdAt: number;
  vehicleName: string | null;
  vehicleBrand: string | null;
  format: "feed" | "story";
  tone: string;
  mode: string;
  carousel: boolean;
  slidesCount: number;
  phrase: string;
  caption: string;
  hashtags: string[];
  imageBase64: string; // cover / single
  slides?: HistorySlide[];
  thumbBase64?: string; // small jpg for fast gallery rendering
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function makeThumb(base64: string, max = 320): Promise<string | undefined> {
  try {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    const ratio = Math.min(max / img.width, max / img.height, 1);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, w, h);
    const data = canvas.toDataURL("image/jpeg", 0.78);
    return data.split(",")[1];
  } catch {
    return undefined;
  }
}

export async function savePost(
  post: Omit<HistoryPost, "id" | "createdAt" | "thumbBase64">,
): Promise<HistoryPost> {
  const thumbBase64 = await makeThumb(post.imageBase64);
  const full: HistoryPost = {
    ...post,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    thumbBase64,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(full);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return full;
}

export async function listPosts(): Promise<HistoryPost[]> {
  const db = await openDb();
  const items = await new Promise<HistoryPost[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as HistoryPost[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPost(id: string): Promise<HistoryPost | null> {
  const db = await openDb();
  const item = await new Promise<HistoryPost | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as HistoryPost) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return item;
}

export async function deletePost(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAllPosts(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
