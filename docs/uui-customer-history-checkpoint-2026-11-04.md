# Customer history reader verification

Restored authenticated EXECUTE on five existing, reviewed read-only functions in UUI Development jgpihdpcdlqugmqanzfj. No function bodies or table permissions changed. Employee-role SQL tests passed all five readers and validated the C360 response includes identity, reservations, calls, texts, emails, notes, quotes, opportunities, and drafts. Workstation role receives no linked-contact data and is rejected for timeline/message readers. Anonymous EXECUTE remains denied for all five.

Mixed read/write c360_employee_regular_contact remains ungranted pending review of its mutation path. This is database-level verification, not a signed-in browser test. Current protected Preview is READY at commit 67217f9f537cfaaa360a81d04a11f4f1d759c6c1, deployment dpl_84VCqWa2uK9B4VsAggRrBKfok7Qq. These database grants require no redeployment. Production and EXC staging unchanged.
