## 用户流程（MVP：录入 + 追溯 + 强检索）

```mermaid
flowchart TD
  Start[打开系统] --> Home[首页/导航]

  Home --> ExpList[Experiment列表]
  ExpList -->|新建| ExpCreate[新建Experiment]
  ExpList -->|打开| ExpDetail[Experiment详情]

  ExpCreate --> ExpMeta[填写meta: 客户/项目编号/目标/胶型号/开始结束]
  ExpMeta --> ExpProcess[填写默认工艺: 硫化/烘烤/厚度]
  ExpProcess --> ExpSave[保存Experiment]
  ExpSave --> ExpDetail

  ExpDetail --> RecordTable[Record表格]
  RecordTable -->|新增Record| RecordEdit[编辑Record]
  RecordTable -->|复制上一条| RecordCopy[复制Record并修改差异]
  RecordEdit --> RecordFields[填: 硫化剂A/B+比例, ML/MH/T10/T90, 气泡0-5, 备注]
  RecordFields -->|可选| RecordOverride[覆盖该Record工艺(若与默认不同)]
  RecordOverride --> RecordValidate[校验: T10/T90解析为秒, 气泡0-5等]
  RecordFields --> RecordValidate
  RecordValidate -->|通过| RecordSave[保存Record]
  RecordValidate -->|不通过| RecordFix[提示错误并修正]
  RecordFix --> RecordFields
  RecordSave --> RecordTable

  Home --> RecordSearch[Record检索页(事实表)]
  RecordSearch --> Filters[设置筛选: 客户/项目/胶型号/硫化剂/指标区间/工艺区间]
  Filters --> Results[查看结果列表]
  Results -->|点开| ExpDetail
  Results -->|导出CSV| ExportCSV[导出筛选结果CSV]

  Home --> Dict[字典管理]
  Dict --> CuringAgentList[硫化剂列表]
  CuringAgentList -->|新增/编辑/停用| CuringAgentEdit[维护硫化剂配方]
  CuringAgentEdit --> CuringAgentList
```

## 3 个主流程总结
- **录入**：新建 `Experiment`（meta+默认工艺）→ 连续新增/复制多条 `Record`（必要时覆盖工艺）→ 保存
- **检索/追溯**：在 `Record` 检索页按条件筛选 → 点回对应 `Experiment` 看上下文
- **导出**：检索页按筛选条件 → 一键导出 CSV 给后续分析/汇报

