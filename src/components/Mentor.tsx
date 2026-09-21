import { useEffect, useRef, useState } from 'react'
import { speakMentorLine, stopMentorVoice } from '../audio/mentorVoice'

const TYPE_SPEED_MS = 26

function MentorAvatar({ talking, compact }: { talking: boolean; compact?: boolean }) {
  const size = compact ? 68 : 116
  return (
    <div className={`mentor-avatar ${talking ? 'mentor-talking' : ''} ${compact ? 'mentor-avatar-compact' : ''}`}>
      {/* Full-figure wizard: pointed hat with a curled tip, staff, and a
          skull-emblem spellbook — same palette the bust portrait always
          used (hat/robe purple, gold trim, parchment beard); the staff and
          book reuse the game's existing wood/gold CSS variables instead of
          introducing new colors. */}
      <svg viewBox="0 0 120 180" width={size} height={size * 1.5}>
        {/* staff */}
        <line x1="14" y1="176" x2="14" y2="20" stroke="var(--wood-light)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="14" cy="15" r="5.5" fill="var(--gold-bright)" stroke="var(--gold-dim)" strokeWidth="1.5" />

        {/* hat, tip curled over like a classic witch/wizard hat */}
        <path
          d="M58 4 Q50 2 48 9 Q45 13 51 17 Q38 28 32 56 Q60 46 92 56 Q84 26 58 4 Z"
          fill="#3a2a66"
          stroke="#f0c85a"
          strokeWidth="2"
        />
        <circle cx="49" cy="10" r="2.6" fill="#f0c85a" />
        <circle cx="42" cy="36" r="2.3" fill="#f0c85a" />
        <circle cx="76" cy="30" r="2.3" fill="#f0c85a" />
        <ellipse cx="62" cy="56" rx="46" ry="9" fill="#3a2a66" stroke="#f0c85a" strokeWidth="2" />

        {/* robe, extended into a full-length figure */}
        <path
          d="M60 94 Q100 96 98 150 Q92 172 60 178 Q28 172 22 150 Q20 96 60 94 Z"
          fill="#2b1d55"
          stroke="#f0c85a"
          strokeWidth="2"
        />

        <path d="M62 136 Q46 146 34 130 Q40 116 44 106 Q52 126 62 136 Z" fill="#e8e2d8" />
        <path d="M58 136 Q74 146 86 130 Q80 116 76 106 Q68 126 58 136 Z" fill="#e8e2d8" />
        <path d="M60 100 Q82 112 74 142 Q60 160 46 142 Q38 112 60 100 Z" fill="#f4efe6" />

        <ellipse cx="60" cy="86" rx="26" ry="27" fill="#f0c9a0" />

        <path d="M42 72 Q49 66 56 71" stroke="#5a4a3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M64 71 Q71 66 78 72" stroke="#5a4a3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        <g>
          <circle className="mentor-eye mentor-eye-left" cx="49" cy="82" r="4.2" fill="#2b1d12" />
          <circle className="mentor-eye mentor-eye-right" cx="71" cy="82" r="4.2" fill="#2b1d12" />
        </g>

        <ellipse cx="60" cy="94" rx="6" ry="4" fill="#c98a5a" opacity="0.5" />

        <path
          className="mentor-mouth-closed"
          d="M52 98 Q60 102 68 98"
          stroke="#7a3d2e"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse className="mentor-mouth-open" cx="60" cy="99" rx="7" ry="5" fill="#7a3d2e" />

        {/* hand gripping the staff */}
        <ellipse cx="17" cy="128" rx="8.5" ry="10" fill="#f0c9a0" />

        {/* spellbook with a small skull emblem, tucked under the other arm */}
        <g transform="rotate(-10 88 142)">
          <rect x="72" y="126" width="30" height="38" rx="3" fill="var(--wood-light)" stroke="var(--gold-bright)" strokeWidth="1.5" />
          <circle cx="87" cy="142" r="6" fill="var(--parchment-text)" />
          <circle cx="84.5" cy="140.5" r="1.3" fill="var(--wood-dark)" />
          <circle cx="89.5" cy="140.5" r="1.3" fill="var(--wood-dark)" />
          <rect x="85.3" y="144.2" width="3.4" height="2" fill="var(--wood-dark)" />
        </g>
        <ellipse cx="80" cy="160" rx="9" ry="8" fill="#f0c9a0" />
      </svg>
    </div>
  )
}

export function Mentor({
  name = 'อาจารย์เมอร์ลิน',
  lines,
  compact = false,
  voice = true,
  onFinish,
}: {
  name?: string
  lines: string[]
  compact?: boolean
  // Read each line aloud (see audio/mentorVoice.ts). Off for the landing
  // page's one-line teaser, which plays before the player has touched
  // anything — browsers block speech without a user gesture, and a voice
  // starting up on a marketing page would be unwelcome even where they don't.
  voice?: boolean
  onFinish?: () => void
}) {
  const [lineIndex, setLineIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [speaking, setSpeaking] = useState(false)
  // Which line's speech is current. A cut-off line reports its end
  // asynchronously, and without this check that late "stopped" could land
  // after the next line has already started and freeze the avatar's mouth
  // mid-sentence.
  const speechRun = useRef(0)

  const fullLine = lines[lineIndex] ?? ''
  const talking = displayed.length < fullLine.length
  const isLastLine = lineIndex >= lines.length - 1

  // Spoken from the moment a line starts typing. Skipping the typewriter by
  // tapping does not cut the voice off (it only fills in the text); moving on
  // to the next line does, and so does leaving the screen.
  useEffect(() => {
    const run = ++speechRun.current
    const text = lines[lineIndex]
    if (!voice || !text) return
    const started = speakMentorLine(text, {
      onStart: () => {
        if (speechRun.current === run) setSpeaking(true)
      },
      onEnd: () => {
        if (speechRun.current === run) setSpeaking(false)
      },
    })
    if (!started) setSpeaking(false)
    return () => {
      stopMentorVoice()
      setSpeaking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIndex, voice])

  useEffect(() => {
    setLineIndex(0)
    setDisplayed('')
  }, [lines])

  useEffect(() => {
    setDisplayed('')
    const text = lines[lineIndex] ?? ''
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(timer)
    }, TYPE_SPEED_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIndex])

  function handleAdvance() {
    if (talking) {
      setDisplayed(fullLine)
      return
    }
    if (!isLastLine) {
      setLineIndex((i) => i + 1)
    } else {
      onFinish?.()
    }
  }

  return (
    <div className={`mentor-row ${compact ? 'mentor-row-compact' : ''}`}>
      {/* The mouth moves for as long as either is going: the text typing out,
          or the voice still reading it (usually the longer of the two). */}
      <MentorAvatar talking={talking || speaking} compact={compact} />
      <div className="mentor-bubble" onClick={handleAdvance}>
        <p className="mentor-name">{name}</p>
        <p className="mentor-text">
          {displayed}
          <span className="mentor-caret">{talking ? '▍' : ''}</span>
        </p>
        {!talking && (
          <p className="mentor-next-hint">{isLastLine ? '' : 'แตะเพื่อฟังต่อ ▸'}</p>
        )}
      </div>
    </div>
  )
}
