import './main.css'

import { Assert } from '@gamezilla/shared/assert'
import { BrowserCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-browser'
import { createRoot } from 'react-dom/client'
import { App } from './App'

Assert.registerCrashHandler(new BrowserCrashHandler())

const el = document.getElementById('root')
if (!el) throw new Error('peer-store-app: #root element not found')
const root = createRoot(el)
root.render(<App />)
