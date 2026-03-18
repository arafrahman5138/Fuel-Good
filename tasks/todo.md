# Structural Audit Plan - Real-Food Project

## Overview
Full structural audit of the Real-Food codebase (~72K lines): React Native/Expo frontend, FastAPI backend, Next.js website.

## Tasks

### 1. Dead Code Removal
- [ ] Scan all frontend files for unused imports
- [ ] Identify unreferenced functions and duplicate components
- [ ] Find orphaned files never imported anywhere
- [ ] Output list of every file and function to delete
- [ ] Remove dead code

### 2. Folder Restructure
- [ ] Propose feature-based folder structure (before/after tree)
- [ ] Each feature gets its own folder with components, hooks, utils, types

### 3. Hardcoded Value Extraction
- [ ] Find hardcoded strings, color hexes, API URLs
- [ ] Find API keys, timeout values, magic numbers
- [ ] Move all into config files with named exports grouped by category

### 4. Naming Standardization
- [ ] Audit variable names, function names, file names
- [ ] Flag vague names (temp, data, handler, stuff, thing, utils2)
- [ ] Suggest specific descriptive replacements

### 5. Scalability Risks
- [ ] List top 5 things that will break at 10K daily active users
- [ ] For each risk, explain failure mode
- [ ] Provide specific fix with code examples

### 6. Worst File Rewrite
- [ ] Identify the single messiest file in the project
- [ ] Rewrite it completely with clean naming, proper error handling
- [ ] Add inline comments explaining every decision

### 7. Documentation
- [ ] Write comprehensive README.md covering what the app does
- [ ] Include how to run locally, folder structure, environment variables

## Review
(To be filled after completion)
