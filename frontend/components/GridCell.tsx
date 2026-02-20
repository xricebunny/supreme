"use client";

import { memo } from "react";
import { formatPayout } from "@/lib/formatters";

interface GridCellProps {
  row: number;
  col: number;
  payout: number;
  multiplier: number;
  isPast: boolean;
  isCurrentTimeCol: boolean;
  isCurrentPriceRow: boolean;
  rowDist: number;
}

function GridCellInner({
  row,
  col,
  payout,
  multiplier,
  isPast,
  isCurrentTimeCol,
  isCurrentPriceRow,
  rowDist,
}: GridCellProps) {
  const isFuture = !isPast && !isCurrentTimeCol;

  return (
    <div
      className="grid-cell"
      data-row={row}
      data-col={col}
      style={{
        opacity: isPast ? 0.35 : 1,
      }}
    >
      {/* Cell content - only show payout for future cells */}
      {isFuture && payout > 0 && (
        <span className="cell-payout">
          {formatPayout(payout)}
        </span>
      )}
    </div>
  );
}

const GridCell = memo(GridCellInner);
export default GridCell;
