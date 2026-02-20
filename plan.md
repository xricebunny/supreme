# Grid Panning & Multiplier Fix Plan

## What's Working
- Grid is correctly sized (21 cols × 10 rows, 72×56px cells)
- Y-axis and X-axis are separate from the grid (rendered outside the panning container)
- Price simulation ticks every 1 second, cycling through 60 data points
- Multiplier formula itself is mathematically sound

---

## Bug Analysis

### Bug 1: X-axis "rubber-bands" instead of infinitely scrolling

**Root cause — two compounding problems:**

1. **`panX` resets every 5 seconds.** In `GameGrid.tsx:43`, `panX = timeSlotProgress * CELL_WIDTH`. Since `timeSlotProgress = (tickIndex % 5) / 5` (from `useGameState.ts:45`), it cycles 0 → 0.2 → 0.4 → 0.6 → 0.8 → 0 → ... Every time `timeSlot` increments, `panX` snaps from ~57.6px back to 0px.

2. **CSS transition animates the snap-back.** `GameGrid.tsx:144` has `transition: "transform 0.3s ease-out"`. When `panX` resets from 57.6→0, the transition visibly animates the grid sliding *backwards* for 0.3 seconds. The time labels do recalculate (their `useMemo` depends on `timeSlot`), so the content shifts forward — but the visual snap-back makes it look like the grid bounces.

3. **Movement is jerky even between snaps.** `tickIndex` increments once per second (integer), so `panX` only updates in discrete jumps of `0.2 * 72 = 14.4px` per second. The CSS transition smooths each jump, but creates a "step-then-coast" pattern rather than continuous motion.

**In short:** The grid moves in 14.4px jumps with 0.3s easing, then every 5 seconds snaps backward 57.6px with a visible reverse animation. It should glide continuously left at 14.4 px/s without any jumps or reversals.

---

### Bug 2: Cell multipliers never adjust over time

**Root cause:** `GameGrid.tsx:126` — the `cells` useMemo depends on `[betSize, centerRow]`. Both are effectively constant (`betSize` defaults to 10, `centerRow` is always 5). The cells array is computed **once at mount** and never recomputes.

Since `colDist = c - CURRENT_TIME_COL` is always the same static integer for each column, and `timeSlot` is not in the dependency array, the multiplier values are frozen. As time passes:
- A cell at column 6 (colDist=1) should represent "less time in the future" as we progress through the slot, but its multiplier stays fixed at the colDist=1 value.
- When the slot boundary passes, the cell that was at colDist=1 should now be at colDist=0 (present), but nothing recalculates.

The cells never reflect that time has passed.

---

### Bug 3: Past overlay & time separator scroll with the grid

**Root cause:** The "past overlay" (`GameGrid.tsx:183-191`) and "current time column separator" (`GameGrid.tsx:172-180`) are **inside the panning container** (the `div` with `transform: translate(-panX, ...)`). They move with the grid instead of staying at a fixed screen position.

This means the vertical "now" line and the dimming overlay slide left with every pan step, then snap back. They should be fixed-position overlays that the grid content scrolls **under**.

---

### Bug 4: Time labels use wall-clock `new Date()` inside useMemo

**Root cause:** `GameGrid.tsx:65` creates `new Date()` inside a `useMemo` that depends on `[timeSlot]`. This means the labels are based on wall-clock time at the moment of recalculation, not on simulation time. It mostly works but can drift and causes labels to be slightly off from the actual simulated time positions.

---

## Fix Plan

### Overview of the new approach

Replace the "static grid that pans and snaps" with a **continuously scrolling grid** driven by `requestAnimationFrame`. The grid renders columns based on absolute time slot indices, and a sub-pixel offset handles smooth scrolling. No CSS transitions on the transform — the animation loop handles smoothness.

---

### Step 1: Create a `useAnimationTime` hook (new file)

**File:** `frontend/hooks/useAnimationTime.ts`

This hook replaces the time/panning logic currently split across `useSimulatedPrice` and `useGameState`:

```ts
export function useAnimationTime() {
  const startTimeRef = useRef(performance.now());
  const [timeSlot, setTimeSlot] = useState(0);
  const panXRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let lastSlot = 0;

    const animate = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const SLOT_MS = 5000;

      const currentSlot = Math.floor(elapsed / SLOT_MS);
      const progress = (elapsed % SLOT_MS) / SLOT_MS;
      const panX = progress * CELL_WIDTH; // 0 → 72px, continuous

      // Direct DOM update for panX (no React re-render)
      if (gridRef.current) {
        gridRef.current.style.transform = `translateX(${-panX}px)`;
      }
      if (xAxisRef.current) {
        xAxisRef.current.style.transform = `translateX(${-panX}px)`;
      }

      panXRef.current = panX;

      // Only trigger React re-render when timeSlot changes (every 5s)
      if (currentSlot !== lastSlot) {
        lastSlot = currentSlot;
        setTimeSlot(currentSlot);
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { timeSlot, gridRef, xAxisRef };
}
```

**Key design decisions:**
- `panX` is applied directly to the DOM via refs → 60fps smooth scrolling with zero React re-renders
- React state (`timeSlot`) only updates every 5 seconds → cells/labels recompute only when the content actually needs to change
- `panX` cycles 0→72px continuously. When `timeSlot` increments, cells shift by one column, compensating for the panX reset. Since there's **no CSS transition**, the content swap + panX reset happen in the same frame = visually seamless.

---

### Step 2: Modify `GameGrid.tsx` — use refs for panning, remove transitions

**Changes:**

1. **Accept `gridRef` and `xAxisRef` from the hook** instead of `timeSlotProgress`.

2. **Split the panning container into two layers:**
   - **Scrolling layer** (attached to `gridRef`): Contains grid cells, grid lines, price line. Pans horizontally via the ref.
   - **Fixed overlay layer** (no panning): Contains the past overlay, current-time separator, and current-price row highlight. These stay at fixed screen positions.

3. **Remove all `transition: "transform 0.3s ease-out"`** from:
   - The grid panning container (line 144)
   - The Y-axis container (line 243)
   - The X-axis container (line 278)

4. **Remove `panX` from inline styles** — it's now set directly via the ref in the animation loop.

5. **Keep `panY` as React state** (it changes with price ticks, which is 1/second — fine for React).

**New structure:**
```
<div className="relative overflow-hidden">     <!-- viewport -->

  <!-- Horizontal panning layer (ref-driven, no transition) -->
  <div ref={gridRef}>
    <div style={{ transform: translateY(panY) }}>  <!-- vertical pan -->
      Grid lines
      Grid cells
      PriceLine
    </div>
  </div>

  <!-- Fixed overlays (outside panning container) -->
  <div> Past overlay (fixed at columns 0-5 screen position) </div>
  <div> Current time separator (fixed at column 5 screen position) </div>
  <div> Current price row highlight </div>

  <!-- Y-axis (only pans vertically, not horizontally) -->
  <div style={{ transform: translateY(panY) }}>
    Price labels
  </div>

  <!-- X-axis (ref-driven horizontal pan) -->
  <div ref={xAxisRef}>
    Time labels
  </div>
</div>
```

---

### Step 3: Make cells recompute on `timeSlot` change

**File:** `GameGrid.tsx`, the `cells` useMemo.

Add `timeSlot` to the dependency array:
```ts
const cells = useMemo(() => {
  // ... same computation ...
}, [betSize, centerRow, timeSlot]); // was: [betSize, centerRow]
```

Since the grid uses relative positions (column 5 = "now"), the cell values are the same after each recompute. But this ensures that when React reconciles after a `timeSlot` change, the cells are fresh and the content swap is in sync with the panX reset.

**For future enhancement (not in this PR):** To make multipliers smoothly adjust mid-slot, compute `effectiveColDist = colDist - timeSlotProgress` and use that for multiplier calculation. This would require either per-frame recompute (expensive) or a CSS-based visual approximation.

---

### Step 4: Fix time label computation

**File:** `GameGrid.tsx`, the `timeLabels` useMemo.

Replace `new Date()` with a computation based on `timeSlot`:

```ts
const timeLabels = useMemo(() => {
  const labels: (string | null)[] = [];
  // Base time: component mount time + timeSlot * 5 seconds
  const baseTime = mountTimeRef.current + timeSlot * 5000;

  for (let c = 0; c < GRID_COLS; c++) {
    const colOffset = c - CURRENT_TIME_COL;
    const time = new Date(baseTime + colOffset * 5000);
    if (c % 2 === 0) {
      labels.push(formatTime(time));
    } else {
      labels.push(null);
    }
  }
  return labels;
}, [timeSlot]);
```

Store `mountTimeRef = useRef(Date.now())` once at component mount. This ensures labels are deterministic and aligned with the simulation timeline.

---

### Step 5: Keep `useSimulatedPrice` for price data only

**File:** `frontend/hooks/useSimulatedPrice.ts`

No changes needed. It continues to tick every 1 second for price updates. The `tickIndex` is still used for price lookups in `data.ts`.

---

### Step 6: Simplify `useGameState` — remove time logic

**File:** `frontend/hooks/useGameState.ts`

Remove `timeSlot` and `timeSlotProgress` computation (moved to `useAnimationTime`). Keep only:
- `betSize` / `setBetSize`
- `currentPriceRow` / `centerRow`
- `gridOffsetY` / `subCellOffsetY` (vertical pan)
- `getMultiplierForCell` / `getPayoutForCell`

---

### Step 7: Update `page.tsx` to wire everything together

```tsx
const { currentPrice, priceHistory, tickIndex } = useSimulatedPrice();
const { timeSlot, gridRef, xAxisRef } = useAnimationTime();
const { betSize, setBetSize } = useGameState(currentPrice, tickIndex);

<GameGrid
  currentPrice={currentPrice}
  tickIndex={tickIndex}
  betSize={betSize}
  priceHistory={priceHistory}
  timeSlot={timeSlot}
  gridRef={gridRef}
  xAxisRef={xAxisRef}
/>
```

---

## Summary of changes by file

| File | Action |
|------|--------|
| `hooks/useAnimationTime.ts` | **NEW** — rAF-driven smooth pan + timeSlot state |
| `hooks/useGameState.ts` | **EDIT** — Remove timeSlot/timeSlotProgress, keep price + bet logic |
| `hooks/useSimulatedPrice.ts` | No changes |
| `components/GameGrid.tsx` | **EDIT** — Use refs for pan, move overlays outside panning container, remove CSS transitions, add timeSlot to cells deps, fix time labels |
| `app/page.tsx` | **EDIT** — Wire up useAnimationTime, pass refs to GameGrid |
| `components/PriceLine.tsx` | No changes (will be revisited later per user request) |
| `lib/multiplier.ts` | No changes |
| `lib/formatters.ts` | No changes |

## What this does NOT address (deferred per user request)
- Price line rendering and price dot behavior
- Cells visually transitioning when price passes them
- Sub-slot fractional multiplier interpolation
