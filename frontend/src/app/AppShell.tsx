import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import './appShell.css'
import { useAuth } from '../lib/auth'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen])

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandTitle">实验记录台</div>
          <div className="brandSub">内测版</div>
        </div>
        <button className="navToggleBtn" type="button" onClick={() => setMobileNavOpen(true)} aria-label="打开菜单">
          菜单
        </button>
        <nav className="nav">
          <div className="navGroupTitle">总览</div>
          <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/dashboard">
            总览
          </NavLink>
          <div className="navGroupTitle" style={{ marginTop: 8 }}>
            业务
          </div>
          <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/experiments">
            实验
          </NavLink>
          {user?.role === 'admin' || user?.role === 'auditor' ? (
            <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/audit-events">
              审计日志
            </NavLink>
          ) : null}
          <div className="navGroupTitle" style={{ marginTop: 8 }}>
            主数据
          </div>
          <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/curing-agents">
            固化剂
          </NavLink>
          <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/materials">
            原材料
          </NavLink>
        </nav>
        <div className="sidebarFooter">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user ? (
                <>
                  {user.display_name} <span style={{ color: '#a3a3a3' }}>({user.role})</span>
                </>
              ) : (
                '未登录'
              )}
            </div>
            <button className="btn" type="button" onClick={() => void logout()} style={{ padding: '6px 10px' }}>
              退出
            </button>
          </div>
          <div style={{ marginTop: 8 }}>数据层：Supabase</div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {mobileNavOpen ? (
        <div className="drawerOverlay" onMouseDown={() => setMobileNavOpen(false)}>
          <aside className="drawer" onMouseDown={(e) => e.stopPropagation()} aria-label="导航菜单">
            <div className="drawerHeader">
              <div>
                <div className="brandTitle">实验记录台</div>
                <div className="brandSub">内测版</div>
              </div>
              <button className="btn" type="button" onClick={() => setMobileNavOpen(false)}>
                关闭
              </button>
            </div>

            <div className="drawerBody">
              <div className="navGroupTitle">总览</div>
              <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/dashboard">
                总览
              </NavLink>

              <div className="navGroupTitle" style={{ marginTop: 10 }}>
                业务
              </div>
              <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/experiments">
                实验
              </NavLink>
              {user?.role === 'admin' || user?.role === 'auditor' ? (
                <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/audit-events">
                  审计日志
                </NavLink>
              ) : null}

              <div className="navGroupTitle" style={{ marginTop: 10 }}>
                主数据
              </div>
              <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/curing-agents">
                固化剂
              </NavLink>
              <NavLink className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`} to="/materials">
                原材料
              </NavLink>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

