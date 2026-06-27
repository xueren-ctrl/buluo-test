/**
 * 统计卡片 — 简约风格
 */
import type { PlayerInfo } from "@/types";
import type { SchedulerSettings } from "@/lib/indexeddb";

export function StatsCards({
  playerInfo,
  activeCount,
  completedCount,
  settings,
}: {
  playerInfo: PlayerInfo | null;
  activeCount: number;
  completedCount: number;
  settings: SchedulerSettings | null;
}) {
  return (
    <section className="w-full grid grid-cols-3 gap-2.5 mb-4">
      <div className="coc-card p-3 text-center">
        <p className="text-base font-bold text-main coc-countdown">
          {playerInfo?.town_hall_level ? `Lv${playerInfo.town_hall_level}` : "—"}
        </p>
        <p className="text-[11px] text-muted mt-0.5">大本等级</p>
      </div>
      <div className="coc-card p-3 text-center">
        <p className="text-base font-bold text-main coc-countdown">{activeCount}</p>
        <p className="text-[11px] text-muted mt-0.5">进行中</p>
      </div>
      <div className="coc-card p-3 text-center">
        <p className="text-base font-bold text-success coc-countdown">{completedCount}</p>
        <p className="text-[11px] text-muted mt-0.5">已完成</p>
      </div>
    </section>
  );
}

export default StatsCards;
