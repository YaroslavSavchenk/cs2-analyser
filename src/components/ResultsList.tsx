import { useMemo, useState } from "react";
import { Crosshair, Skull, Target } from "lucide-react";
import type { AnalysisEvent, AnalysisResult } from "../lib/tauri";
import { Card, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

type Grouped = {
  round: number;
  events: AnalysisEvent[];
  kills: number;
  deaths: number;
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
    .map(([round, evs]) => ({
      round,
      events: evs,
      kills: evs.filter((e) => e.type === "kill").length,
      deaths: evs.filter((e) => e.type === "death").length,
    }));
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
  const [filter, setFilter] = useState<number | null>(null);

  const totalKills = useMemo(
    () => result.events.filter((e) => e.type === "kill").length,
    [result.events],
  );
  const totalDeaths = useMemo(
    () => result.events.filter((e) => e.type === "death").length,
    [result.events],
  );
  const totalHs = useMemo(
    () =>
      result.events.filter((e) => e.type === "kill" && e.headshot).length,
    [result.events],
  );
  const hsPct = totalKills ? Math.round((totalHs / totalKills) * 100) : 0;
  const peakKills = useMemo(
    () => grouped.reduce((m, g) => Math.max(m, g.kills), 0),
    [grouped],
  );

  const visible = filter == null ? grouped : grouped.filter((g) => g.round === filter);

  return (
    <div className="flex flex-col gap-4 hud-fade-up">
      {/* ===== Stat strip ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <StatTile
          label="Map"
          value={result.map.replace(/^de_/, "").toUpperCase()}
          hint={result.map}
        />
        <StatTile
          label="Rounds"
          value={result.rounds.toString().padStart(2, "0")}
        />
        <StatTile
          label="Duration"
          value={formatDuration(result.duration_seconds)}
        />
        <StatTile label="Kills" value={totalKills.toString()} accent />
        <StatTile label="Deaths" value={totalDeaths.toString()} variant="t" />
        <StatTile label="HS %" value={`${hsPct}`} suffix="%" />
      </div>

      {/* ===== Horizontal round strip ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Round map</CardTitle>
            <Badge variant="ghost">
              {grouped.length} of {result.rounds} played
            </Badge>
          </div>
          <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-cs-muted">
            <span>peak {peakKills}k</span>
            <span className="text-cs-border-bright">/</span>
            <button
              type="button"
              onClick={() => setFilter(null)}
              className={cn(
                "text-cs-text-dim hover:text-cs-orange transition-colors",
                filter == null && "text-cs-orange",
              )}
            >
              all
            </button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto hud-scrollbar">
          <ol className="flex items-stretch gap-1 p-3 min-w-max">
            {grouped.map((g) => (
              <li key={g.round}>
                <RoundChip
                  round={g.round}
                  kills={g.kills}
                  deaths={g.deaths}
                  peak={peakKills}
                  active={filter === g.round}
                  onClick={() =>
                    setFilter((cur) => (cur === g.round ? null : g.round))
                  }
                />
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* ===== Event timeline ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Event log</CardTitle>
            <Badge variant="ghost">
              {visible.reduce((n, g) => n + g.events.length, 0)} events
            </Badge>
            {filter != null ? (
              <Badge variant="available">
                round {filter.toString().padStart(2, "0")}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-cs-muted">
            <Legend tone="orange" label="kill" />
            <Legend tone="t" label="death" />
            <Legend tone="gold" label="hs" />
          </div>
        </CardHeader>

        <div className="max-h-[460px] overflow-auto hud-scrollbar">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-[11px] text-cs-muted uppercase tracking-[0.18em]">
              No events recorded.
            </div>
          ) : (
            <ul>
              {visible.map((g, idx) => (
                <li
                  key={g.round}
                  className={cn(
                    idx > 0 && "border-t border-cs-border",
                  )}
                >
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

function Legend({
  tone,
  label,
}: {
  tone: "orange" | "t" | "gold";
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5",
          tone === "orange" && "bg-cs-orange",
          tone === "t" && "bg-cs-t",
          tone === "gold" && "bg-cs-gold",
        )}
      />
      <span>{label}</span>
    </span>
  );
}

function StatTile({
  label,
  value,
  suffix,
  hint,
  accent,
  variant,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  accent?: boolean;
  variant?: "default" | "t";
}) {
  return (
    <div
      className={cn(
        "relative border border-cs-border bg-cs-charcoal-2 rounded-none px-3 py-2.5",
        "flex flex-col gap-1.5",
        accent && "border-cs-orange/45 bg-cs-orange/[0.04]",
        variant === "t" && "border-cs-t/35 bg-cs-t/[0.04]",
      )}
    >
      {/* corner accent */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 right-0 w-2 h-2 border-t border-r",
          accent
            ? "border-cs-orange"
            : variant === "t"
              ? "border-cs-t"
              : "border-cs-border-bright",
        )}
      />
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-text-dim font-bold">
          {label}
        </span>
        {hint ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cs-muted truncate">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span
          className={cn(
            "display-numeral text-[22px] leading-none text-cs-text-bright tabular",
            accent && "text-cs-orange",
            variant === "t" && "text-cs-t-bright",
          )}
        >
          {value}
        </span>
        {suffix ? (
          <span
            className={cn(
              "font-mono text-[12px] leading-none text-cs-text-dim ml-0.5",
              accent && "text-cs-orange/80",
            )}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RoundChip({
  round,
  kills,
  deaths,
  peak,
  active,
  onClick,
}: {
  round: number;
  kills: number;
  deaths: number;
  peak: number;
  active: boolean;
  onClick: () => void;
}) {
  const fillPct = peak === 0 ? 0 : Math.round((kills / peak) * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1 px-1 py-1.5 w-11",
        "border border-cs-border bg-cs-charcoal-3 rounded-none",
        "hover:border-cs-orange/60 hover:bg-cs-charcoal-4 transition-colors",
        active && "border-cs-orange bg-cs-orange/[0.08]",
      )}
      aria-label={`Round ${round}: ${kills} kills, ${deaths} deaths`}
    >
      <span
        className={cn(
          "font-mono text-[9px] uppercase tracking-[0.16em] text-cs-muted",
          active && "text-cs-orange",
        )}
      >
        R{round.toString().padStart(2, "0")}
      </span>
      {/* mini kill-density bar */}
      <span className="relative block w-full h-1 bg-cs-black border border-cs-border">
        <span
          className={cn(
            "absolute left-0 top-0 h-full",
            active ? "bg-cs-orange-bright" : "bg-cs-orange",
          )}
          style={{ width: `${fillPct}%` }}
        />
      </span>
      <span className="font-mono text-[11px] leading-none text-cs-text-bright tabular font-bold">
        {kills}
        <span className="text-cs-muted">/{deaths}</span>
      </span>
    </button>
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
          "shrink-0 w-16 flex flex-col items-center justify-center gap-0.5",
          "bg-cs-charcoal-3 border-r border-cs-border",
          "relative",
        )}
      >
        {/* vertical orange tick */}
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-px bg-cs-orange/60"
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cs-muted font-bold">
          Round
        </span>
        <span className="display-numeral text-[18px] leading-none text-cs-text-bright tabular">
          {round.toString().padStart(2, "0")}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cs-text-dim tabular">
          {events.filter((e) => e.type === "kill").length}k /{" "}
          {events.filter((e) => e.type === "death").length}d
        </span>
      </div>
      <ul className="flex-1">
        {events.map((e, i) => (
          <li
            key={`${round}-${e.tick}-${i}`}
            className={i > 0 ? "border-t border-cs-border/40" : undefined}
          >
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
      <div
        className={cn(
          "relative grid grid-cols-[72px_1fr_auto] items-center gap-3 px-3 py-2",
          "hover:bg-cs-charcoal-3/60 transition-colors group",
        )}
      >
        {/* left orange marker */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-px bg-cs-orange/30 group-hover:bg-cs-orange/80 transition-colors"
        />
        <span className="font-mono text-[10px] text-cs-muted tabular">
          t{formatTick(event.tick)}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <Crosshair
            className="size-3.5 text-cs-orange shrink-0"
            strokeWidth={2}
          />
          <span className="text-[12px] text-cs-text-bright truncate font-semibold font-mono">
            {event.attacker.name}
          </span>
          <span
            aria-hidden
            className="font-mono text-cs-muted text-[10px] tracking-widest"
          >
            ━▶
          </span>
          <span className="text-[12px] text-cs-text-dim truncate font-mono">
            {event.victim.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cs-text-dim">
            {formatWeapon(event.weapon)}
          </span>
          {event.headshot ? (
            <span
              className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cs-gold font-bold"
              title="Headshot"
            >
              <Target className="size-2.5" strokeWidth={2.5} />
              HS
            </span>
          ) : (
            <span className="w-[22px]" />
          )}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative grid grid-cols-[72px_1fr_auto] items-center gap-3 px-3 py-2",
        "hover:bg-cs-charcoal-3/60 transition-colors group",
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-px bg-cs-t/30 group-hover:bg-cs-t/80 transition-colors"
      />
      <span className="font-mono text-[10px] text-cs-muted tabular">
        t{formatTick(event.tick)}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <Skull className="size-3.5 text-cs-t shrink-0" strokeWidth={2} />
        <span className="text-[12px] text-cs-text-bright truncate font-semibold font-mono">
          {event.victim.name}
        </span>
        {event.killer ? (
          <>
            <span
              aria-hidden
              className="font-mono text-cs-muted text-[10px] tracking-widest"
            >
              ◀━
            </span>
            <span className="text-[12px] text-cs-text-dim truncate font-mono">
              {event.killer.name}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-cs-muted italic font-mono">
            world
          </span>
        )}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cs-text-dim">
        {event.weapon ? formatWeapon(event.weapon) : "—"}
      </span>
    </div>
  );
}
