# Coordination Eligibility and Scoring Specification

This document provides a technical specification of the deterministic GIS and rule-based logic used in DigOnce to evaluate **coordination eligibility** and calculate the **coordination score** between municipal infrastructure excavation projects.

---

## 1. Coordination Eligibility (`is_project_coordinable`)

Before a departmental project appears as a candidate in the objection selection modal, it must pass a multi-stage deterministic feasibility screening (`is_project_coordinable`).

### A. Status Eligibility & Exclusion Rules
A candidate project is immediately **excluded** if its status is any of the following:
- `DISCARDED`: Discarded projects are read-only and inactive.
- `Completed`: Work is already finished in the field.
- `Cancelled`: Project was revoked or abandoned.
- `Rejected`: Project was rejected during formal review.

In addition, projects lacking geographic corridor coordinates (`geometry`) or scheduled execution dates (`start_date`, `end_date`) are excluded.

### B. Department Ownership Filter
Candidate projects must belong to the **authenticated objecting user's department** and must not belong to the department owning the submitted project.

### C. Spatial Compatibility
- **Coordination Corridor Threshold**: Maximum distance of **75 meters** (`distance_m <= 75`).
- **Shared Corridor**: Or a shared corridor footprint greater than 0 meters (`shared_corridor_m > 0`).
- If `distance_m > 75` and `shared_corridor_m == 0`, the projects are spatially incompatible for shared road-opening.

### D. Temporal Compatibility
- **Schedule Overlap**: Direct overlap in planned execution dates (`temporal_overlap_days > 0`).
- **Schedule Gap Threshold**: A schedule gap of **14 days or less** (`schedule_gap_days <= 14`).
- If `temporal_overlap_days == 0` and `schedule_gap_days > 14`, the projects are temporally incompatible.

### E. Work / Utility Compatibility & Hard Blockers
Utility compatibility is evaluated using the municipal work compatibility matrix:
- `STRONG_CANDIDATE`: Same utility type (e.g. Water + Water).
- `COMPATIBLE`: Compatible distinct utilities (e.g. Water + Sewage, Fibre + Drainage).
- `CONDITIONAL`: Requires trench separation or sequencing review (e.g. Water + Fibre).
- `RESTRICTED`: High-risk combinations (e.g. Natural Gas near high-voltage electric).

**Hard Blockers (Result: `DO_NOT_COORDINATE`)**:
1. Spatial distance > 75 m.
2. Schedule gap > 14 days.
3. Natural gas asset within 10 m requiring restricted safety review.
4. Combined excavation width exceeding 8 m near gas assets.

A project is classified as **COORDINABLE** only when it meets spatial criteria, temporal criteria, and has **zero hard blockers**.

---

## 2. Coordination Score Calculation

### A. Pairwise Score Components
When two projects ($A$ and $B$) are evaluated, the raw coordination score (0–100) is calculated as the sum of four sub-scores:

1. **Spatial Score** ($\max 50$ points):
   $$\text{Spatial Score} = \max\left(0, 30 - \min\left(30, \frac{\text{distance\_m}}{2}\right)\right) + \min\left(20, \frac{\text{shared\_corridor\_m}}{10}\right)$$

2. **Temporal Score** ($\max 25$ points):
   $$\text{Temporal Score} = \begin{cases} 25 & \text{if } \text{overlap\_days} > 0 \\ \max(0, 15 - \text{schedule\_gap\_days}) & \text{otherwise} \end{cases}$$

3. **Compatibility Score** ($\max 20$ points):
   - `STRONG_CANDIDATE`: 20 points
   - `COMPATIBLE`: 18 points
   - `CONDITIONAL`: 10 points
   - `RESTRICTED`: 0 points

4. **Road Impact Score** ($\max 10$ points):
   - `10` points if $\text{shared\_corridor\_m} \ge 20\text{ m}$
   - `5` points if $\text{distance\_m} \le 30\text{ m}$
   - `0` points otherwise

$$\text{Raw Pair Score} = \begin{cases} 0 & \text{if hard blockers exist} \\ \min(100, \text{Spatial} + \text{Temporal} + \text{Compatibility} + \text{Road Impact}) & \text{otherwise} \end{cases}$$

### B. Multi-Project Group Scoring
For a proposal containing $N$ participating projects:
- If $N \le 1$ or no candidate projects were selected (standalone objection), **no coordination score is calculated** (`coordination_score = null`).
- If $N \ge 2$, the group coordination score is the arithmetic mean of all unique pair scores:
  $$\text{Group Score} = \operatorname{round}\left( \frac{\sum_{i < j} \text{PairScore}(P_i, P_j)}{\text{Number of Pairs}} \right)$$

### C. Live Recalculation
Whenever any participating project is modified (geometry, dates, duration, excavation parameters, costs, or urgency), the system automatically recomputes the group coordination score for all linked coordination proposals.

---

## 3. Coordination Opportunity Categories

Group scores are categorized into qualitative opportunity levels:

| Score Range | Category | Description |
|---|---|---|
| **85 – 100** | `VERY_HIGH` | Prime candidate for joint trenching and unified execution. |
| **70 – 84** | `HIGH` | Strong overlap; recommended joint execution window. |
| **45 – 69** | `MODERATE` | Conditional feasibility; engineering & sequencing review required. |
| **0 – 44** | `LOW` | Minor synergy; independent execution preferred unless aligned. |

---

## 4. Key System Assumptions

1. **Deterministic PostGIS Analysis**: Spatial geometry distances (`ST_Distance`) and corridor intersections (`ST_Intersection`) computed via PostGIS are the authoritative source of truth.
2. **Prototype Thresholds**: Spatial buffer distance (75 m) and schedule gap tolerance (14 days) are standardized municipal default thresholds.
3. **Coordination Definition**: Coordination signifies a synchronized execution window and coordinated road opening, not necessarily a shared physical trench.
4. **AI Role**: Large Language Models (Gemini) generate human-readable narrative explanations and summaries based strictly on these deterministic GIS facts. AI does not invent or calculate the numerical score.

---

## 5. Worked Example

### Scenario
- **Submitted Project A** (Water Department): Pipeline replacement on MG Road, 25 Aug – 5 Sep.
- **Objecting Project B** (Sewage Department): Sewer repair on MG Road, 28 Aug – 4 Sep.

### GIS Measurements & Analysis
- `distance_m` = 5.0 m
- `shared_corridor_m` = 45.0 m
- `overlap_days` = 8 days
- `schedule_gap_days` = 0 days
- `compatibility` = `COMPATIBLE` (Water + Sewage)
- `hard_blockers` = None

### Score Breakdown
1. **Spatial Score**:
   $$\max(0, 30 - 2.5) + \min(20, 4.5) = 27.5 + 4.5 = 32.0$$
2. **Temporal Score**: Overlap of 8 days = $25.0$ points.
3. **Compatibility Score**: `COMPATIBLE` = $18.0$ points.
4. **Road Impact Score**: `shared_corridor_m` ($45\text{ m} \ge 20\text{ m}$) = $10.0$ points.

$$\text{Total Score} = \min(100, 32.0 + 25.0 + 18.0 + 10.0) = 85$$

### Result
- **Coordination Score**: `85 / 100`
- **Category**: `VERY_HIGH`
- **Recommendation**: `COORDINATE` (Unified execution window 28 Aug – 4 Sep)
