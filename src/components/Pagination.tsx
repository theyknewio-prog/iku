"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  hasNextPage: boolean;
  totalPages?: number; /* optional — if you know total */
}

export function Pagination({ currentPage, hasNextPage, totalPages }: PaginationProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();

  const goTo = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  /* Build visible page numbers */
  const pages: (number | "dots")[] = [];

  if (totalPages && totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (totalPages) {
    pages.push(1);
    if (currentPage > 3) pages.push("dots");
    const start = Math.max(2, currentPage - 1);
    const end   = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("dots");
    pages.push(totalPages);
  } else {
    /* No total — show prev/current/next */
    if (currentPage > 1) pages.push(currentPage - 1);
    pages.push(currentPage);
    if (hasNextPage) pages.push(currentPage + 1);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      {/* Prev */}
      <button
        className="pagination__btn"
        onClick={() => goTo(currentPage - 1)}
        data-disabled={currentPage <= 1 ? "" : undefined}
        aria-label="Previous page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Page numbers */}
      {pages.map((page, i) =>
        page === "dots" ? (
          <span key={`dots-${i}`} className="pagination__dots">
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            className={`pagination__btn${page === currentPage ? " pagination__btn--active" : ""}`}
            onClick={() => goTo(page as number)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        className="pagination__btn"
        onClick={() => goTo(currentPage + 1)}
        data-disabled={!hasNextPage ? "" : undefined}
        aria-label="Next page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
