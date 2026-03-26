export interface LevelConfig {
  level: number;
  name: string;
  title: string;
  minXP: number;
  maxXP: number;
  icon: string;
  color: string;
  description: string;
}

export interface LevelProgress {
  currentLevel: LevelConfig;
  nextLevel: LevelConfig | null;
  currentXP: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  xpRemainingToNextLevel: number;
  progressPercentage: number;
  isMaxLevel: boolean;
}

export interface LevelBadge {
  level: number;
  name: string;
  title: string;
  icon: string;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface LevelComparison {
  levels: Array<{
    config: LevelConfig;
    status: "completed" | "current" | "locked";
    progressInLevel: number;
  }>;
  currentLevelIndex: number;
  totalLevels: number;
  overallProgress: number;
}

export interface LevelUpEvent {
  previousLevel: LevelConfig;
  newLevel: LevelConfig;
  message: string;
  xpAtLevelUp: number;
}

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: "Beginner",
    title: "Novice Scholar",
    minXP: 0,
    maxXP: 99,
    icon: "\uD83C\uDF31",
    color: "gray",
    description: "Every journey begins with a single step. Start earning XP!",
  },
  {
    level: 2,
    name: "Intermediate",
    title: "Rising Learner",
    minXP: 100,
    maxXP: 299,
    icon: "\uD83D\uDCD8",
    color: "blue",
    description: "You're building momentum. Keep pushing forward!",
  },
  {
    level: 3,
    name: "Advanced",
    title: "Knowledge Seeker",
    minXP: 300,
    maxXP: 599,
    icon: "\uD83C\uDF93",
    color: "purple",
    description: "Your dedication is paying off. Excellence is within reach!",
  },
  {
    level: 4,
    name: "Champion",
    title: "Campus Champion",
    minXP: 600,
    maxXP: Number.POSITIVE_INFINITY,
    icon: "\uD83C\uDFC6",
    color: "amber",
    description: "You've reached the pinnacle. You're an inspiration to all!",
  },
];

const LEVEL_BADGE_COLORS: Record<
  LevelConfig["color"],
  {
    borderColor: string;
    bgColor: string;
    textColor: string;
    gradientFrom: string;
    gradientTo: string;
  }
> = {
  gray: {
    borderColor: "border-gray-400",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    gradientFrom: "from-gray-200",
    gradientTo: "to-gray-400",
  },
  blue: {
    borderColor: "border-blue-500",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    gradientFrom: "from-blue-200",
    gradientTo: "to-blue-500",
  },
  purple: {
    borderColor: "border-purple-500",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    gradientFrom: "from-purple-200",
    gradientTo: "to-purple-500",
  },
  amber: {
    borderColor: "border-amber-500",
    bgColor: "bg-amber-100",
    textColor: "text-amber-800",
    gradientFrom: "from-amber-200",
    gradientTo: "to-amber-500",
  },
};

function normalizeXP(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function roundToOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getLevelIndex(level: LevelConfig) {
  return LEVELS.findIndex((entry) => entry.level === level.level);
}

function getLevelByNumber(levelNumber: number) {
  return LEVELS.find((entry) => entry.level === levelNumber) ?? null;
}

function buildLevelUpMessage(newLevel: LevelConfig) {
  if (newLevel.level === 2) {
    return "\uD83C\uDF89 Congratulations! You've leveled up to Rising Learner!";
  }
  if (newLevel.level === 3) {
    return "\uD83C\uDF93 Amazing! You've reached Knowledge Seeker status!";
  }
  if (newLevel.level === 4) {
    return "\uD83C\uDFC6 Incredible! You are now a Campus Champion!";
  }

  return `Congratulations! You've reached ${newLevel.title}!`;
}

/**
 * Returns the student's current level configuration for the supplied XP total.
 *
 * Negative or invalid totals safely resolve to Level 1.
 *
 * @param totalXP Total XP points earned by the student.
 * @returns Matching level configuration from the LEVELS array.
 *
 * @example
 * getCurrentLevel(250)
 */
export function getCurrentLevel(totalXP: number): LevelConfig {
  const currentXP = normalizeXP(totalXP);

  for (const level of LEVELS) {
    if (currentXP >= level.minXP && currentXP <= level.maxXP) {
      return level;
    }
  }

  return LEVELS[LEVELS.length - 1];
}

/**
 * Returns the next level the student is working toward.
 *
 * When the student is already at the highest level, null is returned.
 *
 * @param totalXP Total XP points earned by the student.
 * @returns Next level configuration, or null for max-level students.
 *
 * @example
 * getNextLevel(150)
 */
export function getNextLevel(totalXP: number): LevelConfig | null {
  const currentLevel = getCurrentLevel(totalXP);
  const currentIndex = getLevelIndex(currentLevel);

  if (currentIndex < 0 || currentIndex >= LEVELS.length - 1) {
    return null;
  }

  return LEVELS[currentIndex + 1];
}

/**
 * Calculates detailed progress information for the current level and next level.
 *
 * Progress is clamped to a 0-100 range and rounded to one decimal place.
 *
 * @param totalXP Total XP points earned by the student.
 * @returns Current level, next level, and detailed progress metrics.
 *
 * @example
 * getLevelProgress(50)
 */
export function getLevelProgress(totalXP: number): LevelProgress {
  const currentXP = normalizeXP(totalXP);
  const currentLevel = getCurrentLevel(currentXP);
  const nextLevel = getNextLevel(currentXP);
  const xpInCurrentLevel = Math.max(0, currentXP - currentLevel.minXP);
  const isMaxLevel = nextLevel === null;
  const xpRequiredForNextLevel = nextLevel
    ? Math.max(0, nextLevel.minXP - currentLevel.minXP)
    : 0;
  const xpRemainingToNextLevel = nextLevel
    ? Math.max(0, nextLevel.minXP - currentXP)
    : 0;
  const progressPercentage = isMaxLevel
    ? 100
    : roundToOne(
        clamp(
          xpRequiredForNextLevel > 0
            ? (xpInCurrentLevel / xpRequiredForNextLevel) * 100
            : 0,
          0,
          100
        )
      );

  return {
    currentLevel,
    nextLevel,
    currentXP,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    xpRemainingToNextLevel,
    progressPercentage,
    isMaxLevel,
  };
}

/**
 * Returns UI-ready badge styling information for the student's current level.
 *
 * @param totalXP Total XP points earned by the student.
 * @returns Display-friendly badge metadata derived from the level color mapping.
 *
 * @example
 * getLevelBadge(600)
 */
export function getLevelBadge(totalXP: number): LevelBadge {
  const currentLevel = getCurrentLevel(totalXP);
  const colors = LEVEL_BADGE_COLORS[currentLevel.color] ?? LEVEL_BADGE_COLORS.gray;

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    title: currentLevel.title,
    icon: currentLevel.icon,
    color: currentLevel.color,
    borderColor: colors.borderColor,
    bgColor: colors.bgColor,
    textColor: colors.textColor,
    gradientFrom: colors.gradientFrom,
    gradientTo: colors.gradientTo,
  };
}

/**
 * Returns the full level configuration roadmap.
 *
 * @returns Level configuration array used by all level calculations.
 *
 * @example
 * getAllLevels()
 */
export function getAllLevels(): LevelConfig[] {
  return LEVELS;
}

/**
 * Builds a level-roadmap comparison showing completed, current, and locked levels.
 *
 * Overall progress is calculated across the entire level path, including progress
 * within the current level, and rounded to one decimal place.
 *
 * @param totalXP Total XP points earned by the student.
 * @returns Comparison object for rendering a level roadmap.
 *
 * @example
 * getLevelComparison(250)
 */
export function getLevelComparison(totalXP: number): LevelComparison {
  const progress = getLevelProgress(totalXP);
  const currentLevelIndex = getLevelIndex(progress.currentLevel);
  const totalLevels = LEVELS.length;
  const progressFraction = progress.isMaxLevel ? 1 : progress.progressPercentage / 100;
  const overallProgress =
    totalLevels > 0
      ? roundToOne(
          clamp(((Math.max(0, currentLevelIndex) + progressFraction) / totalLevels) * 100, 0, 100)
        )
      : 0;

  return {
    levels: LEVELS.map((config, index) => ({
      config,
      status:
        index < currentLevelIndex
          ? "completed"
          : index === currentLevelIndex
            ? "current"
            : "locked",
      progressInLevel:
        index < currentLevelIndex
          ? 100
          : index === currentLevelIndex
            ? progress.progressPercentage
            : 0,
    })),
    currentLevelIndex: Math.max(0, currentLevelIndex),
    totalLevels,
    overallProgress,
  };
}

/**
 * Returns the XP range required for a specific level number.
 *
 * @param levelNumber Level number to inspect.
 * @returns XP range for the requested level, or null when not found.
 *
 * @example
 * getXPForLevel(3)
 */
export function getXPForLevel(
  levelNumber: number
): { minXP: number; maxXP: number } | null {
  const level = getLevelByNumber(levelNumber);
  if (!level) {
    return null;
  }

  return {
    minXP: level.minXP,
    maxXP: level.maxXP,
  };
}

/**
 * Formats an XP total for display using locale-aware number formatting.
 *
 * @param xp XP value to format.
 * @returns Human-readable XP label such as "1,500 XP".
 *
 * @example
 * formatXPDisplay(1500)
 */
export function formatXPDisplay(xp: number): string {
  const normalizedXP = Number.isFinite(xp) ? xp : 0;
  return `${normalizedXP.toLocaleString()} XP`;
}

/**
 * Detects whether a level-up occurred between two XP totals.
 *
 * When the student crosses into a higher level, a celebratory message and both
 * level configurations are returned. Otherwise, null is returned.
 *
 * @param previousXP Previous XP total.
 * @param newXP Updated XP total.
 * @returns Level-up event details, or null when no level change occurred.
 *
 * @example
 * getLevelUpMessage(99, 100)
 */
export function getLevelUpMessage(
  previousXP: number,
  newXP: number
): LevelUpEvent | null {
  const previousLevel = getCurrentLevel(previousXP);
  const nextLevel = getCurrentLevel(newXP);

  if (nextLevel.level <= previousLevel.level) {
    return null;
  }

  return {
    previousLevel,
    newLevel: nextLevel,
    message: buildLevelUpMessage(nextLevel),
    xpAtLevelUp: normalizeXP(newXP),
  };
}

/* Verification Scenarios:

Scenario 1 — Brand new student:
getCurrentLevel(0) → Level 1, Beginner, "Novice Scholar"
getLevelProgress(0) → progressPercentage: 0%, xpRemainingToNextLevel: 100
getLevelBadge(0) → gray colors

Scenario 2 — About to level up:
getCurrentLevel(99) → Level 1, Beginner
getLevelProgress(99) → progressPercentage: 99%, xpRemainingToNextLevel: 1
getLevelUpMessage(99, 100) → level up to Intermediate!

Scenario 3 — Mid-level student:
getCurrentLevel(250) → Level 2, Intermediate, "Rising Learner"
getLevelProgress(250) → progressPercentage: 75%, xpRemainingToNextLevel: 50
getNextLevel(250) → Level 3, Advanced

Scenario 4 — Champion student:
getCurrentLevel(800) → Level 4, Champion, "Campus Champion"
getLevelProgress(800) → progressPercentage: 100%, isMaxLevel: true
getNextLevel(800) → null
getLevelUpMessage(800, 900) → null (already max level)

Scenario 5 — Level boundaries:
getCurrentLevel(99)  → Level 1
getCurrentLevel(100) → Level 2
getCurrentLevel(299) → Level 2
getCurrentLevel(300) → Level 3
getCurrentLevel(599) → Level 3
getCurrentLevel(600) → Level 4

Scenario 6 — Level comparison:
getLevelComparison(250):
  Level 1: status "completed"
  Level 2: status "current", progressInLevel: 75%
  Level 3: status "locked"
  Level 4: status "locked"
  currentLevelIndex: 1
  overallProgress: ~37.5%

Scenario 7 — Edge cases:
getCurrentLevel(-10) → Level 1 (safety)
formatXPDisplay(1500) → "1,500 XP"
getLevelUpMessage(50, 50) → null (no change)
getXPForLevel(5) → null (doesn't exist)
*/
