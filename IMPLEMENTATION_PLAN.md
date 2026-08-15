# Dig Once Nagpur — Detailed Implementation Plan

## Document purpose

This document converts the current **Dig Once Nagpur** concept, the mentor's recommended upgrades, and the current repository baseline into a phased implementation plan.

The goal is not to build a collection of disconnected features. The project must evolve through **vertical, demoable increments**:

> At the end of every phase, Dig Once Nagpur is a complete working application.  
> The next phase upgrades the same application with deeper intelligence, stronger workflows, better real-world readiness, and a stronger hackathon demo.

The core proposition remains:

> **GIS + Conflict Detection + Automated Coordination + Excavation Permission + Joint Project Planning + Field Verification + Decision Intelligence**

The product should be positioned as a **coordination intelligence layer on top of municipal GIS/infrastructure data**, rather than merely another GIS viewer.

The product principle is:

> **Before a road is opened, know who else needs to open it.**

---

# 1. Current baseline

The repository already has a useful foundation.

The current repository contains:

- React frontend
- FastAPI backend
- PostgreSQL/PostGIS setup
- Docker/Docker Compose
- synthetic GIS GeoJSON files for drainage, fibre, natural gas, sewage, and water
- a GIS import script
- an initial GIS SQL migration
- a `/gis/geojson` endpoint
- demo department users

The backend currently has:

- `/auth/login`
- `/auth/demo-accounts`
- `/health`
- `/db-version`
- `/gis/geojson`

and the GIS endpoint supports utility-type and bounding-box filtering.

The current GIS database migration creates `underground_networks` with:

- `utility_type`
- `properties`
- `geometry(LineString, 4326)`

and a GiST spatial index.

This means **we should not restart the project**.

Instead, the current GIS foundation becomes Phase 0 of the product roadmap.

---

# 2. Target product architecture

The target system should evolve toward:

```text
                         DIG ONCE NAGPUR
                                |
        --------------------------------------------------
        |                       |                        |
   GIS FOUNDATION         PROJECT LIFECYCLE       COORDINATION
        |                       |                        |
   Roads                  Excavation Requests     Conflict Detection
   Utilities              Project Scheduling      Risk Scoring
   Road History            Costs                    Compatibility
   Work Zones              Contractors              Optimization
        |                       |                        |
        ----------------------- | ------------------------
                                |
                       EXCAVATION DECISION
                                |
                 --------------------------------
                 |              |               |
             Permission     Coordination      Proceed
                 |              |               |
                 --------------------------------
                                |
                        Notifications
                                |
                    Cross-Department Workflow
                                |
                       Joint Project Plan
                                |
                        Field Verification
                                |
                           Execution
                                |
                       Restoration / Closure
                                |
                         Audit + Analytics
                                |
                         AI COPILOT LAYER
```

### Important architectural rule

The system must **not** allow an LLM to make raw GIS decisions.

Use:

```text
PostGIS
+
deterministic rules
+
scoring / optimization
        |
        v
candidate recommendations
        |
        v
AI
        |
        v
explanation / prioritization / communication
```

The GIS engine decides whether two projects are spatially or temporally related. AI explains and assists with the decision.

---

# 3. The nine-phase product roadmap

| Phase | Product state | Main outcome |
|---|---|---|
| 0 | GIS Foundation | Stable municipal map and data foundation |
| 1 | Project Planning | Departments can create and manage planned works |
| 2 | Automatic Conflict Detection | Every proposed excavation is automatically checked |
| 3 | Excavation Permission | Conflict-aware digital excavation request and approval workflow |
| 4 | Joint Project Coordination | System groups compatible projects and proposes a shared execution window |
| 5 | Risk & Impact Intelligence | Severity, road risk, cost and disruption intelligence |
| 6 | AI Coordination Copilot | Explain conflicts, recommend actions, assist officers |
| 7 | Field Verification & Data Improvement | GPS/photo verification and continuous GIS improvement |
| 8 | City Command Center | City-wide analytics, auditability and executive decision support |
| 9 | Competition Hardening | Reliability, demo perfection, benchmark scenario and pitch |

Every phase is described below with objective, product behavior, database work, backend work, frontend work, algorithms, APIs, testing, demo value, and exit criteria.

---

# PHASE 0 — GIS FOUNDATION

## Objective

Turn the existing repository into a clean, reliable, extensible GIS application.

The product at the end of Phase 0 should answer:

> **What infrastructure exists at this location?**

It must already feel like a real municipal application.

---

## 0.1 Freeze the domain vocabulary

Do this before adding tables.

### Departments

Initial synthetic departments:

- Water
- Sewerage
- Drainage/Stormwater
- Electrical
- Fibre/Telecom
- Natural Gas
- Roads
- City/NMC administration

### Infrastructure types

At minimum:

- road
- water
- sewage
- drainage
- electrical
- fibre
- natural gas

### Project types

- new installation
- replacement
- repair
- maintenance
- rehabilitation
- resurfacing
- emergency repair

### Project statuses

Use this lifecycle from the start:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
COORDINATION_REQUIRED
APPROVED
SCHEDULED
IN_PROGRESS
RESTORATION
VERIFICATION
COMPLETED
REJECTED
CANCELLED
```

Do not keep the current application forever limited to `Pending / In Progress / Completed`.

---

# 0.2 Database redesign

The existing `underground_networks` table is useful for the initial prototype but is too generic for the final product.

Keep the current table temporarily for migration compatibility.

Introduce these entities.

### `departments`

```text
id
name
code
description
active
created_at
updated_at
```

### `users`

```text
id
department_id
name
email
password_hash
role
active
created_at
updated_at
```

Roles:

```text
SUPER_ADMIN
DEPARTMENT_ADMIN
DEPARTMENT_ENGINEER
DEPARTMENT_VIEWER
FIELD_ENGINEER
```

### `roads`

```text
id
name
road_code
geometry
road_class
traffic_level
condition
last_resurfaced_at
last_excavated_at
last_restored_at
protection_until
criticality
metadata
created_at
updated_at
```

### `utilities`

```text
id
department_id
utility_type
geometry
depth_m
width_m
diameter_mm
material
installation_year
condition
criticality
source_type
confidence_level
verified_at
verified_by
metadata
created_at
updated_at
```

### `projects`

```text
id
project_code
department_id
title
description
project_type
priority
status
geometry
start_date
end_date
estimated_cost
excavation_cost
restoration_cost
traffic_management_cost
excavation_width_m
excavation_depth_m
contractor_id
created_by
created_at
updated_at
```

### `audit_logs`

```text
id
user_id
action
entity_type
entity_id
old_value
new_value
created_at
```

---

# 0.3 Geometry rules

Use:

- roads -> `LINESTRING`
- utility lines -> `LINESTRING`
- project corridor -> `LINESTRING`
- excavation footprint -> `POLYGON`
- work zones -> `POLYGON`
- field observations -> `POINT`

Do not store everything as a point.

For example:

```text
Project line
     |
     v
buffer by excavation width
     |
     v
excavation polygon
```

This becomes important for conflict detection.

---

# 0.4 Spatial indexes

Create GiST indexes on every geometry column.

Examples:

```sql
CREATE INDEX roads_geometry_gix
ON roads USING GIST (geometry);

CREATE INDEX utilities_geometry_gix
ON utilities USING GIST (geometry);

CREATE INDEX projects_geometry_gix
ON projects USING GIST (geometry);
```

Also add indexes for:

- department
- status
- start_date
- end_date
- utility_type

---

# 0.5 GIS API foundation

Keep the current `/gis/geojson` endpoint but refactor it into a proper GIS module.

Recommended:

```text
GET /gis/layers
GET /gis/roads
GET /gis/utilities
GET /gis/projects
GET /gis/geojson
```

Do not return every geometry in the city on every request forever.

Support:

```text
bbox
type
department
status
date range
```

Later, add vector tiles if performance demands it.

---

# 0.6 Synthetic Nagpur dataset

Keep the current GeoJSON assets as source data, then enrich them.

Synthetic data must be **plausible rather than random**.

Create:

```text
roads
water
sewage
drainage
electrical
fibre
natural gas
```

Utilities should generally follow roads/corridors rather than random lines.

Add metadata such as:

```text
depth
diameter
material
installation year
condition
confidence
criticality
```

---

# 0.7 Frontend

Refactor the React app into clear application sections:

```text
/login
/dashboard
/map
/projects
/projects/:id
/conflicts
/notifications
/approvals
/field
/analytics
/admin
```

Build a reusable map shell.

Map controls:

```text
Layers
Legend
Search
Zoom
Date filter
Department filter
Project status filter
```

---

# 0.8 Phase 0 demo

Login as:

```text
Water Department Admin
```

Show:

- Nagpur map
- water layer
- sewer layer
- fibre layer
- gas layer
- utility details
- infrastructure ownership
- confidence indicator

Then login as:

```text
City Admin
```

and show all layers.

---

# PHASE 0 EXIT CRITERIA

Phase 0 is complete only when:

- application starts from Docker
- login works
- roles exist
- GIS layers load from PostGIS
- map is usable
- utilities are selectable
- department ownership is visible
- utility metadata is visible
- spatial indexes exist
- synthetic Nagpur data is loaded
- no GIS data is hard-coded into frontend
- all map data comes through backend APIs

At this point:

> **Dig Once is a working municipal GIS foundation.**

---

# PHASE 1 — PROJECT PLANNING

## Objective

Introduce the thing that makes Dig Once operational:

> **planned infrastructure work**

At the end of this phase an officer can create, edit and track a project on the map.

---

# 1.1 Project creation workflow

Button:

```text
+ New Project
```

Step 1:

```text
Project information
```

Fields:

```text
Project name
Department
Project type
Description
Priority
```

Step 2:

```text
Schedule
```

Fields:

```text
planned start
planned end
estimated duration
```

Step 3:

```text
Execution
```

Fields:

```text
excavation width
excavation depth
estimated cost
excavation cost
restoration cost
traffic management cost
contractor
```

Step 4:

```text
Location
```

Admin draws:

```text
affected road corridor
```

---

# 1.2 Map drawing

Implement:

```text
Draw line
Edit line
Delete line
Clear drawing
```

When line is submitted:

```text
LINESTRING
```

is saved.

Server creates derived:

```text
excavation polygon
```

using width.

Do not trust a polygon sent by the frontend without server-side validation.

---

# 1.3 Project detail page

Show:

```text
Project W-104

Department: Water
Type: Pipeline replacement

Start: 10 Sep
End: 20 Sep

Status: Submitted

Estimated Cost: ₹20L
```

Map:

```text
project corridor
excavation footprint
nearby utilities
nearby projects
```

At this phase nearby items can simply be informational.

Conflict logic comes next.

---

# 1.4 Project lifecycle

Allow:

```text
Draft
 -> Submit
 -> Under Review
 -> Approved
 -> Scheduled
 -> In Progress
 -> Restoration
 -> Verification
 -> Completed
```

Basic role enforcement:

- department can submit own project
- department can edit own project before approval
- admin can approve
- completed projects become restricted

---

# 1.5 Project APIs

Implement:

```http
POST   /projects
GET    /projects
GET    /projects/{id}
PATCH  /projects/{id}
DELETE /projects/{id}

POST   /projects/{id}/submit
POST   /projects/{id}/approve
POST   /projects/{id}/reject
POST   /projects/{id}/status
```

Filters:

```text
department
status
date
project_type
bbox
priority
```

---

# 1.6 Department visibility

A department may:

- edit its own project
- view projects from other departments
- not edit another department's project

But every department can see enough project information to coordinate.

This preserves the core design principle that departments should not be isolated from each other.

---

# PHASE 1 EXIT CRITERIA

A user can:

1. login
2. choose own department
3. create project
4. draw project corridor
5. add dates
6. add costs
7. submit
8. view the project on map
9. change lifecycle status
10. see projects from other departments

At this point:

> **Dig Once can represent what the city plans to do.**

---

# PHASE 2 — AUTOMATIC CONFLICT DETECTION

## Objective

This is the first genuinely innovative phase.

Whenever a project is submitted:

> **the system automatically analyzes what the excavation may affect.**

This directly implements the mentor's first recommendation.

---

# 2.1 Conflict types

Implement four independent conflict classes.

### A. Utility conflict

The project excavation footprint is close to/overlapping an underground utility.

### B. Project conflict

Another planned project is spatially near/overlapping.

### C. Temporal conflict

Two projects have overlapping or near-overlapping schedules.

### D. Road conflict

The excavation affects a sensitive/recently restored/high-traffic road.

---

# 2.2 Utility conflict algorithm

For every submitted project:

```text
project excavation polygon
       |
       v
ST_Intersects / ST_DWithin
       |
       v
nearby utilities
```

Example query concept:

```sql
SELECT *
FROM utilities
WHERE ST_DWithin(
    geometry::geography,
    :project_geometry::geography,
    :threshold_meters
);
```

For actual overlap:

```sql
ST_Intersects(...)
```

Calculate:

```text
distance_m
overlap_length_m
utility_depth
project_depth
```

Do not only say:

> "Utility found."

Say:

> Water pipeline detected 1.7m from proposed excavation.

---

# 2.3 Project-to-project detection

For all existing projects:

```text
same corridor?
nearby corridor?
overlapping dates?
close dates?
```

Spatial filtering:

```text
ST_DWithin(...)
```

Temporal filtering:

```text
projectA.start <= projectB.end
AND
projectB.start <= projectA.end
```

---

# 2.4 Schedule proximity

Exact overlap is not enough.

Example:

```text
A: Sept 1–10
B: Sept 12–20
```

These do not overlap.

But:

```text
gap = 2 days
```

they may still be coordination candidates.

Therefore store:

```text
temporal_overlap_days
schedule_gap_days
```

---

# 2.5 Road conflict

When a project intersects a road retrieve:

```text
traffic_level
road_class
condition
last_resurfaced_at
last_restored_at
excavation_count
```

Then flag:

```text
recently_restored
high_traffic
frequently_excavated
critical_road
```

---

# 2.6 Create conflict records

Table:

```text
project_conflicts
```

Fields:

```text
id
project_id
other_project_id
utility_id
road_id

conflict_type

distance_m
overlap_m
temporal_overlap_days
schedule_gap_days

reason
severity
status
created_at
```

The same table may represent multiple conflict kinds, but the schema should make the type explicit.

---

# 2.7 Conflict API

When submitting:

```http
POST /projects/{id}/analyze
```

Return:

```json
{
  "project_id": 104,
  "conflicts_found": 7,
  "high_priority": 2,
  "coordination_candidates": 3
}
```

Also expose:

```http
GET /projects/{id}/conflicts
GET /conflicts
GET /conflicts/{id}
```

---

# 2.8 Conflict UI

After submit:

```text
Analyzing project...

✓ Spatial analysis
✓ Utility analysis
✓ Schedule analysis
✓ Road analysis

7 issues found
```

Then show cards:

```text
HIGH
Water pipeline
Distance: 1.7m

HIGH
Sewer project S-48
Schedule overlap: 6 days

MEDIUM
Recently resurfaced road
47 days since restoration
```

Clicking a card zooms the map to the conflict.

---

# 2.9 Phase 2 demo

The demo should become:

```text
Water department
    |
Create project
    |
Draw road corridor
    |
Submit
    |
3 seconds
    |
SYSTEM:
4 conflicts found
2 high priority
3 coordination candidates
```

This is the first moment the judges see the core innovation.

---

# PHASE 2 EXIT CRITERIA

A submitted excavation automatically:

- searches nearby utilities
- searches nearby projects
- compares schedules
- evaluates affected roads
- stores conflicts
- displays conflicts
- highlights conflicts on map

At this point:

> **Dig Once detects the problem before digging happens.**

---

# PHASE 3 — EXCAVATION PERMISSION MODULE

## Objective

Convert conflict detection into an actual municipal approval workflow.

This directly implements the mentor's excavation-permission recommendation:

> An agency must raise a digital excavation request before work.

---

# 3.1 Separate "Project" from "Excavation Request"

This is an important data-model decision.

A project describes:

> What work do we want to perform?

An excavation request describes:

> We now want permission to physically open this road.

Create:

### `excavation_requests`

```text
id
project_id
requested_start
requested_end
requested_area
justification
emergency
status
submitted_by
reviewed_by
reviewed_at
decision_reason
created_at
updated_at
```

---

# 3.2 Excavation request workflow

```text
Project
   |
   v
Create Excavation Request
   |
   v
Automatic Conflict Analysis
   |
   +---------------------+
   |                     |
No conflicts          Conflicts
   |                     |
   v                     v
Approval route       Coordination route
```

This is much stronger than letting admins simply mark a project as approved.

---

# 3.3 Permission state machine

Use:

```text
DRAFT
SUBMITTED
AUTO_SCREENED
COORDINATION_REQUIRED
UNDER_REVIEW
APPROVED
REJECTED
MODIFICATION_REQUIRED
CANCELLED
```

---

# 3.4 Permission checklist

When the request is submitted, automatically evaluate:

```text
☑ location supplied
☑ dates supplied
☑ responsible department
☑ nearby utilities checked
☑ nearby projects checked
☑ road condition checked
☑ recent excavation checked
☑ coordination requirement checked
```

---

# 3.5 Approval UI

Officer sees:

```text
EXCAVATION REQUEST ER-1042

Project:
Water Pipeline Replacement

Location:
Central Avenue

Requested:
10–20 Sep

Automatic screening:
HIGH RISK

Conflicts:
3

Coordination:
Recommended

[Request Coordination]
[Approve]
[Reject]
[Request Changes]
```

An admin should **not** be able to casually approve a high-risk request without seeing the analysis.

---

# 3.6 Approval APIs

```http
POST /excavation-requests
GET  /excavation-requests
GET  /excavation-requests/{id}
POST /excavation-requests/{id}/submit
POST /excavation-requests/{id}/approve
POST /excavation-requests/{id}/reject
POST /excavation-requests/{id}/request-changes
```

---

# 3.7 Emergency override

Add:

```text
emergency = true
```

Emergency requests can bypass normal coordination where necessary.

But the system must record:

```text
why emergency
who approved
when
what was bypassed
```

After completion, the system can still identify future planned projects around that corridor.

---

# 3.8 Phase 3 demo

The judge now sees:

```text
Project created
        |
Excavation permission requested
        |
System automatically screens
        |
High-risk conflict
        |
Permission is held
        |
Other departments must be contacted
```

This is much closer to a real government workflow.

---

# PHASE 3 EXIT CRITERIA

You have:

- digital excavation requests
- automatic screening
- approval/rejection workflow
- emergency override
- audit trail
- role-based permissions

At this point:

> **Dig Once is no longer merely analytical; it actively governs excavation requests.**

---

# PHASE 4 — JOINT PROJECT COORDINATION

## Objective

Move from:

> "Project A conflicts with Project B"

to:

> **"These projects should be planned together."**

This directly implements the mentor's joint coordination recommendation.

---

# 4.1 Compatibility engine

Create a configurable rules matrix.

Example:

| Work A | Work B | Default |
|---|---|---|
| Water | Fibre | Compatible |
| Water | Electrical | Conditional |
| Sewer | Fibre | Conditional |
| Sewer | Gas | Restricted |
| Electrical | Fibre | Often compatible |
| Road resurfacing | Utility work | Strong candidate |
| Emergency | Any | Override |

These are **configurable coordination rules**, not engineering guarantees.

Store:

### `coordination_rules`

```text
id
work_type_a
work_type_b
compatibility
required_conditions
preferred_sequence
active
```

---

# 4.2 Coordination candidate generation

For each project:

```text
candidate projects
      |
spatial filter
      |
temporal filter
      |
compatibility filter
      |
road impact filter
      |
candidate set
```

---

# 4.3 Same excavation window vs same trench

The system must not say:

> "All projects will share one trench."

Instead it should recommend one of:

```text
SAME_EXECUTION_WINDOW
SAME_ROAD_OPENING_DIFFERENT_TRENCH
SEPARATE_BUT_COORDINATED
DO_NOT_COORDINATE
```

---

# 4.4 Project clusters

Instead of pairwise conflicts, create a cluster.

Example:

```text
Central Avenue
|
+ W-104 Water
+ S-48 Sewer
+ F-32 Fibre
+ E-82 Electrical
```

Create:

### `coordination_groups`

```text
id
corridor_geometry
recommended_start
recommended_end
coordination_type
score
estimated_savings
estimated_disruption_reduction
status
created_at
```

and:

### `coordination_group_projects`

```text
group_id
project_id
```

---

# 4.5 Common window algorithm

Example:

```text
Water:
10–20 Sep

Sewer:
15–25 Sep

Fibre:
17–22 Sep
```

Candidate intersection:

```text
17–20 Sep
```

Then account for minimum duration:

```text
water = 4 days minimum
sewer = 2 days minimum
fibre = 2 days minimum
```

If feasible:

```text
recommended window = 17–20 Sep
```

Otherwise:

```text
No common feasible window
```

---

# 4.6 Coordination score

Start deterministic.

Example weights:

```text
Spatial overlap             30
Temporal overlap            20
Utility compatibility       20
Road disruption             10
Cost saving potential       10
Road freshness              10
```

Normalize to:

```text
0–100
```

Classify:

```text
0–39   Low
40–59  Moderate
60–79  High
80–100 Critical opportunity
```

The exact weights should be configurable.

---

# 4.7 Coordination proposal

Generate:

```text
Coordination Opportunity #12

Projects:
W-104
S-48
F-32

Shared corridor:
420m

Current:
3 excavation events

Recommended:
1 coordinated road-opening window

Suggested:
17–20 September

Score:
91/100
```

Then:

```text
[Send Proposal]
```

---

# 4.8 Department response

Each department gets:

```text
Accept
Reject
Request Modification
```

Reject requires reason.

Examples:

```text
Technical incompatibility
Resource unavailable
Schedule conflict
Safety restriction
Emergency
Other
```

---

# 4.9 Coordination workflow

```text
Water project submitted
      |
Conflict engine
      |
Cluster found
      |
Proposal created
      |
Water   -> accepts
Sewer   -> accepts
Fibre   -> requests modification
      |
Re-optimization
      |
new window
      |
Final schedule
```

This is the workflow the judges should see.

---

# PHASE 4 EXIT CRITERIA

The system can:

- identify multiple compatible projects
- form a coordination group
- propose a common window
- notify involved departments
- collect accept/reject/modification decisions
- update the proposed window
- produce a final coordinated schedule

At this point:

> **Dig Once is actually preventing repeated excavation rather than merely detecting it.**

---

# PHASE 5 — RISK AND IMPACT INTELLIGENCE

## Objective

Make the system explain **which projects matter most** and quantify the consequences.

This implements the mentor's conflict severity/risk scoring idea.

---

# 5.1 Conflict severity score

Create a deterministic score.

Example factors:

```text
utility criticality       25%
distance                  20%
depth interaction         15%
road criticality          15%
traffic level             10%
project urgency           10%
data confidence             5%
```

Generate:

```text
Low
Medium
High
Critical
```

---

# 5.2 Utility criticality

Attributes:

```text
criticality = 1–5
```

Example:

```text
major water main       5
small fibre line       2
major gas line         5
storm drain            4
```

These are configurable values for the prototype.

---

# 5.3 Depth interaction

Suppose:

```text
project excavation depth = 2.2m
utility depth = 1.8m
```

This is more relevant than a utility at 0.4m if the project's excavation does not reach it.

Build a simple vertical proximity model:

```text
horizontal distance
+
vertical depth relationship
```

Do not claim that this replaces engineering surveys.

Label it:

> preliminary digital screening.

---

# 5.4 Road risk score

For each road:

```text
traffic
road class
days since restoration
past excavation frequency
condition
criticality
planned projects
```

Produce:

```text
Road Risk = 0–100
```

Example:

```text
Central Avenue
92 / 100
HIGH RISK
```

---

# 5.5 Historical excavation frequency

Create:

```text
road_excavation_events
```

or derive history from completed projects.

Metrics:

```text
excavations_30d
excavations_90d
excavations_365d
```

Then:

> 4 excavation events in 12 months.

---

# 5.6 Recently restored road warning

When:

```text
today - last_restored_at
```

is small relative to the configured protection period:

```text
ROAD PROTECTION WARNING
```

Do not hard-code a policy period as a municipal fact.

Store:

### `system_policies`

```text
id
policy_key
policy_value
description
active
```

Example:

```text
recent_restoration_protection_days = configurable
```

---

# 5.7 Cost model

For every project:

```text
construction cost
excavation cost
restoration cost
traffic management cost
```

Estimate:

### Separate

```text
A excavation + restoration
B excavation + restoration
C excavation + restoration
```

### Coordinated

```text
shared road opening
shared traffic management
shared restoration
```

Then:

```text
potential_savings
```

Always label synthetic estimates as:

> Estimated from configured cost assumptions.

---

# 5.8 Disruption model

Calculate:

```text
road_closure_days
affected_length
traffic_level
number_of_road_opening_events
```

Compare:

```text
before coordination
vs
after coordination
```

Output:

```text
Excavation events: 3 -> 1
Road openings:     3 -> 1
Closure days:     18 -> 7
```

---

# 5.9 Opportunity ranking

Create a city list:

```text
Top coordination opportunities

1. Central Avenue         94
2. Wardha Road            89
3. Ring Road              82
4. Seminary Hills         76
```

This gives leadership something actionable.

---

# PHASE 5 EXIT CRITERIA

Every conflict/project now has:

- severity
- risk score
- road risk
- utility criticality
- cost estimate
- disruption estimate
- coordination opportunity score

At this point:

> **The system does not just detect conflicts; it prioritizes them and quantifies their value.**

---

# PHASE 6 — AI COORDINATION COPILOT

## Objective

Add AI only after the deterministic system is reliable.

AI should make the system easier for officers to understand and operate.

---

# 6.1 AI architecture

```text
PostGIS / rules / optimization
        |
        v
structured JSON
        |
        v
Gemini
        |
        +--> explanation
        +--> recommendation wording
        +--> coordination notice
        +--> natural language answer
```

Do not send arbitrary database state to the model.

Build structured prompts.

---

# 6.2 AI conflict explanation

Input:

```json
{
  "shared_corridor_m": 420,
  "temporal_overlap_days": 6,
  "road_risk": 91,
  "compatibility": "conditional",
  "estimated_savings": 800000
}
```

AI output:

```text
This coordination opportunity is high priority because the
three projects affect the same 420m corridor, overlap for six
days, and involve a high-risk recently restored road.
```

All numbers originate from backend calculations.

---

# 6.3 AI coordination proposal

Gemini creates:

```text
Subject:
Coordination request for Central Avenue corridor

Message:
Water, Sewer and Fibre projects are currently planned on the
same 420m corridor. The system estimates that execution in a
single coordinated road-opening window may reduce repeated
excavation and restoration.
```

---

# 6.4 AI "why" explanation

User:

> Why is this conflict critical?

AI answers using only structured facts:

```text
Critical because:

1. Utility is high criticality.
2. Proposed excavation is within threshold distance.
3. Road was recently restored.
4. Three projects are scheduled nearby.
5. Coordination could avoid two additional road openings.
```

---

# 6.5 Natural-language analytics

Add:

```text
Ask Dig Once
```

Examples:

> Which roads have the highest excavation risk?

> Show projects planned on Central Avenue next month.

> Why is project W-104 blocked?

> Which departments need to coordinate for this corridor?

Gemini translates the question into a **known backend query/tool**, not unrestricted SQL.

---

# 6.6 AI document extraction

Later in the same phase, support:

```text
project proposal PDF
utility document
contractor document
```

AI extracts candidate:

```text
project name
work type
dates
location
estimated cost
department
```

Then:

```text
AI extraction
      |
human verification
      |
database
```

---

# PHASE 6 EXIT CRITERIA

AI can:

- explain a conflict
- generate a coordination proposal
- summarize risk
- answer controlled natural-language questions
- draft department notifications
- extract candidate project metadata from documents

At this point:

> **AI is an assistant, not a source of truth.**

---

# PHASE 7 — FIELD VERIFICATION

## Objective

Solve the real-world data problem.

The map is only useful if the actual infrastructure matches the map.

This phase implements the mentor's field verification recommendation.

---

# 7.1 Field engineer role

New role:

```text
FIELD_ENGINEER
```

Field engineers can:

- view assigned projects
- open a project on mobile
- capture GPS location
- capture photos
- record actual utility location
- add observations
- mark infrastructure verified
- submit discrepancy report

---

# 7.2 Field verification entity

Create:

### `field_verifications`

```text
id
project_id
utility_id
engineer_id
gps_point
observed_geometry
observation_type
photos
notes
measured_depth
verified
created_at
```

---

# 7.3 Verification workflow

```text
Project approved
      |
Field verification assigned
      |
Engineer opens project
      |
GPS location
      |
Photo
      |
Observed utility
      |
Compare against GIS
      |
Matched / discrepancy
      |
Submit
```

---

# 7.4 Discrepancy workflow

Suppose GIS says:

```text
water line here
```

Field engineer observes:

```text
water line 4.2m away
```

System creates:

```text
DATA DISCREPANCY
```

Then:

```text
current GIS geometry
vs
observed geometry
```

A supervisor can:

```text
Accept update
Reject
Request re-survey
```

---

# 7.5 GPS + photo

The field screen should capture:

```text
Latitude
Longitude
Timestamp
Photo
Depth
Observation notes
```

The backend stores the coordinates and file metadata.

Photos should live in object storage, not PostgreSQL.

---

# 7.6 Infrastructure confidence

Every utility receives:

```text
VERIFIED
SURVEYED
DIGITIZED
ESTIMATED
```

The confidence should increase after successful field verification.

Example:

```text
Old confidence:
Estimated

After field verification:
Verified
```

---

# 7.7 Scanned map upload

Now add the previously discussed import workflow.

Supported:

```text
GeoJSON
KML
CSV
Shapefile
PDF
JPG
PNG
```

For scanned maps:

```text
Upload
   |
preview
   |
choose control points
   |
georeference
   |
overlay
   |
manual digitization
   |
verification
   |
PostGIS
```

Do not automatically convert an arbitrary photo directly into authoritative infrastructure data.

---

# 7.8 AI-assisted digitization

Optional final enhancement:

```text
scan
 |
AI line detection
 |
candidate utility
 |
human confirmation
 |
PostGIS
```

---

# PHASE 7 EXIT CRITERIA

Now the platform can:

- support field engineers
- capture GPS observations
- capture photos
- verify utilities
- record discrepancies
- update confidence
- import GIS files
- work with scanned maps
- optionally assist digitization

At this point:

> **The platform has a feedback loop that improves the quality of the city map over time.**

---

# PHASE 8 — CITY COMMAND CENTER

## Objective

Move from project-level operations to city-level management.

This is the executive experience.

---

# 8.1 Executive KPIs

Dashboard cards:

```text
Active projects
Open excavation requests
High-risk conflicts
Coordination opportunities
Projects coordinated
Excavations potentially avoided
Estimated savings
Road closure days reduced
```

---

# 8.2 City map

Add map modes:

```text
Infrastructure density
Excavation hotspots
Repeated excavation
High-risk roads
Upcoming works
Coordination clusters
```

---

# 8.3 Department dashboard

Example:

```text
Water
--------
Projects: 27
Pending requests: 4
Conflicts: 8
Accepted coordination: 5
```

---

# 8.4 Excavation heatmap

Color road segments by:

```text
number of excavation events
```

Example:

```text
0–1 green
2–3 yellow
4–5 orange
6+ red
```

This makes repeated excavation immediately visible.

---

# 8.5 Coordination analytics

Show:

```text
projects initially planned
projects coordinated
excavations avoided
estimated savings
```

Over time:

```text
monthly
quarterly
```

---

# 8.6 Audit dashboard

Government decision systems need traceability.

Show:

```text
Who created project?
Who changed dates?
Who approved excavation?
Who rejected coordination?
Why?
Who verified field data?
```

---

# 8.7 Policy management

Super admin can configure:

```text
recent restoration protection period
conflict thresholds
utility criticality
coordination weights
approval rules
emergency policy
```

This avoids hard-coded policy assumptions.

---

# PHASE 8 EXIT CRITERIA

An NMC-level administrator can:

- see the entire city
- see project pipeline
- see risk hotspots
- see high-priority conflicts
- see coordination opportunities
- see impact metrics
- inspect approvals
- inspect audit history
- configure rules

At this point:

> **Dig Once is a city infrastructure command center.**

---

# PHASE 9 — HACKATHON HARDENING

## Objective

Turn the technically complete system into the strongest possible competition submission.

This phase is not "extra polish." It is part of the product.

---

# 9.1 Freeze the feature set

No new major features after the freeze.

Only:

- bug fixes
- reliability
- performance
- UX
- demo preparation
- security
- deployment
- visual polish

---

# 9.2 Build one deterministic winning scenario

Create a fixed dataset.

### Central Avenue scenario

```text
Project W-104
Water pipeline replacement
10–20 Sep

Project S-48
Sewer rehabilitation
15–25 Sep

Project F-32
Fibre installation
17–22 Sep
```

Road characteristics:

```text
high traffic
recently restored
multiple previous excavations
```

Expected result:

```text
3 independent excavation plans
        |
        v
1 coordination cluster
        |
        v
recommended common window
```

---

# 9.3 Prepare a no-failure demo mode

Do not depend on the internet or random data during judging.

Add:

```text
Demo Mode
```

It should seed:

- departments
- users
- roads
- utilities
- projects
- conflicts
- notifications
- coordination groups

Then the exact demo starts from a known state.

---

# 9.4 Measure demo outputs

The final demo should show real calculations from your synthetic dataset.

For example:

```text
Current plans:
3 excavation events

Recommended:
1 coordinated execution window

Potential reduction:
2 excavation events

Estimated cost saving:
₹X

Road opening reduction:
2 events

Potential disruption reduction:
X%
```

Do not hard-code a value into the UI unless it is explicitly presented as demo/static content.

---

# 9.5 Demo flow

The whole live demo should fit into one uninterrupted story.

### Step 1

Login as Water Department.

### Step 2

Create water project.

### Step 3

Draw corridor.

### Step 4

Submit excavation request.

### Step 5

System automatically detects:

```text
3 project conflicts
1 recently restored road
2 utility risks
```

### Step 6

Permission is held because coordination is required.

### Step 7

Open coordination page.

Show:

```text
W-104
S-48
F-32
```

### Step 8

System proposes:

```text
17–20 Sep
```

### Step 9

Other departments receive notifications.

### Step 10

Sewer accepts.

### Step 11

Fibre requests modification.

### Step 12

System recalculates.

### Step 13

Final schedule accepted.

### Step 14

Show impact:

```text
3 excavation events -> 1
3 restorations -> 1
3 road disruptions -> 1
```

### Step 15

Open AI explanation:

> Why did the system recommend this?

### Step 16

Finish with:

> **Before a road is opened, know who else needs to open it.**

---

# 10. API roadmap

The API surface should grow roughly in this order.

## Existing / Phase 0

```http
POST /auth/login
GET  /auth/demo-accounts
GET  /health
GET  /db-version
GET  /gis/geojson
```

## Phase 0–1

```http
GET /departments
GET /users/me

GET /gis/roads
GET /gis/utilities
GET /gis/projects

POST /projects
GET /projects
GET /projects/{id}
PATCH /projects/{id}
DELETE /projects/{id}

POST /projects/{id}/submit
POST /projects/{id}/approve
POST /projects/{id}/reject
```

## Phase 2

```http
POST /projects/{id}/analyze

GET /projects/{id}/conflicts
GET /conflicts
GET /conflicts/{id}
```

## Phase 3

```http
POST /excavation-requests
GET  /excavation-requests
GET  /excavation-requests/{id}

POST /excavation-requests/{id}/submit
POST /excavation-requests/{id}/approve
POST /excavation-requests/{id}/reject
POST /excavation-requests/{id}/request-changes
```

## Phase 4

```http
GET  /coordination/opportunities
GET  /coordination/groups/{id}

POST /coordination/groups
POST /coordination/groups/{id}/proposals
POST /coordination/proposals/{id}/accept
POST /coordination/proposals/{id}/reject
POST /coordination/proposals/{id}/modify
POST /coordination/groups/{id}/optimize
```

## Phase 5

```http
GET /analytics/roads/{id}/risk
GET /analytics/projects/{id}/impact
GET /analytics/opportunities
GET /analytics/excavations
```

## Phase 6

```http
POST /ai/conflicts/{id}/explain
POST /ai/coordination/{id}/proposal
POST /ai/query
POST /ai/documents/extract
```

## Phase 7

```http
POST /field/verifications
GET  /field/verifications
POST /field/verifications/{id}/approve

POST /gis/import
POST /gis/georeference
POST /gis/digitize
```

## Phase 8

```http
GET /dashboard/city
GET /dashboard/departments
GET /dashboard/impact
GET /dashboard/hotspots
GET /audit
```

---

# 11. Database evolution roadmap

Do not try to create the final schema on day one.

Use incremental migrations.

```text
001_gis.sql
```

already exists.

Then:

```text
002_departments_users.sql
003_roads_utilities.sql
004_projects.sql
005_project_conflicts.sql
006_excavation_requests.sql
007_notifications.sql
008_coordination.sql
009_risk_and_policies.sql
010_field_verification.sql
011_documents.sql
012_analytics_views.sql
013_audit_indexes.sql
```

Every migration should be reversible where practical.

---

# 12. Notification architecture

Notifications are critical enough that they should be treated as a first-class subsystem.

Use:

```text
database
+
websocket/realtime
+
optional email/push
```

First build:

```text
database notification
+
in-app notification
```

Then optionally add:

```text
WebSocket
email
FCM
```

A notification should carry:

```text
type
severity
action_required
source_project
related_project
recipient
created_at
read_at
```

---

# 13. Audit architecture

Every important state transition should generate an audit event.

Examples:

```text
PROJECT_CREATED
PROJECT_SUBMITTED
CONFLICT_DETECTED
EXCAVATION_REQUESTED
COORDINATION_REQUESTED
COORDINATION_ACCEPTED
COORDINATION_REJECTED
EXCAVATION_APPROVED
EXCAVATION_REJECTED
FIELD_VERIFICATION_CREATED
FIELD_VERIFICATION_APPROVED
PROJECT_COMPLETED
```

This makes the system defensible as government software.

---

# 14. Testing strategy

Do not leave testing until the end.

## Unit tests

Test:

- date overlap
- distance thresholds
- conflict severity
- coordination score
- common window calculation
- compatibility rules
- cost calculations

## PostGIS integration tests

Test:

```text
project intersects utility
project near utility
project outside utility threshold
projects overlap spatially
projects are near but non-overlapping
road intersection
```

## API tests

Test:

```text
unauthorized access
department isolation
project CRUD
approval permissions
notification creation
coordination workflow
```

## End-to-end test

One full path:

```text
login
 -> create project
 -> submit
 -> conflict detection
 -> excavation request
 -> coordination
 -> approval
 -> completion
```

This should run automatically before judging.

---

# 15. Security hardening

The current repository uses demo-only credentials. Before final deployment:

- hash passwords
- use JWT/session-based auth
- never return password data
- validate department ownership server-side
- validate geometry server-side
- restrict state transitions
- rate-limit sensitive endpoints
- validate uploads
- prevent arbitrary file execution
- use environment secrets
- disable demo account enumeration in production

---

# 16. Performance strategy

Initially:

```text
PostGIS spatial queries
```

are enough.

When the synthetic dataset becomes larger:

- add GiST indexes
- use `ST_DWithin`
- use bounding-box prefiltering
- paginate project queries
- filter by viewport
- cache repeated analytics
- move expensive conflict analysis to background workers

Do not prematurely introduce a complicated architecture.

---

# 17. Synthetic data generation strategy

Create scripts:

```text
scripts/
    generate_roads.py
    generate_utilities.py
    generate_projects.py
    generate_demo_scenario.py
    reset_demo.py
```

The dataset should support:

### Scenario 1
three projects on one road

### Scenario 2
two overlapping projects

### Scenario 3
recent resurfacing

### Scenario 4
high-risk utility

### Scenario 5
incompatible projects

### Scenario 6
emergency request

### Scenario 7
field verification discrepancy

---

# 18. What is mandatory vs optional

## Absolute mandatory

These are protected from feature cuts:

1. GIS map
2. underground utilities
3. departments/RBAC
4. project creation
5. excavation request
6. automatic spatial conflict
7. automatic temporal conflict
8. severity/risk
9. cross-department notification
10. joint coordination proposal
11. acceptance/rejection workflow
12. measurable impact

---

## Strong differentiators

Build when the core works:

- road excavation history
- recently restored road warning
- road risk score
- utility criticality
- cost model
- disruption model
- project clustering
- data confidence
- field verification

---

## Wow features

Only after all mandatory functionality is stable:

- AI copilot
- natural language search
- scanned map georeferencing
- AI-assisted digitization
- document extraction
- advanced analytics

---

# 19. Team execution order

Do not divide work by "frontend person / backend person" only.

Divide by **product verticals**.

## Track A — GIS/Data

Own:

- PostGIS
- roads
- utilities
- project geometry
- import
- spatial queries

## Track B — Project/Permission Backend

Own:

- users
- departments
- projects
- excavation requests
- approvals
- audit

## Track C — Coordination Engine

Own:

- spatial conflicts
- temporal conflicts
- severity
- compatibility
- clustering
- optimization
- cost/disruption

## Track D — Frontend/GIS UX

Own:

- dashboard
- map
- drawing
- project flow
- conflicts
- notifications
- approvals
- analytics

## Track E — AI/Field

Own:

- Gemini
- AI explanations
- natural-language queries
- field verification
- image/document processing

---

# 20. Dependency order

The team must respect this:

```text
DATABASE
   |
   v
GIS
   |
   v
PROJECTS
   |
   v
SPATIAL CONFLICT
   |
   v
TEMPORAL CONFLICT
   |
   v
RISK
   |
   v
EXCAVATION PERMISSION
   |
   v
COORDINATION
   |
   v
OPTIMIZATION
   |
   v
NOTIFICATIONS
   |
   v
AI
   |
   v
FIELD VERIFICATION
   |
   v
ANALYTICS
```

Do not build AI first.

Do not build the executive dashboard first.

Do not spend days polishing the login page while the conflict engine is missing.

---

# 21. Recommended phase checkpoints

## Checkpoint A — Foundation

```text
GIS works.
```

## Checkpoint B — Planning

```text
Projects work.
```

## Checkpoint C — Core innovation

```text
Conflicts work.
```

## Checkpoint D — Government workflow

```text
Permissions work.
```

## Checkpoint E — Actual Dig Once value

```text
Coordination works.
```

## Checkpoint F — Intelligence

```text
Risk + cost + disruption work.
```

## Checkpoint G — AI

```text
AI explains and assists.
```

## Checkpoint H — Field

```text
GIS improves from reality.
```

## Checkpoint I — Competition

```text
Everything works flawlessly in one demo.
```

---

# 22. What "complete application" means after each phase

### End of Phase 0

A city map application.

### End of Phase 1

A municipal project planning application.

### End of Phase 2

A conflict detection application.

### End of Phase 3

A digital excavation permission system.

### End of Phase 4

A cross-department infrastructure coordination system.

### End of Phase 5

A civic decision-support system.

### End of Phase 6

An AI-assisted infrastructure planning system.

### End of Phase 7

A continuously improving infrastructure information system.

### End of Phase 8

A municipal infrastructure command center.

### End of Phase 9

A competition-ready product.

---

# 23. Final product workflow

The final system should ultimately behave like this:

```text
                    DEPARTMENT
                         |
                         v
                  Create Project
                         |
                         v
                 Draw Work Corridor
                         |
                         v
              Request Excavation Permit
                         |
                         v
               AUTOMATIC SCREENING
                         |
       ---------------------------------------
       |                  |                  |
   Utilities           Projects           Road
       |                  |                  |
       ---------------------------------------
                         |
                         v
                    Risk Score
                         |
                         v
                Coordination Engine
                         |
                ------------------
                |                |
           Coordinate        No coordination
                |                |
                v                v
        Common Window        Proceed Review
                |
                v
         Notifications
                |
                v
       Cross-Department Response
                |
        ---------------------
        |         |         |
      Accept    Modify    Reject
        |         |         |
        ------ Re-optimize -
                |
                v
          Final Schedule
                |
                v
         Excavation Execution
                |
                v
         Field Verification
                |
                v
            Restoration
                |
                v
              Audit
                |
                v
             Analytics
```

This is the full Dig Once lifecycle.

---

# 24. The final competition story

The judges should understand the product in this sequence:

### Problem

```text
Different agencies plan infrastructure separately.
```

### Consequence

```text
Same road gets opened repeatedly.
```

### Current gap

```text
Existing maps show infrastructure,
but planning systems do not coordinate the excavation decision.
```

### Dig Once

```text
Before excavation:
    check utilities
    check projects
    check schedule
    check road history
    check risk
```

### Then

```text
detect
 -> score
 -> notify
 -> coordinate
 -> approve
 -> execute
 -> verify
```

### Outcome

```text
fewer excavation events
fewer road closures
less restoration
lower estimated cost
better interdepartmental coordination
better infrastructure data
```

---

# 25. The one feature that should define the hackathon

Everything should ultimately feed one screen:

## "Should this road be excavated now?"

That screen should answer:

```text
PROJECT
    |
    +-- Underground utilities affected
    |
    +-- Existing projects nearby
    |
    +-- Schedule overlap
    |
    +-- Road condition
    |
    +-- Road excavation history
    |
    +-- Conflict severity
    |
    +-- Coordination opportunities
    |
    +-- Estimated impact
    |
    +-- Recommended action
```

And the decision should become:

```text
           SHOULD WE DIG?

        [ COORDINATE ]   [ PROCEED ]
```

That is the product's true center.

---

# 26. Final winning MVP

If time becomes extremely constrained, stop at **Phase 4**, but make Phases 0–4 extremely polished.

The absolute winning sequence is:

```text
LOGIN
  |
CITY GIS
  |
DEPARTMENT PROJECT
  |
DRAW CORRIDOR
  |
EXCAVATION REQUEST
  |
AUTOMATIC CONFLICT DETECTION
  |
SEVERITY
  |
COORDINATION OPPORTUNITY
  |
NOTIFICATION
  |
OTHER DEPARTMENT ACCEPTS
  |
FINAL COORDINATED WINDOW
  |
IMPACT:
3 -> 1 EXCAVATIONS
```

That is enough to demonstrate the entire value proposition.

Then Phase 5–9 make the same product better rather than changing the story.

---

# 27. Final engineering rulebook

Throughout implementation, keep these rules:

### Rule 1
**PostGIS calculates geography.**

### Rule 2
**Backend rules calculate feasibility and scores.**

### Rule 3
**AI explains and assists.**

### Rule 4
**Departments own their data, but coordination requires shared visibility.**

### Rule 5
**A project and an excavation permission are separate concepts.**

### Rule 6
**Same excavation window does not imply same trench.**

### Rule 7
**Low-confidence infrastructure data must be visibly labeled.**

### Rule 8
**Every important approval/change must be auditable.**

### Rule 9
**Synthetic data must be clearly identifiable as synthetic.**

### Rule 10
**One deterministic end-to-end demo is more valuable than ten unfinished features.**

---

# 28. The final positioning

Do not pitch Dig Once as:

> "A GIS dashboard with AI."

Pitch it as:

> **Dig Once Nagpur is a spatial-temporal coordination and excavation-permission platform that sits above fragmented infrastructure data and prevents departments from independently opening the same roads.**

And the strongest concise product statement is:

> **Before a road is opened, know who else needs to open it.**

---

# 29. Immediate implementation order from the current repository

Because the repository already contains the GIS foundation, **do not spend time rebuilding Phase 0**.

The immediate order should be:

```text
NOW
 |
 +--> refactor underground_networks into roads + utilities
 |
 +--> introduce departments + users tables
 |
 +--> replace demo-only auth with persisted users/RBAC
 |
 +--> create projects table
 |
 +--> create project CRUD APIs
 |
 +--> create project map drawing
 |
 +--> create project submission workflow
 |
 +--> build spatial conflict engine
 |
 +--> build temporal conflict engine
 |
 +--> create conflict UI
 |
 +--> create excavation_requests
 |
 +--> create approval workflow
 |
 +--> create notifications
 |
 +--> build coordination groups
 |
 +--> build common-window optimization
 |
 +--> add severity/risk
 |
 +--> add impact calculations
 |
 +--> add AI explanation
 |
 +--> add field verification
 |
 +--> add executive analytics
 |
 +--> harden demo
```

That is the implementation sequence the team should follow.

---

# 30. Definition of victory

The project is not "finished" when every feature in this document exists.

It is finished when, in front of a judge, you can perform this sequence without explanation:

```text
1. A department wants to excavate.
2. It draws the road segment.
3. Dig Once checks underground infrastructure.
4. Dig Once checks other planned projects.
5. Dig Once checks the schedule.
6. Dig Once evaluates road risk.
7. Dig Once blocks/flags the excavation when coordination is needed.
8. Other departments are notified automatically.
9. Dig Once groups compatible work.
10. The system proposes a common execution window.
11. Departments approve the joint plan.
12. The system calculates measurable impact.
13. Field engineers later verify the actual infrastructure.
14. The data improves.
15. City leadership can see the whole picture.
```

The judges should finish the demonstration thinking:

> **"This could actually change how a city plans road excavation."**

That is the standard the implementation should be built toward.
