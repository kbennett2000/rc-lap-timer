"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recentSessions } from "@/domain/sessions";
import type { Session } from "@/domain/types";
import { SessionCard } from "./session-card";

export function RecentSessions({ sessions, onDelete }: { sessions: Session[]; onDelete: (session: Session) => void }) {
  const recent = recentSessions(sessions, 3);
  if (recent.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.map((session) => (
          <SessionCard key={session.id} session={session} onDelete={onDelete} />
        ))}
      </CardContent>
    </Card>
  );
}
