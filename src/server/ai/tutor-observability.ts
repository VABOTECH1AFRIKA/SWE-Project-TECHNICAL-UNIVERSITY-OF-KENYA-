export interface TutorObservation {
  provider: string;
  mode: string;
  success: boolean;
  durationMs: number;
  providerDurationMs: number;
  errorCode?: string;
}

export interface TutorObservability {
  record(observation: TutorObservation): void;
}

export class NoopTutorObservability implements TutorObservability {
  record(_observation: TutorObservation): void {
    // Intentionally no-op until the project chooses an operational metrics sink.
  }
}
