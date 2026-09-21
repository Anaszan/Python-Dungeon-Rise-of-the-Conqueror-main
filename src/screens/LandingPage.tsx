import { Mentor } from '../components/Mentor'

export function LandingPage({ loading, onEnter }: { loading: boolean; onEnter: () => void }) {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <span className="landing-logo">🐍 Python Dungeon Rise of the Conqueror</span>
        <button className="landing-nav-btn" onClick={onEnter}>
          เข้าสู่ระบบ
        </button>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <h1>
            เรียนรู้ <span className="landing-highlight">Python</span> ผ่านการผจญภัยในดันเจี้ยน
          </h1>
          <p>
            ต่อสู้กับเหล่าอสูรบั๊ก เก็บไอเทมเสริมพลัง เลื่อนระดับ และฝึกเขียนโค้ดจริงไปพร้อมกับ
            อาจารย์เมอร์ลิน ผู้จะคอยสอนเวทมนตร์แห่ง Python ให้คุณทุกก้าวของการผจญภัย
          </p>
          <div className="landing-cta-row">
            <button className="landing-cta-primary" onClick={onEnter} disabled={loading}>
              {loading ? 'กำลังโหลด...' : 'เริ่มการผจญภัย'}
            </button>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-mock">
            <div className="landing-mock-topbar">
              <span className="landing-mock-dot" />
              <span className="landing-mock-dot" />
              <span className="landing-mock-dot" />
            </div>
            <div className="landing-mock-body">
              <Mentor compact voice={false} lines={['เขียนโค้ด Python ของเจ้าเอง แล้วร่ายใส่ Goblin ได้เลย']} />
              <div className="landing-mock-combat">
                <p className="landing-mock-monster">Goblin</p>
                <div className="hp-bar-track">
                  <div className="hp-bar-fill" style={{ width: '62%' }} />
                </div>
                <pre className="landing-mock-code">{'damage = atk\nattack(damage)'}</pre>
                <div className="landing-mock-actions">
                  <span className="landing-mock-btn landing-mock-btn-arcane">ร่ายคาถา ⚡</span>
                  <span className="landing-mock-btn">สกิลพิเศษ (20)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}