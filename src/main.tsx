import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { startPwaInstallTracking } from './lib/pwaInstall'

// beforeinstallprompt/appinstalled events React mount-এর আগেই আসতে পারে,
// তাই যত আগে সম্ভব listener attach করা হয়।
startPwaInstallTracking()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
