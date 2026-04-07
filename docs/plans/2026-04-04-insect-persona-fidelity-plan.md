# Insect Persona Fidelity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen insect-feature fidelity in spirit portrait generation so ComfyUI outputs preserve target insect anatomy before applying campus anime style.

**Architecture:** Keep the existing identify -> persona design -> prompt -> ComfyUI pipeline, but add a morphology lexicon and a stronger prompt compiler in the server prompt builder. Adjust routing presets so insect requests favor anatomy-friendly rendering, then lock the behavior with contract tests.

**Tech Stack:** Node.js, Vitest, React + TypeScript, ComfyUI prompt graph integration

---

### Task 1: Add failing morphology tests

**Files:**
- Modify: `server/__tests__/comfyui-prompt-alignment.contract.test.ts`

**Step 1: Write the failing test**

Add assertions that:
- aphid prompts contain antennae / segmented-limb / cornicle or pear-shaped-abdomen style anchors
- ladybug prompts contain elytra / spotted shell / dome-shaped shell anchors
- insect routing prefers an anatomy-oriented preset

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- server/__tests__/comfyui-prompt-alignment.contract.test.ts`
Expected: FAIL because current prompts do not include the new anatomy anchors or routing target.

**Step 3: Write minimal implementation**

Implement only the prompt-builder and routing changes needed for the new assertions.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- server/__tests__/comfyui-prompt-alignment.contract.test.ts`
Expected: PASS

### Task 2: Strengthen server-side insect prompt compilation

**Files:**
- Modify: `server/lib/spiritPersonaPromptBuilder.js`

**Step 1: Add morphology lexicon**

Create insect-specific anatomy anchors keyed by species or keywords, such as:
- aphid: `long antennae`, `pear-shaped abdomen`, `cornicle tailpipes`, `clustered sap-sucking posture`
- ladybug: `domed beetle shell`, `elytra`, `black spotted red shell`, `compact beetle silhouette`

**Step 2: Recompile prompt order**

Reorder prompt blocks so anatomy anchors appear before style tokens, and add insect-specific negative prompts for missing body structures.

**Step 3: Run targeted tests**

Run: `npm run test:run -- server/__tests__/comfyui-prompt-alignment.contract.test.ts`
Expected: PASS

### Task 3: Adjust routing presets toward insect fidelity

**Files:**
- Modify: `server/lib/spiritGenerationConfig.js`
- Modify: `src/services/identifyCanonical.ts`

**Step 1: Add anatomy-oriented preset**

Add a preset for insect morphology clarity and use it for common insect routes.

**Step 2: Strengthen frontend fallback role-pack cues**

Update frontend insect role-pack keywords so fallback prompts also lean toward anatomy, not only generic campus motifs.

**Step 3: Re-run targeted tests**

Run: `npm run test:run -- server/__tests__/comfyui-prompt-alignment.contract.test.ts`
Expected: PASS

### Task 4: Verify integration surface

**Files:**
- Verify only

**Step 1: Run regression verification**

Run: `npm run test:run -- server/__tests__/comfyui-prompt-alignment.contract.test.ts`
Expected: PASS

**Step 2: Run build**

Run: `npm run build`
Expected: PASS
