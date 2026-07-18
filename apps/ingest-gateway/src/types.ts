import type { BaseEvent } from "@monitor/event-contract";

export interface EventBatchRequest {
  projectId: string;
  sdkKey: string;
  events: unknown[];
}

export interface Rejection {
  id?: string;
  reason: string;
}

export interface BatchResult {
  accepted: number;
  rejected: number;
  rejections: Rejection[];
}

export interface AuthorizedProject {
  id: string;
  allowedOrigins: string[];
}

export type ValidatedEvent = BaseEvent & {
  projectId: string;
  sessionId: string;
  schemaVersion: "1.0";
};
