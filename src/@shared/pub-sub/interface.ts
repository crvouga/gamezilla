export type Listener = (message: unknown) => void;

export type Unsubscribe = () => void;

export interface PubSub {
  publish(topic: string, message: unknown): void;
  subscribe(topic: string, listener: Listener): Unsubscribe;
  next(topic: string): Promise<unknown>;
}
