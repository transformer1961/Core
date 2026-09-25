# Core Platform

Core is the central control platform of Sentinel Network Systems. It is not the SNS organization and it is not a Discord bot runtime.

The shared authority, trust-boundary, data, recovery, and release requirements are defined in [SNS-Architecture-Operations](../../Docs/SNS-Architecture-Operations.md).

## Core owns

- Human authentication and authorization
- Service enrollment, approval, credential rotation, and revocation
- Command authorization and queue lifecycle
- Global service controls and emergency disable
- Service health records and audit administration

## Core does not own

- Product-specific Discord command behavior
- Authority merely because a service is connected to the SNS Network
- Unregistered or unapproved service events

Every bot event must identify an active registered service and pass the service authentication contract. A valid signature authenticates a request; Core permissions and service status determine whether the requested operation is authorized.
