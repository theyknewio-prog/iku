/* SkeletonGrid — loading placeholder for video grids */

interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 20 }: SkeletonGridProps) {
  return (
    <div className="video-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-card animate-fade-in"
          style={{ animationDelay: `${i * 30}ms` }}
        >
          {/* Thumbnail area */}
          <div className="skeleton-thumb" />

          {/* Body */}
          <div style={{ padding: "10px 12px 12px" }}>
            {/* Title line 1 */}
            <div
              className="skeleton-line skeleton"
              style={{ width: "90%", marginBottom: "6px" }}
            />
            {/* Title line 2 */}
            <div
              className="skeleton-line skeleton"
              style={{ width: "65%", marginBottom: "10px" }}
            />
            {/* Meta */}
            <div
              className="skeleton-line skeleton"
              style={{ width: "45%", height: "10px" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
