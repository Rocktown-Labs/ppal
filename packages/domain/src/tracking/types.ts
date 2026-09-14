import type {
  SportsEventStatus,
  TicketLegOperator,
  TicketLegStatus,
  TicketStatus,
} from "@ppal/contracts/tickets";

export interface LegEventSnapshot {
  awayParticipantId: string | null;
  awayScore: number | null;
  homeParticipantId: string | null;
  homeScore: number | null;
  status: SportsEventStatus;
}

export interface LegEvaluationInput {
  currentValue: number | null;
  event: LegEventSnapshot | null;
  lostAt: Date | null;
  operator: TicketLegOperator;
  participantId: string | null;
  settledAt: Date | null;
  status: TicketLegStatus;
  targetValue: number | null;
  wonAt: Date | null;
}

export interface LegEvaluationResult extends LegEvaluationInput {
  changed: boolean;
}

export interface TicketEvaluationInput {
  legStatuses: readonly TicketLegStatus[];
  settledAt: Date | null;
  status: TicketStatus;
}

export interface TicketEvaluationResult extends TicketEvaluationInput {
  changed: boolean;
}
