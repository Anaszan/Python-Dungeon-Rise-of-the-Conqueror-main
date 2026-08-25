import { useState } from 'react'
import { stripComments, type TrialSpec } from './trials'

// The hard-mode header that sits on top of a code box: what the monster is
// demanding, and a live checklist that lights up as the player's code starts
// to satisfy it. Same shape as the end-of-level exam's checklist (and it
// borrows its CSS), which is deliberate — hard mode is "every fight is a small
// exam".
//
// The checklist reads comment-stripped source (see stripComments) so the
// โจทย์ written into the starter code as comments does not tick its own boxes.
export function TrialBrief({ trial, code }: { trial: TrialSpec; code: string }) {
  const [showHints, setShowHints] = useState(false)
  const source = stripComments(code)

  return (
    <div className="trial-brief">
      <p className="trial-brief-title">📜 โจทย์: {trial.title}</p>
      {trial.brief.map((line, i) => (
        <p key={i} className="exam-brief-line">
          {i + 1}. {line}
        </p>
      ))}
      <div className="exam-checks">
        {trial.checks.map((check) => {
          const ok = check.pattern.test(source)
          return (
            <p key={check.label} className={`exam-check${ok ? ' exam-check-ok' : ''}`}>
              {ok ? '✔' : '○'} {check.label}
            </p>
          )
        })}
      </div>
      <button type="button" className="trial-hint-btn" onClick={() => setShowHints((v) => !v)}>
        {showHints ? 'ซ่อนคำใบ้' : '💡 ขอคำใบ้'}
      </button>
      {showHints && (
        <div className="exam-hints trial-hints">
          {trial.hints.map((hint, i) => (
            <p key={i}>• {hint}</p>
          ))}
        </div>
      )}
    </div>
  )
}
