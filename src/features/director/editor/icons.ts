/**
 * Heroicon→lucide shim: the ported editor components were written against
 * @heroicons/react names; re-export the desktop's lucide-react icons under those
 * names so the component code is unchanged. lucide icons accept `className`
 * (h-4 w-4 …) the same way, so sizing carries over.
 */
export {
  Download as ArrowDownTrayIcon,
  RotateCw as ArrowPathIcon,
  Upload as ArrowUpTrayIcon,
  Maximize2 as ArrowsPointingOutIcon,
  Type as ChatBubbleBottomCenterTextIcon,
  ChevronDown as ChevronDownIcon,
  Film as FilmIcon,
  Minus as MinusIcon,
  Music as MusicalNoteIcon,
  Pause as PauseIcon,
  Play as PlayIcon,
  Plus as PlusIcon,
  Scissors as ScissorsIcon,
  Sparkles as SparklesIcon,
  Square as StopIcon,
  Trash2 as TrashIcon,
  Crop as ViewfinderCircleIcon,
  X as XMarkIcon,
} from "lucide-react"
