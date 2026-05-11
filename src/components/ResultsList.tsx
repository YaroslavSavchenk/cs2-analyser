import { useMemo } from "react";
import { Crosshair, Skull, ArrowRight } from "lucide-react";
import type { AnalysisEvent, AnalysisResult } from "../lib/tauri";
import { Card, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

type Grouped = {
  round: number;
  events: AnalysisEvent[];
};

function groupByRound(events: AnalysisEvent[]): Grouped[] {
  const map = new Map<number, AnalysisEvent[]>();
  for (const e of events) {
    const arr = map.get(e.round);
    if (arr) arr.push(e);
    else map.set(e.round, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, events]) => ({ round, events }));
}

function formatTick(tick: number): string {
  return tick.toString().padStart(6, "0");
}

function formatWeapon(weapon: string): string {
  return weapon.replace(/^weapon_/, "").replace(/_/g, " ");
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ResultsListProps = {
  result: AnalysisResult;
};

export function ResultsList({ result }: ResultsListProps) {
  const grouped = useMemo(() => groupByRound(result.events), [result.events]);

  const totalKills = useMemo(
    () => result.events.filter((e) => e.type === "kill").length,
    [result.events],
  );
  const totalHs = useMemo(
    () =>
      result.events.filter((e) => e.type === "kill" && e.headshot).length,
    [result.events],
  );

  return (
    <div className="flex flex-col gap-4 cs-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Map" value={result.map} mono />
        <StatTile label="Rounds" value={result.rounds.toString()} mono />
        <StatTile
          label="Duration"
          value={formatDuration(result.duration_seconds)}
          mono
        />
        <StatTile
          label="Kills · HS%"
          value={`${totalKills} · ${totalKills ? Math.round((totalHs / totalKills) * 100) : 0}%`}
          mono
          accent
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Round timeline</CardTitle>
            <Badge variant="ghost">{result.events.length} events</Badge>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cs-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-cs-orange" />
              kill
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-cs-t" />
              death
            </span>
          </div>
        </CardHeader>

        <div className="max-h-[460px] overflow-auto cs-scrollbar">
          {grouped.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12px] text-cs-muted">
              No events recorded in this demo.
            </div>
          ) : (
            <ul className="divide-y divide-cs-border">
              {grouped.map((g) => (
                <li key={g.round}>
                  <RoundBlock round={g.round} events={g.events} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "border border-cs-border bg-cs-charcoal-2 rounded-cs-md px-3 py-2.5",
        "flex flex-col gap-1",
        accent && "border-cs-orange/40 bg-cs-orange/[0.04]",
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-dim">
        {label}
      </span>
      <span
        className={cn(
          "text-cs-text-bright text-sm",
          mono && "font-mono",
          accent && "text-cs-orange",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RoundBlock({
  round,
  events,
}: {
  round: number;
  events: AnalysisEvent[];
}) {
  return (
    <div className="flex items-stretch">
      <div
        className={cn(
          "shrink-0 w-14 flex flex-col items-center justify-center gap-0.5",
          "bg-cs-charcoal-3 border-r border-cs-border",
        )}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cs-muted">
          Round
        </span>
        <span className="font-mono text-base text-cs-text-bright">
          {round.toString().padStart(2, "0")}
        </span>
      </div>
      <ul className="flex-1 divide-y divide-cs-border/60">
        {events.map((e, i) => (
          <li key={`${round}-${e.tick}-${i}`}>
            <EventRow event={e} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventRow({ event }: { event: AnalysisEvent }) {
  if (event.type === "kill") {
    return (
      <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-3 py-2 hover:bg-cs-charcoal-3/60 transition-colors">
        <span className="font-mono text-[10px] text-cs-muted">
          t {formatTick(event.tick)}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <Crosshair className="size-3.5 text-cs-orange shrink-0" strokeWidth={2} />
          <span className="text-[12px] text-cs-text-bright truncate font-medium">
            {event.attacker.name}
          </span>
          <ArrowRight className="size-3 text-cs-muted shrink-0" />
          <span className="text-[12px] text-cs-text truncate">
            {event.victim.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cs-text-dim">
            {formatWeapon(event.weapon)}
          </span>
          {event.headshot ? (
            <span
              className="size-1.5 rounded-full bg-cs-orange"
              title="Headshot"
              aria-label="Headshot"
            />
          ) : (
            <span className="size-1.5" />
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-3 py-2 hover:bg-cs-charcoal-3/60 transition-colors">
      <span className="font-mono text-[10px] text-cs-muted">
        t {formatTick(event.tick)}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <Skull className="size-3.5 text-cs-t shrink-0" strokeWidth={2} />
        <span className="text-[12px] text-cs-text-bright truncate font-medium">
          {event.victim.name}
        </span>
        {event.killer ? (
          <>
            <ArrowRight className="size-3 text-cs-muted shrink-0 rotate-180" />
            <span className="text-[12px] text-cs-text truncate">
              {event.killer.name}
            </span>
          </>
        ) : (
          <span className="text-[12px] text-cs-muted italic">world</span>
        )}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cs-text-dim">
        {event.weapon ? formatWeapon(event.weapon) : "—"}
      </span>
    </div>
  );
}
