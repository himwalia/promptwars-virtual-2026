# MISSION_PRD: Civic-Flow (Autonomous Election Navigator)

## 1. Vision & Mission
**Civic-Flow** is an Autonomous Election Navigator designed to guide users through the complex electoral process. Our goal is a perfect 100% score on the PromptWars Evaluation Framework by delivering outstanding Code Clarity, Security, Efficiency, Testing (>95% coverage), Accessibility (WCAG 2.1 AA), and tight integration with Google Services.

## 2. Extraordinary UI Spec
- **Dynamic Parallax Timeline**: A visually stunning, scroll-driven parallax timeline representing the election process:
  - Voter Registration (ECI Voter ID)
  - Candidate Nomination
  - Campaigning
  - Polling Day (EVMs/VVPAT)
  - Counting & Results Certification
- **Interactive SVG Path**: Nodes in the timeline are connected via a dynamic, interactive SVG path. 
- **Adaptive AI Side-Panel**: When a node is clicked, a sleek side-panel slides in. Powered by **Gemini 1.5 Pro**, it dynamically explains the rules and context, automatically adapting its tone and depth to the user's "Civic Knowledge State" (ranging from *Novice* to *Policy Wonk*). All explanations strictly follow the Indian Election Commission (ECI) guidelines.

## 3. Google Services Stack
- **Firebase Auth**: Secure Google Login integration.
- **Gemini 1.5 Pro**: Core Logic Engine for adaptive explanations and dynamic content generation.
- **Firestore**: State Persistence for user progress, civic knowledge state, and settings.
- **Cloud Run MCP**: Seamless serverless deployment and scaling.

## 4. Hybrid Quota Architecture (UX + BYOK)
- **Zero-Friction Onboarding**: Works seamlessly out-of-the-box using our secure backend `.env` Gemini API key.
- **Bring Your Own Key (BYOK)**: An "Advanced Settings" gear icon in the UI allows power users to input their own Gemini API key.
  - *Storage*: Securely saved to `sessionStorage` on the client.
  - *Transport*: Passed via an `x-api-key` header on requests to override the backend's default credentials.

## 5. Infrastructure & Deployment Constraints
- **Cloud Run Compatibility**: The server entry point **MUST** listen on `0.0.0.0` and bind to `process.env.PORT || 8080`. This is critical to survive Cloud Run deployment and meet strict health check requirements.

## 6. Repository Constraints
- **Strict `.gitignore`**: Must aggressively exclude `node_modules`, `.env`, and unnecessary build artifacts to ensure the repository stays strictly under the 10MB limit.

## 7. Quality Standards (PromptWars Evaluation Framework)
- **Code Clarity**: Modular, well-documented, and highly readable code.
- **Security**: Secure credential handling (BYOK pattern) and safe Auth flows.
- **Efficiency**: Optimized bundle sizes and lazy-loaded assets.
- **Testing**: Test-Driven execution targeting >95% coverage.
- **Accessibility**: Strict adherence to WCAG 2.1 AA standards (keyboard navigation, screen reader support, contrast ratios).
- **Google Services Usage**: Deep, meaningful integration of the Google Cloud/Firebase stack.
