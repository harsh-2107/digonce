# Dig Once Nagpur — Calculations and Assumptions

This document describes the deterministic prototype calculations used by Dig Once Nagpur. They are decision-support screening rules, not certified NMC policy, safety clearance, or engineering design advice. Gemini can explain a completed result but never supplies values, feasibility, scores, or blockers.

## Scope and inputs

Only WATER, SEWAGE, DRAINAGE, NATURAL_GAS and FIBRE are underground utilities. Roads are a separate GIS layer. Project corridors are `LINESTRING`s; footprints are generated server-side by buffering the corridor by half the excavation width in EPSG:3857. Distances and overlap screening are PostGIS calculations in metres.

## Excavation risk

`risk_score` is rounded to 0–100 and is persisted with its factor breakdown. It means the constraint/risk introduced by excavation at the proposed corridor; it is not urgency, importance, contractor quality, failure probability, or budget-overrun probability.

```
risk = .30 exposure + .15 criticality + .15 depth interaction
     + .15 road sensitivity + .10 restoration recency + .05 excavation size
     + .05 historical excavation + .05 data uncertainty
```

All factors are 0–100. The policy is a single backend `RISK_POLICY` configuration. Levels are configurable prototype bands: LOW 0–24, MODERATE 25–49, HIGH 50–74, CRITICAL 75–100.

| Factor | Calculation / assumption |
|---|---|
| Utility exposure | Each asset within 10m is scored by distance: 0–1m=100, 1–2m=75, 2–5m=50, 5–10m=20. The maximum is retained and each additional 20+ asset adds 8, capped at +25 and 100 total. |
| Criticality | Maximum asset criticality (default 3 if absent), normalized as `max exposure × criticality / 5`. Criticality is expected as 1–5 in GIS properties. |
| Depth interaction | 80 if an asset depth is within 1m of excavation depth; 45 when depth is missing; otherwise 20. |
| Road sensitivity | Closest-road traffic: HIGH=85, MEDIUM/default=55, LOW=25. |
| Restoration recency | 70 when a `last_restored_at` GIS value exists, otherwise 35. No calendar-age inference is made from synthetic data. |
| Excavation size | `min(100, width_m × 12 + corridor_length_m / 20)`. |
| Historical excavation | `min(100, nearby utility count × 12)` is a transparent proxy until verified excavation history exists. |
| Data uncertainty | 80 with no utility depth, 45 when any asset is not Verified/HIGH confidence, otherwise 15. |

Example: a 0.8m asset creates exposure 100. Two more 2–10m assets add 16, capped to 100. A criticality of 4 yields criticality 80. The final score is the weighted sum, rounded once at the end.

## Same-department grouping and impact

Same-department work never creates a coordination proposal. Each source project remains intact; a `project_group` is a separate consolidated execution plan. All pair checks must pass and all selected schedules must intersect.

- Common window: `max(source starts)` through `min(source ends)`. If start is after end, grouping is infeasible.
- Hard blockers: pair spatial-distance/schedule-gap constraints, natural-gas and combined-width constraints, or no common window.
- Grouping score: arithmetic mean of deterministic eligible pair coordination scores; zero if any blocker exists. Levels: LOW <45, MODERATE 45–69, HIGH 70–84, VERY_HIGH 85–100.
- Group geometry / footprint: `ST_Union` of all active source geometries / server-derived source footprints; never copied from a first project.
- Road openings avoided and disruption reduction: `source project count - 1`, assuming one feasible consolidated opening. This is an estimate, not a traffic forecast.
- Estimated savings: sum of restoration costs for all source projects after the first. It is a transparent prototype cost assumption; mobilisation, trench redesign, contingency, and real procurement pricing are not inferred.

Changing final dates, excavation width, excavation depth, or urgency marks group analysis `STALE`; re-analysis is required before submission. Name, description and execution strategy normally do not alter spatial/temporal feasibility.

## Coordination pair checks

Cross-department projects use the deterministic pair engine: 75m corridor proximity, schedule overlap or a maximum 14-day gap, network compatibility matrix, combined excavation width, natural-gas proximity, urgency, contractor-resource warning, and depth/data-confidence warning. `COORDINATE` requires score ≥70; `REVIEW` is 45–69; lower scores are independent; any blocker is `DO_NOT_COORDINATE`. These thresholds are prototype assumptions.

## Limitations and governance

Synthetic GIS attributes may be incomplete. Missing depth, confidence, road-restoration, traffic, or criticality values deliberately increase uncertainty or use the documented neutral defaults. All important updates are audit logged. Production deployment must validate geometry, utility depth, traffic policy, costs, contractor capacity and regulatory separation rules with NMC and utility engineering owners.
