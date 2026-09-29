'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export interface DonutDatum {
  name: string;
  value: number;
  colour: string;
}

/**
 * The recharts half of DeviceDonut, split out so its parent can
 * `next/dynamic(..., { ssr: false })` it and keep recharts out of the initial
 * bundle. The arc carries no numbers (the legend does), and in jsdom
 * ResponsiveContainer measures 0x0 so it renders nothing — which is why the
 * DeviceDonut unit test asserts on the legend, not on this. Deferring it changes
 * nothing about correctness; it only moves the library off the critical path.
 */
export function DeviceDonutChart({ data }: { data: DonutDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="100%"
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.colour} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
