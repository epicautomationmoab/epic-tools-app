import type { ExpQuestion } from "./assessment-policy";

/**
 * The ten guest-approved safety topics.
 * Question wording is sourced from the October 26 supplied questionnaire and
 * discussion. Critical grading designations are intentionally NOT assigned here:
 * the user requested a question-only review. Do not activate scoring until
 * content and critical flags are explicitly approved.
 */
export type ExpQuestionDraft = Omit<ExpQuestion, "critical">;
export const EXP_QUESTION_BANK_DRAFT: ExpQuestionDraft[] = [
  {
    id: "speed", prompt: "Speed limits on Moab trails may range from 15–20 MPH. At times, even that speed may be:",
    options: [{id:"a",text:"Way too slow"},{id:"b",text:"Just right"},{id:"c",text:"Excessive — my speed should always be appropriate for the terrain, conditions, and my skill level."}],
    correctOptionId:"c", explanation:"Posted limits are maximums, not target speeds. Choose a speed appropriate for the terrain, conditions, and your ability."
  },
  {
    id:"shifting", prompt:"When shifting between Park, Reverse, Neutral, High, and Low, I:",
    options:[{id:"a",text:"Should slow to 3–5 MPH"},{id:"b",text:"May shift on the fly"},{id:"c",text:"Must come to a full and complete stop"}],
    correctOptionId:"c", explanation:"Come to a full and complete stop before shifting between gear positions."
  },
  {
    id:"protections", prompt:"My actions on the trail can void my valuable rider protections.",
    options:[{id:"true",text:"True"},{id:"false",text:"False"}],
    correctOptionId:"true", explanation:"How you operate the vehicle can affect valuable rider protections."
  },
  {
    id:"two-wheel", prompt:"Two-wheel drive is for:",
    options:[{id:"a",text:"Off-pavement driving"},{id:"b",text:"On-pavement driving"}],
    correctOptionId:"b", explanation:"Use two-wheel drive on paved roads, consistent with Epic's vehicle orientation."
  },
  {
    id:"four-wheel", prompt:"Four-wheel drive is for:",
    options:[{id:"a",text:"On-pavement driving"},{id:"b",text:"Off-pavement driving"}],
    correctOptionId:"b", explanation:"Use four-wheel drive off pavement, consistent with Epic's vehicle orientation."
  },
  {
    id:"low-gear", prompt:"When driving off pavement, I should be in:",
    options:[{id:"a",text:"Low Gear"},{id:"b",text:"High Gear"},{id:"c",text:"Either"}],
    correctOptionId:"a", explanation:"Epic's orientation instructs guests to use Low Gear off pavement."
  },
  {
    id:"designated-routes", prompt:"I may leave a designated motorized trail to explore an area that appears safe to drive.",
    options:[{id:"true",text:"True"},{id:"false",text:"False"}],
    correctOptionId:"false", explanation:"Stay on designated motorized routes. An area appearing safe does not make it an authorized riding route."
  },
  {
    id:"accident", prompt:"In the unlikely event of an accident or rollover, I should:",
    options:[{id:"a",text:"Right the vehicle myself and continue if it appears drivable"},{id:"b",text:"Move the vehicle out of the way and arrange my own recovery"},{id:"c",text:"Stop immediately, call 911 for an emergency, contact Epic 4X4 Adventures, do not move or attempt to recover the vehicle, and wait for the recovery team"}],
    correctOptionId:"c", explanation:"Seek emergency help when needed, notify Epic, and do not attempt vehicle self-recovery."
  },
  {
    id:"throttle", prompt:"When accelerating my RZR, I should:",
    options:[{id:"a",text:"Press the throttle aggressively to get moving quickly"},{id:"b",text:"Apply the throttle smoothly and progressively"},{id:"c",text:"Pump the throttle repeatedly until the vehicle gains speed"}],
    correctOptionId:"b", explanation:"Smooth, progressive throttle supports controlled driving."
  },
  {
    id:"steep-climb", prompt:"When climbing a steep obstacle, I should:",
    options:[{id:"a",text:"Stop partway up if I become uncertain and decide what to do next"},{id:"b",text:"Accelerate hard at the bottom so I have as much speed as possible"},{id:"c",text:"Approach at a controlled speed and maintain smooth, steady momentum through the climb"}],
    correctOptionId:"c", explanation:"Plan the climb with a controlled approach and smooth, steady momentum rather than charging the obstacle."
  }
];
