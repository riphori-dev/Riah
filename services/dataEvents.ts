type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifyDataChanged(): void {
  for (const listener of listeners) listener();
}
