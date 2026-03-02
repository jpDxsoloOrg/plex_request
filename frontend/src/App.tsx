import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold text-foreground">Plex Request</h1>
      <p className="text-muted-foreground">
        Search for movies and TV shows to request for your Plex server.
      </p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
