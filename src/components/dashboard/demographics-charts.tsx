"use client";

import { useMemo } from "react";
import { GlobeHemisphereWest, GenderIntersex, MapPin, UsersThree } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { getDemographicsEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";

export type DemographicRow = {
  dimension: string;
  key: string;
  value: number;
  fetched_at: string | null;
};

interface DemographicsChartsProps {
  demographics: DemographicRow[];
  followersCount: number | null;
  isImporting?: boolean;
}

const DONUT_COLORS = [
  "var(--secondary)",
  "var(--tertiary)",
  "var(--quaternary)",
  "var(--chart-5)",
];

function getLatestByDimension(
  rows: DemographicRow[],
  dimension: string
): DemographicRow[] {
  const filtered = rows.filter((r) => r.dimension === dimension);
  if (filtered.length === 0) return [];

  // Find the latest fetched_at for this dimension
  const latestFetchedAt = filtered.reduce((latest, r) => {
    if (!r.fetched_at) return latest;
    if (!latest) return r.fetched_at;
    return r.fetched_at > latest ? r.fetched_at : latest;
  }, null as string | null);

  if (!latestFetchedAt) return filtered;

  return filtered
    .filter((r) => r.fetched_at === latestFetchedAt)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

const barChartConfig = {
  value: {
    label: "Followers",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const genderChartConfig = {
  value: {
    label: "Percentage",
  },
} satisfies ChartConfig;

function BarChartSection({
  data,
  title,
  description,
  icon,
  iconColor,
  isImporting,
}: {
  data: DemographicRow[];
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: "primary" | "secondary" | "tertiary" | "quaternary";
  isImporting: boolean;
}) {
  const chartData = useMemo(
    () =>
      data.map((row) => ({
        name: row.key,
        value: row.value,
      })),
    [data]
  );

  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.value, 0),
    [chartData]
  );
  const emptyStateCopy = getDemographicsEmptyStateCopy(isImporting);

  if (chartData.length === 0) {
    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardIcon color={iconColor}>{icon}</StickerCardIcon>
        <StickerCardHeader>
          <StickerCardTitle>{title}</StickerCardTitle>
          <StickerCardDescription>{description}</StickerCardDescription>
        </StickerCardHeader>
        <StickerCardContent>
          <EmptyState
            icon={icon}
            iconColor={iconColor}
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
          />
        </StickerCardContent>
      </StickerCard>
    );
  }

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color={iconColor}>{icon}</StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>{title}</StickerCardTitle>
        <StickerCardDescription>{description}</StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <ChartContainer
          config={barChartConfig}
          className="h-[300px] w-full"
          role="img"
          aria-label={`${title} bar chart. Top entry: ${chartData[0]?.name} at ${total > 0 ? ((chartData[0]?.value / total) * 100).toFixed(1) : 0}%`}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
          >
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v: number) =>
                total > 0 ? `${((v / total) * 100).toFixed(0)}%` : `${v}`
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => {
                    const v = Number(value);
                    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                    return `${pct}% (${v.toLocaleString()})`;
                  }}
                />
              }
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </StickerCardContent>
    </StickerCard>
  );
}

function GenderDonutChart({
  data,
  isImporting,
}: {
  data: DemographicRow[];
  isImporting: boolean;
}) {
  const chartData = useMemo(() => {
    const total = data.reduce((sum, r) => sum + r.value, 0);
    return data.map((row, i) => ({
      name: row.key,
      value: row.value,
      percentage: total > 0 ? ((row.value / total) * 100).toFixed(1) : "0",
      fill: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
  }, [data]);
  const emptyStateCopy = getDemographicsEmptyStateCopy(isImporting);

  if (chartData.length === 0) {
    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardIcon color="tertiary">
          <GenderIntersex weight="bold" className="size-6" />
        </StickerCardIcon>
        <StickerCardHeader>
          <StickerCardTitle>Gender Split</StickerCardTitle>
          <StickerCardDescription>
            Follower breakdown by gender
          </StickerCardDescription>
        </StickerCardHeader>
        <StickerCardContent>
          <EmptyState
            icon={<GenderIntersex weight="bold" className="size-7" />}
            iconColor="tertiary"
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
          />
        </StickerCardContent>
      </StickerCard>
    );
  }

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="tertiary">
        <GenderIntersex weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Gender Split</StickerCardTitle>
        <StickerCardDescription>
          Follower breakdown by gender
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <ChartContainer
            config={genderChartConfig}
            className="h-[200px] w-[200px]"
            role="img"
            aria-label={`Gender distribution: ${chartData.map((d) => `${d.name} ${d.percentage}%`).join(", ")}`}
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const pct = item.payload?.percentage ?? "0";
                      return `${pct}% (${Number(value).toLocaleString()})`;
                    }}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                strokeWidth={2}
                stroke="var(--foreground)"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex flex-col gap-2">
            {chartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-full border-2 border-foreground"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-sm font-medium">
                  {entry.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {entry.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </StickerCardContent>
    </StickerCard>
  );
}

export function DemographicsCharts({
  demographics,
  followersCount,
  isImporting = false,
}: DemographicsChartsProps) {
  if (followersCount !== null && followersCount < 100) {
    return (
      <div className="mt-12 space-y-4">
        <h2 className="font-heading text-2xl font-bold">Demographics</h2>
        <StickerCard className="hover:rotate-0 hover:scale-100">
          <StickerCardContent>
            <EmptyState
              icon={<UsersThree weight="bold" className="size-7" />}
              iconColor="secondary"
              title="Audience insights unlock at 100 followers"
              description={`You're at ${followersCount.toLocaleString()} — keep growing!`}
            />
          </StickerCardContent>
        </StickerCard>
      </div>
    );
  }

  const countries = getLatestByDimension(demographics, "country");
  const cities = getLatestByDimension(demographics, "city");
  const genderData = getLatestByDimension(demographics, "gender");

  return (
    <div className="mt-12 space-y-10">
      <h2 className="font-heading text-2xl font-bold">Demographics</h2>

      <div className="grid gap-10 pt-4 md:grid-cols-2">
        <BarChartSection
          data={countries}
          title="Top Countries"
          description="Where your followers are located"
          icon={<GlobeHemisphereWest weight="bold" className="size-6" />}
          iconColor="primary"
          isImporting={isImporting}
        />
        <BarChartSection
          data={cities}
          title="Top Cities"
          description="Cities with the most followers"
          icon={<MapPin weight="bold" className="size-6" />}
          iconColor="quaternary"
          isImporting={isImporting}
        />
      </div>

      <div className="mx-auto max-w-lg pt-4">
        <GenderDonutChart data={genderData} isImporting={isImporting} />
      </div>
    </div>
  );
}
