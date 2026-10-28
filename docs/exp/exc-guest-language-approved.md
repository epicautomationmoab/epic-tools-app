# Epic Xpress Checkout (EXC)
## Approved Guest Language & Conditional Screen Requirements

**Project:** Epic 4X4 Adventures — Guest Portal / Epic Xpress Checkout  
**Purpose:** Update existing Epic Xpress Ready messaging, guest-facing screen states, and conditional presentation.

**Implementation instruction:** Follow this specification without redesigning unrelated portal components or altering existing completion requirements.

---

## 1. Naming and guiding principles

Rename **Epic Xpress Ready** to **Epic Xpress Checkout** throughout the guest-facing experience.

- **Guest-facing name:** Epic Xpress Checkout
- **Internal abbreviation:** EXC
- **Retire:** EXP and “EXP Ready” from guest-facing labels
- **Individual driver status:** Orientation Complete
- **Reservation-level success:** Your party has qualified for our fastest check-out.

The purpose of Epic Xpress Checkout is to save guests time while preserving personal service, safety, and confidence.

Our guiding philosophy:

**We've made it faster to get on the trail, not harder to get help.**

EXC is optional. Guests may complete their orientation and knowledge assessment in person instead. Both paths provide the same opportunity for personal assistance.

Do not present EXC as an additional requirement, an exclusive service tier, or a replacement for our Adventure Techs.

## 2. Eligibility and conditional behavior

EXC qualification is **reservation-wide**, not driver-specific.

An individual driver can have an orientation completion status even when the reservation has not qualified for EXC.

The reservation qualifies only when all applicable readiness requirements are satisfied, including:

- All required driver forms and waivers
- All required passenger forms and waivers
- All minors accounted for and required parent/guardian acknowledgments completed
- Required Utah OHV education completed and verified for every driver
- Epic operator orientation and knowledge assessment successfully completed for every driver
- All applicable overall readiness requirements complete

Use the existing validated readiness data as the source of truth.

The existing 3/3 readiness display should remain consistent with actual completion. Do not qualify a reservation based merely on the numeric display if its underlying requirements are incomplete.

### Conditional display rules

**When only some drivers have completed orientation:**
- Display only the names of drivers whose orientation is complete.
- Do not display unfinished drivers in the EXC completion list.
- Do not display the party-wide qualification statement.
- Do not display the confidence commitment box.
- Keep the existing overall readiness tracker operating normally.
- Do not add warnings, negative messaging, or redundant instructions about unfinished work to this section.

**When every driver has completed orientation but other readiness requirements remain:**
- Continue displaying the completed driver list.
- Do not display the party-wide EXC qualification message.
- Do not display the confidence commitment box.
- The overall readiness tracker continues to reflect the remaining requirements.

**When the entire reservation qualifies:**
- Display the full EXC qualification message.
- Display all completed drivers.
- Display the confidence commitment box.
- Preserve the overall readiness tracker, showing all requirements complete.

**When no drivers have completed orientation:**
- Do not show an empty driver completion list or a misleading success message.
- Continue to offer the optional orientation experience through the existing portal workflow.

---

## 3. Screen A — Partial driver completion

**Condition:** One or more drivers have completed orientation, but the reservation does not yet qualify for EXC.

### Example screen

**OUR FASTEST CHECK-OUT · OPTIONAL**

# Epic Xpress Checkout

The drivers listed below have completed our operator orientation.

✓ **Jordan Trailtest**  
Orientation Complete

### Presentation rules

- Keep the existing EXC card style and overall portal design.
- Use green completion checks for drivers who have completed orientation.
- Display only completed drivers.
- No party-wide success statement.
- No confidence commitment box.
- No requirement to explain missing drivers in this section.

The overall readiness tracker elsewhere on the page continues to communicate the reservation's actual progress.

---

## 4. Screen B — All drivers complete, reservation not fully ready

**Condition:** Every driver has completed orientation but one or more other applicable readiness requirements remain outstanding.

### Example screen

**OUR FASTEST CHECK-OUT · OPTIONAL**

# Epic Xpress Checkout

The drivers listed below have completed our operator orientation.

✓ **Jordan Trailtest**  
Orientation Complete

✓ **Morgan Trailtest**  
Orientation Complete

### Presentation rules

This uses the same positive language as partial driver completion.

Do not announce that the party has qualified for EXC.

Do not display the confidence commitment box.

The portal's separate readiness tracker continues to identify remaining requirements through its existing workflow.

**Important:** Completing the driver orientation process alone does not qualify the entire reservation for Xpress Checkout.

---

## 5. Screen C — Entire reservation EXC qualified

**Condition:** Every applicable readiness requirement is complete.

### Example screen

**OUR FASTEST CHECK-OUT · OPTIONAL**

# Epic Xpress Checkout

### Your party has qualified for our fastest check-out.

Your party has completed all required forms. Every driver has completed Utah's required OHV education course and our operator orientation.

Please see an Adventure Tech upon arrival to complete your check-out.

✓ **Jordan Trailtest**  
Orientation Complete

✓ **Morgan Trailtest**  
Orientation Complete

### Our Commitment to Your Confidence

Epic Xpress Checkout saves you time, but never at the expense of a confident departure. Our Adventure Techs are always happy to answer questions, review vehicle operation, or provide additional guidance before you head out.

**Your adventure should begin with confidence, not uncertainty.**

### Presentation rules

- Show the qualification statement in the existing green success styling.
- Show all completed drivers.
- Display the commitment message in its own visually distinct but understated box beneath the driver list.
- Display the commitment box only for EXC-qualified reservations.
- Preserve the existing overall progress indicator.

The commitment is reassurance, not another requirement or action item.

---

## 6. Screen D — Optional orientation invitation

**Condition:** The guest is being offered the opportunity to complete their operator orientation online.

### Approved language

**Prefer to complete your orientation with us?**

Epic Xpress Checkout is entirely optional and designed to save you time at arrival. If you prefer, our Adventure Techs are happy to guide you through the orientation and knowledge assessment in person when you arrive.

### Presentation rules

- Make the optional nature of EXC clear before beginning the online orientation.
- Retain the existing option to receive assistance in person.
- Do not imply that in-person orientation is inferior, inconvenient, or discouraged.
- Do not imply guests who decline EXC lose access to assistance.
- Preserve all legally and operationally required orientation and assessment steps.

The choice is **when and how to complete orientation**, not whether orientation is required.

---

## 7. Overall readiness panel

The existing overall readiness panel must remain distinct from the EXC card.

### Example — All requirements complete

**YOUR PROGRESS**

# You're all set for check-out!

All three pre-arrival requirements are complete. Your Adventure Tech will help you with the final steps when you arrive.

**3/3 COMPLETE**

Progress bar: **100% ready**

### Presentation rules

- Replace “You are ready for your adventure” with “You're all set for check-out!” when all applicable pre-arrival requirements have been completed.
- Keep the 3/3 completion count and 100% progress bar when accurate.
- Retain existing dynamic progress functionality for incomplete reservations.
- Do not imply completion of in-person vehicle checkout or the final departure process.
- Do not use this completed-state wording for incomplete reservations.

This panel reflects overall pre-arrival readiness. The EXC panel separately celebrates qualification for the expedited checkout experience.

---

## 8. Visual hierarchy

Preserve the current design language from the supplied screenshots.

**EXC card**
1. Orange eyebrow: OUR FASTEST CHECK-OUT · OPTIONAL
2. Primary heading: Epic Xpress Checkout
3. Conditional status or introductory sentence
4. Completed driver list
5. Conditional confidence commitment box

**Readiness panel**
1. YOUR PROGRESS
2. Dynamic readiness heading
3. Dynamic explanatory copy
4. Completion count
5. Progress bar and percentage

Do not introduce a major visual redesign. The desired change is primarily terminology, copy, and conditional presentation.

---

## 9. Acceptance criteria

Before considering this update complete, verify these scenarios:

1. No completed drivers: no false EXC success state or empty driver list.
2. One completed driver of two: only the completed driver appears.
3. All drivers complete but passenger forms outstanding: no party-wide EXC success.
4. All drivers complete but a minor's required acknowledgment outstanding: no party-wide EXC success.
5. Driver orientation complete but required OHV verification incomplete: no party-wide EXC success.
6. All requirements complete: full EXC success, complete driver list, and confidence commitment box appear.
7. All readiness requirements complete: overall progress panel displays the correct completed state.
8. Guests choosing in-person orientation retain access to the normal assisted orientation and assessment experience.
9. Completion changes update the displayed state correctly without requiring a reservation to be recreated.
10. Former guest-facing EXP and Epic Xpress Ready language is replaced where applicable.

## 10. Scope and implementation safeguards

This is an approved language and conditional UI specification.

Do not change:
- Orientation video requirements
- Knowledge assessment questions or scoring
- Utah OHV verification requirements
- Driver, passenger, or minor waiver requirements
- Reservation eligibility rules beyond correctly reflecting existing verified readiness
- Unrelated portal or checkout components

Reuse existing readiness state and completion data wherever possible.

**Implement and validate in preview first. Do not deploy to production without explicit approval.**

Provide screenshots of each applicable state for review.

### Final experience principle

**We've made it faster to get on the trail, not harder to get help.**

Every guest should understand that Xpress Checkout is an optional convenience, that our Adventure Techs remain available, and that Epic's commitment is to a confident departure—not simply a faster transaction.

## Driver session selection — October 28 owner clarification

Reopening orientation asks “Who’s completing orientation?” using existing styling. Drivers can resume their own saved individual session, resume an original group together, or select untouched drivers for a new individual/group session. Completed drivers remain completed. Each new session starts its own video and assessment; it cannot inherit another session’s progress. Original group membership remains fixed. Existing saved sessions and initials remain intact.
