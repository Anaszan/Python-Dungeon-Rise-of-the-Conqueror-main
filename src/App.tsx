import { useEffect, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { GameScene } from './game/GameScene'
import { LandingPage } from './screens/LandingPage'
import { StoryIntro } from './screens/StoryIntro'
import { LoginScreen } from './screens/LoginScreen'
import { ResetPasswordScreen } from './screens/ResetPasswordScreen'
import { CharacterCustomize } from './screens/CharacterCustomize'
import { DifficultySelect } from './screens/DifficultySelect'
import { SaveLoadError } from './screens/SaveLoadError'
import { ChapterIntro } from './screens/ChapterIntro'
import { Leaderboard } from './screens/Leaderboard'
import { LogoutButton } from './screens/LogoutButton'
import { PlayerProfile } from './screens/PlayerProfile'
import { PlayerHUD } from './screens/PlayerHUD'
import { TouchJoystick } from './game/TouchJoystick'
import { LevelBanner } from './screens/LevelBanner'
import { GameOverOverlay } from './screens/GameOverOverlay'
import { LevelExamOverlay } from './screens/LevelExamOverlay'
import { VictoryOverlay } from './screens/VictoryOverlay'
import { PauseButton } from './screens/PauseButton'
import { PauseMenu } from './screens/PauseMenu'
import { GameAudio } from './audio/GameAudio'
import { MenuAudio } from './audio/MenuAudio'
import { SoundToggle } from './audio/SoundToggle'
import { AdminButton } from './admin/AdminButton'
import { AdminPanel } from './admin/AdminPanel'
import { useAdminStore } from './admin/adminStore'
import { useAuthStore } from './auth/authStore'
import { useGameStore } from './game/store'
import { loadSave } from './game/persistence'
import { LESSONS } from './game/lessons'

function App() {
  const [pastLanding, setPastLanding] = useState(false)
  const [pastIntro, setPastIntro] = useState(false)
  const [chapterIntroSeenFor, setChapterIntroSeenFor] = useState<number | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // Bumped by the retry button to re-run the load effect.
  const [loadAttempt, setLoadAttempt] = useState(0)
  const { session, loading, passwordRecovery } = useAuthStore()
  const hydrateSave = useGameStore((s) => s.hydrateSave)
  const resetSave = useGameStore((s) => s.resetSave)
  const checkAdmin = useAdminStore((s) => s.checkAdmin)
  const resetAdmin = useAdminStore((s) => s.reset)
  const saveLoaded = useGameStore((s) => s.saveLoaded)
  const characterClass = useGameStore((s) => s.characterClass)
  const characterName = useGameStore((s) => s.characterName)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const difficulty = useGameStore((s) => s.difficulty)
  const phase = useGameStore((s) => s.phase)

  // Asked once per session, alongside the save: the answer decides whether the
  // admin console exists for this account at all. Cleared first so switching
  // accounts on the same page never carries the previous one's answer over.
  useEffect(() => {
    resetAdmin()
    if (!session) return
    void checkAdmin()
  }, [session, checkAdmin, resetAdmin])

  useEffect(() => {
    resetSave()
    setLoadFailed(false)
    if (!session) return

    let cancelled = false
    loadSave(session.user.id).then(
      (save) => {
        if (!cancelled) hydrateSave(save)
      },
      (error) => {
        // Deliberately not falling through to a blank save: that would read as
        // a brand-new player and send someone with a character straight back
        // to the customize screen. See loadSave.
        console.error('Failed to load save:', error)
        if (!cancelled) setLoadFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [session, hydrateSave, resetSave, loadAttempt])

  useEffect(() => {
    // Covers the Google OAuth redirect: the browser does a full-page reload
    // back to the app, which resets `pastLanding` to false — without this,
    // an already-authenticated user would land back on the marketing page
    // still showing the "เข้าสู่ระบบ" button instead of continuing into the game.
    if (session) setPastLanding(true)
  }, [session])

  let content: ReactNode
  // The mute button only makes sense once music can be toggled mid-experience
  // (pre-game briefing screens and the dungeon itself) — the landing page and
  // login/register play the bright menu theme too, but without the toggle.
  let showSoundToggle = false
  let playMenuMusic = false
  // The admin console rides along with the two screens that are "in the game
  // proper" — the chapter intro and the dungeon itself. Not on the login,
  // customize or difficulty screens, where warping to a level would mean
  // nothing yet. Rendered at this level (not inside the dungeon) so warping
  // from the chapter intro works too, and so the panel survives the remount
  // that changing level causes.
  let showAdminTools = false

  if (passwordRecovery) {
    // Overrides every other screen: the user got here via the "reset
    // password" email link, which signs them into a recovery session before
    // they've set a new password — the rest of the app must wait for that.
    content = <ResetPasswordScreen />
    playMenuMusic = true
  } else if (!pastLanding) {
    content = <LandingPage loading={loading} onEnter={() => setPastLanding(true)} />
    playMenuMusic = true
  } else if (!session) {
    content = <LoginScreen onBack={() => setPastLanding(false)} />
    playMenuMusic = true
  } else if (!pastIntro) {
    content = <StoryIntro onStart={() => setPastIntro(true)} />
    playMenuMusic = true
    showSoundToggle = true
  } else if (loadFailed) {
    content = <SaveLoadError onRetry={() => setLoadAttempt((n) => n + 1)} />
    playMenuMusic = true
    showSoundToggle = true
  } else if (!saveLoaded) {
    content = (
      <div className="screen-overlay">
        <p>กำลังโหลด...</p>
      </div>
    )
    playMenuMusic = true
    showSoundToggle = true
  } else if (!characterClass || !characterName) {
    // Only ever reached by a player whose save was read and genuinely has no
    // character yet — so making one happens once, before the first game, and
    // never again.
    content = <CharacterCustomize />
    playMenuMusic = true
    showSoundToggle = true
  } else if (!difficulty) {
    // Straight after the character exists and before the first chapter intro:
    // the player picks how the code boxes in combat will ask for their spells
    // (see difficulty.ts). Answered once and remembered in the save; the pause
    // menu can change it later, which is why this is not a one-shot flag.
    content = <DifficultySelect />
    playMenuMusic = true
    showSoundToggle = true
  } else if (chapterIntroSeenFor !== currentLevel) {
    content = (
      <ChapterIntro
        level={currentLevel}
        lesson={LESSONS[currentLevel - 1]}
        difficulty={difficulty}
        onStart={() => setChapterIntroSeenFor(currentLevel)}
      />
    )
    playMenuMusic = true
    showSoundToggle = true
    showAdminTools = true
  } else {
    content = (
      <div className="app-root">
        <GameAudio />
        <Canvas shadows>
          <GameScene />
        </Canvas>
        <PlayerHUD />
        <TouchJoystick />
        <LevelBanner />
        {/* Mounted only while the exam is up, unlike the other overlays,
            which self-guard on phase and stay mounted. This one warms
            Pyodide the moment it mounts — leaving it mounted would kick off
            that multi-MB download as soon as the player enters the dungeon,
            long before any code box exists to use it. */}
        {phase === 'exam' && <LevelExamOverlay />}
        <GameOverOverlay />
        <VictoryOverlay />
        {/* Hidden for the duration of the end-of-level exam: each opens a
            modal, and the exam is the one screen the player is not allowed to
            walk away from. Fights no longer hide them — combat happens in the
            dungeon now, and a fight the player can walk out of is not a reason
            to take the corner buttons away. */}
        {phase !== 'exam' && (
          <>
            <Leaderboard />
            <PlayerProfile />
            <LogoutButton />
          </>
        )}
        <PauseButton />
        <PauseMenu />
      </div>
    )
    showSoundToggle = true
    showAdminTools = true
  }

  return (
    <>
      {playMenuMusic && <MenuAudio />}
      {content}
      {showSoundToggle && <SoundToggle />}
      {showAdminTools && (
        <>
          <AdminButton />
          <AdminPanel />
        </>
      )}
    </>
  )
}

export default App
