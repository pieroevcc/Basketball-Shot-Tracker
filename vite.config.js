import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    root: 'src',
    envDir: '..', // load .env from project root, not src/
    build: {
        outDir: '../dist',
    },
});
