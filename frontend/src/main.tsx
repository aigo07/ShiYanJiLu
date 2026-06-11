import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { AppShell } from './app/AppShell.tsx'
import { CuringAgentsPage } from './pages/CuringAgentsPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { AuditEventsPage } from './pages/AuditEventsPage.tsx'
import { ExperimentDetailPage } from './pages/ExperimentDetailPage.tsx'
import { ExperimentFormPage } from './pages/ExperimentFormPage.tsx'
import { ExperimentsPage } from './pages/ExperimentsPage.tsx'
import { MaterialsPage } from './pages/MaterialsPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { AuthProvider, useAuth } from './lib/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="containerNarrow">加载中…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'experiments', element: <ExperimentsPage /> },
      { path: 'audit-events', element: <AuditEventsPage /> },
      { path: 'experiments/new', element: <ExperimentFormPage /> },
      { path: 'experiments/:id/edit', element: <ExperimentFormPage /> },
      { path: 'experiments/:id', element: <ExperimentDetailPage /> },
      { path: 'materials', element: <MaterialsPage /> },
      { path: 'curing-agents', element: <CuringAgentsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
