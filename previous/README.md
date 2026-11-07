# ResolveIQ dashboard UI

This is a responsive Next.js dashboard recreation based on the supplied Relay reference image.

## Add to an existing Next.js App Router project

1. Install the icon dependency:
   ```bash
   npm install lucide-react
   ```
2. Replace `app/page.tsx` with the supplied `page.tsx`.
3. Replace `app/globals.css` with the supplied `globals.css`.
4. Ensure `app/layout.tsx` imports `./globals.css`.
5. Run:
   ```bash
   npm run dev
   ```

The dashboard currently uses sample data and a local interactive search, navigation selection, date-range selector, notification popover, and AI chat panel. The AI panel is UI-only; connect it to your FastAPI/Groq/Hindsight backend when the agent endpoints are ready.

The screenshot's brand label is reproduced as "Relay" as shown. You can change it to "ResolveIQ" in `app/page.tsx`.
