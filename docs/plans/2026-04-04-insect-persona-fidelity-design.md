# Insect Persona Fidelity Design

**Problem:** ComfyUI 灵化角色已能从识别链路拿到虫害语义，但提示词更像“虫害主题校园角色”，而不是“带有目标昆虫关键形态特征的拟人角色”。

**Goal:** 让灵化生图优先保留昆虫解剖与行为锚点，再叠加校园二次元风格，减少 generic anime girl 或普通校园角色的偏移。

## Approaches

1. Prompt-only 强化
   - 只调整提示词顺序、负向词和权重。
   - 优点：改动最小。
   - 风险：没有物种级形态库，提升有限。

2. 形态词典 + 路由增强
   - 为常见昆虫建立 anatomy cues，按“物种锚点 -> 解剖锚点 -> 行为锚点 -> 风格词”编译 prompt。
   - 同时新增更偏形态表达的 preset，让昆虫默认不再优先走校园美型风。
   - 优点：效果更稳定，仍兼容现有 ComfyUI 工作流。
   - 风险：需要补测试，维护词典。

3. 新工作流 / 新模型链路
   - 为昆虫拟人单独配 checkpoint、LoRA 或 IPAdapter。
   - 优点：上限更高。
   - 风险：工作量大，超出当前问题修复范围。

## Decision

采用方案 2。

## Design

### Data Flow

AI 识别结果继续作为唯一上游来源，但在 `spiritPersonaPromptBuilder` 中增加物种/类群形态词典，将昆虫的解剖部位、壳体结构、翅型、腹部、口器与群聚行为整理为强锚点。正向提示词编译时按固定层级输出，并把风格词放到后半段，避免压过形态词。

### Prompt Strategy

- 昆虫 prompt 结构改为：
  - 物种名与角色原型
  - 明确的 anatomy anchors
  - 明确的 behavior anchors
  - 材质/纹理/轮廓
  - 最后才是校园/二次元风格词
- 负向提示增加：
  - `generic human hairstyle`
  - `plain school uniform`
  - `missing antennae`
  - `missing elytra`
  - `missing segmented limbs`
  - 以及与当前种类冲突的特征

### Routing

新增一个更偏“形态清晰”的昆虫 preset，让默认昆虫和高频虫害优先走该 preset；`beneficial-guardian` 也保留守护感，但不再只走纯校园清新风。

### Testing

新增契约测试验证：
- `蚜虫` prompt 必须包含触角、腹部/角状管、群聚等锚点。
- `瓢虫` prompt 必须包含鞘翅、黑色斑点、半球壳面等锚点。
- 昆虫路由默认应命中新昆虫 anatomy preset，而不是直接回落到 `campus_anime`。

