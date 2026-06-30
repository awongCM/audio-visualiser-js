import './style.css'
import { createApp } from './app'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('Root element #app not found')
}

createApp(root)
