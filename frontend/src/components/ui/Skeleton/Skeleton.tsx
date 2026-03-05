"use client";

interface SkeletonLineProps {
  size?: "sm" | "md" | "lg";
  width?: string;
}

export function SkeletonLine({ size = "md", width = "100%" }: SkeletonLineProps) {
  const height = size === "sm" ? 10 : size === "lg" ? 18 : 14;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: "color-mix(in srgb, var(--color-bg-tertiary) 80%, #ffffff 20%)",
      }}
    />
  );
}

interface SkeletonUsageGridProps {
  items?: number;
}

export function SkeletonUsageGrid({ items = 4 }: SkeletonUsageGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      }}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: 10,
            background: "var(--color-bg-tertiary)",
          }}
        >
          <SkeletonLine size="sm" width="70%" />
          <div style={{ marginTop: 8 }}>
            <SkeletonLine size="md" width="45%" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SkeletonTableRowsProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTableRows({ rows = 5, columns = 6 }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={`${rowIndex}-${colIndex}`} style={{ padding: "12px 0" }}>
              <SkeletonLine size="sm" width="80%" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
