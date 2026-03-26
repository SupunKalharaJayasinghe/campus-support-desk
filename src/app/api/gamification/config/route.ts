import { NextResponse } from "next/server";
import { XP_VALUES } from "@/lib/points-engine";

const XP_ACTIONS = [
  {
    action: "module_passed",
    category: "academic",
    xpPoints: XP_VALUES.MODULE_PASSED,
    description: "Awarded when a student passes a module",
  },
  {
    action: "high_score",
    category: "academic",
    xpPoints: XP_VALUES.HIGH_SCORE,
    description: "Awarded when a student scores 80% or above in a module",
  },
  {
    action: "perfect_score",
    category: "academic",
    xpPoints: XP_VALUES.PERFECT_SCORE,
    description: "Awarded when a student scores 100% in a module",
  },
  {
    action: "semester_gpa_above_3",
    category: "academic",
    xpPoints: XP_VALUES.SEMESTER_GPA_ABOVE_3,
    description: "Awarded when semester GPA reaches 3.0 or above",
  },
  {
    action: "semester_gpa_above_3.5",
    category: "academic",
    xpPoints: XP_VALUES.SEMESTER_GPA_ABOVE_3_5,
    description: "Awarded when semester GPA reaches 3.5 or above",
  },
  {
    action: "semester_all_passed",
    category: "academic",
    xpPoints: XP_VALUES.SEMESTER_ALL_PASSED,
    description: "Awarded when every module in a semester is passed",
  },
  {
    action: "first_class_gpa",
    category: "academic",
    xpPoints: XP_VALUES.FIRST_CLASS_GPA,
    description: "Awarded when cumulative GPA reaches First Class level",
  },
  {
    action: "gpa_improvement",
    category: "academic",
    xpPoints: XP_VALUES.GPA_IMPROVEMENT,
    description: "Awarded when GPA improves meaningfully from the previous semester",
  },
  {
    action: "quiz_completed",
    category: "quiz",
    xpPoints: XP_VALUES.QUIZ_COMPLETED,
    description: "Awarded when a quiz is completed",
  },
  {
    action: "quiz_on_time",
    category: "quiz",
    xpPoints: XP_VALUES.QUIZ_ON_TIME,
    description: "Awarded when a quiz is completed before the deadline",
  },
  {
    action: "quiz_high_score",
    category: "quiz",
    xpPoints: XP_VALUES.QUIZ_HIGH_SCORE,
    description: "Awarded when a quiz score reaches 80% or above",
  },
  {
    action: "quiz_perfect_score",
    category: "quiz",
    xpPoints: XP_VALUES.QUIZ_PERFECT_SCORE,
    description: "Awarded when a quiz score reaches 100%",
  },
  {
    action: "milestone_reached",
    category: "milestone",
    xpPoints: XP_VALUES.MILESTONE_100,
    description: "Bonus awarded when a student reaches the 100 XP milestone",
  },
  {
    action: "milestone_reached",
    category: "milestone",
    xpPoints: XP_VALUES.MILESTONE_300,
    description: "Bonus awarded when a student reaches the 300 XP milestone",
  },
  {
    action: "milestone_reached",
    category: "milestone",
    xpPoints: XP_VALUES.MILESTONE_600,
    description: "Bonus awarded when a student reaches the 600 XP milestone",
  },
  {
    action: "streak_bonus",
    category: "bonus",
    xpPoints: XP_VALUES.STREAK_BONUS,
    description: "Awarded for consecutive strong semesters without at-risk modules",
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      xpValues: XP_VALUES,
      actions: XP_ACTIONS,
    },
  });
}
