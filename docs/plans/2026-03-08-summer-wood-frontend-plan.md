# Summer Wood Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete a stitch-aligned, mobile-first frontend for 四季夏木 with login, home, encyclopedia, identify, spirit, community, and achievements flows.

**Architecture:** React Router for page flow, Zustand (persist) for local state, shared layout components for header/frame/tab navigation, page-level containers for business UI. Keep mock data isolated under `src/mock` and business updates in `src/store`.

**Tech Stack:** React 19, TypeScript, Vite 7, Tailwind CSS v4, React Router 7, Zustand, Vitest + Testing Library

---

### Task 1: Base Visual System Alignment

**Files:**
- Modify: `src/index.css`
- Create: `src/components/MaterialSymbol.tsx`
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `src/components/DesktopSidebar.tsx`
- Test: `src/__tests__/auth-login.test.tsx`

**Step 1: Write the failing test**

```tsx
// expectation: no emoji icons in navigation, still can login successfully
expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
```

**Step 2: Run test to verify it fails (or baseline passes before refactor)**

Run: `npm run test:run -- src/__tests__/auth-login.test.tsx`  
Expected: baseline pass; use it as regression guard while refactoring icons.

**Step 3: Write minimal implementation**

- Add Material Symbols font + utility classes in `index.css`
- Introduce `MaterialSymbol` component
- Replace emoji-based nav icons in tab bar and desktop sidebar

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/__tests__/auth-login.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/index.css src/components/MaterialSymbol.tsx src/components/BottomTabBar.tsx src/components/DesktopSidebar.tsx
git commit -m "feat(ui): align navigation icons with stitch style"
```

### Task 2: Home Search -> Encyclopedia Query Flow

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/EncyclopediaPage.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Create: `src/__tests__/home-search.test.tsx`

**Step 1: Write the failing test**

```tsx
await user.type(screen.getByTestId('home-search-input'), 'aphid')
await user.click(screen.getByTestId('home-search-submit'))
expect(screen.getByTestId('encyclopedia-search-input')).toHaveValue('aphid')
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/__tests__/home-search.test.tsx`  
Expected: FAIL (missing test ids or missing route query sync)

**Step 3: Write minimal implementation**

- Add home search form and submit navigation to `/encyclopedia?q=...`
- Sync encyclopedia query input from URL search params
- Add `data-testid` hooks for stable tests

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/__tests__/home-search.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/EncyclopediaPage.tsx src/pages/LoginPage.tsx src/__tests__/home-search.test.tsx
git commit -m "feat(search): add home-to-encyclopedia query flow"
```

### Task 3: Frontend Regression + Build Verification

**Files:**
- Test: `src/__tests__/auth-login.test.tsx`
- Test: `src/__tests__/identify-flow.test.tsx`
- Test: `src/__tests__/home-search.test.tsx`

**Step 1: Write/confirm failing test cases are covered**

- Login flow
- Identify upload flow
- Home search flow

**Step 2: Run test suite**

Run: `npm run test:run`  
Expected: all PASS

**Step 3: Build production bundle**

Run: `npm run build`  
Expected: success output without type errors

**Step 4: Commit verification updates (if needed)**

```bash
git add .
git commit -m "test: finalize frontend regression coverage"
```

### Task 4: Documentation for Progressive Delivery

**Files:**
- Create: `docs/plans/2026-03-08-summer-wood-frontend-design.md`
- Create: `docs/frontend-codex-playbook.md`

**Step 1: Write the doc draft**

- Include screen mapping, architecture, phased milestones, acceptance checklist

**Step 2: Validate commands in doc**

- Ensure all listed scripts exist in `package.json`

**Step 3: Publish docs**

- Save with clear section anchors for phase-by-phase execution

**Step 4: Commit docs**

```bash
git add docs/plans/2026-03-08-summer-wood-frontend-design.md docs/frontend-codex-playbook.md
git commit -m "docs: add progressive frontend delivery guide"
```
