/**
 * navigationVoiceCommander.ts
 *
 * Authoritative Voice Command Classifier & Speech Synthesis Formatter
 * for Accessible Navigation in PixelMuse.
 *
 * Guarantees:
 * - Deterministic command classification (Next, Previous, Repeat, Status, Stop, Surroundings).
 * - Multi-variant natural language matching with boundary guards (prevents substring false-positives).
 * - Zero destination/address repetition on subsequent steps.
 * - First-class landmark confirmation.
 * - Idempotent, deduplicated speech processing.
 */

export interface NavigationStep {
  stepNumber: number;
  instruction: string;
  landmark?: string;
  cue: 'left_turn' | 'right_turn' | 'confirm' | 'stop' | 'obstacle';
  distance: string;
  stepsCount?: number;
}

export type ClassifiedIntent =
  | 'NEXT_STEP'
  | 'PREVIOUS_STEP'
  | 'REPEAT_STEP'
  | 'NAVIGATION_STATUS'
  | 'START_NAVIGATION'
  | 'STOP_NAVIGATION'
  | 'STOP_LISTENING'
  | 'SURROUNDINGS'
  | 'UI_ACTION'
  | 'NEW_DESTINATION'
  | 'GENERAL_QUERY';

/**
 * Authoritative wake name for the PixelMuse voice assistant.
 * Configured in this single source of truth.
 */
export const VOICE_ASSISTANT_NAME = 'Nova';

export interface WakeWordMatch {
  detected: boolean;
  wakeWordMatched?: string;
  extractedCommand?: string;
}

/**
 * Detects whether the wake word ("Nova", "Hey Nova", "Okay Nova", "Ok Nova", "No Va", etc.)
 * was spoken, and extracts any subsequent user command.
 *
 * Supported variations:
 * - "nova", "no va"
 * - "hey nova", "hey no va"
 * - "okay nova", "ok nova", "ok no va"
 * - "hi nova", "hello nova"
 *
 * Examples:
 * - "Hey Nova" -> { detected: true }
 * - "Hey Nova, take me to Cardiology Pavilion." -> { detected: true, extractedCommand: "take me to Cardiology Pavilion." }
 * - "Nova, start navigation." -> { detected: true, extractedCommand: "start navigation." }
 * - "Okay Nova, next step." -> { detected: true, extractedCommand: "next step." }
 * - "I am going to college." -> { detected: false }
 */
export function detectWakeWord(
  rawTranscript: string,
  assistantName: string = VOICE_ASSISTANT_NAME
): WakeWordMatch {
  if (!rawTranscript || typeof rawTranscript !== 'string') {
    return { detected: false };
  }
  const clean = rawTranscript.trim();
  if (!clean) {
    return { detected: false };
  }

  // Regex breakdown:
  // 1. Optional conversational greeting prefix: hey, hi, hello, ok, okay
  // 2. Optional punctuation / whitespace
  // 3. Wake word variations: "nova" or "no va" (allowing spaces between no and va) bounded by \b
  // 4. Followed by optional punctuation/whitespace: [,\s.:;!?-]*
  // 5. Remaining command captured in group 1: (.*)$
  const wakeRegex = /^(?:(?:hey|hi|hello|ok|okay)\b[,\s]*)?(?:nova|no\s+va)\b[,\s.:;!?-]*(.*)$/i;
  const match = clean.match(wakeRegex);

  if (match) {
    const trailing = (match[1] || '').trim();
    return {
      detected: true,
      wakeWordMatched: assistantName,
      extractedCommand: trailing.length > 0 ? trailing : undefined,
    };
  }

  return { detected: false };
}

/**
 * Strips any leading wake word invocation from a transcript before command classification,
 * so "Nova next step" or "Hey Nova, repeat" gracefully classifies to NEXT_STEP / REPEAT_STEP.
 */
export function stripWakeWord(
  transcript: string,
  assistantName: string = VOICE_ASSISTANT_NAME
): string {
  const wake = detectWakeWord(transcript, assistantName);
  if (wake.detected && wake.extractedCommand) {
    return wake.extractedCommand;
  }
  return transcript;
}

export interface CommandClassification {
  intent: ClassifiedIntent;
  rawTranscript: string;
  normalizedText: string;
  payload?: Record<string, unknown>;
}

/**
 * Normalizes speech input: lowercase, strip punctuation (preserving word chars and spaces),
 * and collapse whitespace.
 */
export function normalizeTranscript(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a concise destination venue name, avoiding repeating 50-character street addresses.
 */
export function getConciseDestinationName(dest: string): string {
  if (!dest) return 'your destination';
  const clean = dest.trim();
  // If destination contains multiple comma-separated address parts, take the primary location name
  if (clean.includes(',')) {
    const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0 && parts[0].length >= 3) {
      return parts[0];
    }
  }
  return clean;
}

/**
 * Cleans an instruction string by removing repetitive "Step X:" or "Step X of Y:" prefixes,
 * and stripping any trailing repetitive destination address repetitions.
 */
export function cleanStepInstruction(instruction: string, destination?: string): string {
  if (!instruction) return '';
  let cleaned = instruction.trim();

  // Strip leading "Step 1:", "Step 2 of 4.", etc.
  cleaned = cleaned.replace(/^step\s+\d+(\s+of\s+\d+)?[:.\-–—]\s*/i, '');

  // Strip redundant leading "Next," or "Then,"
  cleaned = cleaned.replace(/^(next|then)[,:]?\s+/i, '');

  // If a destination is provided, ensure we don't end with redundant address attachments
  if (destination) {
    const concise = getConciseDestinationName(destination);
    // Remove pattern: "Arrive at 123 Long Address Rd, City 40001."
    const regex = new RegExp(`arrive at\\s+${concise}.*$`, 'i');
    if (!cleaned.toLowerCase().startsWith('arrive at') && regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, `arrive at ${concise}.`);
    }
  }

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned.trim();
}

/**
 * Classifies spoken transcripts into authoritative navigation intents.
 */
export function classifyVoiceCommand(rawTranscript: string): CommandClassification {
  // If user only spoke the wake word ("Nova", "Hey Nova")
  const wakeCheck = detectWakeWord(rawTranscript);
  if (wakeCheck.detected && !wakeCheck.extractedCommand) {
    return {
      intent: 'GENERAL_QUERY',
      rawTranscript,
      normalizedText: 'wake_word_only',
      payload: { wakeWord: wakeCheck.wakeWordMatched, isWakeOnly: true },
    };
  }

  const stripped = stripWakeWord(rawTranscript);
  const normalized = normalizeTranscript(stripped || rawTranscript);

  if (!normalized) {
    return {
      intent: 'GENERAL_QUERY',
      rawTranscript,
      normalizedText: '',
    };
  }

  // 1. SURROUNDINGS / COMPUTER VISION INTENTS
  const surroundingsPatterns = [
    /^what(?:'s| is) in front(?: of me)?$/i,
    /^what do you see$/i,
    /^describe surroundings$/i,
    /^describe my surroundings$/i,
    /^is there an obstacle$/i,
    /^look ahead$/i,
    /^scan surroundings$/i,
    /^scan obstacles$/i,
    /^what is ahead(?: of me)?$/i,
  ];
  if (surroundingsPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      intent: 'SURROUNDINGS',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 2. STOP LISTENING / CLOSE ASSISTANT
  const stopListeningPhrases = new Set([
    'stop listening',
    'pause assistant',
    'close assistant',
    'exit assistant',
    'cancel assistant',
    'goodbye',
    'bye',
    'stop voice',
  ]);
  if (stopListeningPhrases.has(normalized)) {
    return {
      intent: 'STOP_LISTENING',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 3. STOP / CANCEL NAVIGATION
  const stopNavPatterns = [
    /^(?:please\s+)?(?:stop|cancel|end|exit|finish|terminate)\s+navigation$/i,
    /^(?:stop|end|exit)\s+navigating$/i,
    /^stop route$/i,
    /^cancel route$/i,
  ];
  if (stopNavPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      intent: 'STOP_NAVIGATION',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 4. NEXT STEP (Natural variations)
  // Supported: "next", "next step", "go next", "continue", "move on", "next instruction",
  // "go forward", "forward", "take next step", "proceed", "advance", "next turn"
  const exactNextCommands = new Set([
    'next',
    'next step',
    'go next',
    'continue',
    'move on',
    'next instruction',
    'go forward',
    'forward',
    'take next step',
    'step forward',
    'proceed',
    'advance',
    'next turn',
    'continue forward',
    'next please',
    'next step please',
  ]);
  const nextPattern = /^(?:please\s+)?(?:go\s+to\s+|take\s+me\s+to\s+)?(?:next(?:\s+step|\s+instruction|\s+turn)?|continue(?:\s+forward)?|move\s+on|proceed|advance|forward|go\s+forward)$/i;

  if (exactNextCommands.has(normalized) || nextPattern.test(normalized)) {
    return {
      intent: 'NEXT_STEP',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 5. PREVIOUS STEP (Natural variations)
  // Supported: "previous", "previous step", "go back", "back", "last step", "step back", "prior step"
  const exactPrevCommands = new Set([
    'previous',
    'previous step',
    'go back',
    'back',
    'last step',
    'step back',
    'prior step',
    'previous instruction',
    'previous please',
    'go to previous step',
  ]);
  const prevPattern = /^(?:please\s+)?(?:go\s+)?(?:back|previous(?:\s+step|\s+instruction|\s+turn)?|last\s+step|step\s+back|prior\s+step)$/i;

  if (exactPrevCommands.has(normalized) || prevPattern.test(normalized)) {
    return {
      intent: 'PREVIOUS_STEP',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 6. REPEAT CURRENT STEP (Natural variations)
  // Supported: "repeat", "repeat step", "again", "what was that", "pardon", "say again", "repeat direction"
  const exactRepeatCommands = new Set([
    'repeat',
    'repeat step',
    'repeat instruction',
    'repeat direction',
    'again',
    'say again',
    'what was that',
    'pardon',
    'pardon me',
    'repeat that',
    'repeat current step',
    'repeat please',
  ]);
  const repeatPattern = /^(?:please\s+)?(?:repeat(?:\s+step|\s+instruction|\s+direction|\s+that|\s+again|\s+current\s+step)?|say\s+again|what\s+was\s+that|again|pardon(?:\s+me)?)$/i;

  if (exactRepeatCommands.has(normalized) || repeatPattern.test(normalized)) {
    return {
      intent: 'REPEAT_STEP',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 7. WHERE AM I / NAVIGATION STATUS
  const statusPatterns = [
    /^where am i$/i,
    /^status$/i,
    /^navigation status$/i,
    /^current step$/i,
    /^what step(?:\s+am\s+i\s+on|\s+is\s+this)?$/i,
    /^how far(?:\s+left|\s+to\s+go)?$/i,
    /^where are we$/i,
  ];
  if (statusPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      intent: 'NAVIGATION_STATUS',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 8. QUICK UI ACTIONS
  if (
    normalized.includes('login') ||
    normalized.includes('log in') ||
    normalized.includes('sign in')
  ) {
    return { intent: 'UI_ACTION', rawTranscript, normalizedText: normalized, payload: { action: 'LOGIN' } };
  }
  if (
    normalized.includes('report barrier') ||
    normalized.includes('report obstacle') ||
    normalized.includes('report hazard')
  ) {
    return { intent: 'UI_ACTION', rawTranscript, normalizedText: normalized, payload: { action: 'REPORT_BARRIER' } };
  }
  if (normalized.includes('dark mode') || normalized.includes('night mode')) {
    return { intent: 'UI_ACTION', rawTranscript, normalizedText: normalized, payload: { action: 'DARK_MODE' } };
  }
  if (normalized.includes('light mode') || normalized.includes('day mode')) {
    return { intent: 'UI_ACTION', rawTranscript, normalizedText: normalized, payload: { action: 'LIGHT_MODE' } };
  }

  // 9. START NAVIGATION
  const startNavPatterns = [
    /^(?:please\s+)?(?:start|begin|commence)\s+(?:navigation|navigating|route|guidance)$/i,
    /^(?:start|begin)\s+nav$/i,
    /^start$/i,
  ];
  if (startNavPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      intent: 'START_NAVIGATION',
      rawTranscript,
      normalizedText: normalized,
    };
  }

  // 10. NEW DESTINATION
  const destRegex = /^(?:take\s+me\s+to|navigate\s+to|start\s+navigation\s+to|start\s+navigating\s+to|go\s+to|directions\s+to|route\s+to|find)\s+(.+)$/i;
  const destMatch = normalized.match(destRegex);
  if (destMatch && destMatch[1]) {
    return {
      intent: 'NEW_DESTINATION',
      rawTranscript,
      normalizedText: normalized,
      payload: { destinationQuery: destMatch[1].trim() },
    };
  }

  return {
    intent: 'GENERAL_QUERY',
    rawTranscript,
    normalizedText: normalized,
  };
}

/**
 * Builds clear, non-repetitive speech for sequential turn-by-turn navigation.
 *
 * Rules:
 * - INITIAL: Announces destination ONCE and introduces Step 1:
 *   "Route to Central Library is ready. Step 1 of 4. Walk straight for 20 steps. Landmark: Textured pavement crossing."
 * - FOLLOWING STEPS: Never repeats the destination or address. Concise step number and instruction:
 *   "Step 2 of 4. Keep the granite wall on your left shoulder. Landmark confirmed: Granite wall."
 * - ARRIVAL: Clean arrival statement:
 *   "You have arrived at Central Library."
 * - REROUTE: Clear obstacle notification and seamless continuation:
 *   "An obstacle was detected ahead. I found a safer accessible route. Continuing from your current position. Step 1 of 3: ..."
 */
export function buildNavigationSpeech(
  step: NavigationStep,
  index: number,
  totalSteps: number,
  options?: {
    isInitial?: boolean;
    isReroute?: boolean;
    isArrival?: boolean;
    destination?: string;
  }
): string {
  const destination = options?.destination
    ? getConciseDestinationName(options.destination)
    : 'your destination';

  if (options?.isArrival) {
    return `You have arrived at ${destination}.`;
  }

  const cleanInstruction = cleanStepInstruction(step.instruction, destination);
  const stepNumber = index + 1;

  // Landmark confirmation clause
  let landmarkClause = '';
  if (step.landmark) {
    const normInstruction = cleanInstruction.toLowerCase();
    const normLandmark = step.landmark.toLowerCase();
    // Only append if the landmark isn't already stated verbatim in the instruction
    if (!normInstruction.includes(normLandmark)) {
      landmarkClause = options?.isInitial
        ? ` Landmark: ${step.landmark}.`
        : ` Landmark confirmed: ${step.landmark}.`;
    }
  }

  // 1. Initial route setup announcement
  if (options?.isInitial) {
    return `Route to ${destination} is ready. Step 1 of ${totalSteps}. ${cleanInstruction}.${landmarkClause}`;
  }

  // 2. Obstacle rerouting announcement
  if (options?.isReroute) {
    return `An obstacle was detected ahead. I found a safer accessible route. Continuing from your current position. Step ${stepNumber} of ${totalSteps}. ${cleanInstruction}.${landmarkClause}`;
  }

  // 3. Sequential navigation step announcement (Concise, no repeated destination address)
  return `Step ${stepNumber} of ${totalSteps}. ${cleanInstruction}.${landmarkClause}`;
}
