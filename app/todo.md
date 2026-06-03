# SHL Creative Hub - Combined Website

## Design
- **Style**: Dark, modern agency aesthetic matching the existing Creative Hub at 1ogftzm.atoms.world
- **Layout**: Sidebar navigation (left) + main content area (right)
- **Color Palette**: 
  - Background: #0a0a0f (deep dark), #13131a (card dark), #1a1a2e (sidebar)
  - Primary: #7c3aed (violet), #a855f7 (purple accent)
  - Secondary: #06b6d4 (cyan), #10b981 (emerald for success)
  - Text: #f8fafc (white), #94a3b8 (muted)
- **Typography**: Inter for body, bold headings with gradient text
- **Key Styles**: Sidebar with icons, glassmorphism cards, gradient accents

## Development Tasks
- [ ] Create Sidebar layout component matching Creative Hub design
- [ ] Rebuild Dashboard (/) - Creative Hub main dashboard
- [ ] Create Brand Management page (/brands)
- [ ] Create Prompt Hub page (/workspace)
- [ ] Create AI Workspace page (/chat)
- [ ] Create Asset Gallery page (/gallery)
- [ ] Create Templates page (/templates)
- [ ] Integrate Client Briefs section (/briefs, /briefs/new, /briefs/:id) using existing brief components
- [ ] Update App.tsx with all routes
- [ ] Run lint and build checks

## File Structure (max 8 code files)
1. `src/components/Sidebar.tsx` - Shared sidebar navigation layout
2. `src/pages/Index.tsx` - Creative Hub Dashboard (home)
3. `src/pages/BrandsPage.tsx` - Brand Management page
4. `src/pages/WorkspacePage.tsx` - Prompt Hub + AI Workspace + Gallery + Templates
5. `src/pages/BriefsPage.tsx` - Client Briefs list/dashboard (replaces old Dashboard)
6. `src/pages/NewBrief.tsx` - Brief creation (updated with sidebar layout)
7. `src/pages/BriefDetail.tsx` - Brief detail with AI generation (updated with sidebar layout)
8. `src/lib/briefTypes.ts` - Brief type definitions (unchanged)

## Existing components to keep
- `src/components/BriefForm.tsx` - Dynamic form (unchanged)
- `src/components/BrandProfile.tsx` - Brand profile sidebar (unchanged)