# PRD：客户调样合成实验记录系统（MVP）

## 1. 背景与目标
你目前用 Excel 记录客户调样实验，存在以下痛点：

- 录入慢、格式不统一（尤其工艺字段、`T10/T90`、气泡评价）
- 很难按“客户/项目/胶型号/硫化剂/指标区间”快速检索对比
- 后续分析需要大量清洗

**目标（MVP）**：做一个云端 Web 系统，用统一结构记录实验并支持强检索与导出，覆盖日常工作闭环。

- **核心结构**：`Experiment（实验项目） -> Record（实验记录，多条）`
- **第一版聚焦**：录入 + 追溯 + 检索 + CSV 导出
- **非目标（明确不做）**：
  - 不做历史 Excel 数据迁移
  - 不做多人权限/复杂审批（单用户即可）
  - 不做推荐算法/复杂可视化（后续版本）

## 2. 核心概念与数据模型（业务层）

### 2.1 Experiment（实验项目，容器）
一组针对“某客户胶 + 某目的”的实验集合。包含 meta 与默认工艺条件，下面挂多条 Record。

**meta 必填字段（MVP）**

- 客户（`customer_name`，支持从历史选择或新建）
- 项目编号（`project_no`）
- 调试目标（`debug_goal`）
- 客户胶型号（`silicone_model`，支持从历史选择或新建）
- 项目开始时间（`start_at`）
- 项目结束时间（`end_at`）

**工艺字段（Experiment 默认值，可被 Record 覆盖）**

- 硫化温度（℃，`cure_temp_c`）
- 硫化时间（分钟，`cure_time_min`）
- 烘烤温度（℃，`bake_temp_c`）
- 烘烤时间（分钟，`bake_time_min`）
- 出片厚度（mm，`sheet_thickness_mm`）

**其他**

- 附件（可选）：照片、仪器导出文件（MVP 可先只存链接/文件名）

### 2.2 Record（实验记录，多条）
你在同一组 Experiment 里尝试不同硫化剂方案的每一条记录。

**必填字段（MVP）**

- 硫化剂 A（`curing_agent_a_id`，从字典选；不允许为空，可选“未知”）
- 硫化剂 B（`curing_agent_b_id`，从字典选；不允许为空，可选“未知”）
- A 比例（百分数 0-100，`ratio_a_pct`）
- B 比例（百分数 0-100，`ratio_b_pct`）
- ML（`ml`）
- MH（`mh`）
- T10（秒，`t10_sec`）
- T90（秒，`t90_sec`）
- 测气泡等级（0–5，`bubble_grade`）
- 备注（`note`）

**Record 工艺覆盖（可选）**

- 当某条记录的工艺与 Experiment 默认不同，可在该 Record 上填写覆盖值：
  - `cure_temp_c` / `cure_time_min` / `bake_temp_c` / `bake_time_min` / `sheet_thickness_mm`
- 未填写则继承 Experiment 默认值

## 3. 字典与配置（MVP 必备）

### 3.1 硫化剂字典（CuringAgent）

- 初始 seed 来源：`data/reference/catalysts.json`（或你当前工作区的 `raw_data/catalysts.json`）
- 系统内可维护（CRUD）
- seed 数据中必须强制包含一个硫化剂字典项 **“未知”**（用于录入时无法识别/暂缺的情况；硫化剂字段不允许为空）
- **版本策略（MVP 简化版）**：
  - M1：先实现“编辑时提示可能影响历史”，并允许“复制为新版本”后再改（软约束）
  - M2：严格版本化：历史 Record 引用的版本只读

> `default_ratio` 仅用于“配胶/合成”场景，MVP 录入 Record 不依赖它。

### 3.2 物料字典（Material / MaterialCategory）

- 初始 seed 来源：`data/reference/basic_materials.csv`
- MVP 若 Record 只选硫化剂编号，可先不暴露物料层 UI；但字典作为未来扩展保留。

## 4. 关键规则与校验（必须写死）

### 4.1 字段命名策略

- **内部字段**：英文键（便于数据库/API/长期维护）
- **界面显示**：中文标签

### 4.2 `T10/T90` 输入与存储

- UI 允许多种输入：`0:53`、`00:53`、`53s`、`1m5s`、`65`
- 系统统一解析为 **秒（整数）** 存储到 `t10_sec` / `t90_sec`
- 解析失败：提示用户并阻止保存
- 约束（建议沿用你们历史口径）：`t10_sec <= 300` 且 `t90_sec <= 300`（可配置开关）

### 4.3 气泡字段

- `bubble_grade` 只允许整数 0–5
- UI：下拉或分段按钮（0/1/2/3/4/5），避免自由文本

### 4.4 比例字段

- `ratio_a_pct`、`ratio_b_pct` **只允许百分数**：
  - 取值范围：0–100（可带小数）
  - 约束：`ratio_a_pct + ratio_b_pct < 100`
  - UI：以 `%` 形式输入与展示

### 4.5 硫化剂 A/B 是否必填

- A、B 均必填；当未知时填写字典项 **“未知”**

### 4.6 客户与胶型号的录入体验

- `customer_name`、`silicone_model` 在录入时提供：
  - **从历史快速选择**（下拉搜索/模糊匹配）
  - **新建**（不存在时允许直接输入并保存到历史候选中）

## 5. 用户故事（MVP）

- 作为用户，我要能新建一个 Experiment，填 meta 和默认工艺条件。
- 作为用户，我要能在同一个页面连续新增多条 Record，并能“一键复制上一条 Record”只改硫化剂/比例。
- 作为用户，我要能按客户/项目编号/胶型号/硫化剂/指标区间快速筛选 Record。
- 作为用户，我要能导出筛选结果为 CSV，用于后续分析。

## 6. 功能范围（MVP 页面）

### 6.1 Experiment 列表页

- 搜索/筛选：客户、项目编号、胶型号、时间范围
- 列表字段：客户、项目编号、胶型号、目标、开始/结束时间、Record 数
- 操作：新建、查看、编辑、删除（删除需二次确认）

### 6.2 Experiment 详情页（含 Record 表格/表单）

- 上半区：Experiment meta + 默认工艺（可编辑）
- 下半区：Record 表格（可增删改）
  - 支持“新增 Record”“复制上一条”
  - 表格内联编辑或弹窗编辑（二选一；推荐弹窗避免拥挤）
  - Record 可选覆盖工艺（折叠区）

### 6.3 Record 检索页（事实表视角）

- 过滤条件（高频）：
  - 客户、项目编号、胶型号、目标关键词
  - 硫化剂A/B
  - ML/MH/T10/T90 区间
  - 气泡等级（0–5）
  - 工艺条件（温度/时间/厚度）区间
- 结果列表：每条 Record 一行，带回 Experiment 的关键 meta
- 导出：CSV（导出当前筛选结果）

### 6.4 字典页（硫化剂）

- 列表：硫化剂编号/名称、是否启用、更新时间
- 详情：配方条目（物料键+质量百分比）、`default_ratio`（可选）
- 操作：新增、编辑、停用/启用、复制为新版本（若做版本）

## 7. 数据与接口（研发对接）

- 数据库存储：CloudBase 云数据库
- 认证：CloudBase Auth
- 权限：CloudBase 普通云函数 + profiles 角色
- 核心表：
  - `profiles`
  - `process_types`
  - `experiments`
  - `records`
  - `curing_agents`
  - `materials`
  - `audit_events`
- 导出：CloudBase 普通云函数返回 rowset，前端在浏览器生成 CSV/ZIP
- 校验（CloudBase 云函数必须做，避免前端绕过）：
  - `curing_agent_a_id`、`curing_agent_b_id` **必填**（未知时使用字典项“未知”）
  - `ratio_a_pct`、`ratio_b_pct`：范围 0–100，且 **`ratio_a_pct + ratio_b_pct < 100`**
  - `t10_sec`、`t90_sec`：能解析为整数秒；（如启用约束）需 `<=300`
  - `bubble_grade`：整数 0–5

## 8. 验收标准（MVP）

- 能创建/编辑/删除 Experiment
- 在 Experiment 内能新增多条 Record，且“复制上一条”可用
- `T10/T90` 任意支持格式能解析并存为秒；非法输入无法保存
- 气泡只能 0–5
- 比例只能输入百分数 0–100，且 **A%+B%<100**；前端与 CloudBase API 校验一致，绕过前端提交也会被拒绝
- 硫化剂 A/B 不允许为空；可选“未知”，并且 seed 中始终存在该字典项
- Record 检索页能按硫化剂与指标区间过滤，结果正确
- CSV 导出字段固定、包含必要 meta 与 record 字段

## 9. 里程碑（建议）

- **第 1 周**：确定字段口径 + 原型（页面结构/交互）
- **第 2–3 周**：CloudBase 集合 + 普通云函数权限/查询 + seed 导入（硫化剂/物料字典）
- **第 3–4 周**：前端录入（Experiment/Record）+ 检索 + 导出
- **第 5 周**：打磨（复制录入、校验提示、性能）+ 上线

