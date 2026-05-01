import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* vite config docs to, check niyo muna dito bago galawin plugin setup */
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
