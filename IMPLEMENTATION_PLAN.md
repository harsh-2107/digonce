# Dig Once Nagpur — Implementation Plan (5-Underground-Network Version)

## 1. Scope Freeze

The current prototype has exactly **five underground infrastructure network types**:

1. Water Supply
2. Sewage
3. Drainage
4. Natural Gas
5. Fibre Network

These are the only underground-network layers that the implementation should model in the hackathon prototype. Do **not** add Electrical, Telecom beyond Fibre, or other utility types unless the dataset is actually added later.

The application may still contain a **road network** because every excavation needs to be associated with a road/corridor, but roads are a separate civic GIS entity, not one of the five underground network layers.

The product remains:

> **Dig Once Nagpur — an excavation-permission and cross-department coordination system that checks five underground infrastructure networks before a road is opened.**

Core principle:

> **Before a road is opened, know who else needs to open it.**

---

# 2. Product Roles

## 2.1 Super Admin / NMC City Admin

Has city-wide visibility and can:

- see all five networks
- see all projects and excavation requests
- manage departments/users
- approve or reject excavation requests according to workflow
- view city-wide conflicts
- view coordination opportunities
- configure thresholds and scoring policies
- view audit logs
- manage imported/verified GIS data

## 2.2 Department Admin

There are five primary department types matching the five network layers:

```text
Water Supply
Sewage
Drainage
Natural Gas
Fibre Network
```

A Department Admin can:

- view the full city map
- view all five networks
- edit only their own network data
- create and manage their own projects
- submit excavation requests for their projects
- receive notifications when another project affects their network/corridor
- review coordination requests involving their projects
- accept, reject, or request modification of proposed coordination

## 2.3 Department Engineer

Can:

- inspect GIS data
- create project drafts
- perform conflict review
- submit field observations
- participate in coordination

Cannot perform final administrative approvals unless explicitly granted.

## 2.4 Field Engineer

Can:

- view assigned work
- capture GPS position
- upload photos
- verify utility position/depth
- report discrepancies
- submit field verification

## 2.5 Department Viewer

Read-only access to authorized departmental/project information.

---

# 3. Product Structure

The application should be organized around five major workflows:

```text
1. VIEW INFRASTRUCTURE
        |
2. PLAN PROJECT
        |
3. REQUEST EXCAVATION
        |
4. DETECT + COORDINATE CONFLICTS
        |
5. EXECUTE + VERIFY + ANALYZE
```

The map is the central interface, but the product is the decision workflow around excavation.

---

# 4. Main Pages

## Page 1 — Login

Route:

```text
/login
```

Elements:

- Email
- Password
- Login
- optional demo-account selector for hackathon mode

After login, redirect based on role.

---

# Page 2 — City / Department Dashboard

Route:

```text
/dashboard
```

For Department Admin, show:

```text
My Active Projects
Pending Excavation Requests
Open Conflicts
Coordination Requests
High-Risk Alerts
```

For City Admin, show:

```text
Active Projects
Open Excavation Requests
High-Risk Conflicts
Coordination Opportunities
Excavations Potentially Avoided
Estimated Savings
```

The dashboard should contain a compact map preview and action cards.

---

# Page 3 — Infrastructure Map

Route:

```text
/map
```

This is the primary page.

## Layer control

Exactly these five underground layers:

```text
● Water Supply
● Sewage
● Drainage
● Natural Gas
● Fibre Network
```

Also provide separate civic overlays:

```text
○ Roads
○ Planned Projects
○ Active Projects
○ Excavation Requests
○ Conflict Areas
○ Coordination Opportunities
```

The five network types use the existing conceptual display shown in the prototype:

- Water Supply — 29 loaded
- Sewage — 50 loaded
- Drainage — 78 loaded
- Natural Gas — 77 loaded
- Fibre Network — 122 loaded

These counts should remain dynamic and come from the backend, not be hard-coded.

---

# Page 4 — Network Details

Clicking a network segment opens a detail panel.

Example for Water:

```text
Water Supply

Network ID: W-00124
Department: Water Supply

Diameter: 600 mm
Depth: 2.1 m
Material: DI
Condition: Good
Installed: 2020

Data Source: GIS Import
Confidence: Verified
Last Verified: 14 Aug 2026
```

Not every attribute must exist for every network. Display only available fields.

## Common attributes

All five types should support:

```text
id
department
utility_type
geometry
condition
criticality
source_type
confidence_level
last_verified_at
metadata
```

Network-specific values belong in a structured metadata field initially.

---

# Page 5 — Project List

Route:

```text
/projects
```

Filters:

```text
Department
Project type
Status
Priority
Start date
End date
Road
```

Columns:

```text
Project Code
Project Name
Department
Road / Area
Start
End
Status
Risk
Coordination
```

---

# Page 6 — Create Project

Route:

```text
/projects/new
```

This should be a **four-step map-first flow**.

## Step 1 — Project Information

```text
Project Name
Project Type
Description
Priority
Department
```

Project types:

```text
Repair
Replacement
New Installation
Maintenance
Rehabilitation
Emergency Repair
```

## Step 2 — Schedule

```text
Planned Start
Planned End
Minimum Required Duration
```

## Step 3 — Work Parameters

```text
Excavation Width
Excavation Depth
Estimated Cost
Excavation Cost
Restoration Cost
Traffic Management Cost
Contractor
```

## Step 4 — Location

User draws the planned work corridor on the map.

The frontend saves a `LINESTRING`.

Backend creates a derived excavation footprint using the excavation width.

```text
Project centerline
        |
        v
buffer by width/2
        |
        v
Excavation Polygon
```

The frontend must not be trusted for the final footprint calculation. The backend recalculates it.

---

# Page 7 — Project Details

Route:

```text
/projects/:id
```

Sections:

### Summary

```text
Project Code
Department
Type
Priority
Status

Start
End

Estimated Cost
```

### Map

Show:

- project corridor
- excavation footprint
- all five underground networks
- nearby projects
- road segment
- conflict markers

### Analysis

Show:

```text
Utilities affected
Nearby projects
Schedule conflicts
Road risk
Overall severity
Coordination opportunity
```

### Timeline

Show:

```text
Created
Submitted
Analyzed
Coordination Requested
Approved
Scheduled
In Progress
Restoration
Verified
Completed
```

### Audit

Who changed what and when.

---

# Page 8 — Excavation Request

Route:

```text
/excavation-requests/new?project_id=<id>
```

This is a separate workflow from project creation.

The distinction is:

> Project = what work the department plans.
>
> Excavation Request = permission to physically open the road.

The request automatically triggers conflict analysis.

Fields:

```text
Project
Requested Start
Requested End
Excavation Area
Justification
Emergency?
Supporting Documents
```

---

# Page 9 — Excavation Request Review

Route:

```text
/excavation-requests/:id
```

The reviewer sees:

```text
EXCAVATION REQUEST ER-1042

Project: Water Pipeline Replacement
Road: Central Avenue

10–20 Sep

Risk: HIGH

Underground network conflicts:
2

Other projects nearby:
3

Coordination opportunity:
YES
```

Actions:

```text
Approve
Reject
Request Changes
Send for Coordination
```

For high-risk requests, the coordination state should be visible before approval.

---

# Page 10 — Conflicts

Route:

```text
/conflicts
```

Filters:

```text
Severity
Network Type
Department
Project
Status
Date
```

Conflict cards:

```text
HIGH
Water Supply conflict
Distance: 1.6m
Project: W-104

MEDIUM
Sewage project overlap
Temporal overlap: 5 days

HIGH
Natural Gas conflict
Critical utility
```

Clicking a conflict should zoom to its map location.

---

# Page 11 — Coordination Opportunities

Route:

```text
/coordination
```

Show:

```text
Central Avenue
4 projects
3 network types involved

Opportunity Score: 91/100
Suggested Window: 17–20 Sep
Potential Excavations: 3 -> 1
```

Opening a coordination opportunity shows all participating projects and their departments.

---

# Page 12 — Coordination Detail

Route:

```text
/coordination/:id
```

Sections:

```text
Projects
Spatial overlap
Schedule overlap
Network conflicts
Compatibility
Recommended execution window
Estimated savings
Estimated disruption reduction
Department responses
AI explanation
```

Actions:

```text
Send Proposal
Accept
Reject
Request Modification
Recalculate
```

---

# Page 13 — Notifications

Route:

```text
/notifications
```

Notification types:

```text
New Conflict
Excavation Request
Coordination Request
Approval Required
Road Protection Warning
Field Verification Required
Coordination Accepted
Coordination Rejected
```

Every relevant notification must be actionable.

Example:

```text
Coordination Request

Water project W-104 overlaps your Fibre project F-32.

Shared corridor: 420m
Schedule overlap: 4 days
Score: 87

[Review]
```

---

# Page 14 — Field Verification

Route:

```text
/field
/field/:projectId
```

Mobile-friendly screen.

Actions:

```text
Capture GPS
Take Photo
Add Depth
Select Network
Add Observation
Submit Verification
```

Comparison view:

```text
GIS Location
vs
Observed Location
```

If different:

```text
Create Data Discrepancy
```

---

# Page 15 — Analytics / Command Center

Route:

```text
/analytics
```

Show:

```text
Active Projects
Open Excavation Requests
High-Risk Conflicts
Coordination Opportunities
Excavations Avoided
Potential Savings
Road Opening Days Reduced
```

Maps:

```text
Conflict Heatmap
Repeated Excavation Hotspots
Upcoming Work Density
Coordination Opportunities
```

---

# Page 16 — Admin

Route:

```text
/admin
```

Sections:

```text
Departments
Users
Policies
Conflict Thresholds
Utility Rules
Audit Logs
GIS Data Management
```

---

# 5. Database Schema

## 5.1 Departments

```sql
CREATE TABLE departments (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Seed exactly these infrastructure departments:

```text
water
sewage
drainage
natural-gas
fibre
```

A separate `nmc-admin`/city-admin role can exist without pretending there is an underground layer for it.

---

# 5.2 Users

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT REFERENCES departments(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Roles:

```text
SUPER_ADMIN
DEPARTMENT_ADMIN
DEPARTMENT_ENGINEER
DEPARTMENT_VIEWER
FIELD_ENGINEER
```

---

# 5.3 Underground Networks

The existing `underground_networks` concept remains useful.

However, normalize the department ownership and common attributes.

Recommended:

```sql
CREATE TABLE utilities (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES departments(id),
    utility_type TEXT NOT NULL CHECK (
        utility_type IN (
            'water',
            'sewage',
            'drainage',
            'natural-gas',
            'fibre'
        )
    ),
    geometry geometry(LineString, 4326) NOT NULL,
    depth_m NUMERIC,
    width_m NUMERIC,
    diameter_mm NUMERIC,
    material TEXT,
    installation_year INTEGER,
    condition TEXT,
    criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),
    source_type TEXT,
    confidence_level TEXT,
    verified_at TIMESTAMPTZ,
    verified_by BIGINT REFERENCES users(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Why `metadata`?

The five networks do not necessarily share identical physical attributes.

For example:

```text
Water -> diameter/material/depth
Sewage -> diameter/material/depth
Drainage -> channel/diameter/depth
Natural Gas -> diameter/pressure/material/depth
Fibre -> cable count/type/depth
```

Keep universal fields normalized and network-specific fields in `metadata` until the prototype proves that they need dedicated columns.

---

# 5.4 Roads

Roads are not one of the five underground networks. They are the physical surface through which excavation happens.

```sql
CREATE TABLE roads (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    road_code TEXT UNIQUE,
    geometry geometry(LineString, 4326) NOT NULL,
    road_class TEXT,
    traffic_level TEXT,
    condition TEXT,
    criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),
    last_resurfaced_at TIMESTAMPTZ,
    last_excavated_at TIMESTAMPTZ,
    last_restored_at TIMESTAMPTZ,
    protection_until TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

If real road geometry is not available in the current dataset, generate/load a synthetic road layer specifically for project corridors and demo scenarios. Do not label synthetic roads as official NMC data.

---

# 5.5 Projects

```sql
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    project_code TEXT NOT NULL UNIQUE,
    department_id BIGINT NOT NULL REFERENCES departments(id),
    title TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    geometry geometry(LineString, 4326) NOT NULL,
    excavation_geometry geometry(Polygon, 4326),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    minimum_duration_days INTEGER,
    estimated_cost NUMERIC(14,2),
    excavation_cost NUMERIC(14,2),
    restoration_cost NUMERIC(14,2),
    traffic_management_cost NUMERIC(14,2),
    excavation_width_m NUMERIC,
    excavation_depth_m NUMERIC,
    contractor_name TEXT,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 5.6 Project-Road association

A project can cross more than one road.

Use a bridge table rather than storing one `road_id`.

```sql
CREATE TABLE project_roads (
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    road_id BIGINT NOT NULL REFERENCES roads(id),
    overlap_length_m NUMERIC,
    PRIMARY KEY (project_id, road_id)
);
```

This becomes important for corridors.

---

# 5.7 Excavation Requests

```sql
CREATE TABLE excavation_requests (
    id BIGSERIAL PRIMARY KEY,
    request_code TEXT NOT NULL UNIQUE,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    requested_start DATE NOT NULL,
    requested_end DATE NOT NULL,
    requested_area geometry(Polygon, 4326),
    justification TEXT NOT NULL,
    emergency BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    submitted_by BIGINT NOT NULL REFERENCES users(id),
    reviewed_by BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 5.8 Conflicts

One project can conflict with:

- any of the five network types
- another project
- a road condition

Use a flexible conflict record.

```sql
CREATE TABLE project_conflicts (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    other_project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    utility_id BIGINT REFERENCES utilities(id),
    road_id BIGINT REFERENCES roads(id),
    conflict_type TEXT NOT NULL,
    distance_m NUMERIC,
    overlap_m NUMERIC,
    temporal_overlap_days INTEGER,
    schedule_gap_days INTEGER,
    depth_difference_m NUMERIC,
    severity TEXT,
    score NUMERIC(5,2),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Conflict types:

```text
UTILITY_PROXIMITY
UTILITY_OVERLAP
PROJECT_SPATIAL_OVERLAP
PROJECT_TEMPORAL_OVERLAP
ROAD_RECENTLY_RESTORED
ROAD_HIGH_TRAFFIC
ROAD_FREQUENT_EXCAVATION
```

---

# 5.9 Coordination Groups

```sql
CREATE TABLE coordination_groups (
    id BIGSERIAL PRIMARY KEY,
    corridor_geometry geometry(LineString, 4326),
    recommended_start DATE,
    recommended_end DATE,
    coordination_type TEXT,
    score NUMERIC(5,2),
    estimated_savings NUMERIC(14,2),
    estimated_disruption_reduction NUMERIC(7,2),
    status TEXT NOT NULL DEFAULT 'PROPOSED',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Membership:

```sql
CREATE TABLE coordination_group_projects (
    group_id BIGINT NOT NULL REFERENCES coordination_groups(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    response_status TEXT NOT NULL DEFAULT 'PENDING',
    response_reason TEXT,
    responded_by BIGINT REFERENCES users(id),
    responded_at TIMESTAMPTZ,
    PRIMARY KEY (group_id, project_id)
);
```

---

# 5.10 Notifications

```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    project_id BIGINT REFERENCES projects(id),
    related_project_id BIGINT REFERENCES projects(id),
    coordination_group_id BIGINT REFERENCES coordination_groups(id),
    action_required BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 5.11 Field Verification

```sql
CREATE TABLE field_verifications (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id),
    utility_id BIGINT REFERENCES utilities(id),
    engineer_id BIGINT NOT NULL REFERENCES users(id),
    gps_point geometry(Point, 4326) NOT NULL,
    observed_geometry geometry(LineString, 4326),
    observation_type TEXT NOT NULL,
    measured_depth_m NUMERIC,
    notes TEXT,
    verification_status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Photos should be stored in object storage.

Create:

```sql
CREATE TABLE field_verification_files (
    id BIGSERIAL PRIMARY KEY,
    verification_id BIGINT NOT NULL REFERENCES field_verifications(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 5.12 Audit Logs

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id BIGINT,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 6. API Design

## Authentication

```http
POST /auth/login
GET  /auth/me
POST /auth/logout
```

For final deployment use secure persisted users and hashed passwords. Demo accounts are acceptable only for development/demo mode.

---

# Departments / Users

```http
GET  /departments
GET  /departments/{id}

GET  /users/me
GET  /users
POST /users
PATCH /users/{id}
```

Super Admin only for user management.

---

# GIS

```http
GET /gis/layers
GET /gis/roads
GET /gis/utilities
GET /gis/geojson
GET /gis/projects
```

All should support appropriate filters.

## `GET /gis/utilities`

Parameters:

```text
utility_type
bbox
department_id
confidence_level
condition
```

Allowed utility types are exactly:

```text
water
sewage
drainage
natural-gas
fibre
```

## `GET /gis/projects`

Parameters:

```text
bbox
department_id
status
start_date
end_date
priority
```

---

# Projects

```http
POST   /projects
GET    /projects
GET    /projects/{id}
PATCH  /projects/{id}
DELETE /projects/{id}

POST   /projects/{id}/submit
POST   /projects/{id}/cancel
```

Do not expose unrestricted state mutation. State transitions should be role-checked.

---

# Project Analysis

```http
POST /projects/{id}/analyze
GET  /projects/{id}/analysis
GET  /projects/{id}/conflicts
```

The analysis endpoint should be idempotent for the same current project state.

---

# Excavation Requests

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

# Conflicts

```http
GET /conflicts
GET /conflicts/{id}
POST /conflicts/{id}/resolve
POST /conflicts/{id}/dismiss
```

Resolution should require a reason.

---

# Coordination

```http
GET  /coordination/opportunities
POST /coordination/groups
GET  /coordination/groups/{id}
POST /coordination/groups/{id}/optimize
POST /coordination/groups/{id}/send

POST /coordination/groups/{id}/respond
```

A response body should contain:

```json
{
  "response": "ACCEPT | REJECT | MODIFY",
  "reason": "...",
  "requested_start": "2026-09-17",
  "requested_end": "2026-09-20"
}
```

---

# Notifications

```http
GET  /notifications
POST /notifications/{id}/read
POST /notifications/read-all
```

Later:

```text
WebSocket /ws/notifications
```

---

# Field Verification

```http
POST /field/verifications
GET  /field/verifications
GET  /field/verifications/{id}
POST /field/verifications/{id}/approve
POST /field/verifications/{id}/reject
```

---

# Analytics

```http
GET /analytics/city
GET /analytics/departments
GET /analytics/roads/{id}/risk
GET /analytics/projects/{id}/impact
GET /analytics/opportunities
GET /analytics/excavation-hotspots
```

---

# AI

```http
POST /ai/conflicts/{id}/explain
POST /ai/coordination/{id}/draft
POST /ai/query
```

AI receives structured backend data only.

---

# 7. Exact User Flow — Department Project to Coordinated Excavation

This is the **primary hackathon workflow**.

## Step 1 — Water Admin logs in

Role:

```text
DEPARTMENT_ADMIN
Department: Water Supply
```

---

## Step 2 — Dashboard

Water admin sees:

```text
My Projects
Pending Requests
Open Conflicts
Coordination Requests
```

Clicks:

```text
Create Project
```

---

## Step 3 — Create project

Enters:

```text
Water Pipeline Replacement
Start: 10 Sep
End: 20 Sep
Depth: 2.2m
Width: 4m
```

Draws the corridor on the map.

---

## Step 4 — Save draft

Backend:

```text
POST /projects
```

Creates:

```text
project = DRAFT
```

---

## Step 5 — Submit project

User clicks:

```text
Submit for review
```

Backend:

```text
POST /projects/{id}/submit
```

Project becomes:

```text
SUBMITTED
```

---

## Step 6 — Create excavation request

User clicks:

```text
Request Excavation Permission
```

---

## Step 7 — Automatic screening

Backend automatically runs:

```text
1. Find affected roads
2. Find Water/Sewage/Drainage/Gas/Fibre utilities nearby
3. Find nearby projects
4. Compare dates
5. Check road history
6. Calculate severity
7. Find coordination candidates
```

---

## Step 8 — Analysis result

Example:

```text
HIGH RISK

Underground conflicts: 2
Other projects: 3
Road risk: 88
Coordination score: 91
```

---

## Step 9 — Permission state

System changes request to:

```text
COORDINATION_REQUIRED
```

and does not send it directly to final approval.

---

## Step 10 — Notifications

Affected departments receive notifications.

Example:

```text
Sewage Department

New Water excavation project overlaps your
planned sewage work on Central Avenue.

Shared corridor: 420m
Schedule overlap: 6 days

[Review]
```

The same happens for Drainage/Gas/Fibre only when the conflict engine identifies a meaningful relationship.

**Do not notify every department for every project.** Notify only affected departments or relevant coordination candidates.

---

## Step 11 — Coordination group

Suppose Water + Sewage + Fibre are compatible.

Create:

```text
Coordination Group #12

W-104
S-48
F-32
```

---

## Step 12 — Find common window

Current schedules:

```text
Water:   10–20 Sep
Sewage:  15–25 Sep
Fibre:   17–22 Sep
```

Candidate:

```text
17–20 Sep
```

System checks minimum required duration and compatibility.

---

## Step 13 — Coordination proposal

Show:

```text
Current:
3 excavation events

Recommended:
1 coordinated road-opening window

Potential savings:
₹X

Potential road opening reduction:
2 events
```

---

## Step 14 — Department responses

Sewage:

```text
ACCEPT
```

Fibre:

```text
MODIFY
```

System recalculates.

---

## Step 15 — Final plan

All relevant departments accept.

Project changes to:

```text
APPROVED
```

and eventually:

```text
SCHEDULED
```

---

## Step 16 — Field verification

Before/after execution:

```text
GPS
Photo
Depth
Observed utility position
```

---

## Step 17 — Completion

Project becomes:

```text
COMPLETED
```

Road history is updated.

---

## Step 18 — Analytics

City dashboard records:

```text
1 coordinated excavation
2 potential excavations avoided
1 restoration cycle
estimated savings
```

---

# 8. Conflict Detection Logic for the Five Networks

Every new excavation is checked against exactly:

```text
Water Supply
Sewage
Drainage
Natural Gas
Fibre Network
```

## 8.1 Water Supply

Check:

```text
Horizontal proximity
Overlap
Depth
Criticality
Condition
```

Potential output:

```text
HIGH
Water Supply W-121 lies 1.2m from the excavation.
```

---

## 8.2 Sewage

Check:

```text
Horizontal proximity
Overlap
Depth
Criticality
Project schedule
```

Potential output:

```text
MEDIUM
Sewer rehabilitation project overlaps this corridor.
```

---

## 8.3 Drainage

Check:

```text
Proximity
Overlap
Depth
Condition
Road drainage importance
```

Drainage should be especially visible when projects affect roads vulnerable to waterlogging in the synthetic dataset, but this must be represented as dataset attributes rather than claimed real-world facts.

---

## 8.4 Natural Gas

Treat as a high-sensitivity network in the prototype scoring configuration.

Check:

```text
Proximity
Depth
Criticality
Installation data confidence
```

Potential output:

```text
CRITICAL
Natural Gas line within excavation safety threshold.
```

The UI should clearly state:

> Preliminary digital screening — field verification required.

Do not present the model as a substitute for gas safety procedures or engineering authorization.

---

## 8.5 Fibre Network

Check:

```text
Proximity
Overlap
Depth
Cable metadata
Planned fibre project schedule
```

Potential output:

```text
MEDIUM
Fibre project F-32 overlaps the proposed corridor.
```

---

# 9. Utility Conflict Thresholds

Do not hard-code one threshold for all five networks.

Use a configurable table:

```text
utility_type
warning_distance_m
critical_distance_m
criticality_default
active
```

Example prototype configuration:

```text
water       5m   2m
sewage      5m   2m
drainage    5m   2m
natural-gas 8m   4m
fibre       3m   1.5m
```

These numbers are **prototype/demo thresholds**, not municipal engineering standards. Mark them as configurable assumptions.

---

# 10. Risk Scoring

The score should be deterministic and explainable.

Suggested structure:

```text
Risk Score
=
Utility Risk
+ Distance Risk
+ Depth Risk
+ Road Risk
+ Schedule Risk
+ Data Confidence Risk
```

Example weighting:

```text
Utility criticality       25%
Distance                  20%
Depth interaction         15%
Road criticality          15%
Schedule overlap          10%
Project priority          10%
Data confidence             5%
```

Result:

```text
0–39    LOW
40–59   MEDIUM
60–79   HIGH
80–100  CRITICAL
```

Every score must expose its reason breakdown.

---

# 11. Coordination Scoring

Separate **risk** from **coordination opportunity**.

A dangerous conflict is not necessarily a good coordination candidate.

Coordination score:

```text
Spatial overlap             30%
Temporal overlap            20%
Compatibility               20%
Disruption reduction        10%
Cost saving potential       10%
Road freshness              10%
```

Output:

```text
Low opportunity
Moderate opportunity
High opportunity
Critical opportunity
```

---

# 12. Coordination Compatibility Matrix for Five Networks

The matrix should be configuration data, not application code.

Example prototype:

| Work A | Work B | Prototype default |
|---|---|---|
| Water | Sewage | Conditional |
| Water | Drainage | Compatible |
| Water | Natural Gas | Restricted |
| Water | Fibre | Compatible |
| Sewage | Drainage | Conditional |
| Sewage | Natural Gas | Restricted |
| Sewage | Fibre | Conditional |
| Drainage | Natural Gas | Restricted |
| Drainage | Fibre | Compatible |
| Natural Gas | Fibre | Conditional |

This does **not** mean they can occupy the same trench. It means they may be considered for coordinated planning subject to the configured rules and field/engineering verification.

---

# 13. Road Interaction

Roads remain important even though they are not an underground network layer.

For every project:

```text
Find affected road(s)
```

Then calculate:

```text
traffic level
road class
road condition
days since restoration
past excavation frequency
```

This creates:

```text
Road Risk
```

The five underground network layers explain **what is underneath**.

The road layer explains **what surface will be disrupted**.

Projects connect both worlds.

---

# 14. Data Import Strategy

## Current five-network GeoJSON

Continue using the current files for initial seeding:

```text
water.geojson
sewage.geojson
drainage.geojson
natural-gas.geojson
fibre.geojson
```

Import them through the backend data import pipeline.

Do not load them directly in React.

---

# 15. Future Network Upload Page

Route:

```text
/admin/gis/import
```

Workflow:

```text
Select network type
      |
Upload file
      |
Validate
      |
Preview on map
      |
Map fields
      |
Confirm
      |
Import into PostGIS
```

Allowed network types:

```text
Water Supply
Sewage
Drainage
Natural Gas
Fibre Network
```

File types:

```text
GeoJSON
KML
CSV
Shapefile
```

---

# 16. Scanned Paper Map Workflow

Do this only after the core application works.

Workflow:

```text
Upload JPG/PDF
      |
Preview
      |
Choose 3+ known reference points
      |
Georeference
      |
Overlay on Nagpur map
      |
Manually digitize network lines
      |
Select network type
      |
Save as unverified
      |
Field verification
      |
Verified GIS record
```

The AI can assist with line detection later, but the human must confirm the network.

---

# 17. Notification Rules

Do not spam all five departments.

## Rule 1 — Utility impact

If new excavation is within the configured threshold of another department's utility:

```text
Notify that department
```

## Rule 2 — Project overlap

If another department has a project on the same/nearby corridor:

```text
Notify that department
```

## Rule 3 — Coordination candidate

If coordination score exceeds threshold:

```text
Create coordination opportunity
Notify involved departments
```

## Rule 4 — Critical conflict

If severity is CRITICAL:

```text
Escalate to City Admin
```

---

# 18. Notification State

A notification should have:

```text
UNREAD
READ
ACKNOWLEDGED
ACTIONED
```

For action-required notifications:

```text
notification -> coordination/approval page
```

Do not make users search for the relevant project manually.

---

# 19. Project Status Machine

Use a strict state machine.

```text
DRAFT
  |
SUBMITTED
  |
AUTO_SCREENED
  |
+-----------------------+
|                       |
NO COORDINATION      COORDINATION_REQUIRED
|                       |
APPROVED              COORDINATION
|                       |
SCHEDULED          FINAL_PLAN
|                       |
IN_PROGRESS             |
|                       |
RESTORATION             |
|                       |
VERIFICATION            |
|                       |
COMPLETED <-------------+
```

Rejected projects can move to:

```text
REJECTED
```

Emergency projects can take an emergency approval route but must be audited.

---

# 20. Audit Events

At minimum:

```text
PROJECT_CREATED
PROJECT_UPDATED
PROJECT_SUBMITTED
EXCAVATION_REQUEST_CREATED
EXCAVATION_REQUEST_SUBMITTED
CONFLICT_DETECTED
CONFLICT_RESOLVED
COORDINATION_CREATED
COORDINATION_SENT
COORDINATION_ACCEPTED
COORDINATION_REJECTED
COORDINATION_MODIFIED
EXCAVATION_APPROVED
EXCAVATION_REJECTED
FIELD_VERIFICATION_CREATED
FIELD_VERIFICATION_APPROVED
PROJECT_COMPLETED
```

---

# 21. Implementation Phases

## Phase 0 — Existing GIS foundation

### Backend

- normalize five utility types
- introduce departments
- persist users
- migrate GIS data to `utilities`
- introduce `roads`
- improve GIS filtering

### Frontend

- map shell
- exact five network toggles
- road overlay
- utility detail drawer
- department-based visibility/editing

### Done when

The map reliably shows exactly:

```text
Water
Sewage
Drainage
Natural Gas
Fibre
```

plus the separate road/project overlays.

---

## Phase 1 — Project Management

### Backend

- projects table
- project CRUD
- project-road association
- geometry validation
- project status machine

### Frontend

- project list
- create project
- draw corridor
- project detail
- project timeline

### Done when

A department can create a real map-based project.

---

## Phase 2 — Conflict Detection

### Backend

- PostGIS proximity queries
- spatial project conflict
- temporal project conflict
- five-network impact detection
- road checks
- conflict records

### Frontend

- conflict result screen
- map highlighting
- severity cards
- utility details

### Done when

Submitting a project automatically reveals affected networks/projects.

---

## Phase 3 — Excavation Permission

### Backend

- excavation request model
- screening workflow
- approval/rejection
- emergency path
- audit events

### Frontend

- request permission
- review request
- checklist
- decision screen

### Done when

A project cannot reach excavation approval without going through the digital screening process.

---

## Phase 4 — Joint Coordination

### Backend

- compatibility rules
- coordination groups
- common-window algorithm
- proposal lifecycle
- department responses
- notification creation

### Frontend

- opportunities page
- coordination detail
- accept/reject/modify
- common-window visualization

### Done when

Three projects can become one coordinated road-opening plan.

---

## Phase 5 — Risk + Impact

### Backend

- utility risk score
- road risk score
- coordination score
- cost model
- disruption model
- hotspot analytics

### Frontend

- risk cards
- score breakdown
- before/after impact
- opportunity ranking

### Done when

The system can explain why one coordination opportunity matters more than another.

---

## Phase 6 — AI Copilot

### Backend

- Gemini integration
- structured prompt layer
- conflict explanation endpoint
- coordination proposal drafting
- controlled NL analytics

### Frontend

- Ask Dig Once
- Explain This Conflict
- Draft Coordination Notice

### Done when

AI can explain deterministic system output without becoming the source of truth.

---

## Phase 7 — Field Verification

### Backend

- field verification table
- GPS point storage
- file metadata
- discrepancy workflow
- confidence update

### Frontend

- mobile verification screen
- GPS capture
- photo upload
- discrepancy comparison

### Done when

A field engineer can verify a network asset and improve the GIS record.

---

## Phase 8 — City Command Center

### Backend

- aggregate analytics
- city KPIs
- department KPIs
- heatmaps
- audit APIs

### Frontend

- command dashboard
- heatmap
- KPI cards
- city coordination table

### Done when

A City Admin can understand the overall excavation/coordination situation in one screen.

---

## Phase 9 — Competition Hardening

### Engineering

- full E2E test
- performance checks
- seeded demo dataset
- deployment
- failure recovery
- security hardening

### Product

- visual consistency
- loading states
- empty states
- error states
- excellent map UX
- clear score explanations

### Demo

Use one fixed scenario that involves **at least three of the five networks**.

Preferred scenario:

```text
Water Supply
Sewage
Fibre Network
```

Optional second conflict:

```text
Natural Gas
```

Drainage can appear as an additional affected network where appropriate.

---

# 22. Recommended Winning Demo Scenario

## Central Avenue

Synthetic road properties:

```text
High traffic
Recently restored
Multiple previous excavation events
```

## Existing underground infrastructure

```text
Water Supply
Sewage
Drainage
Natural Gas
Fibre Network
```

## Planned projects

```text
W-104
Water replacement
10–20 Sep

S-48
Sewer rehabilitation
15–25 Sep

F-32
Fibre installation
17–22 Sep
```

Optional:

```text
D-18
Drainage maintenance
18–21 Sep
```

Natural Gas should create either a proximity warning or a high-sensitivity conflict only if the synthetic geometry actually produces that relationship.

---

# 23. Winning Demo Flow

```text
Login as Water Admin
        |
        v
Create Water project
        |
        v
Draw Central Avenue corridor
        |
        v
Request Excavation Permission
        |
        v
Automatic Analysis
        |
        +----------------------------+
        |                            |
 Underground Networks          Planned Projects
        |                            |
 Water / Sewage / Fibre       S-48 / F-32 / D-18
        |                            |
        +-------------+--------------+
                      |
                      v
                 Risk Score
                      |
                      v
            Coordination Opportunity
                      |
                      v
               Notify Departments
                      |
                      v
            Joint Coordination Plan
                      |
                      v
            Shared execution window
                      |
                      v
                 Approvals
                      |
                      v
                   Schedule
                      |
                      v
            Show measurable impact
```

---

# 24. Final Impact Screen

End the demo with a clean comparison.

```text
WITHOUT DIG ONCE

Water      -> excavation
Sewage     -> excavation
Fibre      -> excavation

3 road openings
3 restoration cycles
3 disruption events
```

Then:

```text
WITH DIG ONCE

1 coordinated road-opening window

Potentially avoided:
2 additional excavations
2 additional restoration cycles
2 additional disruption events
```

All financial figures must be calculated from synthetic/configured assumptions and clearly labeled as estimates.

---

# 25. What Not to Add

Since the prototype has only five underground networks, avoid scope creep into:

- Electrical network without data
- additional utility types without data
- citizen mobile app
- IoT sensors
- drone imagery
- full road-damage computer vision
- complex contractor marketplace
- payment processing
- huge predictive ML system
- automated AI conversion of arbitrary paper maps into authoritative GIS

The core product is already strong enough.

---

# 26. Priority Order for Development

If time is limited, implement in exactly this order:

```text
1. Persisted departments/users/RBAC
2. Five-network GIS data model
3. Roads layer
4. Project CRUD
5. Map drawing
6. Excavation footprint generation
7. Five-network spatial conflict detection
8. Project temporal conflict detection
9. Conflict severity
10. Excavation request
11. Approval workflow
12. Notifications
13. Coordination groups
14. Common execution window
15. Department accept/reject/modify
16. Impact calculation
17. Road risk
18. AI explanation
19. Field verification
20. Analytics
21. File/map import
22. AI digitization
```

Do not reverse this order.

---

# 27. Final Architecture

```text
                         REACT FRONTEND
                              |
       ------------------------------------------------
       |          |          |          |             |
      Map      Projects   Conflicts   Approval   Analytics
       |          |          |          |             |
       ---------------- REST / WebSocket ------------
                              |
                           FASTAPI
                              |
        --------------------------------------------------
        |             |              |                  |
       AUTH          GIS          PROJECTS          WORKFLOW
        |             |              |                  |
        |             |              |                  |
        |        PostGIS queries     |         Coordination Engine
        |             |              |                  |
        ----------------------       --------------------
                              |
                       POSTGRESQL + POSTGIS
                              |
          ------------------------------------------------
          |           |          |         |             |
       Utilities    Roads     Projects  Conflicts    Permissions
          |
          +---------------------------------------------+
                                                        |
                           -------------------------------
                           |                             |
                     Risk/Optimization                 AI
                           |                             |
                   deterministic facts          explanation/drafting
                           |
                           v
                    FINAL DECISION WORKFLOW
```

---

# 28. Final Definition of the Product

The final Dig Once Nagpur system should be able to answer four questions for every proposed excavation:

## 1. What's underneath?

```text
Water
Sewage
Drainage
Natural Gas
Fibre
```

## 2. Who else is working here?

```text
Other departments' planned projects
```

## 3. Should we excavate now?

```text
Risk
Road condition
Utility conflicts
Schedule conflicts
```

## 4. Can we coordinate?

```text
Compatible projects
Shared execution window
Department approvals
Estimated impact
```

That is the complete product loop.

---

# 29. Immediate next implementation task

Do **not** jump to AI or notifications yet.

The next coding slice should be:

```text
CURRENT
five GeoJSON network layers
        |
        v
DEPARTMENTS + USERS
        |
        v
UTILITIES TABLE
        |
        v
ROADS TABLE
        |
        v
PROJECTS TABLE
        |
        v
CREATE PROJECT PAGE
        |
        v
DRAW PROJECT CORRIDOR
        |
        v
SAVE PROJECT
```

After that works end-to-end, immediately implement:

```text
PROJECT
   |
   v
EXCAVATION FOOTPRINT
   |
   v
CHECK FIVE NETWORKS
   |
   v
RETURN CONFLICTS
```

That is the first major milestone where Dig Once starts solving the actual problem rather than simply visualizing infrastructure.

---

# 30. Non-negotiable engineering principles

1. **The five underground networks are the complete utility scope for the current hackathon prototype.**
2. **Roads are separate from underground utilities and exist because excavation occurs on roads.**
3. **PostGIS performs spatial analysis.**
4. **Deterministic backend rules calculate severity, compatibility, and coordination scores.**
5. **AI explains and assists; it does not invent GIS facts.**
6. **Departments can edit only their own network/project data, while still seeing enough information to coordinate.**
7. **Project planning and excavation permission are separate workflows.**
8. **Coordination means a shared execution window, not automatically a shared trench.**
9. **Every conflict must have an explainable reason.**
10. **Every important approval or change must be auditable.**
11. **Synthetic data must be clearly labeled as synthetic.**
12. **Field verification is the mechanism through which synthetic/imported GIS information can eventually become higher-confidence data.**
13. **The final hackathon demo must use the five-network model exactly as implemented rather than claiming unsupported infrastructure types.**

---

# Final Product Statement

> **Dig Once Nagpur is a geospatial excavation-permission and coordination platform built around five underground infrastructure networks — Water Supply, Sewage, Drainage, Natural Gas, and Fibre Network. Before an excavation is approved, it identifies affected underground assets, detects overlapping projects and schedules, scores risk, notifies affected departments, and proposes a coordinated execution window to reduce repeated road excavation, restoration effort, cost, and disruption.**

The map tells the city **what is underneath**.  
The coordination engine tells the city **who else needs to work there**.  
The permission workflow decides **whether the road should be opened now**.  
The impact engine shows **what Dig Once prevented**.
