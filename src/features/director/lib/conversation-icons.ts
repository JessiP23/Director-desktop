import {
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CubeTransparentIcon,
  FireIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid"

type DirectorConversationIconId = "chat" | "sparkles" | "rocket" | "lightbulb" | "cube" | "bolt" | "fire"

const DIRECTOR_CONVERSATION_ICON_IDS: DirectorConversationIconId[] = [
  "chat",
  "sparkles",
  "rocket",
  "lightbulb",
  "cube",
  "bolt",
  "fire",
]

const CONVERSATION_ICON_COMPONENTS = {
  chat: ChatBubbleLeftRightIcon,
  sparkles: SparklesIcon,
  rocket: RocketLaunchIcon,
  lightbulb: LightBulbIcon,
  cube: CubeTransparentIcon,
  bolt: BoltIcon,
  fire: FireIcon,
} as const satisfies Record<DirectorConversationIconId, typeof ChatBubbleLeftRightIcon>

function iconIndexForConversation(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % DIRECTOR_CONVERSATION_ICON_IDS.length
  }
  return hash
}

function iconIdForConversation(id: string, savedIcon?: unknown): DirectorConversationIconId {
  if (savedIcon && typeof savedIcon === "string" && DIRECTOR_CONVERSATION_ICON_IDS.includes(savedIcon as DirectorConversationIconId)) {
    return savedIcon as DirectorConversationIconId
  }
  return DIRECTOR_CONVERSATION_ICON_IDS[iconIndexForConversation(id)]
}

export function iconForConversation(id: string, savedIcon?: unknown) {
  return CONVERSATION_ICON_COMPONENTS[iconIdForConversation(id, savedIcon)]
}
