# Epic Xpress Checkout — Belt & Tire Protection Inquiry
## Final Feature Specification for ChatGPT Work

**Project:** Epic 4X4 Adventures — Epic Xpress Checkout (EXC)  
**Feature:** Optional Belt & Tire Protection inquiry during orientation  
**Scope:** Guest orientation modal, individual driver responses, and existing staff Readiness indicator  
**Environment:** Isolated staging only

### Objective

We want every driver to have a fair, documented opportunity to learn about optional Belt & Tire Protection without making the orientation feel like a sales pitch.

We face two competing guest concerns:

- Guests who damage a tire or belt may feel they were not adequately informed about available protection.
- Guests who are offered optional protection may perceive it as another unwanted add-on.

Our goal is to address both concerns with a respectful, low-pressure informational question integrated naturally into the existing orientation.

**This is an information request, not a purchase decision or waiver of coverage.**

Guiding principle:

**Inform the guest. Offer a choice. Respect the answer. Move on.**

---

## 1. Video timing and presentation

The Belt & Tire Protection discussion concludes at approximately **10:17:09** in the existing orientation video.

At that playback position, introduce a small, unobtrusive question panel **beneath the video, inside the existing orientation modal**.

Requirements:

- Do not pause the video.
- Do not interrupt playback.
- Do not obscure the video.
- Do not interrupt or reset saved video progress.
- The question should appear when playback reaches the designated timestamp.
- If a driver resumes before that timestamp, display the question when playback reaches it.
- If a driver resumes after the timestamp without answering, make the question available without requiring a replay.
- Keep the panel visible or accessible until the participating drivers have had an opportunity to respond.
- Do not repeatedly prompt drivers who have already responded.

The existing requirement to watch 100% of the orientation remains unchanged.

Do not introduce a separate full-screen step, sales screen, or interruption between video segments.

---

## 2. Guest-facing language

### Optional Belt & Tire Protection

As covered in your orientation, Moab's rocky terrain can be especially demanding on tires and drive belts. For additional peace of mind, we offer optional Belt & Tire Protection.

Display only the price applicable to the reservation:

- **$59** standard price
- **$39** when the reservation qualifies for the Premier Adventure Assurance discount

Use existing authoritative reservation and protection data to determine the correct price.

### Question

**Would you like more information about Belt & Tire Protection when you arrive?**

○ I'd like more information.

○ No thank you.

*Requesting information does not add a charge to your reservation.*

The prompt must remain visually understated, friendly, and informational.

No urgency, promotional graphics, countdowns, additional upsells, or sales-oriented language.

---

## 3. Individual driver responses — critical requirement

**Every driver must be offered the opportunity to respond individually, regardless of whether orientation is completed alone or as a group.**

This is essential.

One driver's response must never automatically become another driver's response.

### Individual orientation

When a driver completes orientation individually:

- Display the question for that driver.
- Save their individual response.
- Preserve the response across refreshes and resumed sessions.
- Do not overwrite another driver's response.
- Do not repeat the question after that driver has responded.

### Group orientation

When multiple drivers watch and complete orientation together:

- Display the question once within the shared orientation experience.
- Identify the participating drivers by name.
- Provide each driver with their own response selection.
- Save each response independently, associated with that driver.
- Do not assume everyone shares the same preference.
- Preserve the existing shared video and assessment workflow.

**Example:**

Jennifer — I'd like more information.

Joe — No thank you.

Both responses are valid and must be preserved.

Group viewing is a convenience. It does not eliminate individual driver choice.

### Unanswered responses

Neither choice is preselected.

A driver may leave the question unanswered.

An unanswered response must never block:
- Video playback
- The knowledge assessment
- Orientation completion
- EXC qualification
- Reservation readiness

This is optional information gathering, not an additional completion requirement.

Do not treat a lack of response as a decline.

---

## 4. Existing staff Readiness indicator

Readiness already has a Belt & Tire Protection indicator.

**Current behavior:**
- 🛞 appears when protection is purchased.
- The indicator is blank when protection has not been purchased.

That functionality already exists and must remain intact.

We are introducing two informational symbols into the currently blank state.

### Display rules

| Condition | Readiness indicator |
|---|---|
| Protection purchased | 🛞 |
| Protection not purchased; at least one driver requests information | ❓ |
| Protection not purchased; all applicable drivers have responded “No thank you” | ⛔️ |
| Protection not purchased; no information requests and one or more driver responses are missing | Blank |

### Display precedence

**1. 🛞 Purchased — highest priority**

Always display the existing tire symbol when protection has been purchased.

Purchase status must continue to come from the same existing authoritative source.

**2. ❓ Information requested**

If any driver requests information, display ❓.

Another driver's decline cannot cancel an information request.

**3. ⛔️ Declined**

Only display ⛔️ when every applicable driver has explicitly selected “No thank you.”

**4. Blank**

If nobody has requested information and not all applicable drivers have responded, leave the indicator blank.

Do not create additional symbols.

### Example outcomes

| Jennifer | Joe | Readiness |
|---|---|---|
| More information | No thank you | ❓ |
| No thank you | More information | ❓ |
| More information | Unanswered | ❓ |
| No thank you | No thank you | ⛔️ |
| No thank you | Unanswered | Blank |
| Unanswered | Unanswered | Blank |
| Any responses | Protection purchased | 🛞 |

These display rules must remain consistent regardless of the order in which drivers complete orientation.

---

## 5. Identifying who requested information

When Readiness displays ❓, the Adventure Tech should be able to identify which driver requested information.

Use the existing Readiness interface and the smallest practical interaction, such as existing detail or tooltip behavior.

For example:

**Belt & Tire Protection — Information Requested**

Jennifer — Requested more information  
Joe — No thank you

This allows the Adventure Tech to address the right person rather than automatically repeating the protection presentation to everyone.

Do not introduce an additional dashboard, new workflow, or complex interface.

If the current Readiness component already supports displaying detail, reuse that capability.

---

## 6. Respecting guest preferences

**❓ Requested information**

The guest has asked for an explanation upon arrival.

The Adventure Tech should provide it and answer questions without pressure.

**⛔️ Declined**

All applicable drivers have indicated they do not want additional information.

Do not automatically repeat the optional protection presentation.

**Blank**

No information request has been recorded, but one or more responses are outstanding.

Do not interpret this as an affirmative decline.

**🛞 Purchased**

Protection has been purchased, and the existing tire indicator takes precedence.

Guests may still ask questions or change their minds in person.

No special guest-facing change-your-answer screen is required.

Importantly, these responses express an interest in receiving additional information. They are **not a legally binding decline of insurance or protection**, nor a substitute for any existing mandatory disclosures or acknowledgments.

---

## 7. Purchasing behavior — unchanged

Belt & Tire Protection is currently purchased upon arrival.

We are not adding online purchasing.

Do not introduce:
- Payment processing
- Shopping carts
- Purchase buttons
- Automatic charges
- Additional checkout steps
- A new purchase status system

The existing purchase record already controls the 🛞 indicator.

If protection is purchased upon arrival, 🛞 must replace any previous ❓, ⛔️, or blank status in Readiness.

Preserve all existing purchasing functionality.

---

## 8. EXC completion and eligibility — unchanged

This optional inquiry is completely separate from safety education, the knowledge assessment, and reservation readiness.

A driver can:
- Request information
- Decline information
- Leave the question unanswered

All three outcomes are acceptable.

None may prevent orientation completion or EXC qualification.

The new inquiry must not create an exception, readiness gate, mandatory acknowledgment, or additional knowledge assessment question.

---

## 9. Session persistence and driver identity

We are already implementing independent and group orientation sessions.

This feature must use that existing participant/session architecture.

Requirements:

- Tie each answer to the correct reservation and driver.
- Preserve answers across session interruption and resume.
- Preserve answers when another driver starts later.
- Preserve answers when drivers complete orientation in different orders.
- Group orientation must save independent driver responses.
- Do not overwrite or erase previously saved answers when participant selections change.
- Do not create duplicate driver identities or separate parallel session systems.

If a driver has already responded, their answer should remain recorded even if another driver subsequently participates.

Use existing driver identity and session persistence patterns.

---

## 10. Staging test requirements

Test the following using isolated staging data.

### Video and prompt

1. Prompt appears at approximately 10:17:09.
2. Video continues without interruption.
3. Prompt does not obscure video content.
4. Resuming before the timestamp triggers the prompt correctly.
5. Resuming after the timestamp preserves access to an unanswered prompt.
6. A previously answered driver is not repeatedly prompted.

### Individual and group scenarios

7. One driver completes orientation and requests information.
8. Another driver completes later and declines.
9. The first driver's request remains recorded.
10. Group orientation allows each participating driver to answer independently.
11. Individual and group sessions do not overwrite one another's responses.
12. Missing responses do not block completion.

### Readiness

13. One or more information requests produce ❓.
14. All applicable drivers declining produces ⛔️.
15. Partial declines with no information requests leave the indicator blank.
16. No responses leave the indicator blank.
17. An existing protection purchase produces 🛞.
18. A purchase correctly overrides an earlier ❓ or ⛔️.
19. The Adventure Tech can identify who requested information.

### Pricing and existing functionality

20. Correct reservation-specific price displays.
21. No charges are created.
22. Existing EXC qualification logic remains unchanged.
23. Existing video, assessment, resume, and group workflows continue functioning.
24. Existing Belt & Tire purchasing behavior remains unchanged.

---

## 11. Scope and implementation boundaries

This is a contained enhancement to EXC, not a new project.

Reuse the existing:
- Orientation video modal
- Driver participant identities
- Group and individual session persistence
- Reservation readiness data
- Belt & Tire purchased indicator
- Staff Readiness display

Do not redesign unrelated screens.

Do not introduce a new sales workflow, insurance approval process, marketing automation, or reservation system.

**Do not perform unrelated refactoring or cleanup.**

If an implementation decision can be made using existing patterns, make that decision and proceed.

Only escalate a genuine blocker that prevents safe implementation.

### Authorization

You may implement and test this feature in the isolated EXC staging environment.

**Do not merge, migrate, deploy, or change production without explicit approval.**

Complete the implementation and tests, then provide a short report:

1. What was implemented
2. What passed testing
3. Any genuine blocker
4. Whether it is ready for my personal review

Do not produce another large visual report or reopen previously approved EXC decisions.

### Final guiding principle

**Inform every driver. Respect every response. Keep the checkout simple.**