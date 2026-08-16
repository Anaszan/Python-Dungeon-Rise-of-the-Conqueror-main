import { useEffect, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { GameScene } from './game/GameScene'
import { CombatOverlay } from './game/CombatOverlay'
import { LandingPage } from './screens/LandingPage'
import { StoryIntro } from './screens/StoryIntro'
import { LoginScreen } from './screens/LoginScreen'
import { ResetPasswordScreen } from './screens/ResetPasswordScreen'
import { CharacterCustomize } from './screens/CharacterCustomize'
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
import { useAuthStore } from './auth/authStore'
import { useGameStore } from './game/store'
import { loadSave } from './game/persistence'
import { LESSONS } from './game/lessons'

function App() {
  const [pastLanding, setPastLanding] = useState(false)
  const [pastIntro, setPastIntro] = useState(false)
  const [chapterIntroSeenFor, setChapterIntroSeenFor] = useState<number | null>(null)
  const { session, loading, passwordRecovery } = useAuthStore()
  const hydrateSave = useGameStore((s) => s.hydrateSave)
  const resetSave = useGameStore((s) => s.resetSave)
  const saveLoaded = useGameStore((s) => s.saveLoaded)
  const characterClass = useGameStore((s) => s.characterClass)
  const characterName = useGameStore((s) => s.characterName)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const phase = useGameStore((s) => s.phase)

  useEffect(() => {
    resetSave()
    if (!session) return
    loadSave(session.user.id).then(hydrateSave)
  }, [session, hydrateSave, resetSave])

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
  } else if (!saveLoaded) {
    content = (
      <div className="screen-overlay">
        <p>กำลังโหลด...</p>
      </div>
    )
    playMenuMusic = true
    showSoundToggle = true
  } else if (!characterClass || !characterName) {
    content = <CharacterCustomize />
    playMenuMusic = true
    showSoundToggle = true
  } else if (chapterIntroSeenFor !== currentLevel) {
    content = (
      <ChapterIntro
        level={currentLevel}
        lesson={LESSONS[currentLevel - 1]}
        onStart={() => setChapterIntroSeenFor(currentLevel)}
      />
    )
    playMenuMusic = true
    showSoundToggle = true
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
        <CombatOverlay />
        {/* Mounted only while the exam is up, unlike the other overlays,
            which self-guard on phase and stay mounted. This one warms
            Pyodide the moment it mounts — leaving it mounted would kick off
            that multi-MB download as soon as the player enters the dungeon,
            long before any code box exists to use it. */}
        {phase === 'exam' && <LevelExamOverlay />}
        <GameOverOverlay />
        <VictoryOverlay />
        {/* Hidden for the duration of a fight and of the end-of-level exam:
            these sit in the corner the battle screen gives the monster, and
            each opens a modal that would cover the fight while the monster's
            attack timer keeps running. */}
        {phase !== 'combat' && phase !== 'exam' && (
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
  }

  return (
    <>
      {playMenuMusic && <MenuAudio />}
      {content}
      {showSoundToggle && <SoundToggle />}
    </>
  )
}

export default App
