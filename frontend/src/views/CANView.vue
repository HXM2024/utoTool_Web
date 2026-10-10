<template>
  <div class="can-view">
    <ConfigToolbar
      ref="configToolbarRef"
      module-name="can"
      @config-change="onConfigChange"
      @save="onSave"
      @generate="onGenerate"
      @export-excel="onExportExcel"
      @create="onCreate"
      @delete="onConfigDelete"
      @refresh="onRefresh"
    />

    <div class="can-layout">
      <div class="can-body" :class="{ 'with-panel': showObjectPanel }">
        <div class="can-main">
        <div
          class="app-card can-content"
          :class="{ 'fill-height': activeTab === 'dbc' && dbcViewMode === 'table' }"
        >
          <el-tabs v-model="activeTab" class="can-sub-tabs" tab-position="left">

        <!-- ====== DBC 报文信号表 ====== -->
        <el-tab-pane name="dbc">
          <template #label>
            <span class="tab-label"><el-icon><Connection /></el-icon> DBC</span>
          </template>
          <div class="sub-page">
            <div class="sub-page-header">
              <span class="sub-page-title">报文信号表</span>
              <el-tag v-if="signalRowCount" size="small" type="info">{{ signalRowCount }} 条信号</el-tag>
              <div class="header-right">
                <el-popover placement="bottom-end" :width="560" trigger="click" popper-class="can-hint-pop">
                  <template #reference>
                    <button type="button" class="can-help" title="表格 / 树形图操作说明" aria-label="表格 / 树形图操作说明">
                      <el-icon><QuestionFilled /></el-icon>
                    </button>
                  </template>
                  <div class="can-hint">
                    <template v-if="dbcViewMode === 'table'">
                      <div class="hint-row"><b>编辑</b><span>双击单元格编辑</span></div>
                      <div class="hint-row"><b>复制</b><span>框选后 Ctrl+C / Ctrl+V 与 Excel 互转（粘贴自动平铺填充）</span></div>
                      <div class="hint-row"><b>填充</b><span>拖拽选区右下角小方块可自动填充</span></div>
                      <div class="hint-row"><b>列宽</b><span>拖拽表头右缘调整</span></div>
                      <div class="hint-row"><b>多选</b><span>Ctrl/Shift+点击「Test」列复选框可加选多行，再点复选框即批量勾选（配合上方「标记测试 / 取消测试」）</span></div>
                      <div class="hint-row"><b>撤销</b><span>Ctrl+Z 撤销上一步修改</span></div>
                    </template>
                    <template v-else>
                      <div class="hint-row"><b>编辑</b><span>双击可编辑</span></div>
                      <div class="hint-row"><b>拖拽</b><span>从右侧对象树拖拽「信号 / DTC / 属性 / 测试参数」到节点或标签自动填充</span></div>
                    </template>
                  </div>
                </el-popover>
                <el-radio-group v-model="dbcViewMode" size="small" @change="onDbcViewChange">
                  <el-radio-button label="tree">树形图</el-radio-button>
                  <el-radio-button label="table">表格</el-radio-button>
                </el-radio-group>
                <el-button v-if="dbcViewMode === 'tree'" size="small" :icon="Plus" @click="addSignalRow">添加信号</el-button>
                <el-button
                  size="small"
                  :icon="Delete"
                  :disabled="!selectedSignalRows.length && !selectedTreeNode"
                  @click="removeSelectedRows"
                >删除选中</el-button>
                <!-- 展开/折叠：两种视图共用同一对按钮 -->
                <el-button size="small" :icon="Expand" @click="onDbcExpandAll">全部展开</el-button>
                <el-button size="small" :icon="Fold" @click="onDbcCollapseAll">全部折叠</el-button>
                <!-- 表格视图专有：批量测试勾选 + 列设置 -->
                <template v-if="dbcViewMode === 'table'">
                  <span class="dst-selected-hint">已选 {{ dbcTableSelectedCount }} 行</span>
                  <el-button size="small" :disabled="!dbcTableSelectedCount" @click="onDbcBatchTest(true)">标记测试</el-button>
                  <el-button size="small" :disabled="!dbcTableSelectedCount" @click="onDbcBatchTest(false)">取消测试</el-button>
                  <el-popover placement="bottom-end" :width="320" trigger="click">
                    <template #reference>
                      <el-button size="small" :icon="Setting">列设置</el-button>
                    </template>
                    <div class="dst-col-setting">
                      <div v-for="(c, i) in dbcOrderedColumns" :key="c.key" class="dst-col-row">
                        <el-checkbox :model-value="c.visible" @change="onDbcColumnVisibleChange(c.key, !!$event)">
                          {{ c.label }}
                        </el-checkbox>
                        <span class="dst-col-ops">
                          <el-button link size="small" :disabled="i === 0" @click="moveDbcColumn(i, -1)">↑</el-button>
                          <el-button link size="small" :disabled="i === dbcOrderedColumns.length - 1" @click="moveDbcColumn(i, 1)">↓</el-button>
                        </span>
                      </div>
                      <div class="dst-col-foot">
                        <el-button size="small" @click="resetDbcColumns">恢复默认</el-button>
                      </div>
                    </div>
                  </el-popover>
                </template>
                <el-input
                  v-model="dbcSearch"
                  placeholder="搜索筛选..."
                  :prefix-icon="Search"
                  clearable
                  data-shortcut-search
                  class="search-input"
                />
              </div>
            </div>
            <div
              class="dbc-tree-main"
              v-if="dbcViewMode === 'tree'"
              :style="{ height: dbcTreeHeight + 'px' }"
              @drop="_onTableDrop"
              @dragover="_onTreeDragOver"
              @dragenter="_onTreeDragEnter"
              @dragleave="_onTreeDragLeave"
            >
              <el-tree
                ref="mainDbcTreeRef"
                :data="treeData"
                node-key="id"
                :props="treeProps"
                :expand-on-click-node="false"
                :expanded-keys="treeExpandedKeys"
                :node-class="treeNodeClass"
                :filter-node-method="filterDbcTreeNode"
                class="main-dbc-tree"
                @node-click="onMainTreeNodeClick"
                @expand-change="onTreeExpandChange"
              >
                <template #default="{ data }">
                  <div
                    class="tree-node-content"
                    :class="{ 'is-sender': data.type === 'sender', 'is-msg': data.type === 'message', 'is-signal': data.type === 'signal', 'is-group': data.type === 'group', 'is-attr': data.type === 'attr', 'is-new': getDbChangeMark(data) === 'new', 'is-diff': getDbChangeMark(data) === 'diff' }"
                    @dragover.prevent="onTreeNodeDragOver($event, data)"
                    @dragleave="onTreeNodeDragLeave($event, data)"
                    @drop.prevent="onTreeNodeDrop($event, data)"
                  >
                    <el-icon class="node-icon" :class="data.type">
                      <component :is="getNodeIcon(data.type)" />
                    </el-icon>
                    <input
                      v-if="editingLabelId === data.id"
                      :value="labelEditValue"
                      class="label-edit-input"
                      @input="e => labelEditValue = (e.target as HTMLInputElement).value"
                      @blur="finishLabelEdit(data)"
                      @keyup.enter="finishLabelEdit(data)"
                      @keyup.esc="cancelLabelEdit"
                      @dblclick.stop
                    />
                    <span
                      v-else
                      class="node-label"
                      @dblclick.stop="_startLabelEdit(data)"
                    >{{ data.label }}</span>
                    <span v-if="data.type === 'attr'" class="attr-value">
                      <template v-if="editingAttrId === data.id">
                        <input
                          ref="attrInputRef"
                          :value="data.value"
                          class="attr-edit-input"
                          @input="e => data.value = (e.target as HTMLInputElement).value"
                          @blur="finishAttrEdit(data)"
                          @keyup.enter="finishAttrEdit(data)"
                          @keyup.esc="cancelAttrEdit"
                        />
                      </template>
                      <span v-else @dblclick.stop="_startAttrEdit(data)">
                        {{ data.value || '-' }}
                      </span>
                    </span>
                    <div
                      v-if="data.type === 'message' || data.type === 'signal'"
                      class="test-param-tags"
                    >
                      <span
                        v-for="param in data.testParams"
                        :key="param.value"
                        class="test-param-tag"
                        :class="{ 
                          active: isTestParamSelected(data, param),
                          configured: isParamConfigured(param)
                        }"
                        @click.stop="selectTestParam(data, param)"
                        @dragover.prevent.stop="onTestParamTagDragOver($event)"
                        @dragleave="onTestParamTagDragLeave($event)"
                        @drop.stop.prevent="onTestParamTagDrop($event, data, param)"
                      >
                        {{ param.label }}
                        <el-icon class="test-param-tag-close" @click.stop="removeTestParam(data, param)">×</el-icon>
                      </span>
                    </div>
                  </div>
                </template>
              </el-tree>
            </div>
            <!-- 表格视图：按报文一级分组（报文行 + 信号子行），列对照 Excel 通信矩阵；高度自适应铺满页签 -->
            <div v-else class="dbc-table-main">
              <DbcSignalTable
                ref="dbcTableRef"
                :rows="filteredDbcTableRows"
                :columns="dbcTableVisibleColumns"
                :is-configured="isParamConfigured"
                :is-param-selected="isTestParamSelected"
                :change-mark-of="getDbChangeMark"
                :serialize-params="serializeParamsForCell"
                @select-param="selectTestParam"
                @remove-param="removeTestParam"
                @tag-drop="onTestParamTagDrop"
                @row-drop="onDbcTableDrop"
                @check-change="onTreeCheckChange"
                @cell-commit="setNodeField"
                @sender-rename="onSenderRename"
                @apply-params="applyParamsFromCell"
                @batch-test="batchSetTest"
                @row-select="onDbcTableRowSelect"
                @column-resize="onDbcColumnResize"
                @auto-widths="onDbcAutoWidths"
                @selection-count="dbcTableSelectedCount = $event"
              />
            </div>
            <ResizableSplitter
              v-if="selectedTestParam"
              direction="vertical"
              :on-drag="dbcViewMode === 'table' ? onTestParamPanelDrag : onDbcTreeDrag"
            />
            <div
              v-if="selectedTestParam"
              class="test-param-detail-panel"
              :style="{ maxHeight: testParamPanelHeight + 'px' }"
            >
              <div class="detail-panel-header">
                <span class="detail-title">{{ selectedTestParam.label }} 配置</span>
                <el-icon class="detail-close" @click="closeSelectedTestParam">×</el-icon>
              </div>
              <div class="detail-panel-body">
                <div class="param-cards">
                  <template v-if="selectedTestParam && selectedTestParam.value === 'LostTest'">
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.dtc" placeholder="请输入DTC" size="large" />
                    </div>
                  </template>
                  <template v-else-if="selectedTestParam && selectedTestParam.value === 'DlcTest'">
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.dtc" placeholder="请输入DTC" size="large" />
                    </div>
                  </template>
                  <template v-else-if="selectedTestParam && (selectedTestParam.value === 'CRCTest' || selectedTestParam.value === 'CounterTest')">
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.dtc" placeholder="DTC" size="large" />
                    </div>
                  </template>
                  <template v-else-if="selectedTestParam && selectedTestParam.value === 'SigInvalidTest'">
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.dtcValue" placeholder="报DTC的值" size="large" />
                    </div>
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.noDtcValue" placeholder="不报DTC的值" size="large" />
                    </div>
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.dtc" placeholder="DTC" size="large" />
                    </div>
                    <div class="param-card param-card-inline param-card-right">
                      <span class="param-card-label">类型</span>
                      <el-radio-group v-model="selectedTestParam.params.invalidType" size="large">
                        <el-radio-button label="SigInvalid">SigInvalid</el-radio-button>
                        <el-radio-button label="SigvalueInvalid">SigvalueInvalid</el-radio-button>
                      </el-radio-group>
                    </div>
                  </template>
                  <template v-else-if="selectedTestParam && selectedTestParam.value === 'FactorTest'">
                    <div class="param-card">
                      <el-input v-model="selectedTestParam.params.variable" placeholder="变量名" size="large" />
                    </div>
                    <div v-if="!selectedTestParam.params.autoRange" class="param-card">
                      <el-input v-model="selectedTestParam.params.testValues" placeholder="测试值，逗号分隔" size="large" />
                    </div>
                    <div class="param-card">
                      <el-switch
                        v-model="selectedTestParam.params.autoRange"
                        active-text="自动遍历（从最小值到最大值）"
                        inactive-text="手动输入"
                        size="large"
                      />
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ====== Data Link Layer ====== -->
        <el-tab-pane v-if="store.selectedOem === 'GEEA_3.0'" name="dataLink">
          <template #label>
            <span class="tab-label"><el-icon><Link /></el-icon> 链路层</span>
          </template>
          <div class="dll-page">
            <!-- 面包屑导航栏：点击路径跳转层级 -->
            <div class="dll-breadcrumb-bar">
              <el-button
                v-if="dllNavLevel === 'items'"
                size="small"
                :icon="ArrowLeft"
                class="dll-back-btn"
                @click="dllGoBack"
              >返回上一层</el-button>
              <el-breadcrumb separator="/">
                <el-breadcrumb-item>
                  <a
                    class="dll-crumb-link"
                    :class="{ 'is-current': dllNavLevel === 'types' }"
                    @click="dllNavToRoot"
                  >链路层</a>
                </el-breadcrumb-item>
                <el-breadcrumb-item v-if="dllNavLevel === 'items'">
                  <span class="dll-crumb-current">{{ dllSelectedType }}</span>
                </el-breadcrumb-item>
              </el-breadcrumb>
              <el-tag v-if="dllTreeData.length" size="small" type="info">{{ dllTreeData.length }} 条</el-tag>
            </div>

            <!-- 第一层：测试类型列表 -->
            <div v-if="dllNavLevel === 'types'" class="dll-types-view">
              <div
                class="dll-drop-zone"
                @dragover.prevent
                @drop="onDllDrop"
              >
                <el-icon class="empty-icon"><Link /></el-icon>
                <span>从对象浏览器拖拽 DTC 到此处添加</span>
              </div>
              <div class="dll-type-grid">
                <div
                  v-for="t in DLL_TYPES"
                  :key="t"
                  class="dll-type-item"
                  @click="dllOpenType(t)"
                >
                  <span class="dll-type-name">{{ t }}</span>
                  <el-tag size="small" :type="dllTypeTagType(t)">{{ countDllByType(t) }}</el-tag>
                </div>
              </div>
            </div>

            <!-- 第二层：DTC 列表 + 配置（同一页） -->
            <div v-else class="dll-items-view">
              <div class="dll-list-panel">
                <div class="sub-page-header">
                  <span class="sub-page-title">{{ dllSelectedType }}</span>
                  <el-tag v-if="nodesOfDllType(dllSelectedType).length" size="small" type="info">{{ nodesOfDllType(dllSelectedType).length }}</el-tag>
                </div>
                <div
                  class="dll-items-area"
                  @dragover.prevent
                  @drop="onDllDrop"
                >
                  <div v-if="nodesOfDllType(dllSelectedType).length" class="dll-item-list">
                    <div
                      v-for="n in nodesOfDllType(dllSelectedType)"
                      :key="n.id"
                      class="dll-item-row"
                      :class="{ 'is-active': selectedDllNode?.id === n.id }"
                      @click="onDllNodeClick(n)"
                    >
                      <span class="dll-item-dtc">{{ n.data['DTC Test'] || '?' }}</span>
                      <el-tag size="small" :type="dllTypeTagType(n.data.Item)">{{ n.data.Item || '未设置' }}</el-tag>
                    </div>
                  </div>
                  <div v-else class="dll-drop-hint">
                    <el-icon class="empty-icon"><Link /></el-icon>
                    <span>该类型暂无 DTC，拖拽添加</span>
                  </div>
                </div>
              </div>

              <div class="dll-config-panel">
                <template v-if="selectedDllNode">
                  <div class="dll-prop-header">
                    <span>参数编辑</span>
                    <el-button size="small" :icon="Delete" type="danger" @click="removeDllNode">删除节点</el-button>
                  </div>
                  <el-form label-width="150px" size="small" class="dll-prop-form">
                    <el-form-item label="Item">
                      <el-select v-model="selectedDllNode.data.Item" @change="onDllTypeChange">
                        <el-option v-for="t in DLL_TYPES" :key="t" :label="t" :value="t" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="DTC Test">
                      <el-input v-model="selectedDllNode.data['DTC Test']" />
                    </el-form-item>

                <!-- ===== 电压相关测试 ===== -->
                <template v-if="isVoltageTest(selectedDllNode.data.Item)">
                  <div class="dll-form-group-title">TRC（电压相关：8 参数）</div>
                  <el-form-item label="1. StepUpValue">
                    <el-input v-model="selectedDllNode.data.StepUpValue" placeholder="例: 3" />
                  </el-form-item>
                  <el-form-item label="2. TestPeriod">
                    <el-input v-model="selectedDllNode.data.TestPeriod" placeholder="例: 50" />
                  </el-form-item>
                  <el-form-item label="3. StepDownValue">
                    <el-input v-model="selectedDllNode.data.StepDownValue" placeholder="例: 6" />
                  </el-form-item>
                  <el-form-item label="4. Vlot">
                    <el-input v-model="selectedDllNode.data.Vlot" placeholder="例: 9" />
                  </el-form-item>
                  <el-form-item label="5. confirmedDTCLimit">
                    <el-input v-model="selectedDllNode.data.confirmedDTCLimit" placeholder="例: 3" />
                  </el-form-item>
                  <el-form-item label="6. UnconfirmedDTCLimit">
                    <el-input v-model="selectedDllNode.data.UnconfirmedDTCLimit" placeholder="例: 6" />
                  </el-form-item>
                  <el-form-item label="7. agedDTCLimit">
                    <el-input v-model="selectedDllNode.data.agedDTCLimit" placeholder="例: 255" />
                  </el-form-item>
                  <el-form-item label="8. DTCid">
                    <el-input v-model="selectedDllNode.data['DTC Test']" placeholder="自动取自 DTC Test" disabled />
                  </el-form-item>

                  <div class="dll-form-group-title">Car Mode（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Car Mode 1']" placeholder="不诊断的值" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Car Mode 2']" placeholder="开启诊断的值" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-form-item label="Long-Term Memory Test">
                    <el-switch v-model="selectedDllNode.data['Long-Term Memory Test']" active-value="True" inactive-value="" />
                  </el-form-item>

                  <div class="dll-form-group-title">Usage Mode（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Usage Mode 1']" placeholder="逗号分隔，例: 0,1,2,11" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Usage Mode 2']" placeholder="逗号分隔，例: 13" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <div class="dll-form-group-title">ElPowerLevel（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['ElPowerLevel 1']" placeholder="逗号分隔，例: 1,2" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['ElPowerLevel 2']" placeholder="逗号分隔，例: 0,3,4,5,6,7,8,9,10,11,12,13,14,15" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="DTCAgedLimit" label-width="110px">
                        <el-switch v-model="selectedDllNode.data.DTCAgedLimit" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="Extend Data" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Extend Data']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="Ubat is lower than 12V" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Ubat is lower than 12V']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="Supply Voltage Compared Failure" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Supply Voltage Compared Failure']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-form-item label="voltage out range">
                    <el-input v-model="selectedDllNode.data['voltage out range']" />
                  </el-form-item>
                  <el-form-item label="FDC10 Test">
                    <el-input v-model="selectedDllNode.data['FDC10 Test']" placeholder="逗号分隔，例: 9,18" />
                  </el-form-item>
                  <el-form-item label="UnconfirmedDTCLimit Test">
                    <el-switch v-model="selectedDllNode.data['UnconfirmedDTCLimit Test']" active-value="True" inactive-value="" />
                  </el-form-item>
                  <el-form-item label="CanSMBorTimeTxEnsured">
                    <el-input v-model="selectedDllNode.data['CanSMBorTimeTxEnsured']" />
                  </el-form-item>
                </template>

                <!-- ===== BusOff 测试 ===== -->
                <template v-else-if="isBusOffTest(selectedDllNode.data.Item)">
                  <div class="dll-form-group-title">TRC（BusOff：8 参数）</div>
                  <el-form-item label="1. StepUpValue">
                    <el-input v-model="selectedDllNode.data.StepUpValue" placeholder="例: 4" />
                  </el-form-item>
                  <el-form-item label="2. StepDownValue">
                    <el-input v-model="selectedDllNode.data.StepDownValue" placeholder="例: 128" />
                  </el-form-item>
                  <el-form-item label="3. TestPeriod">
                    <el-input v-model="selectedDllNode.data.TestPeriod" placeholder="例: 10" />
                  </el-form-item>
                  <el-form-item label="4. confirmedDTCLimit">
                    <el-input v-model="selectedDllNode.data.confirmedDTCLimit" placeholder="例: 1" />
                  </el-form-item>
                  <el-form-item label="5. UnconfirmedDTCLimit">
                    <el-input v-model="selectedDllNode.data.UnconfirmedDTCLimit" placeholder="例: 127" />
                  </el-form-item>
                  <el-form-item label="6. agedDTCLimit">
                    <el-input v-model="selectedDllNode.data.agedDTCLimit" placeholder="例: 255" />
                  </el-form-item>
                  <el-form-item label="7. aged">
                    <el-input v-model="selectedDllNode.data.aged" placeholder="例: 1" />
                  </el-form-item>
                  <el-form-item label="8. DTCid">
                    <el-input v-model="selectedDllNode.data['DTC Test']" placeholder="自动取自 DTC Test" disabled />
                  </el-form-item>

                  <div class="dll-form-group-title">Car Mode（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Car Mode 1']" placeholder="不诊断的值" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Car Mode 2']" placeholder="开启诊断的值" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-form-item label="Long-Term Memory Test">
                    <el-switch v-model="selectedDllNode.data['Long-Term Memory Test']" active-value="True" inactive-value="" />
                  </el-form-item>

                  <div class="dll-form-group-title">Usage Mode（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Usage Mode 1']" placeholder="逗号分隔，例: 0,1,2,11" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Usage Mode 2']" placeholder="逗号分隔，例: 13" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <div class="dll-form-group-title">ElPowerLevel（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['ElPowerLevel 1']" placeholder="逗号分隔，例: 1,2" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['ElPowerLevel 2']" placeholder="逗号分隔，例: 0,3,4,5,6,7,8,9,10,11,12,13,14,15" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="DTCAgedLimit" label-width="110px">
                        <el-switch v-model="selectedDllNode.data.DTCAgedLimit" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="Extend Data" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Extend Data']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="Ubat is lower than 12V" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Ubat is lower than 12V']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="Supply Voltage Compared Failure" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Supply Voltage Compared Failure']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-form-item label="voltage out range">
                    <el-input v-model="selectedDllNode.data['voltage out range']" />
                  </el-form-item>
                  <el-form-item label="FDC10 Test">
                    <el-input v-model="selectedDllNode.data['FDC10 Test']" placeholder="逗号分隔，例: 9,18" />
                  </el-form-item>
                  <el-form-item label="UnconfirmedDTCLimit Test">
                    <el-switch v-model="selectedDllNode.data['UnconfirmedDTCLimit Test']" active-value="True" inactive-value="" />
                  </el-form-item>
                  <el-form-item label="CanSMBorTimeTxEnsured">
                    <el-input v-model="selectedDllNode.data['CanSMBorTimeTxEnsured']" placeholder="待补充模板" />
                  </el-form-item>
                </template>

                <!-- ===== BUS 测试 ===== -->
                <template v-else-if="isBusTest(selectedDllNode.data.Item)">
                  <div class="dll-form-group-title">TRC（BUS：6 参数）</div>
                  <el-form-item label="1. StepUpValue">
                    <el-input v-model="selectedDllNode.data.StepUpValue" placeholder="例: 13" />
                  </el-form-item>
                  <el-form-item label="2. StepDownValue">
                    <el-input v-model="selectedDllNode.data.StepDownValue" placeholder="例: 13" />
                  </el-form-item>
                  <el-form-item label="3. confirmedDTCLimit">
                    <el-input v-model="selectedDllNode.data.confirmedDTCLimit" placeholder="例: 1" />
                  </el-form-item>
                  <el-form-item label="4. UnconfirmedDTCLimit">
                    <el-input v-model="selectedDllNode.data.UnconfirmedDTCLimit" placeholder="例: 127" />
                  </el-form-item>
                  <el-form-item label="5. agedDTCLimit">
                    <el-input v-model="selectedDllNode.data.agedDTCLimit" placeholder="例: 255" />
                  </el-form-item>
                  <el-form-item label="6. DTCid">
                    <el-input v-model="selectedDllNode.data['DTC Test']" placeholder="自动取自 DTC Test" disabled />
                  </el-form-item>

                  <div class="dll-form-group-title">Car Mode（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Car Mode 1']" placeholder="不诊断的值" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Car Mode 2']" placeholder="开启诊断的值" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <div class="dll-form-group-title">Usage Mode（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Usage Mode 1']" placeholder="逗号分隔，例: 0,1,2,11" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['Usage Mode 2']" placeholder="逗号分隔，例: 13" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <div class="dll-form-group-title">ElPowerLevel（拆分填值）</div>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="组1" label-width="48px">
                        <el-input v-model="selectedDllNode.data['ElPowerLevel 1']" placeholder="逗号分隔，例: 1,2" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="组2" label-width="48px">
                        <el-input v-model="selectedDllNode.data['ElPowerLevel 2']" placeholder="逗号分隔，例: 0,3,4,5,6,7,8,9,10,11,12,13,14,15" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-form-item label="Long-Term Memory Test">
                    <el-switch v-model="selectedDllNode.data['Long-Term Memory Test']" active-value="True" inactive-value="" />
                  </el-form-item>
                  <el-row :gutter="8">
                    <el-col :span="12">
                      <el-form-item label="DTCAgedLimit" label-width="110px">
                        <el-switch v-model="selectedDllNode.data.DTCAgedLimit" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="Extend Data" label-width="110px">
                        <el-switch v-model="selectedDllNode.data['Extend Data']" active-value="True" inactive-value="" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-form-item label="voltage out range">
                    <el-input v-model="selectedDllNode.data['voltage out range']" />
                  </el-form-item>
                </template>
                  </el-form>
                </template>
                <div v-else class="dll-detail-empty">
                  <el-icon class="empty-icon"><Setting /></el-icon>
                  <span>请选择 DTC 编辑参数</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 类型选择弹窗 -->
          <el-dialog v-model="dllTypeDialogVisible" title="选择链路层测试类型" width="420px">
            <div class="dll-type-list">
              <div
                v-for="t in DLL_TYPES"
                :key="t"
                class="dll-type-option"
                @click="onDllTypeSelect(t)"
              >
                <el-icon><Link /></el-icon>
                <span>{{ t }}</span>
              </div>
            </div>
          </el-dialog>
        </el-tab-pane>

        <!-- ====== DTC 故障码 ====== -->
        <el-tab-pane name="dtc">
          <template #label>
            <span class="tab-label"><el-icon><Warning /></el-icon> DTC</span>
          </template>
          <div class="sub-page">
            <div class="sub-page-header">
              <span class="sub-page-title">故障码列表</span>
              <el-tag v-if="dtcData.length" size="small" type="info">{{ dtcData.length }} 条</el-tag>
              <div class="sub-page-actions">
                <el-button size="small" :icon="Plus" @click="addDtcRow">添加</el-button>
                <el-button size="small" :icon="Delete" :disabled="selectedDtcRow < 0" @click="removeDtcRow">删除</el-button>
              </div>
            </div>
            <div v-if="dtcData.length" class="table-area">
              <DtcCardList
                :columns="dtcColumns"
                :data="dtcData"
                :object-names="dtcObjectNames"
                :selected-row="selectedDtcRow"
                @update="onDtcCardUpdate"
                @add-col="onDtcColumnAdd"
                @remove-col="onDtcColumnRemove"
                @rename-col="onDtcColumnRename"
                @select-row="selectedDtcRow = $event"
              />
            </div>
            <div v-else class="empty-placeholder">
              <el-icon class="empty-icon"><Warning /></el-icon>
              <span>暂无 DTC 数据</span>
            </div>
          </div>
        </el-tab-pane>

        <!-- ====== Other 其他配置 ====== -->
        <el-tab-pane name="other">
          <template #label>
            <span class="tab-label"><el-icon><Setting /></el-icon> 其他配置</span>
          </template>
          <div class="sub-page">
            <div class="sub-page-header">
              <span class="sub-page-title">其他配置参数</span>
              <el-checkbox v-model="otherSelectAll" class="other-select-all">全选</el-checkbox>
            </div>
            <div class="other-form-container">
              <!-- 简单卡片（1-3 个输入框） -->
              <div
                v-for="field in otherFieldDefs"
                :key="field.key"
                class="other-card"
                :class="[
                  { 'other-card--active': otherCheckboxStates[field.key] },
                  `other-card--span-${field.span ?? getCardSpan(field.inputs.length)}`,
                  field.layout ? `other-card--layout-${field.layout}` : ''
                ]"
                @click="otherCheckboxStates[field.key] = !otherCheckboxStates[field.key]"
              >
                <div class="other-card-header">
                  <span class="other-card-title">{{ field.label }}</span>
                  <el-popover
                    v-if="OTHER_CARD_DOCS[field.key]"
                    placement="bottom-end"
                    trigger="click"
                    :width="320"
                  >
                    <template #reference>
                      <el-icon class="other-card-help" title="使用说明" @click.stop><QuestionFilled /></el-icon>
                    </template>
                    <div class="other-card-help-text">{{ OTHER_CARD_DOCS[field.key] }}</div>
                  </el-popover>
                </div>
                <div class="other-card-body">
                  <template v-for="inp in field.inputs" :key="inp.key">
                    <el-switch
                      v-if="inp.type === 'select'"
                      v-model="otherData[inp.key]"
                      :active-value="inp.activeValue ?? 'TRUE'"
                      :inactive-value="inp.inactiveValue ?? 'FALSE'"
                      :active-text="inp.activeText ?? 'TRUE'"
                      :inactive-text="inp.inactiveText ?? 'FALSE'"
                      :style="inp.span ? { gridColumn: `span ${inp.span}` } : undefined"
                      inline-prompt
                      size="small"
                      @click.stop
                    />
                    <el-input
                      v-else
                      v-model="otherData[inp.key]"
                      :placeholder="inp.placeholder"
                      :style="inp.span ? { gridColumn: `span ${inp.span}` } : undefined"
                      size="small"
                      @click.stop
                      @input="onValidateInput(inp)"
                    />
                  </template>
                </div>
              </div>

              <!-- Compound 滑块卡片 -->
              <div
                v-for="d in compoundSliderDefs"
                :key="d.key"
                class="other-card other-card--span-2x2"
                :class="{ 'other-card--active': d.sliders.every(s => otherData[s.key] === 'TRUE') }"
              >
                <div class="other-card-header">
                  <span class="other-card-title">{{ d.label }}</span>
                  <el-popover
                    v-if="OTHER_CARD_DOCS[d.key]"
                    placement="bottom-end"
                    trigger="click"
                    :width="320"
                  >
                    <template #reference>
                      <el-icon class="other-card-help" title="使用说明" @click.stop><QuestionFilled /></el-icon>
                    </template>
                    <div class="other-card-help-text">{{ OTHER_CARD_DOCS[d.key] }}</div>
                  </el-popover>
                </div>
                <div class="other-card-body other-card-body--sliders">
                  <div
                    v-for="s in d.sliders"
                    :key="s.key"
                    class="other-slider-row"
                    :class="{ 'other-slider-row--on': otherData[s.key] === 'TRUE' }"
                    @click="otherData[s.key] = otherData[s.key] === 'TRUE' ? 'FALSE' : 'TRUE'"
                  >
                    <span class="other-slider-label">{{ s.label }}</span>
                    <el-switch
                      :model-value="otherData[s.key] === 'TRUE'"
                      @update:model-value="(v: boolean) => otherData[s.key] = v ? 'TRUE' : 'FALSE'"
                      active-text="TRUE"
                      inactive-text="FALSE"
                      inline-prompt
                      size="small"
                      @click.stop
                    />
                  </div>
                </div>
              </div>

              <!-- Hex ID 卡片（Ready_OffDiagStop） -->
              <div
                v-for="card in hexIdCardDefs"
                :key="card.key"
                class="other-card"
                :class="[
                  { 'other-card--active': otherCheckboxStates[card.key] },
                  `other-card--span-1x1`
                ]"
                @click="otherCheckboxStates[card.key] = !otherCheckboxStates[card.key]"
              >
                <div class="other-card-header">
                  <span class="other-card-title">{{ card.label }}</span>
                  <el-popover
                    v-if="OTHER_CARD_DOCS[card.key]"
                    placement="bottom-end"
                    trigger="click"
                    :width="320"
                  >
                    <template #reference>
                      <el-icon class="other-card-help" title="使用说明" @click.stop><QuestionFilled /></el-icon>
                    </template>
                    <div class="other-card-help-text">{{ OTHER_CARD_DOCS[card.key] }}</div>
                  </el-popover>
                </div>
                <div class="other-card-body">
                  <el-input
                    v-model="otherData[card.key]"
                    :placeholder="card.placeholder"
                    size="small"
                    @click.stop
                    @input="onHexIdInput(card.key)"
                  />
                </div>
              </div>

              <!-- 纯参数卡片（11ResetTime / IGON_OFF：只有一个输入框、无开关，跟随自动落位） -->
              <div
                v-for="card in paramCardDefs"
                :key="card.key"
                class="other-card other-card--span-1x1 other-card--param"
              >
                <div class="other-card-header">
                  <span class="other-card-title">{{ card.label }}</span>
                  <el-popover
                    v-if="OTHER_CARD_DOCS[card.key]"
                    placement="bottom-end"
                    trigger="click"
                    :width="320"
                  >
                    <template #reference>
                      <el-icon class="other-card-help" title="使用说明" @click.stop><QuestionFilled /></el-icon>
                    </template>
                    <div class="other-card-help-text">{{ OTHER_CARD_DOCS[card.key] }}</div>
                  </el-popover>
                </div>
                <div class="other-card-body">
                  <el-input
                    v-model="otherData[card.key]"
                    :placeholder="card.placeholder"
                    size="small"
                    @input="onValidateInput(card)"
                  />
                </div>
              </div>

              <!-- 分组卡片独立子网格：整行另起（占满 8 列），内部两列并排，
                   避免 4 列宽的卡片在外层 8 列网格里落位参差、留出大片空白 -->
              <div
                class="other-group-wrap"
                :style="{ gridRow: `span ${groupWrapRowSpan}` }"
              >
              <!-- DiagStop Group 卡片（OTA / Sig / PwrStsFb） -->
              <div
                v-for="card in groupCardDefs"
                :key="card.key"
                class="other-card other-card--group"
                :class="{ 'other-card--active': isGroupActive(card.key) }"
                :style="{ gridRow: `span ${getGroupRowSpan(card.groups.length)}` }"
                @click="otherCheckboxStates[card.key] = !otherCheckboxStates[card.key]"
              >
                <div class="other-card-header">
                  <span class="other-card-title">{{ card.label }}</span>
                  <div class="other-card-header-actions">
                    <el-button
                      class="other-add-btn"
                      size="small"
                      type="primary"
                      link
                      @click.stop="addGroup(card.key)"
                    >
                      + 添加
                    </el-button>
                    <el-popover
                      v-if="OTHER_CARD_DOCS[card.key]"
                      placement="bottom-end"
                      trigger="click"
                      :width="320"
                    >
                      <template #reference>
                        <el-icon class="other-card-help" title="使用说明" @click.stop><QuestionFilled /></el-icon>
                      </template>
                      <div class="other-card-help-text">{{ OTHER_CARD_DOCS[card.key] }}</div>
                    </el-popover>
                  </div>
                </div>
                <div
                  class="other-card-body other-card-body--groups"
                  :class="{ 'other-card-body--drop': dragOverGroup === card.key }"
                  @click.stop
                  @dragenter.prevent="onGroupDragEnter(card.key, $event)"
                  @dragover.prevent
                  @dragleave="onGroupDragLeave"
                  @drop="onGroupCardDrop($event, card.key)"
                >
                  <div
                    v-if="card.groups.length === 0"
                    class="other-drop-hint"
                  >
                    将 DBC 信号拖入此处，或点击"+ 添加"手动输入
                  </div>
                  <div
                    v-for="(group, idx) in card.groups"
                    :key="group.id"
                    class="other-group-item"
                  >
                    <div class="other-group-header">
                      <span class="other-group-idx">#{{ idx + 1 }}</span>
                      <el-button
                        size="small"
                        type="danger"
                        link
                        @click.stop="removeGroup(card.key, group.id)"
                      >
                        删除
                      </el-button>
                    </div>
                    <div class="other-group-fields">
                      <template v-for="f in card.groupFields" :key="f.key">
                        <el-input
                          v-if="f.type === 'hex'"
                          v-model="group.values[f.key]"
                          :placeholder="f.placeholder"
                          size="small"
                          @click.stop
                          @dragover.prevent
                          @drop="onDropReplace($event, (v) => group.values[f.key] = v)"
                        />
                        <el-input
                          v-else
                          v-model="group.values[f.key]"
                          :placeholder="f.placeholder"
                          size="small"
                          @click.stop
                          @dragover.prevent
                          @drop="onDropReplace($event, (v) => group.values[f.key] = v)"
                        />
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Config_Diag：与 SignalValue 同款分组卡片（半宽 + 分组条目格式）。
                   ① 全配、② 全不配固定各一条（无删除）；③ 部分配置按「+ 添加」逐条录入 -->
              <div
                class="other-card other-card--group"
                :class="{ 'other-card--active': otherCheckboxStates.configDiag }"
                :style="{ gridRow: `span ${configDiagRowSpan}` }"
                @click="otherCheckboxStates.configDiag = !otherCheckboxStates.configDiag"
              >
                <div class="other-card-header">
                  <span class="other-card-title">Config_Diag</span>
                  <div class="other-card-header-actions">
                    <el-button
                      class="other-add-btn"
                      size="small"
                      type="primary"
                      link
                      @click.stop="addPartialConfig"
                    >
                      + 添加
                    </el-button>
                    <el-popover
                      v-if="OTHER_CARD_DOCS.configDiag"
                      placement="bottom-end"
                      trigger="click"
                      :width="320"
                    >
                      <template #reference>
                        <el-icon class="other-card-help" title="使用说明" @click.stop><QuestionFilled /></el-icon>
                      </template>
                      <div class="other-card-help-text">{{ OTHER_CARD_DOCS.configDiag }}</div>
                    </el-popover>
                  </div>
                </div>
                <div class="other-card-body other-card-body--groups" @click.stop>
                  <!-- ① 全配：固定，无删除 -->
                  <div class="other-group-item">
                    <div class="other-group-header">
                      <span class="other-group-idx">#1 AllConfig_Diag</span>
                    </div>
                    <div class="other-group-fields">
                      <el-input
                        v-model="otherData['configUdsCommand']"
                        placeholder="配置所有功能的UDS指令"
                        size="small"
                        @click.stop
                        @input="onUdsInput('configUdsCommand')"
                      />
                    </div>
                  </div>
                  <!-- ② 全不配：固定，无删除 -->
                  <div class="other-group-item">
                    <div class="other-group-header">
                      <span class="other-group-idx">#2 EraseConfig_Diag</span>
                    </div>
                    <div class="other-group-fields">
                      <el-input
                        v-model="otherData['eraseUdsCommand']"
                        placeholder="擦除所有配置的UDS指令"
                        size="small"
                        @click.stop
                        @input="onUdsInput('eraseUdsCommand')"
                      />
                      <el-input
                        v-model="otherData['unconfigDtc']"
                        placeholder="未配置DTC (如 456F00)"
                        size="small"
                        @click.stop
                        @input="onHexIdInput('unconfigDtc')"
                      />
                      <el-input
                        v-model="otherData['excludeMsgIds']"
                        placeholder="排除的报文ID (逗号分隔)"
                        size="small"
                        @click.stop
                      />
                    </div>
                  </div>
                  <!-- ③ 部分配置：数量不定，+ 添加 -->
                  <div v-if="!(otherData.configDiagPartial || []).length" class="other-drop-hint">
                    点击"+ 添加"录入部分配置（UDS指令 + 关联ID），每条生成一条用例
                  </div>
                  <div
                    v-for="(g, idx) in (otherData.configDiagPartial || [])"
                    :key="idx"
                    class="other-group-item"
                  >
                    <div class="other-group-header">
                      <span class="other-group-idx">#{{ idx + 3 }} PartialConfig_Diag</span>
                      <el-button
                        size="small"
                        type="danger"
                        link
                        @click.stop="removePartialConfig(idx)"
                      >
                        删除
                      </el-button>
                    </div>
                    <div class="other-group-fields">
                      <el-input
                        v-model="g.udsCommand"
                        placeholder="UDS指令"
                        size="small"
                        @click.stop
                        @input="g.udsCommand = normalizeUdsText(g.udsCommand)"
                      />
                      <el-input
                        v-model="g.relatedIds"
                        placeholder="关联ID (逗号分隔)"
                        size="small"
                        @click.stop
                      />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ====== Voltage 电压图表 ====== -->
        <el-tab-pane name="voltage">
          <template #label>
            <span class="tab-label"><el-icon><DataLine /></el-icon> 电压图表</span>
          </template>
          <div class="sub-page voltage-page">
            <el-tabs v-model="activeVoltageTab" class="voltage-sub-tabs">
              <!-- 通信电压 -->
              <el-tab-pane label="通信电压" name="communication">
                <div class="voltage-chart-page">
                  <div class="params-panel">
                    <div class="params-header">
                      <div class="params-header-left">
                        <span class="params-title">参数设置 — 通信电压</span>
                        <el-switch
                          v-model="commParams.commEnableCheckBox"
                          active-text="启用"
                          inactive-text="禁用"
                          inline-prompt
                          class="enable-switch"
                        />
                      </div>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="voltageLoading"
                        @click="applyParams('communication')"
                      >
                        应用并刷新
                      </el-button>
                    </div>
                    <el-form :model="commParams" label-width="170px" class="params-form" size="small">
                      <el-row :gutter="12">
                        <el-col v-for="field in commParamFields" :key="field.key" :span="8">
                          <el-form-item :label="field.label">
                            <el-input-number
                              v-if="field.type === 'number'"
                              v-model="commParams[field.key]"
                              :controls="false"
                              class="param-input"
                            />
                            <el-switch v-else v-model="commParams[field.key]" />
                          </el-form-item>
                        </el-col>
                      </el-row>
                    </el-form>
                  </div>
                  <div class="chart-area">
                    <VoltageChart
                      ref="commChartRef"
                      :chart-data="commChartData"
                      title="通信电压波形"
                    />
                  </div>
                </div>
              </el-tab-pane>

              <!-- 诊断电压 -->
              <el-tab-pane label="诊断电压" name="diagnostic">
                <div class="voltage-chart-page">
                  <div class="params-panel">
                    <div class="params-header">
                      <div class="params-header-left">
                        <span class="params-title">参数设置 — 诊断电压</span>
                        <el-switch
                          v-model="diagParams.diagEnableCheckBox"
                          active-text="启用"
                          inactive-text="禁用"
                          inline-prompt
                          class="enable-switch"
                        />
                      </div>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="voltageLoading"
                        @click="applyParams('diagnostic')"
                      >
                        应用并刷新
                      </el-button>
                    </div>
                    <el-form :model="diagParams" label-width="170px" class="params-form" size="small">
                      <el-row :gutter="12">
                        <el-col v-for="field in diagParamFields" :key="field.key" :span="8">
                          <el-form-item :label="field.label">
                            <el-input-number
                              v-if="field.type === 'number'"
                              v-model="diagParams[field.key]"
                              :controls="false"
                              class="param-input"
                            />
                            <el-switch v-else v-model="diagParams[field.key]" />
                          </el-form-item>
                        </el-col>
                      </el-row>
                    </el-form>
                  </div>
                  <div class="chart-area">
                    <VoltageChart
                      ref="diagChartRef"
                      :chart-data="diagChartData"
                      title="诊断电压波形"
                    />
                  </div>
                </div>
              </el-tab-pane>

              <!-- 助力电压 -->
              <el-tab-pane label="助力电压" name="power_assist">
                <div class="voltage-chart-page">
                  <div class="params-panel">
                    <div class="params-header">
                      <div class="params-header-left">
                        <span class="params-title">参数设置 — 助力电压</span>
                        <el-switch
                          v-model="paParams.assistEnableCheckBox"
                          active-text="启用"
                          inactive-text="禁用"
                          inline-prompt
                          class="enable-switch"
                        />
                      </div>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="voltageLoading"
                        @click="applyParams('power_assist')"
                      >
                        应用并刷新
                      </el-button>
                    </div>
                    <el-form :model="paParams" label-width="120px" class="params-form pa-form" size="small">
                      <!-- 低压（常显，5个一排） -->
                      <div class="pa-group">
                        <div class="pa-group-header"><span>低压参数</span></div>
                        <div class="pa-row">
                          <el-form-item v-for="field in paParamFields.filter(f => !f.group && !f.type?.includes('switch') && ['lowVolt','low_hysteresis','diag_time_low','Torque_low','DTC_low'].includes(f.key))" :key="field.key" :label="field.label" class="pa-item">
                            <el-input-number v-if="field.type === 'number'" v-model="paParams[field.key]" :controls="false" class="param-input" />
                            <el-input v-else v-model="paParams[field.key]" maxlength="8" @input="onDtcInput(field.key)" @dragover.prevent @drop="onDropReplace($event, (v) => paParams[field.key] = v)" />
                          </el-form-item>
                        </div>
                      </div>
                      <!-- 欠压（开关控制，参数始终显示但禁用） -->
                      <div class="pa-group">
                        <div class="pa-group-header">
                          <span>欠压参数</span>
                          <el-switch v-model="paParams.use_under_volt" size="small" />
                        </div>
                        <div class="pa-row" :class="{ 'is-disabled': !paParams.use_under_volt }">
                          <el-form-item v-for="field in paParamFields.filter(f => f.group === 'under')" :key="field.key" :label="field.label" class="pa-item">
                            <el-input-number v-if="field.type === 'number'" v-model="paParams[field.key]" :controls="false" class="param-input" :disabled="!paParams.use_under_volt" />
                            <el-input v-else v-model="paParams[field.key]" maxlength="8" :disabled="!paParams.use_under_volt" @input="onDtcInput(field.key)" @dragover.prevent @drop="onDropReplace($event, (v) => paParams[field.key] = v)" />
                          </el-form-item>
                        </div>
                      </div>
                      <!-- 高压（常显，5个一排） -->
                      <div class="pa-group">
                        <div class="pa-group-header"><span>高压参数</span></div>
                        <div class="pa-row">
                          <el-form-item v-for="field in paParamFields.filter(f => !f.group && !f.type?.includes('switch') && ['highVolt','high_hysteresis','diag_time_high','Torque_high','DTC_high'].includes(f.key))" :key="field.key" :label="field.label" class="pa-item">
                            <el-input-number v-if="field.type === 'number'" v-model="paParams[field.key]" :controls="false" class="param-input" />
                            <el-input v-else v-model="paParams[field.key]" maxlength="8" @input="onDtcInput(field.key)" @dragover.prevent @drop="onDropReplace($event, (v) => paParams[field.key] = v)" />
                          </el-form-item>
                        </div>
                      </div>
                      <!-- 过压（开关控制，参数始终显示但禁用） -->
                      <div class="pa-group">
                        <div class="pa-group-header">
                          <span>过压参数</span>
                          <el-switch v-model="paParams.use_over_volt" size="small" />
                        </div>
                        <div class="pa-row" :class="{ 'is-disabled': !paParams.use_over_volt }">
                          <el-form-item v-for="field in paParamFields.filter(f => f.group === 'over')" :key="field.key" :label="field.label" class="pa-item">
                            <el-input-number v-if="field.type === 'number'" v-model="paParams[field.key]" :controls="false" class="param-input" :disabled="!paParams.use_over_volt" />
                            <el-input v-else v-model="paParams[field.key]" maxlength="8" :disabled="!paParams.use_over_volt" @input="onDtcInput(field.key)" @dragover.prevent @drop="onDropReplace($event, (v) => paParams[field.key] = v)" />
                          </el-form-item>
                        </div>
                      </div>
                    </el-form>
                  </div>
                  <div class="chart-area">
                    <VoltageChart
                      ref="paChartRef"
                      :chart-data="paChartData"
                      title="助力电压波形"
                    />
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-tab-pane>

        <!-- ====== Configuration 配置生成 ====== -->
        <el-tab-pane name="config">
          <template #label>
            <span class="tab-label"><el-icon><Document /></el-icon> 配置生成</span>
          </template>
          <div class="sub-page">
            <!-- 配置参数 -->
            <div class="config-section">
              <div class="sub-page-title">配置参数</div>
              <el-form
                :model="configPageData"
                label-width="150px"
                class="config-form"
                size="small"
              >
                <el-form-item
                  v-for="field in visibleConfigFieldDefs"
                  :key="field.key"
                  :label="field.label"
                >
                  <!-- Ready 组合：共用一个信号对象 + On/Off 两个值输入框 -->
                  <template v-if="field.isReadyGroup">
                    <div class="ready-group">
                      <div
                        class="drop-zone signal-name"
                        data-drop-key="config-readySignal"
                        @dragenter.prevent="onConfigDragEnter"
                        @dragover.prevent
                        @dragleave="onConfigDragLeave"
                        @drop="onDropField($event, configPageData, 'readySignal')"
                      >
                        <el-input
                          v-model="configPageData.readySignal"
                          placeholder="DBC 信号名（拖拽）"
                        />
                      </div>
                      <div class="ready-values-row">
                        <div class="ready-value-item">
                          <span class="ready-value-label">On</span>
                          <el-input
                            v-model="configPageData.readyOnValue"
                            placeholder="开启值"
                            class="signal-value-input"
                          />
                        </div>
                        <div class="ready-value-item">
                          <span class="ready-value-label">Off</span>
                          <el-input
                            v-model="configPageData.readyOffValue"
                            placeholder="关闭值"
                            class="signal-value-input"
                          />
                        </div>
                      </div>
                    </div>
                  </template>
                  <!-- 普通信号值双输入框：对象名 + 值 -->
                  <template v-else-if="field.isSignalValue">
                    <div class="signal-value-row">
                      <div
                        class="drop-zone signal-name"
                        :data-drop-key="`config-${field.key}Signal`"
                        @dragenter.prevent="onConfigDragEnter"
                        @dragover.prevent
                        @dragleave="onConfigDragLeave"
                        @drop="onDropField($event, configPageData, field.key + 'Signal')"
                      >
                        <el-input
                          v-model="configPageData[field.key + 'Signal']"
                          placeholder="DBC 信号名（拖拽）"
                        />
                      </div>
                      <el-input
                        v-model="configPageData[field.key + 'Value']"
                        placeholder="值"
                        class="signal-value-input"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <div
                      class="drop-zone"
                      :data-drop-key="`config-${field.key}`"
                      @dragenter.prevent="onConfigDragEnter"
                      @dragover.prevent
                      @dragleave="onConfigDragLeave"
                      @drop="onDropField($event, configPageData, field.key)"
                    >
                      <el-input
                        v-model="configPageData[field.key]"
                        :placeholder="field.placeholder"
                      />
                    </div>
                  </template>
                </el-form-item>
              </el-form>
            </div>

            <!-- 生成结果 -->
            <div class="config-section">
              <div class="sub-page-header">
                <span class="sub-page-title">生成结果</span>
                <el-button
                  type="warning"
                  :icon="Promotion"
                  :loading="generating"
                  :disabled="!currentConfig"
                  @click="onGenerate"
                >
                  生成 CAN 脚本
                </el-button>
              </div>
              <div v-if="generateResult" class="generate-result">
                <el-alert
                  :title="resultMessage"
                  :type="resultSuccess ? 'success' : 'warning'"
                  :closable="false"
                  show-icon
                />
                <el-input
                  v-if="generateResult.output_dir"
                  :model-value="generateResult.output_dir"
                  readonly
                  class="output-path"
                >
                  <template #prepend>输出目录</template>
                  <template #append>
                    <el-button
                      :icon="FolderOpened"
                      @click="handleOpenDir"
                    >
                      打开
                    </el-button>
                  </template>
                </el-input>
                <el-alert
                  v-if="teResultMessage"
                  :title="teResultMessage"
                  :type="teResultSuccess ? 'success' : 'warning'"
                  :closable="false"
                  show-icon
                  class="te-result-alert"
                />
                <pre v-if="previewData" class="code-preview">{{ previewData }}</pre>
              </div>
              <div v-else class="empty-placeholder small">
                <span>点击"生成 CAN 脚本"查看输出结果</span>
              </div>
            </div>
          </div>
        </el-tab-pane>

          </el-tabs>
        </div>

        <ResizableSplitter
          v-if="showObjectPanel"
          direction="horizontal"
          :on-drag="onCanSideDrag"
          show-toggle
          :toggle-icon="panelCollapsed ? Expand : Fold"
          @toggle="panelCollapsed = !panelCollapsed"
        />
      </div>

      <transition name="panel-slide">
        <div v-if="showObjectPanel && !panelCollapsed" class="can-side" :style="{ width: canSideWidth + 'px' }">
          <ObjectPanel
            :dbc-raw="store.objMergedDbcRaw"
            :dtc-raw="dtcRaw"
            :a2l-vars="a2lVars"
            :dbc-env-vars="store.objDbcEnvVars"
            :a2l-qualifier="a2lQualifierForPanel"
            :test-param-cards="testParamCards"
            @collapse="panelCollapsed = true"
            @test-params-change="onTestParamsChange"
            @test-param-configure="onTestParamCardConfigure"
            @test-param-copy="onTestParamCopy"
          />
        </div>
      </transition>
    </div>
  </div>

  <!-- 测试参数卡片「先配置再拖拽」配置弹窗 -->
  <el-dialog
    v-model="cardConfigDialogVisible"
    :title="`配置测试参数 ${editingCardValue}`"
    width="480px"
    append-to-body
  >
    <div class="card-config-body">
      <template v-if="editingCardValue === 'LostTest' || editingCardValue === 'DlcTest'">
        <div class="param-card">
          <el-input v-model="cardConfigForm.dtc" placeholder="请输入DTC" size="large" />
        </div>
      </template>
      <template v-else-if="editingCardValue === 'CRCTest' || editingCardValue === 'CounterTest'">
        <div class="param-card">
          <el-input v-model="cardConfigForm.dtc" placeholder="DTC" size="large" />
        </div>
      </template>
      <template v-else-if="editingCardValue === 'SigInvalidTest'">
        <div class="param-card">
          <el-input v-model="cardConfigForm.dtcValue" placeholder="报DTC的值" size="large" />
        </div>
        <div class="param-card">
          <el-input v-model="cardConfigForm.noDtcValue" placeholder="不报DTC的值" size="large" />
        </div>
        <div class="param-card">
          <el-input v-model="cardConfigForm.dtc" placeholder="DTC" size="large" />
        </div>
        <div class="param-card param-card-inline param-card-right">
          <span class="param-card-label">类型</span>
          <el-radio-group v-model="cardConfigForm.invalidType" size="large">
            <el-radio-button label="SigInvalid">SigInvalid</el-radio-button>
            <el-radio-button label="SigvalueInvalid">SigvalueInvalid</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <template v-else-if="editingCardValue === 'FactorTest'">
        <div class="param-card">
          <el-input v-model="cardConfigForm.variable" placeholder="变量名" size="large" />
        </div>
        <div v-if="!cardConfigForm.autoRange" class="param-card">
          <el-input v-model="cardConfigForm.testValues" placeholder="测试值，逗号分隔" size="large" />
        </div>
        <div class="param-card">
          <el-switch
            v-model="cardConfigForm.autoRange"
            active-text="自动遍历（从最小值到最大值）"
            inactive-text="手动输入"
            size="large"
          />
        </div>
      </template>
    </div>
    <template #footer>
      <el-button @click="cardConfigDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveCardConfig">确定</el-button>
    </template>
  </el-dialog>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, reactive, onMounted, onActivated, onBeforeUnmount, watch, nextTick } from 'vue'

defineOptions({ name: 'CANView' })
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Connection, Link, Warning, Setting, DataLine, Document, Promotion,
  Expand, Fold, Plus, Delete, UploadFilled, Loading, CircleCheck, CircleClose,
  Cpu, Menu, Monitor, FolderOpened, ArrowLeft, QuestionFilled,
} from '@element-plus/icons-vue'
import ConfigToolbar from '@/components/ConfigToolbar.vue'
import DataTable from '@/components/DataTable.vue'
import VoltageChart from '@/components/VoltageChart.vue'
import OemSelector from '@/components/OemSelector.vue'
import ObjectPanel, { type TestParamCard } from '@/components/ObjectPanel.vue'
import DtcCardList from '@/components/DtcCardList.vue'
import DbcSignalTable from '@/components/DbcSignalTable.vue'
import ResizableSplitter from '@/components/ResizableSplitter.vue'
import { parseDbcRecords, parseParamColumns, parseFlatParamCells } from '@/utils/dbc'
import { getChartData, updateParams, generateCAN, parseA2lFile, parseCAN, parseDbcFile, getCrcAlgorithms, exportConfigExcel } from '@/api/can'
import { getConfig, saveConfig, openFolder } from '@/api/config'
import type { Column, VoltageChartData } from '@/types'
import type { DbcTableColumn, DbcTableRow } from '@/types/dbcTable'
import { useModuleStore, DEFAULT_CCP_PRECISION, DEFAULT_CCP_OFFSET, type A2lVars } from '@/stores/modules'
import { useResizableSize } from '@/composables/useResizableSize'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'

// ==================== 状态 ====================

const store = useModuleStore()
const activeTab = ref('dbc')
const activeVoltageTab = ref('communication')
const currentConfig = ref('')
/** 当前内存中数据所归属的配置名（加载/切换过程中为空，用于切换前安全自动保存） */
const loadedConfig = ref('')
/** 配置切换/加载令牌：忽略过期请求，避免快速切换时数据错位 */
let configChangeToken = 0
const voltageLoading = ref(false)
const generating = ref(false)
const generateResult = ref<any>(null)

// 统一文件上传
interface UploadedFile {
  name: string
  type: 'excel' | 'a2l' | 'dbc'
  typeLabel: string
  status: 'parsing' | 'success' | 'error'
}
const uploadedFiles = ref<UploadedFile[]>([])
const unifiedParsing = ref(false)
// A2L 变量：使用全局 store 共享数据（CFG 解析优先加载，上传覆盖刷新）
const a2lVars = computed<A2lVars>({
  get: () => store.objA2lVars,
  set: (v) => store.setA2lVars(v),
})

// 右侧面板
const panelCollapsed = ref(false)
let dragOverKey = ''
let dragOverEl: HTMLElement | null = null

// 树节点选中状态（鼠标点击选中，用于删除）
const selectedTreeNode = ref<any>(null)

// DBC 更新对比：仅对比「上传 DBC」与「配置 DBC」，加载配置不触发高亮
const dbChangeMarks = ref<Record<string, 'new' | 'diff'>>({})

// 测试参数剪贴板（Ctrl+C 从卡片/树上标签复制，Ctrl+V 粘贴到选中对象）
const testParamClipboard = ref<any>(null)

// 用户上传的 DBC/Excel 文件数据（优先级最高）
const dbcRaw = ref<any>(null)

// Json 配置中加载的 DBC Canmatrix 数据（优先级次之）
const jsonDbcRaw = ref<any>(null)

// CFG 目录加载的 DBC 数据 - 使用全局 store 共享（优先级最低）
const cfgDbcRaw = computed<any>({
  get: () => store.objCfgDbcRaw,
  set: (v) => { store.objCfgDbcRaw = v },
})

/** 合并 DBC 数据来源优先级：上传文件 > Json 配置 > CFG 解析 */
const mergedDbcRaw = computed(() => {
  // 1. 用户上传的文件优先
  const uploaded = dbcRaw.value
  if (uploaded && uploaded?.rows?.length > 0) return uploaded
  // 2. 无上传则用 Json 配置中的 DBC
  const jsonCfg = jsonDbcRaw.value
  if (jsonCfg && (jsonCfg.rows?.length > 0 || Object.keys(jsonCfg).length > 0)) return jsonCfg
  // 3. 最后用 CFG 目录加载的
  const cfg = store.objCfgDbcRaw
  if (cfg && cfg?.rows?.length > 0) return cfg
  return null
})

function isDbcArrayFormat(val: any): val is { columns: string[]; rows: any[][] } {
  return val && Array.isArray(val.columns) && Array.isArray(val.rows)
}

// 同步本地 dbcRaw（{columns,rows} 格式时）到全局 store，供其他模块对象浏览器共享
watch(dbcRaw, (v) => {
  store.setUploadDbc(isDbcArrayFormat(v) ? v : null)
}, { deep: false })

// 测试参数存储（key: msgName / msgName:::signalName）
const testParamMap = ref<Map<string, any[]>>(new Map())

function getTestParamsKey(msgName: string, signalName?: string): string {
  return signalName ? `${msgName}:::${signalName}` : msgName
}

const msgTestParamList = [
  { value: 'LostTest', label: 'LostTest', type: 'testParam', target: 'message' },
  { value: 'DlcTest', label: 'DlcTest', type: 'testParam', target: 'message' },
]

const sigTestParamList = [
  { value: 'CRCTest', label: 'CRCTest', type: 'testParam', target: 'signal' },
  { value: 'CounterTest', label: 'CounterTest', type: 'testParam', target: 'signal' },
  { value: 'SigInvalidTest', label: 'SigInvalidTest', type: 'testParam', target: 'signal' },
  { value: 'FactorTest', label: 'FactorTest', type: 'testParam', target: 'signal' },
]

/** 信号级「无效值」类测试参数（自动匹配 / 补全时按“是否已有其中之一”判断） */
const SIG_INVALID_PARAM_VALUES = ['CRCTest', 'CounterTest', 'SigInvalidTest']

// EPS 测试参数卡片 = Counter + CRC 算法（与 Create CANoe 的 GenSigFuncType 一致）
const crcAlgorithms = ref<Array<{ name: string; code: string }>>([])

async function loadCrcAlgorithms() {
  try {
    const res: any = await getCrcAlgorithms()
    crcAlgorithms.value = res?.data?.algorithms || []
  } catch (e: any) {
    console.warn('[CAN] 加载 CRC 算法失败：', e?.message || e)
  }
}

// 卡片配置状态（先配置再拖拽）：key 为卡片 value
const testParamCardConfig = ref<Record<string, Record<string, any>>>({})

/** 测试参数卡片列表（报文 / 信号 / EPS），展示在对象浏览器 */
const testParamCards = computed<TestParamCard[]>(() => {
  const cards: TestParamCard[] = []
  // 报文测试参数
  for (const p of msgTestParamList) {
    cards.push({
      value: p.value,
      label: p.label,
      target: 'message',
      category: 'msg',
      params: testParamCardConfig.value[p.value] || getDefaultParams(p.value),
      configured: !!testParamCardConfig.value[p.value],
    })
  }
  // 信号测试参数
  for (const p of sigTestParamList) {
    cards.push({
      value: p.value,
      label: p.label,
      target: 'signal',
      category: 'sig',
      params: testParamCardConfig.value[p.value] || getDefaultParams(p.value),
      configured: !!testParamCardConfig.value[p.value],
    })
  }
  // EPS 测试参数：Counter + CRC 算法
  cards.push({
    value: 'Counter',
    label: 'Counter',
    target: 'eps',
    category: 'eps',
    configured: false,
  })
  for (const algo of crcAlgorithms.value) {
    cards.push({
      value: algo.name,
      label: algo.name,
      target: 'eps',
      category: 'eps',
      configured: false,
    })
  }
  return cards
})

function getDefaultParams(paramValue: string, msg: any = null, fields: any = null, signalName: string = ''): Record<string, any> {
  const baseDefaults: Record<string, Record<string, any>> = {
    LostTest: { dtc: '' },
    DlcTest: { dtc: '' },
    CRCTest: { dtcValue: '2', noDtcValue: '1', dtc: '' },
    CounterTest: { dtcValue: '1', noDtcValue: '0', dtc: '' },
    SigInvalidTest: { dtcValue: '', noDtcValue: '', dtc: '', invalidType: 'SigInvalid' },
    FactorTest: { variable: '', testValues: '', autoRange: false },
  }
  const params = { ...baseDefaults[paramValue] || {} }

  // 自动填充逻辑
  if (paramValue === 'LostTest' && msg) {
    params.dtc = msg.lostDtc || ''
  }
  if (paramValue === 'DlcTest' && msg) {
    params.dtc = msg.dlcDtc || ''
  }
  if (paramValue === 'SigInvalidTest' && fields) {
    const invalidValue = fields.invalidValue || ''
    // 0x 形式（非法值）默认走 SigvalueInvalid，其余走 SigInvalid
    params.invalidType = invalidValue.toLowerCase().startsWith('0x') ? 'SigvalueInvalid' : 'SigInvalid'
    params.dtcValue = invalidValue
    params.dtc = fields.dtc || ''
    const minPhy = parseFloat(fields.minPhy) || 0
    const maxPhy = parseFloat(fields.maxPhy) || 0
    const rangeCount = Math.floor(maxPhy) - Math.floor(minPhy) + 1
    const MAX_RANGE = 500
    if (rangeCount > 0 && rangeCount <= MAX_RANGE) {
      const rangeValues: string[] = []
      for (let i = Math.floor(minPhy); i <= Math.floor(maxPhy); i++) {
        rangeValues.push(String(i))
      }
      params.noDtcValue = rangeValues.join(', ')
    } else if (rangeCount > MAX_RANGE) {
      params.noDtcValue = `${Math.floor(minPhy)}, ${Math.floor(maxPhy)}`
    }
  }
  if (paramValue === 'FactorTest' && fields) {
    // Excel 导入时若信号存在 XCP/CCP 变量名，自动填入精度偏移测试的监控变量
    params.variable = fields.xcpVar || params.variable || ''
    // 只有 variable 有值时才自动配置 autoRange/testValues，否则保持空
    if (params.variable) {
      const minPhy = parseFloat(fields.minPhy) || 0
      const maxPhy = parseFloat(fields.maxPhy) || 0
      const diff = Math.abs(maxPhy - minPhy)
      // 最大值最小值不超过15，默认遍历
      if (diff <= 15) {
        params.autoRange = true
        params.testValues = ''
      } else {
        // 太大的默认遍历最大最小值，有正负的话中间增加一个0
        params.autoRange = false
        if (minPhy < 0 && maxPhy > 0) {
          params.testValues = `${minPhy}, 0, ${maxPhy}`
        } else {
          params.testValues = `${minPhy}, ${maxPhy}`
        }
      }
    }
  }

  return params
}

/** 从旧 Excel 导入的列自动生成报文级测试参数卡片。
 *  非 EPS 报文默认自带 LostTest / DlcTest 两个测试参数：
 *  - 分别取 lostDtc / dlcDtc 自动填入 DTC；
 *  - 未填 DTC 时保持灰色（未配置）状态，需人工补全或拖拽 DTC 填充。 */
function buildAutoMsgTestParams(msg: any): any[] {
  const params: any[] = []
  // EPS（Tx）报文不生成 LOST / DLC 测试参数
  if (msg?.senders === 'EPS') return params
  const lostDtc = msg?.lostDtc && String(msg.lostDtc).trim() !== '0' ? String(msg.lostDtc).trim() : ''
  const dlcDtc = msg?.dlcDtc && String(msg.dlcDtc).trim() !== '0' ? String(msg.dlcDtc).trim() : ''
  params.push({
    value: 'LostTest',
    label: 'LostTest',
    target: 'message',
    params: { dtc: lostDtc },
    enabled: true,
  })
  params.push({
    value: 'DlcTest',
    label: 'DlcTest',
    target: 'message',
    params: { dtc: dlcDtc },
    enabled: true,
  })
  return params
}

/** 解析 invalid_value（兼容列表字符串如 "[1,2,3]" 与单个值），返回字符串数组 */
function parseInvalidValueList(value: any): string[] {
  if (value === null || value === undefined) return []
  const s = String(value).trim()
  if (!s) return []
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s.replace(/'/g, '"'))
      if (Array.isArray(arr)) return arr.map((v) => String(v).trim()).filter(Boolean)
    } catch { /* ignore */ }
  }
  return [s]
}

/** 解析裸 Data_Type 列的测试值列表（如 "[0,8,15]"），返回字符串数组 */
function parseTestValueList(handler: string): string[] {
  const s = (handler || '').trim()
  if (!s.startsWith('[')) return []
  try {
    const arr = JSON.parse(s.replace(/'/g, '"'))
    if (Array.isArray(arr)) return arr.map((v) => String(v).trim()).filter(Boolean)
  } catch { /* ignore */ }
  return []
}

/** 根据物理最小/最大值生成遍历测试值（ENM/UNM/SNM 处理器用） */
function buildRangeValues(minPhy: any, maxPhy: any): string[] {
  const min = parseFloat(minPhy)
  const max = parseFloat(maxPhy)
  if (Number.isNaN(min) || Number.isNaN(max)) return []
  const lo = Math.floor(min)
  const hi = Math.floor(max)
  if (hi - lo < 0 || hi - lo > 500) return [String(lo), String(hi)]
  const vals: string[] = []
  for (let i = lo; i <= hi; i++) vals.push(String(i))
  return vals
}

/** 旧参数模型 → 新模型的迁移（读取旧配置 / 粘贴旧数据时调用）：
 *  - SigInvalidTest(invalidType=CRC)       → CRCTest
 *  - SigInvalidTest(invalidType=Counter)   → CounterTest
 *  - SigInvalidTest(invalidType=Signal/'') → SigInvalidTest(invalidType=SigInvalid)
 *  - SigvalueInvalidTest                   → SigInvalidTest(invalidType=SigvalueInvalid)
 *  同一 value 重复时保留先出现的（实测历史配置不存在同信号两种无效值参数并存）。 */
function migrateParamList(list: any[] | undefined): any[] {
  if (!Array.isArray(list)) return []
  const out: any[] = []
  const pushUnique = (p: any) => {
    if (out.some((x) => x.value === p.value)) {
      console.warn(`[CAN] 测试参数迁移：忽略重复的 ${p.value}`)
      return
    }
    out.push(p)
  }
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || !raw.value) continue
    const params = { ...(raw.params || {}) }
    const invalidType = String(params.invalidType || '')
    if (raw.value === 'SigInvalidTest' && (invalidType === 'CRC' || invalidType === 'Counter')) {
      const value = invalidType === 'CRC' ? 'CRCTest' : 'CounterTest'
      delete params.invalidType
      pushUnique({ ...raw, value, label: value, params })
    } else if (raw.value === 'SigInvalidTest') {
      params.invalidType = invalidType === 'SigvalueInvalid' ? 'SigvalueInvalid' : 'SigInvalid'
      pushUnique({ ...raw, label: 'SigInvalidTest', params })
    } else if (raw.value === 'SigvalueInvalidTest') {
      pushUnique({ ...raw, value: 'SigInvalidTest', label: 'SigInvalidTest', params: { ...params, invalidType: 'SigvalueInvalid' } })
    } else {
      pushUnique({ ...raw, params })
    }
  }
  return out
}

/** 从旧 Excel 导入的列自动生成信号级测试参数卡片（反译 AutoTool.py
 *  `_generate_Rxsignal_testcases` / `_generate_Txsignal_testcases` 逻辑） */
function buildAutoSigTestParams(fields: any, signalName: string, isEps: boolean): any[] {
  const params: any[] = []
  if (!fields) return params

  const signalType = (fields.signalType || '').trim().toLowerCase()
  const handler = (fields.testDataType || '').trim()
  const dtc = fields.dtc && String(fields.dtc).trim() !== '0' ? String(fields.dtc).trim() : ''
  const invalidRaw = fields.invalidValue != null ? String(fields.invalidValue).trim() : ''
  const invalidValues = parseInvalidValueList(invalidRaw)

  // CRC / Counter 关键词识别（Signal_Type 列优先，纯 DBC 无该列时按信号名兜底）
  const sn = signalName.toLowerCase()
  const crcByType = signalType.includes('crc') || signalType.includes('checksum') || signalType.includes('csum')
  const counterByType = signalType.includes('counter')
  const crcByName = sn.includes('crc') || sn.includes('checksum') || sn.includes('csum')
  const counterByName = sn.includes('counter') || sn.includes('rollcnt') || sn.includes('rolling') || sn.includes('seq') || sn.includes('_cnt') || sn.includes('cnt_')

  // EPS 发送节点（Tx）：参考 _generate_Txsignal_testcases ——
  // 优先 signal_type；纯 DBC 无 Signal_Type 列时，按信号名关键词自动识别 CRC/Counter，
  // 结果落在树形图上供人工核验拖拽覆盖。
  if (isEps) {
    if (crcByType || crcByName) {
      const crcValue = crcByType ? fields.signalType.trim() : 'CRC_CheckSum'
      params.push({
        value: crcValue,
        label: crcValue,
        target: 'eps',
        params: {},
        enabled: true,
      })
    } else if (counterByType || counterByName) {
      params.push({
        value: 'Counter',
        label: 'Counter',
        target: 'eps',
        params: {},
        enabled: true,
      })
    }
    return params
  }

  // 非 EPS（Rx）：参考 _generate_Rxsignal_testcases 处理器分派
  // 1) CRC 信号（ENM + CRC，或按信号名 / Signal_Type 关键词识别）→ 校验和无效（CRCTest）
  if (crcByType || crcByName) {
    params.push({
      value: 'CRCTest',
      label: 'CRCTest',
      target: 'signal',
      params: { dtcValue: '2', noDtcValue: '1', dtc },
      enabled: true,
    })
    return params
  }

  // 2) Counter 信号（BLN + Counter，或按信号名 / Signal_Type 关键词识别）→ 计数器无效（CounterTest）
  if (counterByType || counterByName) {
    params.push({
      value: 'CounterTest',
      label: 'CounterTest',
      target: 'signal',
      params: { dtcValue: '1', noDtcValue: '0', dtc },
      enabled: true,
    })
    return params
  }

  // 3) 布尔型信号（物理最小值=0 且最大值=1）→ 信号无效（SigInvalidTest，类型 SigInvalid）
  const minNum = parseFloat(fields.minPhy)
  const maxNum = parseFloat(fields.maxPhy)
  const isBoolRange = Number.isFinite(minNum) && Number.isFinite(maxNum) && minNum === 0 && maxNum === 1
  if (isBoolRange) {
    params.push({
      value: 'SigInvalidTest',
      label: 'SigInvalidTest',
      target: 'signal',
      params: {
        dtcValue: invalidValues.length > 0 ? invalidValues.join(', ') : '',
        noDtcValue: '0, 1',
        dtc,
        invalidType: 'SigInvalid',
      },
      enabled: true,
    })
    return params
  }

  // 4) 列表处理器：测试值 = 裸 Data_Type 列表；其余按 min/max 遍历
  let factorValues = parseTestValueList(handler)
  if (factorValues.length === 0) {
    factorValues = buildRangeValues(fields.minPhy, fields.maxPhy)
  }

  // 精度偏移测试：存在测试值时才生成
  if (factorValues.length > 0) {
    params.push({
      value: 'FactorTest',
      label: 'FactorTest',
      target: 'signal',
      params: { variable: fields.xcpVar || '', testValues: factorValues.join(', '), autoRange: false },
      enabled: true,
    })
  }

  // 无效值测试：存在 invalid_value 时生成（0x 非法值 → SigvalueInvalid，其余 → SigInvalid）
  if (invalidValues.length > 0) {
    const isHex = /0x/i.test(invalidRaw)
    params.push({
      value: 'SigInvalidTest',
      label: 'SigInvalidTest',
      target: 'signal',
      params: {
        dtcValue: invalidValues.join(', '),
        noDtcValue: factorValues.join(', '),
        dtc,
        invalidType: isHex ? 'SigvalueInvalid' : 'SigInvalid',
      },
      enabled: true,
    })
  }

  return params
}

const selectedTestParamKey = ref<{ msgName: string; signalName?: string; paramValue: string } | null>(null)
const hoveredTreeNode = ref<any>(null)

const selectedTestParam = computed(() => {
  if (!selectedTestParamKey.value) return null
  const { msgName, signalName, paramValue } = selectedTestParamKey.value
  const targetNode = findNodeInTree(treeData.value, msgName, signalName)
  if (!targetNode || !targetNode.testParams) return null
  return targetNode.testParams.find((p: any) => p.value === paramValue) || null
})

// 仅在「报DTC的值」变化时从「不报DTC的值」中移除重复项，避免 deep watch
// 在用户输入 noDtcValue 中间态时反复回写（逗号、空格等被 join 规范化吃掉）。
watch(
  () => selectedTestParam.value?.params?.dtcValue,
  (_newVal) => {
    const param = selectedTestParam.value
    if (!param || param.value !== 'SigInvalidTest') return
    const params = param.params
    const dtcValues = parseValues(params.dtcValue)
    const noDtcValues = parseValues(params.noDtcValue)

    const dtcSet = new Set(dtcValues)
    const filteredNoDtc = noDtcValues.filter((v) => !dtcSet.has(v))
    params.noDtcValue = filteredNoDtc.join(', ')
  }
)

// 切换为自动遍历时清空手动测试值，保证后端按 autoRange 生成遍历用例
watch(
  () => selectedTestParam.value?.params?.autoRange,
  (autoRange) => {
    const param = selectedTestParam.value
    if (!param || param.value !== 'FactorTest') return
    if (autoRange === true) {
      param.params.testValues = ''
    }
  }
)

// 手动输入测试值时自动切回“手动输入”模式
watch(
  () => selectedTestParam.value?.params?.testValues,
  (testValues) => {
    const param = selectedTestParam.value
    if (!param || param.value !== 'FactorTest') return
    if (testValues && String(testValues).trim() !== '') {
      param.params.autoRange = false
    }
  }
)

function parseValues(str: string): string[] {
  if (!str) return []
  return str.split(/[,，\s]+/).filter((v) => v.trim())
}

function findNodeInTree(nodes: any[], msgName: string, signalName?: string): any | null {
  for (const node of nodes) {
    if (signalName) {
      if (node.type === 'signal' && node.name === signalName && node.msg?.msgName === msgName) {
        return node
      }
    } else {
      if (node.type === 'message' && node.name === msgName) {
        return node
      }
    }
    if (node.children?.length) {
      const found = findNodeInTree(node.children, msgName, signalName)
      if (found) return found
    }
  }
  return null
}

const dllRaw = ref<any>(null)

// ==================== Data Link Layer 树形图 ====================
// 字段对齐 Excel 表头（15 列），TRC 和复合字段拆分填值
const DLL_TYPES = [
  'Supply Voltage Compared Failure',
  'High Supply Voltage',
  'Low Supply Voltage',
  'Bus off',
  'Bus',
] as const

// 与 Excel 表头顺序完全一致（输出时使用）
const DLL_COLUMNS = [
  'Item',
  'TRC',
  'DTC Test',
  'Car Mode',
  'Long-Term Memory Test',
  'Usage Mode',
  'ElPowerLevel',
  'DTCAgedLimit',
  'Extend Data',
  'Ubat is lower than 12V',
  'Supply Voltage Compared Failure',
  'voltage out range',
  'FDC10 Test',
  'UnconfirmedDTCLimit Test',
  'CanSMBorTimeTxEnsured',
] as const

interface DllNodeData {
  Item: string
  'DTC Test': string
  // TRC 拆分子字段（电压/BUS 通用）
  StepUpValue: string
  TestPeriod: string
  StepDownValue: string
  Vlot: string
  confirmedDTCLimit: string
  UnconfirmedDTCLimit: string
  agedDTCLimit: string
  // BusOff 专用：aged
  aged: string
  // Car Mode 拆分（[[...],[...]] → 两个子数组）
  'Car Mode 1': string
  'Car Mode 2': string
  'Long-Term Memory Test': string
  // Usage Mode 拆分
  'Usage Mode 1': string
  'Usage Mode 2': string
  // ElPowerLevel 拆分
  'ElPowerLevel 1': string
  'ElPowerLevel 2': string
  DTCAgedLimit: string
  'Extend Data': string
  'Ubat is lower than 12V': string
  'Supply Voltage Compared Failure': string
  'voltage out range': string
  'FDC10 Test': string
  'UnconfirmedDTCLimit Test': string
  'CanSMBorTimeTxEnsured': string
}

interface DllTreeNode {
  id: string
  label: string
  type: 'dll-item'
  data: DllNodeData
}

const dllTreeData = ref<DllTreeNode[]>([])
const selectedDllNode = ref<DllTreeNode | null>(null)
const dllTypeDialogVisible = ref(false)
const pendingDtcDrop = ref('')
// 链路层层级导航：types（测试类型列表）→ items（类型下 DTC 列表 + 配置同页）
const dllNavLevel = ref<'types' | 'items'>('types')
const dllSelectedType = ref<string>('')

/** 获取指定类型下的所有 DTC 节点 */
function nodesOfDllType(type: string): DllTreeNode[] {
  return dllTreeData.value.filter((n) => n.data.Item === type)
}

/** 统计指定类型下的 DTC 数量 */
function countDllByType(type: string): number {
  return nodesOfDllType(type).length
}

/** 进入某类型，显示该类型下 DTC 列表，并自动选中第一个 */
function dllOpenType(type: string) {
  dllSelectedType.value = type
  dllNavLevel.value = 'items'
  const list = nodesOfDllType(type)
  selectedDllNode.value = list.length ? list[0] : null
}

/** 面包屑点击「链路层」回到类型根目录 */
function dllNavToRoot() {
  dllNavLevel.value = 'types'
  dllSelectedType.value = ''
  selectedDllNode.value = null
}

/** 返回上一层按钮 */
function dllGoBack() {
  if (dllNavLevel.value === 'items') {
    dllNavLevel.value = 'types'
    dllSelectedType.value = ''
    selectedDllNode.value = null
  }
}

/** 判断是否为电压相关测试 */
function isVoltageTest(item: string): boolean {
  return item.includes('Supply Voltage')
}

/** 判断是否为 BusOff 测试（后端 self.Case 按 8 元素访问，需与电压类一致） */
function isBusOffTest(item: string): boolean {
  return item.toLowerCase().replace(/\s/g, '') === 'busoff'
}

/** 判断是否为 BUS 测试（后端 BusCase 按 6 元素访问） */
function isBusTest(item: string): boolean {
  return item === 'Bus'
}

/** 创建空的 DllNodeData */
function createEmptyDllData(): DllNodeData {
  return {
    Item: '',
    'DTC Test': '',
    StepUpValue: '',
    TestPeriod: '',
    StepDownValue: '',
    Vlot: '',
    confirmedDTCLimit: '',
    UnconfirmedDTCLimit: '',
    agedDTCLimit: '',
    aged: '1',
    'Car Mode 1': '1,2,3',
    'Car Mode 2': '0,5',
    'Long-Term Memory Test': '',
    'Usage Mode 1': '',
    'Usage Mode 2': '',
    'ElPowerLevel 1': '',
    'ElPowerLevel 2': '',
    DTCAgedLimit: '',
    'Extend Data': '',
    'Ubat is lower than 12V': '',
    'Supply Voltage Compared Failure': '',
    'voltage out range': '',
    'FDC10 Test': '',
    'UnconfirmedDTCLimit Test': '',
    'CanSMBorTimeTxEnsured': '',
  }
}

function dllTypeTagType(item: string): '' | 'success' | 'warning' | 'info' | 'danger' {
  if (item.includes('Supply Voltage')) return 'warning'
  if (item.toLowerCase().includes('busoff')) return 'danger'
  if (item === 'Bus') return 'info'
  return ''
}

/** 将逗号分隔字符串转为数组字符串：'1,2,3' → '[1,2,3]' */
function toListStr(val: string): string {
  const v = (val || '').trim()
  if (!v) return ''
  // 已是 [..] 格式直接返回
  if (v.startsWith('[')) return v
  return '[' + v + ']'
}

/** 将 [[...],[...]] 拆分为两个子数组字符串 */
function splitNestedArray(val: string): [string, string] {
  const v = (val || '').trim()
  if (!v) return ['', '']
  // 去掉最外层 []
  let inner = v
  if (inner.startsWith('[') && inner.endsWith(']')) {
    inner = inner.slice(1, -1).trim()
  }
  // 找到第一个不在 [] 内的逗号作为两组分隔符，兼容 [[a],[b]]、[[],[b]]、[,[b]]、[[a],] 等格式
  let depth = 0
  let splitIdx = -1
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '[') depth++
    else if (ch === ']') depth--
    else if (ch === ',' && depth === 0) { splitIdx = i; break }
  }
  if (splitIdx < 0) return [v, '']
  const strip = (s: string) => {
    let t = s.trim()
    if (t.startsWith('[') && t.endsWith(']')) t = t.slice(1, -1).trim()
    return t
  }
  return [strip(inner.slice(0, splitIdx)), strip(inner.slice(splitIdx + 1))]
}

/** 将两个子数组字符串组合为 [[...],[...]] */
function joinNestedArray(part1: string, part2: string): string {
  const v1 = (part1 || '').trim()
  const v2 = (part2 || '').trim()
  if (!v1 && !v2) return ''
  // 某组为空时保留空数组 []，避免输出成 "[, [..]]" 丢失空组
  const p1 = v1 ? toListStr(v1) : '[]'
  const p2 = v2 ? toListStr(v2) : '[]'
  return '[' + p1 + ',' + p2 + ']'
}

/** 根据 Item 类型组合 TRC 字符串 */
function composeTrc(d: DllNodeData): string {
  const dtcId = d['DTC Test'] || ''
  // 空值用 0 占位，保证 TRC 固定元素数量，避免后端 ast.literal_eval 后按索引访问越界
  const fill = (p: string) => (p && String(p).trim() !== '') ? String(p).trim() : '0'
  if (isVoltageTest(d.Item)) {
    // 电压相关：[StepUpValue, TestPeriod, StepDownValue, Vlot, confirmedDTCLimit, UnconfirmedDTCLimit, agedDTCLimit, DTCid]
    const parts = [
      d.StepUpValue, d.TestPeriod, d.StepDownValue, d.Vlot,
      d.confirmedDTCLimit, d.UnconfirmedDTCLimit, d.agedDTCLimit, dtcId,
    ]
    if (parts.every(p => !p)) return ''
    return '[' + parts.map(fill).join(',') + ']'
  }
  if (isBusOffTest(d.Item)) {
    // BusOff：[StepUpValue, StepDownValue, TestPeriod, confirmedDTCLimit, UnconfirmedDTCLimit, agedDTCLimit, aged, DTCid]
    const parts = [
      d.StepUpValue, d.StepDownValue, d.TestPeriod,
      d.confirmedDTCLimit, d.UnconfirmedDTCLimit, d.agedDTCLimit, d.aged, dtcId,
    ]
    if (parts.every(p => !p)) return ''
    return '[' + parts.map(fill).join(',') + ']'
  }
  if (isBusTest(d.Item)) {
    // BUS：[StepUpValue, StepDownValue, confirmedDTCLimit, UnconfirmedDTCLimit, agedDTCLimit, DTCid]
    const parts = [
      d.StepUpValue, d.StepDownValue,
      d.confirmedDTCLimit, d.UnconfirmedDTCLimit, d.agedDTCLimit, dtcId,
    ]
    if (parts.every(p => !p)) return ''
    return '[' + parts.map(fill).join(',') + ']'
  }
  return ''
}

/** 从 TRC 字符串解析到子字段 */
function parseTrc(trc: string, item: string, d: DllNodeData) {
  const v = (trc || '').trim()
  if (!v) return
  // 去除首尾 []
  const inner = v.replace(/^\[/, '').replace(/\]$/, '')
  const parts = inner.split(',').map(s => s.trim())
  if (isVoltageTest(item) && parts.length >= 8) {
    d.StepUpValue = parts[0]
    d.TestPeriod = parts[1]
    d.StepDownValue = parts[2]
    d.Vlot = parts[3]
    d.confirmedDTCLimit = parts[4]
    d.UnconfirmedDTCLimit = parts[5]
    d.agedDTCLimit = parts[6]
    // parts[7] 为 DTCid，已在 DTC Test 字段
  } else if (isBusOffTest(item) && parts.length >= 8) {
    // BusOff 新格式：[StepUpValue, StepDownValue, TestPeriod, confirmedDTCLimit, UnconfirmedDTCLimit, agedDTCLimit, aged, DTCid]
    d.StepUpValue = parts[0]
    d.StepDownValue = parts[1]
    d.TestPeriod = parts[2]
    d.confirmedDTCLimit = parts[3]
    d.UnconfirmedDTCLimit = parts[4]
    d.agedDTCLimit = parts[5]
    d.aged = parts[6]
  } else if (isBusOffTest(item) && parts.length >= 6) {
    // BusOff 历史 6 元素兼容：[StepUpValue, StepDownValue, confirmedDTCLimit, UnconfirmedDTCLimit, agedDTCLimit, DTCid]
    d.StepUpValue = parts[0]
    d.StepDownValue = parts[1]
    d.confirmedDTCLimit = parts[2]
    d.UnconfirmedDTCLimit = parts[3]
    d.agedDTCLimit = parts[4]
  } else if (isBusTest(item) && parts.length >= 6) {
    d.StepUpValue = parts[0]
    d.StepDownValue = parts[1]
    d.confirmedDTCLimit = parts[2]
    d.UnconfirmedDTCLimit = parts[3]
    d.agedDTCLimit = parts[4]
    // parts[5] 为 DTCid
  }
}

/** 从对象浏览器拖拽 DTC 到 DLL 树形图 */
function onDllDrop(e: DragEvent) {
  e.preventDefault()
  // 优先解析 application/json（ObjectPanel 拖拽格式）
  const jsonStr = e.dataTransfer?.getData('application/json') || ''
  let dtcCode = ''
  if (jsonStr) {
    try {
      const payload = JSON.parse(jsonStr)
      // ObjectPanel DTC 拖拽：payload.type === 'dtc'，code 为 DTC ID
      if (payload.type === 'dtc' && payload.code) {
        dtcCode = payload.code
      } else if (payload.name) {
        dtcCode = payload.name
      }
    } catch { /* ignore */ }
  }
  // 兜底：使用 text/plain
  if (!dtcCode) {
    dtcCode = e.dataTransfer?.getData('text/plain') || ''
  }
  if (!dtcCode) return
  pendingDtcDrop.value = dtcCode
  dllTypeDialogVisible.value = true
}

function onDllTypeSelect(type: string) {
  const newNode: DllTreeNode = {
    id: `dll-${Date.now()}`,
    label: `${pendingDtcDrop.value} [${type}]`,
    type: 'dll-item',
    data: {
      ...createEmptyDllData(),
      Item: type,
      'DTC Test': pendingDtcDrop.value,
    },
  }
  dllTreeData.value.push(newNode)
  dllTypeDialogVisible.value = false
  selectedDllNode.value = newNode
  // 拖入后进入该类型视图，并选中新节点
  dllSelectedType.value = type
  dllNavLevel.value = 'items'
}

function onDllNodeClick(data: any) {
  selectedDllNode.value = data as DllTreeNode
}

function onDllTypeChange() {
  if (selectedDllNode.value) {
    selectedDllNode.value.label = `${selectedDllNode.value.data['DTC Test']} [${selectedDllNode.value.data.Item}]`
    dllSelectedType.value = selectedDllNode.value.data.Item
  }
}

function removeDllNode() {
  if (!selectedDllNode.value) return
  const id = selectedDllNode.value.id
  const type = selectedDllNode.value.data.Item
  dllTreeData.value = dllTreeData.value.filter((n) => n.id !== id)
  selectedDllNode.value = null
  // 删除后选中该类型剩余第一个（仍留在同页），无剩余则清空
  dllSelectedType.value = type
  dllNavLevel.value = 'items'
  const list = nodesOfDllType(type)
  selectedDllNode.value = list.length ? list[0] : null
}

/** DTC 复制剪贴板：Ctrl+C 存选中 DTC 的配置，Ctrl+V 粘贴生成新 DTC（快捷键在统一层注册） */
const dllClipboard = ref<DllNodeData | null>(null)

/** 从树形图重建 dllRaw（{columns, rows} 格式，列顺序与 Excel 一致） */
function buildDllRawFromTree(): any {
  const columns = [...DLL_COLUMNS]
  const rows = dllTreeData.value.map((node) => {
    const d = node.data
    // 组合 TRC
    const trc = composeTrc(d)
    // 组合复合字段
    const carMode = joinNestedArray(d['Car Mode 1'], d['Car Mode 2'])
    const usageMode = joinNestedArray(d['Usage Mode 1'], d['Usage Mode 2'])
    const elPowerLevel = joinNestedArray(d['ElPowerLevel 1'], d['ElPowerLevel 2'])
    // 按 DLL_COLUMNS 顺序输出
    return DLL_COLUMNS.map((col) => {
      if (col === 'TRC') return trc
      if (col === 'Car Mode') return carMode
      if (col === 'Usage Mode') return usageMode
      if (col === 'ElPowerLevel') return elPowerLevel
      return (d as any)[col] ?? ''
    })
  })
  return { columns, rows }
}

/** 从 dllRaw 构建树形图（解析 Excel 格式到拆分字段） */
function buildDllTreeFromRaw(raw: any) {
  if (!raw?.rows) {
    dllTreeData.value = []
    return
  }
  const cols = raw.columns || []
  // 列名规范化：将换行/制表符/连续空白统一为单个空格（Excel 表头常含换行）
  const normalizeCol = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim()
  // 按列名查找索引（规范化后精确匹配优先，模糊匹配兜底）
  const findColIdx = (name: string): number => {
    const key = normalizeCol(name)
    let idx = cols.findIndex((c: string) => normalizeCol(c) === key)
    if (idx < 0) {
      const lowerKey = key.toLowerCase()
      idx = cols.findIndex((c: string) => normalizeCol(c).toLowerCase().includes(lowerKey))
    }
    return idx
  }
  const idxMap: Record<string, number> = {}
  for (const key of DLL_COLUMNS) idxMap[key] = findColIdx(key)

  dllTreeData.value = raw.rows.map((row: any[], i: number) => {
    const get = (key: string) => {
      const idx = idxMap[key]
      return idx >= 0 ? String(row[idx] ?? '') : ''
    }
    const item = get('Item').trim()
    const dtcCode = get('DTC Test').trim()
    const data = createEmptyDllData()
    data.Item = item
    data['DTC Test'] = dtcCode
    // 解析 TRC 到子字段
    parseTrc(get('TRC'), item, data)
    // 拆分复合字段
    const [cm1, cm2] = splitNestedArray(get('Car Mode'))
    data['Car Mode 1'] = cm1
    data['Car Mode 2'] = cm2
    const [um1, um2] = splitNestedArray(get('Usage Mode'))
    data['Usage Mode 1'] = um1
    data['Usage Mode 2'] = um2
    const [ep1, ep2] = splitNestedArray(get('ElPowerLevel'))
    data['ElPowerLevel 1'] = ep1
    data['ElPowerLevel 2'] = ep2
    // 其他字段直接映射
    data['Long-Term Memory Test'] = get('Long-Term Memory Test')
    data.DTCAgedLimit = get('DTCAgedLimit')
    data['Extend Data'] = get('Extend Data')
    data['Ubat is lower than 12V'] = get('Ubat is lower than 12V')
    data['Supply Voltage Compared Failure'] = get('Supply Voltage Compared Failure')
    data['voltage out range'] = get('voltage out range')
    data['FDC10 Test'] = get('FDC10 Test')
    data['UnconfirmedDTCLimit Test'] = get('UnconfirmedDTCLimit Test')
    data['CanSMBorTimeTxEnsured'] = get('CanSMBorTimeTxEnsured')
    return {
      id: `dll-${i}`,
      label: `${dtcCode} [${item}]`,
      type: 'dll-item' as const,
      data,
    }
  })
}
// DTC 数据：使用全局 store 共享（上传 Excel DTC 覆盖刷新，供所有模块对象浏览器使用）
const dtcRaw = computed<any>({
  get: () => store.objDtcRaw,
  set: (v) => store.setDtc(v),
})

// DBC 搜索
const dbcSearch = ref('')

/** 报文信号树搜索过滤：匹配报文名/信号名/报文ID/属性名等 */
function filterDbcTreeNode(value: string, data: any): boolean {
  if (!value) return true
  const kw = String(value).toLowerCase()
  if ((data.label || '').toLowerCase().includes(kw)) return true
  if ((data.name || '').toLowerCase().includes(kw)) return true
  if (data.type === 'message' && data.msg?.msgId !== undefined) {
    if (String(data.msg.msgId).toLowerCase().includes(kw)) return true
  }
  if (data.type === 'attr') {
    if ((data.tableKey || '').toLowerCase().includes(kw)) return true
    if (String(data.value ?? '').toLowerCase().includes(kw)) return true
  }
  return false
}

watch(dbcSearch, (kw) => {
  const tree = mainDbcTreeRef.value
  if (!tree) return
  tree.filter(kw)
  nextTick(() => {
    if (kw) {
      // 搜索时展开所有节点，确保深层匹配项（如信号属性）可见
      const ids: string[] = []
      const walk = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.children?.length) {
            ids.push(n.id)
            walk(n.children)
          }
        }
      }
      walk(treeData.value)
      treeExpandedKeys.value = ids
    } else {
      initTreeExpandedKeys()
    }
  })
})

// Other / Configuration 表单数据
const otherData = ref<Record<string, any>>({})
const configPageData = ref<Record<string, any>>({})

// 对象浏览器 A2L Qualifier：优先使用配置中的 qualifier，回退到 store（CFG 解析）
const a2lQualifierForPanel = computed(() => configPageData.value.a2lQualifier || store.objA2lQualifier || '')

// ==================== 默认电压参数（与后端 CANModule 默认值保持一致） ====================

const DEFAULT_COMM_PARAMS: Record<string, any> = {
  commEnableCheckBox: true,
  normVolt: 12.0,
  underVolt: 6.0,
  overVolt: 18.0,
  Hhysteresis_v: 1.0,
  Lhysteresis_v: 0.5,
  tcaninit_min: 200,
  tcaninit_max: 1000,
  tcanstop_min: 0,
  tcanstop_max: 100,
  init_is_range: true,
  stop_is_range: true,
  // 兼容后端 excel_processor 旧 key
  tcaninit: 200,
  tcanstop: 100,
  init_range_check: true,
  stop_range_check: true,
}

const DEFAULT_DIAG_PARAMS: Record<string, any> = {
  diagEnableCheckBox: true,
  normVolt: 12.0,
  minVolt: 8.0,
  maxVolt: 16.0,
  hysteresis: 0.5,
  diag_start_min: 100,
  diag_start_max: 100,
  start_is_range: false,
  diag_recovery_min: 100,
  diag_recovery_max: 100,
  recovery_is_range: false,
}

const DEFAULT_PA_PARAMS: Record<string, any> = {
  assistEnableCheckBox: true,
  normVolt: 12.0,
  lowVolt: 9.0,
  low_hysteresis: 0.5,
  diag_time_low: 150,
  Torque_low: 50,
  DTC_low: 'P0562',
  use_under_volt: false,
  underVolt: 6.0,
  under_hysteresis: 0.5,
  diag_time_under: 100,
  Torque_under: 30,
  DTC_under: 'P056',
  highVolt: 16.0,
  high_hysteresis: 0.5,
  diag_time_high: 100,
  Torque_high: 50,
  DTC_high: 'P0563',
  use_over_volt: false,
  overVolt: 18.3,
  over_hysteresis: 1.0,
  diag_time_over: 200,
  Torque_over: 30,
  DTC_over: 'P0563',
}

// 电压参数与图表数据
const commParams = ref<Record<string, any>>({ ...DEFAULT_COMM_PARAMS })
const diagParams = ref<Record<string, any>>({ ...DEFAULT_DIAG_PARAMS })
const paParams = ref<Record<string, any>>({ ...DEFAULT_PA_PARAMS })

const commChartData = ref<VoltageChartData | null>(null)
const diagChartData = ref<VoltageChartData | null>(null)
const paChartData = ref<VoltageChartData | null>(null)

// 图表组件引用（用于 tab 切换后手动 resize，避免在隐藏容器中初始化导致尺寸为 0）
const commChartRef = ref<any>(null)
const diagChartRef = ref<any>(null)
const paChartRef = ref<any>(null)

// 配置工具栏引用（新建后刷新配置列表）
const configToolbarRef = ref<any>(null)

// Other 表复选框状态
const otherCheckboxStates = ref<Record<string, boolean>>({})

// ==================== 字段定义 ====================

const commParamFields = [
  { key: 'normVolt', label: '正常电压 (V)', type: 'number' },
  { key: 'underVolt', label: '欠压 (V)', type: 'number' },
  { key: 'overVolt', label: '过压 (V)', type: 'number' },
  { key: 'Hhysteresis_v', label: '高迟滞 (V)', type: 'number' },
  { key: 'Lhysteresis_v', label: '低迟滞 (V)', type: 'number' },
  { key: 'tcaninit_min', label: 'CAN初始化最小 (ms)', type: 'number' },
  { key: 'tcaninit_max', label: 'CAN初始化最大 (ms)', type: 'number' },
  { key: 'tcanstop_min', label: 'CAN停止最小 (ms)', type: 'number' },
  { key: 'tcanstop_max', label: 'CAN停止最大 (ms)', type: 'number' },
  { key: 'init_is_range', label: '初始化范围', type: 'switch' },
  { key: 'stop_is_range', label: '停止范围', type: 'switch' },
]

const diagParamFields = [
  { key: 'normVolt', label: '正常电压 (V)', type: 'number' },
  { key: 'minVolt', label: '最小电压 (V)', type: 'number' },
  { key: 'maxVolt', label: '最大电压 (V)', type: 'number' },
  { key: 'hysteresis', label: '迟滞 (V)', type: 'number' },
  { key: 'diag_start_min', label: '开始最小时间 (ms)', type: 'number' },
  { key: 'diag_start_max', label: '开始最大时间 (ms)', type: 'number' },
  { key: 'start_is_range', label: '开始范围', type: 'switch' },
  { key: 'diag_recovery_min', label: '恢复最小时间 (ms)', type: 'number' },
  { key: 'diag_recovery_max', label: '恢复最大时间 (ms)', type: 'number' },
  { key: 'recovery_is_range', label: '恢复范围', type: 'switch' },
]

const paParamFields = [
  // 低压（常显）
  { key: 'lowVolt', label: '低压阈值 (V)', type: 'number' },
  { key: 'low_hysteresis', label: '低压迟滞 (V)', type: 'number' },
  { key: 'diag_time_low', label: '低压诊断时间 (ms)', type: 'number' },
  { key: 'Torque_low', label: '低压助力', type: 'number' },
  { key: 'DTC_low', label: '低压DTC', type: 'text' },
  // 欠压（开关控制）
  { key: 'underVolt', label: '欠压阈值 (V)', type: 'number', group: 'under' },
  { key: 'under_hysteresis', label: '欠压迟滞 (V)', type: 'number', group: 'under' },
  { key: 'diag_time_under', label: '欠压诊断时间 (ms)', type: 'number', group: 'under' },
  { key: 'Torque_under', label: '欠压助力', type: 'number', group: 'under' },
  { key: 'DTC_under', label: '欠压DTC', type: 'text', group: 'under' },
  // 高压（常显）
  { key: 'highVolt', label: '高压阈值 (V)', type: 'number' },
  { key: 'high_hysteresis', label: '高压迟滞 (V)', type: 'number' },
  { key: 'diag_time_high', label: '高压诊断时间 (ms)', type: 'number' },
  { key: 'Torque_high', label: '高压助力', type: 'number' },
  { key: 'DTC_high', label: '高压DTC', type: 'text' },
  // 过压（开关控制）
  { key: 'overVolt', label: '过压阈值 (V)', type: 'number', group: 'over' },
  { key: 'over_hysteresis', label: '过压迟滞 (V)', type: 'number', group: 'over' },
  { key: 'diag_time_over', label: '过压诊断时间 (ms)', type: 'number', group: 'over' },
  { key: 'Torque_over', label: '过压助力', type: 'number', group: 'over' },
  { key: 'DTC_over', label: '过压DTC', type: 'text', group: 'over' },
]

interface ConfigFieldDef {
  key: string
  label: string
  placeholder?: string
  isSignalValue?: boolean
  isReadyGroup?: boolean
}

const configFieldDefs: ConfigFieldDef[] = [
  { key: 'cddQualifier', label: 'CDD_Qualifier', placeholder: 'CDD在CANoe工程中的Name（非文件名）' },
  { key: 'a2lQualifier', label: 'A2L_Qualifier', placeholder: 'A2L ECU 名称（如 ECUAPP_A32Z_1482）' },
  { key: 'batteryVoltage', label: 'Battery_Voltage', placeholder: '内部电压变量名' },
  { key: 'torqueLimit', label: 'Torque_limit', placeholder: '内部助力变量名' },
  { key: 'ready', label: 'Ready', isReadyGroup: true },
  { key: 'carMode', label: 'Car_Mode', placeholder: 'Car Mode 信号名（拖拽）' },
  { key: 'usageMode', label: 'Usage_Mode', placeholder: 'Usage Mode 信号名（拖拽）' },
  { key: 'elPowerLevel', label: 'ElPowerLevel', placeholder: 'ElPowerLevel 信号名（拖拽）' },
  { key: 'ubat', label: 'Ubat', placeholder: 'Ubat 信号名（拖拽）' },
]

/** 链路层信号名字段仅在 GEEA_3.0（吉利3.0）显示；有刷模式不使用 A2L 限定符 */
const visibleConfigFieldDefs = computed(() => {
  const fields = store.selectedOem === 'GEEA_3.0'
    ? configFieldDefs
    : configFieldDefs.filter(f => !['carMode', 'usageMode', 'elPowerLevel', 'ubat'].includes(f.key))
  if (store.canMotorMode === 'brushed') return fields.filter(f => f.key !== 'a2lQualifier')
  return fields
})

/** Other 表字段定义（checkbox + 多输入框） */
interface OtherInputDef {
  key: string
  placeholder: string
  type?: 'text' | 'select'
  /** 输入校验类型：int=仅整数，hex=16进制（0x 前缀），uds=UDS 指令字节序列 */
  validate?: 'int' | 'hex' | 'uds'
  /** type=select 时的开关取值与文案（默认 TRUE / FALSE） */
  activeValue?: string
  inactiveValue?: string
  activeText?: string
  inactiveText?: string
  /** 卡片 layout='rows' 时占的列数（12 列栅格）；同组参数占满 12 列即各占一行 */
  span?: number
}
interface OtherFieldDef {
  key: string
  label: string
  inputs: OtherInputDef[]
  /** 'rows' = 内部按 12 列栅格排布，靠 span 让每组参数各占一行；'break' = 强制从第 1 列开始（该卡另起一行） */
  layout?: 'rows' | 'break'
  /** 覆盖卡片尺寸，取值为 `.other-card--span-<列>x<行>` 的 `<列>x<行>`（如 '3x2'）；不填则按输入框数量自动取 */
  span?: string
}

/** Group 卡片：拖拽 DBC 对象生成多组参数 */
interface GroupDef {
  id: string
  values: Record<string, string>
}
interface GroupCardDef {
  key: string
  label: string
  groupFields: Array<{ key: string; placeholder: string; type?: 'text' | 'hex' }>
  groups: GroupDef[]
}

/** Hex ID 卡片 */
interface HexIdCardDef {
  key: string
  label: string
  placeholder: string
}

/** 纯参数卡片：只有一个输入框、没有开关 */
interface ParamCardDef {
  key: string
  label: string
  placeholder: string
  /** 输入校验类型：int=仅整数，hex=16进制（0x 前缀） */
  validate?: 'int' | 'hex'
}

/** Compound 滑块卡片：集中放多个 TRUE/FALSE 开关 */
interface CompoundSliderDef {
  key: string
  label: string
  sliders: Array<{ key: string; label: string }>
}

/** 其他配置各测试项卡片的「使用说明」文案（key = 卡片 key），卡片右上角「?」点击展示。
 *  参考后端用例生成逻辑与 CAPL 实现编写，如需调整直接修改此处文本即可。 */
const OTHER_CARD_DOCS: Record<string, string> = {
  ack: 'ACK\n开启后生成 ACK_time 用例：上电（IG ON）后等待 ECU 对接收报文 ACK 置位，实测置位时间不超过所填「ACK时间」则通过；10s 内未检测到 ACK 置位判失败。\n\n参数：ACK时间（ms）。',
  init: 'Init\n开启后生成 Init_time 用例：上电后等待 ECU 发出第一帧 Tx 报文，实测初始化时间不超过所填「init时间」则通过；10s 内未收到任何 Tx 报文判失败。\n\n参数：init时间（ms）。',
  allMsgTx: 'AllmsgTx\n开启后生成 TxmessageAll_time 用例：上电后等待 ECU 的所有 Tx 报文各发送一次，实测总耗时不超过所填值则通过；10s 内未发完判失败。\n\n参数：发出所有报文的时间（ms）。',
  dataframeId: 'DataframeID\n开启后生成 DataframeID 用例：用例执行期间监听总线上所有报文，若出现 ID 超出所填位数（11 位 → 0x7FF）的报文则失败，用于校验 ECU 发送的报文标识符位数。\n\n参数：ID的位数（如 11）。',
  busoffDiagStartTime: 'Busoff_DiagStartTime\n开启后生成 Busoff_DiagStartTime 用例：制造 BusOff 并恢复后逐个注入故障，检查 BusOff 恢复后所填时间内故障不应被诊断（网络诊断未开启），超过该时间后才应能读到对应 DTC。\n\n参数：busoff恢复诊断时间（ms）。',
  igonDiagStartTime: 'IGON_DiagStartTime\n开启后生成 IGON_DiagStartTime 用例：IG OFF 后重新 IG ON 并逐个注入故障，检查 IG ON 后所填时间内故障不应被诊断，超过该时间后才应能读到对应 DTC（即网络诊断在 IG ON 后延迟所填时间开启）。\n\n参数：IGON开启诊断时间（ms）。',
  igoffDiagStopTime: 'IGOFF_DiagStopTime\n开启后生成 IGOFF_DiagStopTime 用例：逐个注入故障并在 IG OFF 后等待所填时间，检查此时故障已不再被诊断（网络诊断已停止）。\n\n参数：IGOFF关闭诊断时间（ms）。',
  powerDownDiagStop: 'PowerDown_DiagStop\n开启后生成 PowerDown_Diag 用例：IG ON 后等待所填时间，确认诊断已开启（注入各类故障应无故障误报）；随后 IG OFF 再等待所填时间，确认诊断已停止。\n\n参数：检测结果的等待时间（ms）。',
  highBusLoadTxatt: 'HighBusLoad_Txatt\n开启后生成 HighBusLoad_Txatt 用例：把总线负载逐步加到所填负载率，分别用 0x7FF 与 1 两种 ID 发送负载报文，检查 ECU 报文仍能正常发送则通过。\n\n参数：负载率（%）。',
  highBusLoadCommunication: 'HighBusLoad_communication\n开启后生成 HighBusLoad_communication 用例：把总线负载加到所填负载率并持续观察，检查总线未出现错误帧则通过。\n\n参数：负载率（%）。',
  highBusLoadDiag: 'HighBusLoad_Diag\n开启后生成 HighBusLoad_Diag 用例：先用 14 FF FF FF 清除故障并确认无当前历史网络故障，再模拟高优先级报文把总线负载加到所填负载率并持续 1min，随后读全部故障码并检查外发故障灯，要求无当前历史故障码且故障灯 = 0x0；最后停止模拟负载。\n\n参数：负载率（%）。',
  dtcAged: 'DTCAged\n开启后生成 DTC_Aged 用例：逐个制造 Fault_array 中的每个故障，确认能报出对应 DTC，同时把全部故障 DTC 去重汇总成白名单；随后按所填次数反复上下电做「老化」，每次都用 mask=8 断言这些 DTC 仍作为历史故障存在；最后再上下电一次，断言当前与历史故障码已全部清除（掩码 9）。\n\n参数：老化上下电次数（次）。',
  minDelayTime: 'Min_delayTime\n开启后生成 Min_delayTime 用例：对每个 Tx 报文统计同一 ID 报文的最小发送间隔，实测最小间隔小于所填值则失败。\n\n参数：最小间隔时间（ms，整数）。',
  shutdown: 'Shutdown\n开启后生成 Shutdown_time 用例：Ready_Off 后 IG OFF，检查通信停止时间是否落在所填 [minTime, maxTime] 区间内，超出区间判失败。\n\n参数：下电诊断停止 minTime / maxTime（ms）。',
  busOff: 'tBusOff\n开启后按三组参数生成 BusOff 相关用例：\n\n① 快恢复（tbusoffquickNum / tquickmin / tquickmax）\n生成 BusOff_quick_recovery 用例：连续制造 BusOff 并恢复，检查报文快恢复时间是否落在 [tquickmin, tquickmax] 区间内。\n\n② 慢恢复（tbusoffslowNum / tslowmin / tslowmax）\n生成 BusOff_slow_recovery 用例：连续制造 BusOff 并恢复，检查报文慢恢复时间是否落在 [tslowmin, tslowmax] 区间内。\n\n③ DTC（DTCbusoffNum / DTCbusoffrecovery / DTCbusoffrecoveryType / DTC）\n生成 BusOff DTC 检测用例。\nDTCbusoffrecovery 为恢复量，用右侧开关声明它的含义：开=时间（ms），关=报文帧数。\n\n三组参数互相独立，各自填了才会生成对应用例；Num 为busoff次数，min/max 单位为 ms。',
  disableXcp: 'DisableXCP\n开启后生成 DisableXCP 用例：先发送「关闭XCP」的 UDS 指令，随后连接 XCP 并检查指定 ID 的报文已停止发送；再发送「打开XCP」指令并重新 Init，检查该 ID 报文恢复正常发送。\n\n参数：XCP ID（16 进制，如 0x123）、关闭XCP的UDS指令、打开XCP的UDS指令。',
  configDiag: 'Config_Diag\n开启后生成 AllConfig_Diag（配置所有功能）、EraseConfig_Diag（擦除所有配置）及若干 PartialConfig_Diag_N（部分配置）：\n\n① AllConfig_Diag：Req14 → 发送「配置所有功能」UDS 指令 → 正常上下电 → 读取全部故障（白名单=未配置DTC，并断言其为历史故障）→ 注入全部网络故障 → 读取全部故障（白名单=全部网络故障 DTC + 未配置DTC）→ 恢复全部网络故障 → 再次读取（网络故障 DTC 应转历史）。\n\n② EraseConfig_Diag：Req14 → 发送「擦除所有配置」UDS 指令 → 正常上下电 → 读取全部故障（白名单=未配置DTC，断言其为当前故障）→ 注入全部网络故障 → 读取全部故障（白名单=未被排除的 DTC + 未配置DTC）→ 恢复全部网络故障 → 读取（未配置DTC 应为当前故障）。\n\n③ PartialConfig_Diag_N（部分配置，数量不定，点「+ 添加」逐条录入）：Req14 → 发送该条的 UDS 指令 → 正常上下电（当前应无故障）→ 按分类静默注入故障 → 读取全部故障（白名单=该分类 DTC 去掉该条「关联ID」命中的，不含未配置DTC）→ 恢复后当前应无故障。与 EraseConfig 的区别：不期望「未配置DTC」，且只排除该条填写的「关联ID」。\n\n参数：全配=配置所有功能的UDS指令；全不配=擦除所有配置的UDS指令 + 未配置DTC（如 456F00）+ 擦除后不再报出的报文ID（可多个，英文逗号分隔，如 0x123,0x456）；部分配置=每条「UDS指令 + 关联ID（可多个，英文逗号分隔）」。',
  sliderGroup: '开关配置（四项开关，互相独立）\n· ExtendFrame：对每个 Rx 报文 ID 发送扩展帧，检查总线未出现错误帧。\n· RemotrFrame：对每个 Rx 报文 ID 发送远程帧，检查总线未出现错误帧。\n· UnexpectDlc:less：检查各 Tx 报文是否出现 DLC 小于预期的非预期长度。\n· UnexpectDlc:Greater：检查各 Tx 报文是否出现 DLC 大于预期的非预期长度。\n\n四项均依赖 DBC 中已配置的 Tx/Rx 报文列表，需先导入并配置 DBC 再勾选。',
  readyOffDiagStop: 'Ready_OffDiagStop\n开启后生成 Ready_Off_Diag 用例：Ready Off 状态下，所填报文 ID 对应的故障应被禁止诊断（不置位），其它故障仍正常触发；用于验证 Ready Off 时车速类 DTC 不置位。\n\n参数：车速报文ID（如 0x123）。',
  waittime: '11ResetTime\n每个 Tx 报文都会生成 11 重启用例（xxx_11Reset_Attribute）：发送 11 01（ECU 复位）后等待该报文重新发出。\n\n参数：等待时间（ms），未填时按 3000 处理。',
  igonDag: 'IGON_OFF\n无需勾选，保存配置即生成 IGON_OFF 用例：执行 Init → Ready_Off → IG OFF（等待）→ IG ON（等待），中间先断言应无故障；随后 Ready_On → K30 OFF（等待）→ K30 ON（等待），最后读取 DTC 并断言结果。\n\n参数：IG ON 后读取的 DTC（16 进制，如 0xC12345）。留空时不读取 DTC，改用 _testnullDTC(0,1,0) 断言应无故障。',
  signalValue: 'SignalValue\n从 DBC 拖入信号，或点「+ 添加」手动录入；每条配置生成一组上电信号检查：上电后监控该信号，检查其在所填时间内达到所填值，未达到则失败。\n\n字段：信号名（拖入）、上电发送有效值时间（ms）、无效值。\n可添加多组，每组独立生成检查语句。',
  otaDiagStop: 'OTA_DiagStop\n从 DBC 拖入信号，或点「+ 添加」手动录入：通过信号值开启 OTA 网络诊断，注入故障应能正常诊断，并校验低压/高压下的 DTC；再用停止值关闭网络诊断，注入的故障应不再被诊断。\n\n字段：OTA信号名（拖入）、关闭诊断的信号值、开启诊断的信号值、开启/关闭诊断的时间（ms）。\n信号值支持多个取值（英文逗号分隔），用例按取值循环执行。',
  sigDiagStop: 'Sig_DiagStop\n从 DBC 拖入信号，或点「+ 添加」手动录入：先设置「开启诊断的信号值」，注入故障应能诊断到 DTC；再设置「关闭诊断的信号值」，故障应不再被诊断。\n\n字段：信号名（拖入）、关闭诊断的信号值、开启诊断的信号值、开启/关闭诊断的时间（ms）。\n信号值支持多个取值（英文逗号分隔）。',
  pwrStsFbDiagStop: 'PwrStsFb_DiagStop\n从 DBC 拖入信号，或点「+ 添加」手动录入：通过信号值切换电源状态反馈（模拟发动机/电源状态），并结合断开与恢复报文，检查网络诊断的开启与关闭行为是否符合预期。\n\n字段：信号名（拖入）、关闭诊断的信号值、开启诊断的信号值、开启/关闭诊断的时间（ms）。\n信号值支持多个取值（英文逗号分隔）。',
}

// 排列顺序按卡片尺寸（span）优化，尽量填满 8 列网格、减少空洞：
// 1×1 小卡连续排布 → 2×2 的 tBusOff 插在小卡中间（跨两行不留洞）→ 1×2 的 DisableXCP 放在末尾
// （DisableXCP 若插在中间，它跨行会在下一行留下一个空位）
const otherFieldDefs: OtherFieldDef[] = [
  { key: 'ack', label: 'ACK', inputs: [{ key: 'ackTime', placeholder: 'ACK时间', validate: 'int' }] },
  { key: 'init', label: 'Init', inputs: [{ key: 'initTime', placeholder: 'init时间', validate: 'int' }] },
  { key: 'allMsgTx', label: 'AllmsgTx', inputs: [{ key: 'allMsgTxTime', placeholder: '发出所有报文的时间', validate: 'int' }] },
  { key: 'dataframeId', label: 'DataframeID', inputs: [{ key: 'idBitCount', placeholder: 'ID的位数(11)', validate: 'int' }] },
  { key: 'busOff', label: 'tBusOff', layout: 'rows', span: '2x2', inputs: [
    // ① 快恢复（3 项占满一行）
    { key: 'tbusoffquickNum', placeholder: '快恢复次数', validate: 'int', span: 4 },
    { key: 'tquickmin', placeholder: '快恢复minTime', validate: 'int', span: 4 },
    { key: 'tquickmax', placeholder: '快恢复maxTime', validate: 'int', span: 4 },
    // ② 慢恢复（3 项占满一行）
    { key: 'tbusoffslowNum', placeholder: '慢恢复次数', validate: 'int', span: 4 },
    { key: 'tslowmin', placeholder: '慢恢复minTime', validate: 'int', span: 4 },
    { key: 'tslowmax', placeholder: '慢恢复maxTime', validate: 'int', span: 4 },
    // ③ DTC（4 项占满一行）
    { key: 'DTCbusoffNum', placeholder: 'DTC检测次数', validate: 'int', span: 3 },
    { key: 'DTCbusoffrecovery', placeholder: '恢复时间/报文帧数', validate: 'int', span: 3 },
    {
      key: 'DTCbusoffrecoveryType', placeholder: '恢复量类型', type: 'select', span: 3,
      activeValue: 'TIME', inactiveValue: 'FRAME',
      activeText: '时间', inactiveText: '帧数',
    },
    { key: 'DTC', placeholder: 'DTC', validate: 'hex', span: 3 },
  ] },
  { key: 'busoffDiagStartTime', label: 'Busoff_DiagStartTime', inputs: [{ key: 'busoffRecoveryDiagTime', placeholder: 'busoff恢复诊断时间', validate: 'int' }] },
  { key: 'igonDiagStartTime', label: 'IGON_DiagStartTime', inputs: [{ key: 'igonDiagStartTime', placeholder: 'IGON开启诊断时间', validate: 'int' }] },
  { key: 'igoffDiagStopTime', label: 'IGOFF_DiagStopTime', inputs: [{ key: 'igoffDiagStopTime', placeholder: 'IGOFF关闭诊断时间', validate: 'int' }] },
  { key: 'powerDownDiagStop', label: 'PowerDown_DiagStop', inputs: [{ key: 'resultWaitTime', placeholder: '检测结果的等待时间', validate: 'int' }] },
  { key: 'minDelayTime', label: 'Min_delayTime', inputs: [{ key: 'minDelayTime', placeholder: '最小间隔时间：整数', validate: 'int' }] },
  { key: 'shutdown', label: 'Shutdown', inputs: [
    { key: 'shutdownDiagStopMinTime', placeholder: '下电诊断停止minTime', validate: 'int' },
    { key: 'shutdownDiagStopMaxTime', placeholder: '下电诊断停止maxTime', validate: 'int' },
  ] },
  { key: 'disableXcp', label: 'DisableXCP', inputs: [
    { key: 'xcpId', placeholder: '输入XCP ID', validate: 'hex' },
    { key: 'closeXcpUdsCommand', placeholder: '关闭XCP的UDS指令' },
    { key: 'openXcpUdsCommand', placeholder: '打开XCP的UDS指令' },
  ] },
  // Config_Diag 已改为与 SignalValue 同款的分组卡片（见模板 other-group-wrap 内），不再走 otherFieldDefs
  // 三个「总线负载率」配置集中成一排、等宽（2 列 × 1 行）。
  // 它们必须相邻：原先夹在 2×2 的 tBusOff 大卡两侧，会被隔成两段；
  // 排在简单卡片末尾时，8 列网格里正好落成连续的一排（各占 1-2 / 3-4 / 5-6 列）

  // { key: 'busOffTxatt', label: 'BusOff_Txatt', inputs: [
  //   { key: 'angleSignalName', placeholder: '角度信号名' },
  //   { key: 'torqueSignalName', placeholder: '扭矩信号名' },
  // ] },
  // 三个「总线负载率」并成一排：各占 2 列 × 1 行，第一张用 layout:'break' 强制另起一行（从第 1 列开始），
  // 后两张紧随其后。用 break 而不是靠顺序，是为了不依赖 8 列网格的落位结果（否则会被 2×2 的 tBusOff 大卡隔开、或跨行拆成两段）。
  // 取 2 列宽：3 张共占 6 列，本行只剩 1 个空格；若取 1 列宽则 3 张只占 3 列，本行会空出 3~4 格，反而松散
  { key: 'highBusLoadTxatt', label: 'HighBusLoad_Txatt', span: '1x1', layout: 'break', inputs: [{ key: 'busLoadRate', placeholder: '负载率', validate: 'int' }] },
  { key: 'highBusLoadCommunication', label: 'HighBusLoad_communication', span: '1x1', inputs: [{ key: 'busLoadRate2', placeholder: '负载率', validate: 'int' }] },
  { key: 'highBusLoadDiag', label: 'HighBusLoad_Diag', span: '1x1', inputs: [{ key: 'busLoadRate3', placeholder: '负载率', validate: 'int' }] },
  { key: 'dtcAged', label: 'DTCAged', span: '1x1', inputs: [{ key: 'dtcAgedNum', placeholder: '老化次数', validate: 'int' }] },
]

/** Group 卡片（拖拽 DBC 对象生成多组参数） */
const groupCardDefs = ref<GroupCardDef[]>([
  {
    key: 'signalValue', label: 'SignalValue',
    groupFields: [
      { key: 'signalName', placeholder: '信号名（拖入）' },
      { key: 'switchTime', placeholder: '上电发送有效值时间' },
      { key: 'invalidValue', placeholder: '无效值' },
    ],
    groups: [],
  },
  {
    key: 'otaDiagStop', label: 'OTA_DiagStop',
    groupFields: [
      { key: 'signalName', placeholder: 'OTA信号名（拖入）' },
      { key: 'offValue', placeholder: '关闭诊断的信号值' },
      { key: 'startValue', placeholder: '开启诊断的信号值' },
      { key: 'switchTime', placeholder: '开启/关闭诊断的时间' },
    ],
    groups: [],
  },
  {
    key: 'sigDiagStop', label: 'Sig_DiagStop',
    groupFields: [
      { key: 'signalName', placeholder: '信号名（拖入）' },
      { key: 'offValue', placeholder: '关闭诊断的信号值' },
      { key: 'startValue', placeholder: '开启诊断的信号值' },
      { key: 'switchTime', placeholder: '开启/关闭诊断的时间' },
    ],
    groups: [],
  },
  {
    key: 'pwrStsFbDiagStop', label: 'PwrStsFb_DiagStop',
    groupFields: [
      { key: 'signalName', placeholder: '信号名（拖入）' },
      { key: 'offValue', placeholder: '关闭诊断的信号值' },
      { key: 'startValue', placeholder: '开启诊断的信号值' },
      { key: 'switchTime', placeholder: '开启/关闭诊断的时间' },
    ],
    groups: [],
  },
])

/** Hex ID 卡片 */
const hexIdCardDefs = ref<HexIdCardDef[]>([
  { key: 'readyOffDiagStop', label: 'Ready_OffDiagStop', placeholder: '车速报文ID (如 0x123)' },
])

/** 纯参数卡片：只有一个输入框、没有开关（值直接进 Other 表，后端按 key 取用） */
const paramCardDefs = ref<ParamCardDef[]>([
  // 11 重启用例（xxx_11Reset_Attribute）里 testWaitForMessage 的等待时间
  { key: 'waittime', label: '11ResetTime', placeholder: '等待时间 (ms)', validate: 'int' },
  // IGON_OFF 用例里 TestStep_ReadDTC 读取的 DTC（后端 _add_IGON_OFF_testcase，无开关、保存即生成）
  { key: 'igonDag', label: 'IGON_OFF', placeholder: 'DTC (如 0xC12345)', validate: 'hex' },
])

/** Compound 滑块卡片 */
const compoundSliderDefs: CompoundSliderDef[] = [
  {
    key: 'sliderGroup', label: '开关配置',
    sliders: [
      { key: 'extendFrame', label: 'ExtendFrame' },
      { key: 'remoteFrame', label: 'RemotrFrame' },
      { key: 'unexpectDlcLess', label: 'UnexpectDlc:less' },
      { key: 'unexpectDlcGreater', label: 'UnexpectDlc:Greater' },
    ],
  },
]

/** DiagStop 分组：放在一起展示 */
const diagStopGroupKeys = ['otaDiagStop', 'sigDiagStop', 'pwrStsFbDiagStop', 'readyOffDiagStop']

/** 生成唯一 ID */
function genId(): string {
  return Math.random().toString(36).slice(2, 9)
}

/** 拖拽 DBC 信号到 group 卡片 */
function onGroupCardDrop(event: DragEvent, cardKey: string) {
  event.preventDefault()
  event.stopPropagation()
  const name = event.dataTransfer?.getData('text/plain')
  if (!name) return
  const card = groupCardDefs.value.find(c => c.key === cardKey)
  if (!card) return
  const newGroup: GroupDef = { id: genId(), values: { signalName: name } }
  card.groups.push(newGroup)
  if (!otherCheckboxStates.value[cardKey]) {
    otherCheckboxStates.value[cardKey] = true
  }
}

/** 手动添加空 group */
function addGroup(cardKey: string) {
  const card = groupCardDefs.value.find(c => c.key === cardKey)
  if (!card) return
  const newGroup: GroupDef = { id: genId(), values: {} }
  card.groups.push(newGroup)
  if (!otherCheckboxStates.value[cardKey]) {
    otherCheckboxStates.value[cardKey] = true
  }
}

/** 删除 group */
function removeGroup(cardKey: string, groupId: string) {
  const card = groupCardDefs.value.find(c => c.key === cardKey)
  if (!card) return
  const idx = card.groups.findIndex(g => g.id === groupId)
  if (idx >= 0) card.groups.splice(idx, 1)
}

/** Config_Diag「部分配置」列表：数量不定，每条 = { udsCommand, relatedIds }。
 *  直接存在 otherData.configDiagPartial（随 Other 一起保存/加载），无需额外字段。 */
function addPartialConfig() {
  if (!Array.isArray(otherData.value.configDiagPartial)) {
    otherData.value.configDiagPartial = []
  }
  otherData.value.configDiagPartial.push({ udsCommand: '', relatedIds: '' })
  if (!otherCheckboxStates.value.configDiag) {
    otherCheckboxStates.value.configDiag = true
  }
}

/** 删除「部分配置」第 idx 条 */
function removePartialConfig(idx: number) {
  const list = otherData.value.configDiagPartial
  if (Array.isArray(list) && idx >= 0 && idx < list.length) {
    list.splice(idx, 1)
  }
}

/** 获取 group 卡片的 checkbox 状态（有 group 即视为启用） */
function isGroupActive(cardKey: string): boolean {
  const card = groupCardDefs.value.find(c => c.key === cardKey)
  if (card && card.groups.length > 0) return true
  return !!otherCheckboxStates.value[cardKey]
}

/**
 * 根据输入项数量取卡片默认尺寸，返回值即 `.other-card--span-<列>x<行>` 的后缀。
 * 外层网格 8 列、每行 92px：1~2 项 → 1 列 × 1 行；3 项 → 1 列 × 2 行；4 项及以上 → 4 列 × 2 行。
 * 需要别的尺寸时，在 otherFieldDefs 里给该卡片直接写 `span: '<列>x<行>'` 覆盖。
 */
function getCardSpan(inputCount: number): string {
  if (inputCount <= 1) return '1x1'
  if (inputCount === 2) return '1x1'
  if (inputCount === 3) return '1x2'
  return '4x2'
}

/** 根据 group 数量动态计算卡片跨行数（每行 92px，至少 2 行） */
function getGroupRowSpan(groupCount: number): number {
  // 空状态：2 行；每个 group 约 70px，每行 92px
  if (groupCount === 0) return 2
  return Math.max(2, Math.ceil((groupCount * 70 + 40) / 92))
}

/** Config_Diag 卡片条目数：2 条固定（全配 / 全不配）+ 部分配置条数 */
const configDiagEntryCount = computed(() =>
  2 + (Array.isArray(otherData.value.configDiagPartial) ? otherData.value.configDiagPartial.length : 0)
)

/** Config_Diag 卡片跨行数：与分组卡片同口径（每行 92px，每条约 70px） */
const configDiagRowSpan = computed(() => getGroupRowSpan(configDiagEntryCount.value))

/** 分组卡片子网格占用的外层行数：两列一行，累加每行两张卡片跨行数的较大值；
 *  Config_Diag 也在这个子网格里（作为第 5 张），故一并计入 */
const groupWrapRowSpan = computed(() => {
  const rows = groupCardDefs.value.map(c => getGroupRowSpan(c.groups.length))
  rows.push(configDiagRowSpan.value)
  let total = 0
  for (let i = 0; i < rows.length; i += 2) total += Math.max(rows[i], rows[i + 1] ?? 0)
  return Math.max(2, total)
})

/** Hex ID 输入校验与转换：10 进制自动转 16 进制（0x 前缀） */
function onHexIdInput(cardKey: string) {
  let val = String(otherData.value[cardKey] || '')
  // 先过滤非法字符：仅保留 0-9 a-f A-F x X
  const filtered = val.replace(/[^0-9a-fA-FxX]/g, '')
  // 规范化：将 0X 转为 0x
  let normalized = filtered.replace(/^0X/, '0x')
  // 若不以 0x 开头但包含 x/X（非前缀），移除 x/X
  if (!normalized.startsWith('0x')) {
    normalized = normalized.replace(/[xX]/g, '')
  }
  if (normalized !== val) {
    val = normalized
    otherData.value[cardKey] = normalized
  }
  const trimmed = val.trim()
  // 空值或仅 0x 前缀：允许用户自由编辑/清空，不做处理
  if (!trimmed || trimmed === '0x') return
  // 已是 0x 开头的十六进制，规范化字母为大写
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    otherData.value[cardKey] = '0x' + trimmed.slice(2).toUpperCase()
    return
  }
  // 纯数字（十进制）：正数转换为十六进制；0 不转换避免补成 0x0 影响清空
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10)
    if (!isNaN(num) && num > 0) {
      otherData.value[cardKey] = '0x' + num.toString(16).toUpperCase()
    }
    return
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && !/^0x/.test(trimmed)) {
  otherData.value[cardKey] = '0x' + trimmed.toUpperCase();
  return;
  }  
  // 其他情况（含纯十六进制字符、非法输入）不处理，避免删除过程中强制补全导致无法清空
}

/** 整数输入校验：仅保留数字字符 */
function onIntInput(inputKey: string) {
  const val = String(otherData.value[inputKey] || '')
  // 过滤掉所有非数字字符
  const filtered = val.replace(/[^\d]/g, '')
  if (filtered !== val) {
    otherData.value[inputKey] = filtered
  }
}

/** UDS 文本规范化：把各种写法统一成 0x14,0xFF,0xFF,0xFF（字母大写）。
 *  兼容 `14 FF FF FF` / `0x14,0xFF,0xFF,0xFF` / `[0x14,0xFF,0xFF,0xFF]` /
 *  `14ffffff`（无分隔的一串十六进制）。编辑中间态（单个字符、末尾分隔符）原样保留，避免删不掉；
 *  含非十六进制字符时原样返回。 */
function normalizeUdsText(raw: string): string {
  if (raw === '') return raw
  // 去掉包围的方括号/花括号，按逗号或空白切分
  const parts = raw.replace(/[[\]{}]/g, '').split(/[\s,]+/).filter(s => s !== '')
  if (parts.length === 0) return raw
  const out: string[] = []
  for (const p of parts) {
    const hex = p.replace(/^0[xX]/, '')
    // 含非十六进制字符：不强行纠正，保留用户原输入
    if (!/^[0-9a-fA-F]+$/.test(hex)) return raw
    if (hex.length > 2 && hex.length % 2 === 0) {
      for (let i = 0; i < hex.length; i += 2) out.push('0x' + hex.slice(i, i + 2).toUpperCase())
    } else if (hex.length === 2) {
      out.push('0x' + hex.toUpperCase())
    } else {
      // 单个/奇数个十六进制字符：编辑中间态，原样保留
      out.push(p)
    }
  }
  const normalized = out.join(',')
  const trailingSep = /[,\s]\s*$/.test(raw)
  return trailingSep ? normalized + ',' : normalized
}

/** UDS 指令输入校验：把 otherData 里该字段的写法规范化 */
function onUdsInput(inputKey: string) {
  const raw = String(otherData.value[inputKey] || '')
  const finalVal = normalizeUdsText(raw)
  if (finalVal !== raw) {
    otherData.value[inputKey] = finalVal
  }
}

/** 根据输入框校验类型分发到对应校验函数 */
function onValidateInput(inp: OtherInputDef) {
  if (inp.validate === 'int') {
    onIntInput(inp.key)
  } else if (inp.validate === 'hex') {
    onHexIdInput(inp.key)
  } else if (inp.validate === 'uds') {
    onUdsInput(inp.key)
  }
}

/** DTC 输入校验：仅保留 0-9 a-f A-F，自动大写 */
function onDtcInput(key: string) {
  const val = String(paParams.value[key] || '')
  // 过滤非十六进制字符并转大写
  const filtered = val.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  if (filtered !== val) {
    paParams.value[key] = filtered
  }
}

/** Group 卡片拖拽高亮 */
const dragOverGroup = ref<string>('')
function onGroupDragEnter(cardKey: string, event: DragEvent) {
  event.preventDefault()
  dragOverGroup.value = cardKey
}
function onGroupDragLeave() {
  dragOverGroup.value = ''
}

/** 全选复选框（读写计算属性） */
const otherSelectAll = computed({
  get: () => {
    const simpleOk = otherFieldDefs.every(f => otherCheckboxStates.value[f.key] === true)
    const groupOk = groupCardDefs.value.every(c => isGroupActive(c.key))
    const hexOk = hexIdCardDefs.value.every(c => !!otherCheckboxStates.value[c.key])
    const sliderOk = compoundSliderDefs.every(d =>
      d.sliders.every(s => otherData.value[s.key] === 'TRUE')
    )
    return simpleOk && groupOk && hexOk && sliderOk
  },
  set: (val: boolean) => {
    otherFieldDefs.forEach(f => { otherCheckboxStates.value[f.key] = val })
    groupCardDefs.value.forEach(c => { otherCheckboxStates.value[c.key] = val })
    hexIdCardDefs.value.forEach(c => { otherCheckboxStates.value[c.key] = val })
    compoundSliderDefs.forEach(d => {
      d.sliders.forEach(s => { otherData.value[s.key] = val ? 'TRUE' : 'FALSE' })
    })
  },
})

// ==================== 计算属性 ====================

/** 将后端 { columns, rows } 转为 DataTable 列定义 */
function convertColumns(raw: any): Column[] {
  if (!raw?.columns) return []
  return raw.columns.map((col: string, i: number) => ({
    key: `c${i}`,
    title: typeof col === 'string' ? col.replace(/\n/g, ' / ') : String(col),
    width: 160,
    sortable: true,
  }))
}

/** 将后端 { columns, rows } 转为 DataTable 数据（对象数组） */
function convertRows(raw: any): any[] {
  if (!raw?.rows) return []
  const cols = raw.columns || []
  return raw.rows.map((row: any[], i: number) => {
    const obj: Record<string, any> = {}
    cols.forEach((_: string, j: number) => {
      obj[`c${j}`] = row[j]
    })
    obj.__row = i
    return obj
  })
}

const dllColumns = computed(() => convertColumns(dllRaw.value))
const dllData = computed(() => convertRows(dllRaw.value))
/** DTC 列：第 4 列（c3 之后）起若不在 dtcObjectNames 中，表头加 ⚠ 标记 */
const dtcColumns = computed(() => {
  const cols = convertColumns(dtcRaw.value)
  const matchSet = dtcObjectNames.value
  return cols.map((c, i) => {
    if (i >= 4) {
      const rawTitle = String(c.title || '').replace(/^⚠\s*/, '')
      const header = rawTitle.split(' / ')[0]
      if (!matchSet.has(header)) {
        return { ...c, title: `⚠ ${rawTitle || '?'}`, _unmatched: true }
      }
      return { ...c, title: rawTitle, _unmatched: false }
    }
    return c
  })
})
const dtcData = computed(() => convertRows(dtcRaw.value))

/** DBC 报文信号 + A2L 变量名集合（用于 DTC 表头匹配） */
const dtcObjectNames = computed(() => {
  const set = new Set<string>()

  // 从 {columns, rows} 格式提取信号名（Excel导入 / DBC文件 / CFG目录DBC）
  const records = parseDbcRecords(mergedDbcRaw.value)
  for (const rec of records) {
    if (rec?.signalName) set.add(String(rec.signalName))
  }

  // 从对象字典格式提取信号名（配置加载）
  const raw = mergedDbcRaw.value
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !raw.columns) {
    for (const messages of Object.values(raw as Record<string, any>)) {
      if (!messages || typeof messages !== 'object') continue
      for (const msgData of Object.values(messages as Record<string, any>)) {
        if (!msgData || typeof msgData !== 'object') continue
        const signals = msgData.signals
        if (signals && typeof signals === 'object') {
          for (const sigName of Object.keys(signals)) {
            set.add(sigName)
          }
        }
      }
    }
  } else {
    // dbcRaw 是 {columns, rows} 格式
    const recs = parseDbcRecords(raw)
    for (const rec of recs) {
      if (rec?.signalName) set.add(String(rec.signalName))
    }
  }

  // A2L 变量（原始名 + 转换后形式，两种形式都能匹配）
  // qualifier 必须与 ObjectPanel 拖拽时使用的一致（含 store 回退），否则拖拽列名无法命中
  const qualifier = a2lQualifierForPanel.value
  function addA2lNames(name: string) {
    set.add(name)
    // 拖拽时 A2L 变量 text/plain 统一转换为 sysvar::XCP::<qualifier>::<name::> 形式，需一并加入匹配集合
    // （有刷模式无 A2L 限定符，拖拽直接输出符号名，无需转换形式）
    if (qualifier) set.add(`sysvar::XCP::${qualifier}::${name.replace(/\./g, '::')}`)
  }
  for (const v of a2lVars.value.measurements) addA2lNames(typeof v === 'string' ? v : v.name)
  for (const v of a2lVars.value.characteristics) addA2lNames(typeof v === 'string' ? v : v.name)
  return set
})

/** DTC 新增列：新增检测对象，所有行默认值为 0 */
function onDtcColumnAdd(payload: { title: string }) {
  if (!dtcRaw.value) {
    dtcRaw.value = { columns: [], rows: [] }
  }
  if (!dtcRaw.value.columns) dtcRaw.value.columns = []
  if (!dtcRaw.value.rows) dtcRaw.value.rows = []
  const newColIndex = dtcRaw.value.columns.length
  dtcRaw.value.columns.push(payload.title)
  for (const row of dtcRaw.value.rows) {
    row[newColIndex] = '0'
  }
}

/** DTC 重命名列：拖拽替换对象名 */
function onDtcColumnRename(payload: { col: number; title: string }) {
  if (!dtcRaw.value?.columns) return
  if (payload.col < 0 || payload.col >= dtcRaw.value.columns.length) return
  dtcRaw.value.columns[payload.col] = payload.title
}

/** DTC 单元格更新（卡片模式） */
function onDtcCardUpdate(payload: { row: number; col: number; value: string }) {
  if (!dtcRaw.value) {
    dtcRaw.value = { columns: [], rows: [] }
  }
  if (!dtcRaw.value.columns) dtcRaw.value.columns = []
  if (!dtcRaw.value.rows) dtcRaw.value.rows = []

  while (payload.col >= dtcRaw.value.columns.length) {
    dtcRaw.value.columns.push('')
  }
  while (payload.row >= dtcRaw.value.rows.length) {
    dtcRaw.value.rows.push([])
  }
  while (payload.col >= dtcRaw.value.rows[payload.row].length) {
    dtcRaw.value.rows[payload.row].push('')
  }

  let value = String(payload.value ?? '')
  // DTC_Type 列填写规范：只允许 Fun / Bus / Volt / BusOff（空值表示未填写）
  const colTitle = String(dtcRaw.value.columns[payload.col] ?? '').replace(/^⚠\s*/, '').trim()
  if (colTitle === 'DTC_Type') {
    const trimmed = value.trim()
    if (trimmed === '') {
      value = ''
    } else {
      const matched = DTC_TYPE_OPTIONS.find(o => o.toLowerCase() === trimmed.toLowerCase())
      if (!matched) {
        ElMessage.warning({ message: `DTC_Type 只允许填写：${DTC_TYPE_OPTIONS.join(' / ')}`, grouping: true })
        return
      }
      value = matched
    }
  }

  dtcRaw.value.rows[payload.row][payload.col] = value
}

/** DTC 删除列（仅允许删除检测对象列） */
function onDtcColumnRemove(payload: { col: number }) {
  if (!dtcRaw.value?.columns) return
  if (payload.col < 4 || payload.col >= dtcRaw.value.columns.length) return
  
  dtcRaw.value.columns.splice(payload.col, 1)
  for (const row of dtcRaw.value.rows) {
    row.splice(payload.col, 1)
  }
}

const selectedDtcRow = ref(-1)

/** DTC_Type 列允许填写的取值（后端按该列原样写入生成的 DTC_Data_array） */
const DTC_TYPE_OPTIONS = ['Fun', 'Bus', 'Volt', 'BusOff']

// ==================== Excel 导入数据校验 ====================
//
// 导入 Excel 时按规范校验测试参数与 DTC 表：能自动纠正的直接改（如统一 0x 前缀、
// 规范化大小写），不能纠正的清空或移除；所有改动汇总后一次性提示（详见控制台）。

/** SigInvalidTest 子类型允许取值（对应后端 SigInvalid / SigvalueInvalid 两条生成路径） */
const SIG_INVALID_TYPE_OPTIONS = ['SigInvalid', 'SigvalueInvalid']

/** DTC 文本：0x + 1~8 位十六进制 */
const DTC_HEX_RE = /^0[xX]([0-9a-fA-F]{1,8})$/
/** DTC 文本：不带前缀的 1~8 位十六进制（如 C07300，保持原样，不自动补 0x） */
const DTC_BARE_HEX_RE = /^[0-9a-fA-F]{1,8}$/
const AUTO_RANGE_TRUE_RE = /^(y|yes|是|true|1)$/i
const AUTO_RANGE_FALSE_RE = /^(n|no|否|false|0)$/i

/**
 * 规范化 DTC 文本。
 * 返回 ``null`` = 非法（调用方应清空并提示）；空串 = 未填写；其余为规范化后的文本。
 * 只把 ``0X`` 前缀统一成 ``0x``，不给不带前缀的值补前缀（C07300 / 500016 保持原样）。
 */
function normalizeDtcText(raw: any): string | null {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const m = DTC_HEX_RE.exec(text)
  if (m) return '0x' + m[1]
  if (DTC_BARE_HEX_RE.test(text)) return text
  return null
}

/** 导入校验问题汇总提示（完整明细输出到控制台，避免提示过长） */
function notifyImportIssues(scope: string, issues: string[]) {
  if (!issues.length) return
  console.warn(`[导入校验] ${scope} 共 ${issues.length} 处不合规：\n` + issues.map((s) => '  - ' + s).join('\n'))
  ElMessage.warning({
    message: `${scope}已按规范自动纠正 ${issues.length} 处：${issues.slice(0, 3).join('；')}${issues.length > 3 ? ' …（完整明细见控制台）' : ''}`,
    duration: 10000,
    showClose: true,
    grouping: true,
  })
}

/**
 * 校验并纠正一批导入的测试参数（不修改入参，返回新数组）。
 *
 * 规则：
 * - EPS 卡片（CRC 算法名 / Counter）：不在「Counter + 已注册 CRC 算法」内 → 移除；
 * - SigInvalidTest 子类型：只允许 SigInvalid / SigvalueInvalid，非法按 SigInvalid 处理；
 * - FactorTest.autoRange：只接受布尔语义（Y/N/是/否/true/false/1/0），非法按 N 处理；
 * - DTC 字段：只允许 空 / 0x+十六进制 / 裸十六进制，非法清空。
 */
function sanitizeImportedParams(list: any[], where: string, issues: string[]): any[] {
  const crcNames = new Set(crcAlgorithms.value.map((a: any) => String(a?.name || '')))
  const out: any[] = []
  for (const p of list || []) {
    if (!p || !p.value) continue
    const value = String(p.value)

    // 1) EPS 卡片：CRC 算法名 / Counter
    if (p.target === 'eps') {
      // CRC 算法列表尚未加载时不判定，避免误删合法卡片
      if (!crcNames.size || value === 'Counter' || crcNames.has(value)) out.push(p)
      else issues.push(`「${where}」的 EPS 类型「${value}」不在允许范围（Counter / 已注册 CRC 算法），已移除`)
      continue
    }

    const params = { ...(p.params || {}) }

    // 2) SigInvalidTest 子类型
    if (value === 'SigInvalidTest') {
      const raw = String(params.invalidType ?? '').trim()
      const matched = SIG_INVALID_TYPE_OPTIONS.find((o) => o.toLowerCase() === raw.toLowerCase())
      if (raw && !matched) {
        issues.push(`「${where}」的无效类型「${raw}」不在允许范围（${SIG_INVALID_TYPE_OPTIONS.join(' / ')}），已按 SigInvalid 处理`)
      }
      params.invalidType = matched || 'SigInvalid'
    }

    // 3) FactorTest 自动遍历
    if ('autoRange' in params && typeof params.autoRange !== 'boolean') {
      const raw = String(params.autoRange ?? '').trim()
      if (AUTO_RANGE_TRUE_RE.test(raw)) {
        params.autoRange = true
      } else if (AUTO_RANGE_FALSE_RE.test(raw)) {
        params.autoRange = false
      } else {
        issues.push(`「${where}」的自动遍历取值「${raw}」不是 Y/N，已按 N 处理`)
        params.autoRange = false
      }
    }

    // 4) DTC 字段格式
    if ('dtc' in params) {
      const raw = String(params.dtc ?? '').trim()
      const fixed = normalizeDtcText(params.dtc)
      if (fixed === null) {
        issues.push(`「${where}」的 DTC「${raw}」不是合法十六进制，已清空`)
        params.dtc = ''
      } else {
        if (raw && fixed !== raw) issues.push(`「${where}」的 DTC「${raw}」已规范为「${fixed}」`)
        params.dtc = fixed
      }
    }

    out.push({ ...p, params })
  }
  return out
}

/** 校验/纠正整张测试参数表（导入 Excel 后调用），并弹出问题汇总 */
function sanitizeImportedParamMap(map: Map<string, any[]>): Map<string, any[]> {
  const issues: string[] = []
  const next = new Map<string, any[]>()
  for (const [key, list] of map) {
    const cleaned = sanitizeImportedParams(list, key.replace(':::', ' / '), issues)
    if (cleaned.length) next.set(key, cleaned)
  }
  notifyImportIssues('测试参数', issues)
  return next
}

/** 校验/纠正导入的 DTC 表 DTC_Type 列（非法值清空） */
function sanitizeImportedDtcTable(raw: any): void {
  const cols: any[] = raw?.columns || []
  const rows: any[][] = raw?.rows || []
  const colIdx = cols.findIndex((c: any) => String(c ?? '').trim().replace(/^⚠\s*/, '') === 'DTC_Type')
  if (colIdx < 0) return
  const issues: string[] = []
  rows.forEach((row, i) => {
    if (!Array.isArray(row)) return
    const cellVal = String(row[colIdx] ?? '').trim()
    if (!cellVal) return
    const matched = DTC_TYPE_OPTIONS.find((o) => o.toLowerCase() === cellVal.toLowerCase())
    if (matched) {
      row[colIdx] = matched
    } else {
      issues.push(`第 ${i + 2} 行 DTC_Type「${cellVal}」不在允许范围（${DTC_TYPE_OPTIONS.join(' / ')}），已清空`)
      row[colIdx] = ''
    }
  })
  notifyImportIssues('DTC 表', issues)
}

/** DTC 添加行 */
function addDtcRow() {
  if (!dtcRaw.value) {
    dtcRaw.value = { columns: ['DTC', 'DTC_Type', 'DTC_Confirm', 'DTC_recovery'], rows: [] }
  }
  if (!dtcRaw.value.columns) dtcRaw.value.columns = ['DTC', 'DTC_Type', 'DTC_Confirm', 'DTC_recovery']
  if (!dtcRaw.value.rows) dtcRaw.value.rows = []
  // 新行数据列默认填 0（DTC 码列保留空，待用户输入）
  const newRow = new Array(dtcRaw.value.columns.length).fill(0)
  newRow[0] = '' // DTC 码列留空，等用户填写
  // DTC_Type 列也留空：该列只允许 Fun / Bus / Volt / BusOff，由用户填写
  const typeCol = dtcRaw.value.columns.findIndex((c: any) => String(c ?? '').trim() === 'DTC_Type')
  if (typeCol >= 0) newRow[typeCol] = ''
  dtcRaw.value.rows.push(newRow)
}

/** DTC 删除选中行 */
function removeDtcRow() {
  if (selectedDtcRow.value < 0 || !dtcRaw.value?.rows) return
  if (selectedDtcRow.value >= dtcRaw.value.rows.length) return
  dtcRaw.value.rows.splice(selectedDtcRow.value, 1)
  selectedDtcRow.value = -1
}

// ==================== DBC 报文信号表（可编辑 + 可拖拽填充） ====================

interface SignalColumn {
  key: string
  cn: string
  en: string
  width?: number
}

/** 信号表列定义（中文 + 英文双行表头）
 * 核心列（矩阵通信表映射）：无效值、Data_Type、lostDTC、dlcDTC、DTC、Signal_Type、XCP_CCP_varname
 * 扩展列：发送节点、报文标识符、报文长度、信号名称、精度、偏移量、物理最小/最大值、初始值、信号值描述
 */
const signalColumns: SignalColumn[] = [
  // === 核心测试属性列（来自矩阵通信表） ===
  { key: 'invalidValue', cn: '无效值', en: 'Invalid_Value', width: 130 },
  { key: 'dataType', cn: '数据类型', en: 'Data_Type', width: 120 },
  { key: 'signalType', cn: '', en: 'Signal_Type', width: 130 },
  // === 报文基础信息列 ===
  { key: 'senders', cn: '发送节点', en: 'Senders', width: 130 },
  { key: 'msgName', cn: '报文名称', en: 'Msg_Name', width: 150 },
  { key: 'msgId', cn: '报文标识符', en: 'Msg_ID', width: 130 },
  { key: 'msgCycleTime', cn: '报文周期时间', en: 'Msg_Cycle_Time', width: 150 },
  { key: 'msgLength', cn: '报文长度', en: 'Msg_Length', width: 120 },
  // === 信号详细信息列 ===
  { key: 'signalName', cn: '信号名称', en: 'Signal_Name', width: 150 },
  { key: 'factor', cn: '精度', en: 'Factor', width: 100 },
  { key: 'offset', cn: '偏移量', en: 'Offset', width: 100 },
  { key: 'minPhy', cn: '物理最小值', en: 'Signal_Min_Value_Phy', width: 160 },
  { key: 'maxPhy', cn: '物理最大值', en: 'Signal_Max_Value_Phy', width: 160 },
  { key: 'initialValue', cn: '初始值', en: 'Initial_Value', width: 120 },
  { key: 'valueDesc', cn: '信号值描述', en: 'Signal_Value_Descriptions', width: 180 },
  { key: 'byteOrder', cn: '排列格式', en: 'Byte_Order', width: 120 },
  { key: 'startBit', cn: '起始位', en: 'Start_Bit', width: 100 },
  { key: 'bitLength', cn: '位长度', en: 'Bit_Length', width: 100 },
]

type SignalRow = { __id: number; [key: string]: any }
let signalRowSeq = 0
const signalRows = ref<SignalRow[]>([])
const selectedSignalRows = ref<SignalRow[]>([])
let dragCellKey = ''
let dragCellEl: HTMLElement | null = null
let dragRafId = 0
let pendingDragTarget: EventTarget | null = null

const STORAGE_KEY_SIGNALS = 'canview_signal_rows'

/** 真实信号行数（signalRows 同时承载报文行，报文行无信号名） */
const signalRowCount = computed(() => signalRows.value.filter((r) => r.signalName).length)

watch(signalRows, (rows) => {
  try {
    localStorage.setItem(STORAGE_KEY_SIGNALS, JSON.stringify(rows))
  } catch { /* ignore */ }
}, { deep: true })

function emptySignalRow(): SignalRow {
  const row = { __id: signalRowSeq++ } as SignalRow
  signalColumns.forEach((c) => { row[c.key] = '' })
  return row
}

function buildSignalRowsFromRaw(raw: any): SignalRow[] {
  if (Array.isArray(raw)) {
    const newMap = new Map<string, any[]>()
    const rows: SignalRow[] = []

    function walk(nodes: any[]) {
      for (const node of nodes) {
        const nt = node.type || node.t
        if (nt === 's' || nt === 'sender') {
          if (node.c || node.children) walk(node.c || node.children)
        } else if (nt === 'm' || nt === 'message') {
          const row = { __id: signalRowSeq++ } as SignalRow
          signalColumns.forEach((c) => { row[c.key] = '' })
          row.senders = node.sn || node.msg?.senders || ''
          row.msgName = node.n || node.name || ''
          row.msgId = node.id || node.msg?.msgId || ''
          row.msgCycleTime = node.cy || node.msg?.cycle || ''
          row.msgLength = node.ln || node.msg?.length || ''
          row.msgTest = (node.lk !== undefined ? node.lk : node.checked) ? 'Y' : 'N'

          const tp = node.tp || node.testParams
          if (tp && Array.isArray(tp)) {
            row.testParams = [...tp]
            if (row.msgName) newMap.set(row.msgName, tp)
          }

          rows.push(row)

          if (node.c || node.children) walk(node.c || node.children)
        } else if (nt === 'g' || nt === 'signal') {
          const row = { __id: signalRowSeq++ } as SignalRow
          signalColumns.forEach((c) => { row[c.key] = '' })
          row.signalName = node.n || node.name || ''
          row.invalidValue = node.iv || node.fields?.invalidValue || ''
          row.dataType = node.dt || node.fields?.dataType || ''
          row.signalType = node.st || node.fields?.signalType || ''
          row.test = (node.lk !== undefined ? node.lk : node.checked) ? 'Y' : 'N'

          const tp = node.tp || node.testParams
          if (tp && Array.isArray(tp)) {
            row.testParams = [...tp]
            const key = row.msgName && row.signalName
              ? `${row.msgName}:::${row.signalName}`
              : row.signalName || row.msgName
            if (key) newMap.set(key, tp)
          }

          rows.push(row)
        }
      }
    }

    walk(raw)
    testParamMap.value = newMap
    return rows
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !raw.columns && !raw.rows) {
    const newMap = new Map<string, any[]>()
    const rows: SignalRow[] = []

    function tpObjToArray(tpObj: Record<string, any>): any[] {
      const arr: any[] = []
      for (const [key, params] of Object.entries(tpObj)) {
        arr.push({
          value: key,
          label: key,
          type: 'testParam',
          target: '',
          params,
          enabled: true
        })
      }
      // 旧参数模型（SigInvalidTest.invalidType=CRC/Counter/Signal、SigvalueInvalidTest）迁移到新模型
      return migrateParamList(arr)
    }

    for (const [senderName, messages] of Object.entries(raw)) {
      for (const [msgName, msgData] of Object.entries(messages as Record<string, any>)) {
        const msgRow = { __id: signalRowSeq++ } as SignalRow
        signalColumns.forEach((c) => { msgRow[c.key] = '' })
        msgRow.senders = senderName
        msgRow.msgName = msgName
        msgRow.msgId = msgData.id || ''
        msgRow.msgCycleTime = msgData.cy || ''
        msgRow.msgLength = msgData.ln || ''
        msgRow.lostDtc = msgData.ld || ''
        msgRow.dlcDtc = msgData.dd || ''
        msgRow.msgTest = msgData.lk ? 'Y' : 'N'

        if (msgData.tp && typeof msgData.tp === 'object') {
          msgRow.testParams = tpObjToArray(msgData.tp)
          newMap.set(msgName, msgRow.testParams)
        } else if (senderName !== 'EPS') {
          // 非 EPS 报文默认自带 LostTest / DlcTest（未填 DTC 时为灰色）
          const defaults = buildAutoMsgTestParams({
            senders: senderName,
            lostDtc: msgData.ld || '',
            dlcDtc: msgData.dd || '',
          }).map((d: any) => ({ ...d, enabled: hasParamData(d) }))
          if (defaults.length) {
            msgRow.testParams = defaults
            newMap.set(msgName, defaults)
          }
        }

        rows.push(msgRow)

        if (msgData.signals && typeof msgData.signals === 'object') {
          for (const [sigName, sigData] of Object.entries(msgData.signals as Record<string, any>)) {
            const sigRow = { __id: signalRowSeq++ } as SignalRow
            signalColumns.forEach((c) => { sigRow[c.key] = '' })
            sigRow.senders = senderName
            sigRow.msgName = msgName
            sigRow.msgId = msgData.id || ''
            sigRow.msgCycleTime = msgData.cy || ''
            sigRow.msgLength = msgData.ln || ''
            sigRow.signalName = sigName
            sigRow.dataType = sigData.dt || ''
            sigRow.factor = sigData.fc || ''
            sigRow.offset = sigData.of || ''
            sigRow.minPhy = sigData.mn || ''
            sigRow.maxPhy = sigData.mx || ''
            sigRow.invalidValue = sigData.iv || ''
            sigRow.initialValue = sigData.iv_init || ''
            sigRow.valueDesc = sigData.vd || ''
            sigRow.byteOrder = sigData.bo || ''
            sigRow.startBit = sigData.sb || ''
            sigRow.bitLength = sigData.bl || ''
            sigRow.unit = sigData.unit || ''
            sigRow.signalType = sigData.st || ''
            sigRow.test = sigData.lk ? 'Y' : 'N'

            if (sigData.tp && typeof sigData.tp === 'object') {
              sigRow.testParams = tpObjToArray(sigData.tp)
              newMap.set(`${msgName}:::${sigName}`, sigRow.testParams)
            }

            rows.push(sigRow)
          }
        }
      }
    }

    testParamMap.value = newMap
    return rows
  }

  const records = parseDbcRecords(raw)
  // 解析导出时追加的「报文/信号测试参数」JSON 列（存在则优先采用，保证「导出 → 再导入」参数不丢失）
  const parseParamJson = (text: string): any[] => {
    const rawText = String(text || '').trim()
    if (!rawText) return []
    try {
      const parsed = JSON.parse(rawText)
      if (!Array.isArray(parsed)) return []
      return migrateParamList(parsed)
        .filter((p: any) => p && p.value)
        .map((p: any) => ({
          value: p.value,
          label: p.label || p.value,
          target: p.target || '',
          params: { ...(p.params || {}) },
          enabled: hasParamData(p),
        }))
    } catch {
      return []
    }
  }
  // 导出格式里的 8 个测试参数明细列（测试参数 / 报DTC值 / 不报DTC值 / DTC / 变量名 / 测试值 / 自动遍历 / 类型），
  // 一个参数一行；用于手工填这种格式的 Excel 后导入（旧导出文件的 JSON 列存在时优先用 JSON）。
  // 参数名不在已知信号级参数列表中的（如 CRC 算法名 / Counter），视为 EPS 卡片还原 target='eps'。
  const KNOWN_SIG_PARAMS = ['CRCTest', 'CounterTest', 'SigInvalidTest', 'SigvalueInvalidTest', 'FactorTest']
  const parseParamCols = (cells: string[], target: 'message' | 'signal'): any[] =>
    parseParamColumns(cells, target).map((p) => ({
      value: p.value,
      label: p.value,
      target: (target === 'signal' && !KNOWN_SIG_PARAMS.includes(p.value)) ? 'eps' : p.target,
      params: { ...p.params },
      enabled: hasParamData(p),
    }))
  // 平铺测试参数列（新导出格式：每类参数每字段一列，如 LostTest / SigInvalidTest / SigInvalidTest_DTC）
  const parseParamFlat = (cells: Record<string, string>): any[] =>
    parseFlatParamCells(cells).map((p) => ({
      value: p.value,
      label: p.value,
      target: p.target,
      params: { ...p.params },
      enabled: hasParamData(p),
    }))
  // 「报文测试参数」列只写在报文行（信号行留空）；按报文取首个非空值，
  // 兼容手工把内容填在其它行的情况。
  const msgParamsText = new Map<string, string>()
  for (const rec of records) {
    if (rec.msgName && rec.msgTestParams && !msgParamsText.has(rec.msgName)) {
      msgParamsText.set(rec.msgName, rec.msgTestParams)
    }
  }
  // 兼容旧 Excel：从 lostDTC/dlcDTC/DTC/Signal_Type/Data_Type/XCP_CCP_varname 列自动生成测试参数卡片
  const newMap = new Map<string, any[]>()
  // 报文级参数（LostTest / DlcTest）按「非 EPS 报文」去重生成，与信号行是否携带信号名无关
  const seenMsgKeys = new Set<string>()
  for (const rec of records) {
    if (rec.msgName && !seenMsgKeys.has(rec.msgName)) {
      seenMsgKeys.add(rec.msgName)
      const explicitMsg = parseParamJson(msgParamsText.get(rec.msgName) || '')
      const fromMsgCols = parseParamCols(rec.paramCells, 'message')
      const fromMsgFlat = parseParamFlat(rec.flatParamCells)
      if (explicitMsg.length) {
        newMap.set(rec.msgName, explicitMsg)
      } else if (fromMsgCols.length) {
        newMap.set(rec.msgName, fromMsgCols)
      } else if (fromMsgFlat.length) {
        newMap.set(rec.msgName, fromMsgFlat)
      } else if (rec.senders !== 'EPS') {
        const params = buildAutoMsgTestParams({
          senders: rec.senders,
          lostDtc: rec.lostDtc,
          dlcDtc: rec.dlcDtc,
        })
        if (params.length) newMap.set(rec.msgName, params)
      }
    }
    if (rec.signalName) {
      const key = `${rec.msgName}:::${rec.signalName}`
      const explicitSig = parseParamJson(rec.sigTestParams)
      if (explicitSig.length) {
        newMap.set(key, explicitSig)
        continue
      }
      const fromSigCols = parseParamCols(rec.paramCells, 'signal')
      if (fromSigCols.length) {
        newMap.set(key, fromSigCols)
        continue
      }
      const fromSigFlat = parseParamFlat(rec.flatParamCells)
      if (fromSigFlat.length) {
        newMap.set(key, fromSigFlat)
        continue
      }
      const fields = {
        invalidValue: rec.invalidValue,
        dataType: rec.dataType,
        testDataType: rec.testDataType,
        dtc: rec.dtc,
        signalType: rec.signalType,
        xcpVar: rec.xcpVar,
        minPhy: rec.minPhy,
        maxPhy: rec.maxPhy,
        factor: rec.factor,
        offset: rec.offset,
      }
      // 参考 AutoTool.py：仅 Test == 'Y' 的信号生成测试用例
      if (isTruthyTest(rec.test)) {
        const params = buildAutoSigTestParams(fields, rec.signalName, rec.senders === 'EPS')
        if (params.length) newMap.set(key, params)
      }
    }
  }
  // 导入新 DBC 时保留已加载配置的测试参数（EPS 的 et / FactorTest 变量 / DTC 等）：
  // 之前 buildSignalRowsFromRaw 无条件用新 DBC 自动匹配结果覆盖 testParamMap，
  // 导致「先加载配置再导入 DBC」时配置参数被清空丢失。
  // 现改为合并：已有配置参数全量保留；仅对无配置记录的键采用新 DBC 自动匹配结果；
  // 重叠键按「配置优先」合并，并跳过 EPS 类型重复卡片（配置 et 与自动识别算法二选一）。
  const prevParams = testParamMap.value
  if (prevParams && prevParams.size) {
    for (const [key, saved] of prevParams) {
      if (!newMap.has(key)) {
        newMap.set(key, saved)
        continue
      }
      const merged = [...saved]
      const present = new Set(saved.map((p: any) => p.value))
      for (const np of newMap.get(key)!) {
        if (np.target === 'eps') continue // 配置的 EPS 卡片优先，避免同信号出两张 EPS 卡
        if (!present.has(np.value)) {
          merged.push(np)
          present.add(np.value)
        }
      }
      newMap.set(key, merged)
    }
  }
  // 导入前按规范校验并纠正测试参数（非法值清空/移除，合法值规范化），并汇总提示
  testParamMap.value = sanitizeImportedParamMap(newMap)
  return records.map((rec) => {
    const row = { __id: signalRowSeq++ } as SignalRow
    signalColumns.forEach((c) => { row[c.key] = '' })
    row.invalidValue = rec.invalidValue
    row.dataType = rec.dataType
    row.signalType = rec.signalType
    row.senders = rec.senders
    row.msgName = rec.msgName
    row.msgId = rec.msgId
    row.msgCycleTime = rec.cycle
    row.msgLength = rec.length
    row.signalName = rec.signalName
    row.factor = rec.factor
    row.offset = rec.offset
    row.minPhy = rec.minPhy
    row.maxPhy = rec.maxPhy
    row.initialValue = rec.initialValue
    row.valueDesc = rec.valueDesc
    row.byteOrder = rec.byteOrder
    row.startBit = rec.startBit
    row.bitLength = rec.bitLength
    row.dtc = rec.dtc || ''
    row.xcpVar = rec.xcpVar || ''
    row.lostDtc = rec.lostDtc || ''
    row.dlcDtc = rec.dlcDtc || ''
    if (rec.test !== undefined) row.test = rec.test
    if (rec.msgTest !== undefined) row.msgTest = rec.msgTest
    return row
  })
}

// ==================== 主 DBC 树形展示 ====================

const mainDbcTreeRef = ref()

function expandAllMainTree() {
  const store = mainDbcTreeRef.value?.store
  if (!store) return
  Object.values(store.nodesMap).forEach((node: any) => {
    const data = node.data
    // 信号与报文同级，只展开 sender 即可看到报文和信号
    if (data && data.type === 'sender') {
      node.expanded = true
    } else {
      node.expanded = false
    }
  })
}

function collapseAllMainTree() {
  const store = mainDbcTreeRef.value?.store
  if (!store) return
  Object.values(store.nodesMap).forEach((node: any) => { node.expanded = false })
}

const treeProps = { label: 'label', children: 'children', disabled: 'disabled' }
const editingAttrId = ref<string | null>(null)
const attrInputRef = ref()
let mainTreeIdSeq = 0

const treeExpandedKeys = ref<string[]>([])
const treeData = ref<any[]>([])

function initTreeExpandedKeys() {
  const keys: string[] = []
  function walk(nodes: any[]) {
    for (const n of nodes) {
      // 信号与报文同级，只展开 sender 即可看到报文和信号
      if (n.type === 'sender') keys.push(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(treeData.value)
  treeExpandedKeys.value = keys
}

function onTreeExpandChange(_key: string, _expanded: boolean) {}

// ====== DBC 更新对比（新增/差异对象黄色高亮） ======
function pickMsgAttrs(msg: any): Record<string, any> {
  if (!msg) return {}
  return {
    msgId: msg.msgId,
    msgType: msg.msgType,
    msgSendType: msg.msgSendType,
    cycle: msg.cycle,
    cycleFast: msg.cycleFast,
    nrOfReption: msg.nrOfReption,
    length: msg.length,
    lostDtc: msg.lostDtc,
    dlcDtc: msg.dlcDtc,
  }
}

function pickSigAttrs(fields: any): Record<string, any> {
  if (!fields) return {}
  return {
    invalidValue: fields.invalidValue,
    dataType: fields.dataType,
    dtc: fields.dtc,
    signalType: fields.signalType,
    xcpVar: fields.xcpVar,
    minPhy: fields.minPhy,
    maxPhy: fields.maxPhy,
    factor: fields.factor,
    offset: fields.offset,
    byteOrder: fields.byteOrder,
    startByte: fields.startByte,
    startBit: fields.startBit,
    bitLength: fields.bitLength,
    unit: fields.unit,
    initialValue: fields.initialValue,
    valueDesc: fields.valueDesc,
  }
}

function getNodeChangeKey(data: any): string {
  if (data.type === 'message') return data.name || ''
  if (data.type === 'signal') {
    const msgName = data.msg?.msgName || data.msg?.name || ''
    return getTestParamsKey(msgName, data.name)
  }
  return ''
}

function extractDbcSnapshot(nodes: any[]): Record<string, any> {
  const snapshot: Record<string, any> = {}
  function walk(list: any[]) {
    for (const node of list) {
      if (node.type === 'message') {
        snapshot[getNodeChangeKey(node)] = { type: 'message', attrs: pickMsgAttrs(node.msg) }
      } else if (node.type === 'signal') {
        snapshot[getNodeChangeKey(node)] = { type: 'signal', attrs: pickSigAttrs(node.fields) }
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return snapshot
}

/** 对比当前（上传）DBC 快照与配置基准快照，标记新增/差异对象。
 *  仅当存在用户上传的 DBC 时才有意义；加载配置本身不触发高亮。 */
function computeDbChangeMarks(current: Record<string, any>, base: Record<string, any>) {
  const marks: Record<string, 'new' | 'diff'> = {}
  for (const [key, item] of Object.entries(current)) {
    if (!(key in base)) {
      marks[key] = 'new'
    } else if (JSON.stringify(base[key]) !== JSON.stringify(item)) {
      marks[key] = 'diff'
    }
  }
  dbChangeMarks.value = marks
}

function getDbChangeMark(data: any): 'new' | 'diff' | null {
  const key = getNodeChangeKey(data)
  if (!key) return null
  return dbChangeMarks.value[key] || null
}

/** 自动为所有报文和信号匹配测试参数（幂等：仅对尚无参数的节点补充）。
 *  基于报文 lostDtc/dlcDtc、信号 signalType/invalidValue/minPhy/maxPhy/xcpVar/dtc 自动判断。 */
function autoMatchTestParams(nodes: any[]) {
  for (const node of nodes) {
    if (node.type === 'message') {
      const key = getTestParamsKey(node.name)
      if (!(testParamMap.value.get(key) || []).length) {
        const params = buildAutoMsgTestParams(node.msg || {})
        if (params.length) {
          testParamMap.value = new Map(testParamMap.value)
          testParamMap.value.set(key, params)
        }
      }
    } else if (node.type === 'signal') {
      const msgName = node.msg?.msgName || node.msg?.name
      const key = getTestParamsKey(msgName, node.name)
      if (!(testParamMap.value.get(key) || []).length) {
        const isEps = node.msg?.senders === 'EPS'
        const params = buildAutoSigTestParams(node.fields || {}, node.name, isEps)
        if (params.length) {
          testParamMap.value = new Map(testParamMap.value)
          testParamMap.value.set(key, params)
        }
      }
    }
    if (node.children?.length) autoMatchTestParams(node.children)
  }
}

function mergeTestParamsIntoTree(nodes: any[]) {
  for (const node of nodes) {
    if (node.type === 'message') {
      const key = getTestParamsKey(node.name)
      const saved = testParamMap.value.get(key) || []
      node.testParams = saved.map((s: any) => ({
        value: s.value,
        label: s.label,
        target: s.target || 'message',
        params: { ...s.params },
        enabled: hasParamData(s),
      }))
    } else if (node.type === 'signal') {
      const key = getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
      const saved = testParamMap.value.get(key) || []
      node.testParams = saved.map((s: any) => ({
        value: s.value,
        label: s.label,
        target: s.target || 'signal',
        params: { ...s.params },
        enabled: hasParamData(s),
      }))
    }
    if (node.children?.length) mergeTestParamsIntoTree(node.children)
  }
}

/** 加载配置时：对缺少默认测试参数的节点补全卡片用于树形图显示（只补空，不覆盖已保存参数）。
 *  - 非 EPS 报文：补 LostTest / DlcTest（未填 DTC 时显示为灰色）
 *  - EPS 信号：补 et（target==='eps'），优先取配置中保存的 et 值（如 E2E_CRC）
 *  - 非 EPS 信号：补 SigInvalidTest（CRC / Counter / 布尔型 / 无效值），与导入时自动匹配保持一致
 *  识别依据信号名 / Signal_Type / 物理最小最大值（与 buildAutoSigTestParams 一致）。 */
function autoMatchMissingParams(nodes: any[], parentEps = false) {
  for (const node of nodes) {
    const isEps = parentEps || node.name === 'EPS' || node.msg?.senders === 'EPS'
    if (node.type === 'message') {
      if (!isEps) {
        const key = getTestParamsKey(node.name)
        const existing = testParamMap.value.get(key) || []
        const missing = buildAutoMsgTestParams(node.msg || {})
          .filter((d: any) => !existing.some((p: any) => p.value === d.value))
          .map((d: any) => ({ ...d, enabled: hasParamData(d) }))
        if (missing.length) {
          node.testParams = [...(node.testParams || []), ...missing]
          const next = new Map(testParamMap.value)
          next.set(key, [...existing, ...missing])
          testParamMap.value = next
        }
      }
    } else if (node.type === 'signal') {
      const key = getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
      if (isEps) {
        if (!node.testParams?.some((p: any) => p.target === 'eps')) {
          // 优先使用配置中保存的 et 值
          const cfg = jsonDbcRaw.value
          const sender = node.msg?.senders || node.name
          const savedEt = cfg?.[sender]?.[node.msg?.msgName]?.signals?.[node.name]?.et
          let cand = buildAutoSigTestParams(node.fields || {}, node.name, true)
          if (!cand.length && savedEt) {
            cand = [{ value: savedEt, label: savedEt, target: 'eps', params: {}, enabled: true }]
          } else if (cand.length && savedEt) {
            cand = [{ ...cand[0], value: savedEt, label: savedEt }]
          }
          const epsCand = cand.find((p: any) => p.target === 'eps')
          if (epsCand) {
            if (!node.testParams?.some((p: any) => p.target === 'eps')) {
              node.testParams = [...(node.testParams || []), epsCand]
            }
            const existing = testParamMap.value.get(key) || []
            if (!existing.some((p: any) => p.target === 'eps')) {
              const next = new Map(testParamMap.value)
              next.set(key, [...existing, epsCand])
              testParamMap.value = next
            }
          }
        }
      } else {
        // 非 EPS：已有「无效值」类参数（CRCTest / CounterTest / SigInvalidTest）则跳过，否则自动识别补全
        const existing = testParamMap.value.get(key) || []
        const hasSigInvalid = (list: any[]) => list.some((p: any) => SIG_INVALID_PARAM_VALUES.includes(p.value))
        if (!hasSigInvalid(node.testParams || [])) {
          const cand = buildAutoSigTestParams(node.fields || {}, node.name, false)
            .find((p: any) => SIG_INVALID_PARAM_VALUES.includes(p.value))
          if (cand) {
            const filled = { ...cand, enabled: hasParamData(cand) }
            node.testParams = [...(node.testParams || []), filled]
            if (!hasSigInvalid(existing)) {
              const next = new Map(testParamMap.value)
              next.set(key, [...existing, filled])
              testParamMap.value = next
            }
          }
        }
      }
    }
    if (node.children?.length) autoMatchMissingParams(node.children, isEps)
  }
}

function isTruthyTest(val: string | undefined | null): boolean {
  if (val === undefined || val === null || val === '') return true
  const s = String(val).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === '是'
}

/** 从任意 DBC 原始数据构建树（兼容对象字典格式与记录格式）。
 *  抽离出来以便分别基于「配置 DBC」与「上传 DBC」构建快照做对比。 */
function buildDbcTreeFromRaw(raw: any): any[] {
  try {
  // 对象字典格式（从配置加载）：{ senderName: { msgName: { id, cy, ln, lk, tp, signals: {...} } } }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !raw.columns && !raw.rows) {
    return buildTreeFromDict(raw)
  }

  const records = parseDbcRecords(raw)
  if (!records.length) return []

  const senderMap = new Map<string, typeof records>()
  for (const rec of records) {
    const sender = rec.senders || 'Unknown'
    if (!senderMap.has(sender)) senderMap.set(sender, [] as any)
    senderMap.get(sender)!.push(rec)
  }

  const tree: any[] = []
  mainTreeIdSeq = 0

  for (const [sender, senderRecords] of senderMap) {
    const msgMap = new Map<string, typeof records>()
    for (const rec of senderRecords) {
      const key = rec.msgName || rec.msgId || 'Unknown'
      if (!msgMap.has(key)) msgMap.set(key, [] as any)
      msgMap.get(key)!.push(rec)
    }

    const senderNode: any = {
      id: `sender${mainTreeIdSeq++}`,
      label: sender,
      type: 'sender',
      name: sender,
      children: [],
      disabled: true,
    }

    for (const [msgName, msgRecords] of msgMap) {
      const first = msgRecords[0]
      const msg = {
        senders: first.senders,
        msgName: first.msgName,
        msgType: first.msgType,
        msgId: first.msgId,
        msgSendType: first.msgSendType,
        cycle: first.cycle,
        cycleFast: first.cycleFast,
        nrOfReption: first.nrOfReption,
        length: first.length,
        lostDtc: first.lostDtc,
        dlcDtc: first.dlcDtc,
      }

      // 兼容旧 Excel：无独立 msgTest 列时，回退到 Test 列（报文行 Y/N）
      const msgChecked = isTruthyTest(first.msgTest || first.test)

      const msgNode: any = {
        id: `m${mainTreeIdSeq++}`,
        label: msgName,
        type: 'message',
        name: msgName,
        msg,
        checked: msgChecked,
        testParams: [],
        children: [],
      }

      const msgAttrDefs: Array<[string, string, any]> = [
        ['报文类型', 'msgType', first.msgType],
        ['报文标识符', 'msgId', first.msgId],
        ['报文发送类型', 'msgSendType', first.msgSendType],
        ['报文周期时间', 'cycle', first.cycle],
        ['报文发送的快速周期(ms)', 'cycleFast', first.cycleFast],
        ['报文快速发送的次数', 'nrOfReption', first.nrOfReption],
        ['报文长度', 'length', first.length],
        ['lostDTC', 'lostDtc', first.lostDtc],
        ['dlcDTC', 'dlcDtc', first.dlcDtc],
      ]
      for (const [label, tableKey, value] of msgAttrDefs) {
        msgNode.children.push({
          id: `a${mainTreeIdSeq++}`,
          label,
          type: 'attr',
          tableKey,
          value,
          parentType: 'message',
          parentMsg: msgName,
          disabled: true,
        })
      }

      senderNode.children.push(msgNode)

      for (const rec of msgRecords) {
        if (!rec.signalName) continue
          const fields = {
            invalidValue: rec.invalidValue,
            dataType: rec.dataType,
            lostDtc: rec.lostDtc,
            dlcDtc: rec.dlcDtc,
            dtc: rec.dtc,
            signalType: rec.signalType,
            xcpVar: rec.xcpVar,
            minPhy: rec.minPhy,
            maxPhy: rec.maxPhy,
            factor: rec.factor,
            offset: rec.offset,
            byteOrder: rec.byteOrder,
            startByte: rec.startByte,
            startBit: rec.startBit,
            bitLength: rec.bitLength,
            unit: rec.unit,
            initialValue: rec.initialValue,
            valueDesc: rec.valueDesc,
          }

          const signalNode: any = {
            id: `s${mainTreeIdSeq++}`,
            label: rec.signalName,
            type: 'signal',
            name: rec.signalName,
            fields,
            msg,
            checked: isTruthyTest(rec.test) && msgChecked,
            testParams: [],
            children: [],
          }

          const sigAttrDefs: Array<[string, string, any]> = [
            ['无效值', 'invalidValue', rec.invalidValue],
            ['数据类型', 'dataType', rec.dataType],
            ['DTC', 'dtc', rec.dtc],
            ['XCP_CCP_varname', 'xcpVar', rec.xcpVar],
            ['排列格式', 'byteOrder', rec.byteOrder],
            ['起始字节', 'startByte', rec.startByte],
            ['起始位', 'startBit', rec.startBit],
            ['信号长度', 'bitLength', rec.bitLength],
            ['精度', 'factor', rec.factor],
            ['偏移量', 'offset', rec.offset],
            ['物理最小值', 'minPhy', rec.minPhy],
            ['物理最大值', 'maxPhy', rec.maxPhy],
            ['初始值', 'initialValue', rec.initialValue],
            ['单位', 'unit', rec.unit],
          ]
          for (const [label, tableKey, value] of sigAttrDefs) {
            signalNode.children.push({
              id: `sa${mainTreeIdSeq++}`,
              label,
              type: 'attr',
              tableKey,
              value,
              parentType: 'signal',
              parentMsg: msgName,
              parentSignal: rec.signalName,
              disabled: true,
            })
          }

          senderNode.children.push(signalNode)
      }
    }

    tree.push(senderNode)
  }

  return tree
  } catch (e) {
    console.error('[CAN] buildDbcTreeFromRaw error:', e)
    return []
  }
}

/** 主 DBC 树：合并后的有效 DBC（上传 > 配置 > CFG） */
const mainDbcTree = computed(() => buildDbcTreeFromRaw(mergedDbcRaw.value))

/** 判定信号是否为 CRC / Counter（与 buildAutoSigTestParams 的识别规则一致）：
 *  信号名或 Signal_Type 列命中关键词即视为 CRC / Counter。 */
function isCrcOrCounterSignal(signalName: string, signalType?: string): boolean {
  const sn = String(signalName || '').toLowerCase()
  const st = String(signalType || '').toLowerCase()
  const isCrc = sn.includes('crc') || sn.includes('checksum') || sn.includes('csum') ||
    st.includes('crc') || st.includes('checksum') || st.includes('csum')
  const isCounter = sn.includes('counter') || sn.includes('rollcnt') || sn.includes('rolling') ||
    sn.includes('seq') || sn.includes('_cnt') || sn.includes('cnt_') ||
    st.includes('counter')
  return isCrc || isCounter
}

/** 树中「信号名 -> Signal_Type」：保存时据以识别 CRC / Counter（取 DBC 表格当前节点数据） */
const signalTypeLookup = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  const walk = (nodes: any[]) => {
    for (const node of nodes || []) {
      if (node?.type === 'signal') {
        const name = String(node.name || node.label || '').trim()
        if (name && map[name] === undefined) map[name] = String(node.fields?.signalType || '')
      }
      if (node?.children?.length) walk(node.children)
    }
  }
  walk(treeData.value as any[])
  return map
})

/** 树中「信号名 -> 无效值」：直接取自 DBC 报文信号表的 Invalid_Value 列（EPS 信号）。
 *  统一归一化为后端期望的「逗号分隔数值」形式（如 "0" / "0, 100"），
 *  兼容 DBC/Excel 的列表字符串写法（如 "[0,1]"）；未填写无效值的信号不会出现在此表中。 */
const signalInvalidValueLookup = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  const walk = (nodes: any[]) => {
    for (const node of nodes || []) {
      if (node?.type === 'signal' && node.msg?.senders === 'EPS') {
        const name = String(node.name || node.label || '').trim()
        const list = parseInvalidValueList(node.fields?.invalidValue)
        const normalized = list.join(', ')
        if (name && normalized && map[name] === undefined) map[name] = normalized
      }
      if (node?.children?.length) walk(node.children)
    }
  }
  walk(treeData.value as any[])
  return map
})

/** 配置级 DBC（不含用户上传的 DBC）：作为上传 DBC 对比的基准 */
const configDbcRaw = computed<any>(() => {
  const jsonCfg = jsonDbcRaw.value
  if (jsonCfg && (jsonCfg.rows?.length > 0 || Object.keys(jsonCfg).length > 0)) return jsonCfg
  const cfg = store.objCfgDbcRaw
  if (cfg && cfg?.rows?.length > 0) return cfg
  return null
})

/** 从对象字典格式构建树（配置加载时使用） */
function buildTreeFromDict(raw: Record<string, any>): any[] {
  const tree: any[] = []
  mainTreeIdSeq = 0

  for (const [senderName, messages] of Object.entries(raw)) {
    if (!messages || typeof messages !== 'object') continue
    const senderNode: any = {
      id: `sender${mainTreeIdSeq++}`,
      label: senderName,
      type: 'sender',
      name: senderName,
      children: [],
      disabled: true,
    }
    const isEps = senderName === 'EPS'

    for (const [msgName, msgData] of Object.entries(messages as Record<string, any>)) {
      if (!msgData || typeof msgData !== 'object') continue
      const msg = {
        senders: senderName,
        msgName,
        msgType: '',
        msgId: msgData.id || '',
        msgSendType: '',
        cycle: msgData.cy || '',
        cycleFast: '',
        nrOfReption: '',
        length: msgData.ln || '',
        lostDtc: msgData.ld || '',
        dlcDtc: msgData.dd || '',
      }
      const msgChecked = !!msgData.lk

      // 报文测试参数（仅恢复已保存的配置，不再预置全部）
      let msgTestParams: any[] = []
      if (!isEps && msgData.tp && typeof msgData.tp === 'object') {
        msgTestParams = Object.entries(msgData.tp).map(([value, params]) => {
          const p = msgTestParamList.find((x) => x.value === value)
          return {
            value,
            label: p?.label || value,
            target: 'message',
            params: { ...(params as any) },
          }
        })
      }

      const msgNode: any = {
        id: `m${mainTreeIdSeq++}`,
        label: msgName,
        type: 'message',
        name: msgName,
        msg,
        checked: msgChecked,
        testParams: msgTestParams,
        children: [],
      }

      const msgAttrDefs: Array<[string, string, any]> = [
        ['报文类型', 'msgType', ''],
        ['报文标识符', 'msgId', msgData.id || ''],
        ['报文发送类型', 'msgSendType', ''],
        ['报文周期时间', 'cycle', msgData.cy || ''],
        ['报文发送的快速周期(ms)', 'cycleFast', ''],
        ['报文快速发送的次数', 'nrOfReption', ''],
        ['报文长度', 'length', msgData.ln || ''],
        ['lostDTC', 'lostDtc', msgData.ld || ''],
        ['dlcDTC', 'dlcDtc', msgData.dd || ''],
      ]
      for (const [label, tableKey, value] of msgAttrDefs) {
        msgNode.children.push({
          id: `a${mainTreeIdSeq++}`,
          label,
          type: 'attr',
          tableKey,
          value,
          parentType: 'message',
          parentMsg: msgName,
          disabled: true,
        })
      }

      senderNode.children.push(msgNode)

      const signals = msgData.signals
      if (signals && typeof signals === 'object') {
        for (const [sigName, sigData] of Object.entries(signals as Record<string, any>)) {
          if (!sigData || typeof sigData !== 'object') continue
          const fields = {
            invalidValue: sigData.iv || '',
            dataType: sigData.dt || '',
            lostDtc: '',
            dlcDtc: '',
            dtc: '',
            signalType: sigData.st || '',
            xcpVar: '',
            minPhy: sigData.mn || '',
            maxPhy: sigData.mx || '',
            factor: sigData.fc || '',
            offset: sigData.of || '',
            byteOrder: sigData.bo || '',
            startBit: sigData.sb || '',
            bitLength: sigData.bl || '',
            startByte: sigData.sbyte || '',
            unit: sigData.unit || '',
            initialValue: sigData.iv_init || '',
            valueDesc: sigData.vd || '',
          }

          let sigTestParams: any[] = []
          if (sigData.tp && typeof sigData.tp === 'object') {
            sigTestParams = migrateParamList(
              Object.entries(sigData.tp).map(([value, params]) => {
                const p = sigTestParamList.find((x) => x.value === value)
                return {
                  value,
                  label: p?.label || value,
                  target: 'signal',
                  params: { ...(params as any) },
                }
              })
            )
          }
          // EPS 信号：从 et 恢复 EPS 类型为测试参数（target === 'eps'）
          if (isEps && sigData.et) {
            sigTestParams = [...sigTestParams, {
              value: sigData.et,
              label: sigData.et,
              target: 'eps',
              params: {},
            }]
          }

          const signalNode: any = {
            id: `s${mainTreeIdSeq++}`,
            label: sigName,
            type: 'signal',
            name: sigName,
            fields,
            msg,
            checked: !!sigData.lk,
            testParams: sigTestParams,
            children: [],
          }

          const sigAttrDefs: Array<[string, string, any]> = [
            ['无效值', 'invalidValue', ''],
            ['数据类型', 'dataType', sigData.dt || ''],
            ['DTC', 'dtc', ''],
            ['XCP_CCP_varname', 'xcpVar', ''],
            ['排列格式', 'byteOrder', sigData.bo || ''],
            ['起始字节', 'startByte', sigData.sbyte || ''],
            ['起始位', 'startBit', sigData.sb || ''],
            ['信号长度', 'bitLength', sigData.bl || ''],
            ['精度', 'factor', sigData.fc || ''],
            ['偏移量', 'offset', sigData.of || ''],
            ['物理最小值', 'minPhy', sigData.mn || ''],
            ['物理最大值', 'maxPhy', sigData.mx || ''],
            ['初始值', 'initialValue', sigData.iv || ''],
            ['单位', 'unit', sigData.unit || ''],
          ]
          for (const [label, tableKey, value] of sigAttrDefs) {
            signalNode.children.push({
              id: `sa${mainTreeIdSeq++}`,
              label,
              type: 'attr',
              tableKey,
              value,
              parentType: 'signal',
              parentMsg: msgName,
              parentSignal: sigName,
              disabled: true,
            })
          }

          senderNode.children.push(signalNode)
        }
      }
    }

    tree.push(senderNode)
  }

  return tree
}

function onMainTreeNodeClick(data: any, node: any) {
  // 如果点击的是同一个已选中的节点，切换展开/折叠
  if (selectedTreeNode.value && selectedTreeNode.value.id === data.id) {
    if (node && node.childNodes?.length) {
      node.expanded = !node.expanded
    }
  } else {
    // 首次点击：选中该节点
    selectedTreeNode.value = data
  }
}

function onTreeCheckChange(data: any, checked: boolean, _indeterminate?: boolean) {
  if (!data || data.type !== 'message' && data.type !== 'signal') return
  // 同步勾选状态到节点自身（Element Plus @check-change 参数顺序: data, checked, indeterminate）
  if (!!data.checked !== !!checked) {
    recordUndo({ kind: 'checked', node: data, before: !!data.checked }, checked ? '标记测试' : '取消测试')
  }
  data.checked = checked
}

function treeNodeClass(data: any): string {
  if (data.type === 'sender' || data.type === 'attr') {
    return 'hide-checkbox'
  }
  return ''
}

function syncTreeCheckedState(nodes: any[]) {
  for (const node of nodes) {
    if (node.type === 'message' || node.type === 'signal') {
      if (node.checked) {
        mainDbcTreeRef.value?.setCheckedKeys([
          ...(mainDbcTreeRef.value?.getCheckedKeys() || []),
          node.id,
        ])
      }
    }
    if (node.children?.length) syncTreeCheckedState(node.children)
  }
}

// ==================== DBC 报文信号表：表格视图 ====================

/** 视图模式：tree = 树形图 / table = 分组表格（默认表格，用 localStorage 记忆） */
const DBC_TABLE_VIEW_KEY = 'canview_dbc_view_mode'
const dbcViewMode = ref<'tree' | 'table'>(localStorage.getItem(DBC_TABLE_VIEW_KEY) === 'tree' ? 'tree' : 'table')

function setDbcViewMode(mode: 'tree' | 'table') {
  dbcViewMode.value = mode
  try {
    localStorage.setItem(DBC_TABLE_VIEW_KEY, mode)
  } catch { /* ignore */ }
}

/** 视图切换（radio 的 change 事件值为 string，这里收敛为联合类型） */
function onDbcViewChange(value: any) {
  setDbcViewMode(value === 'tree' ? 'tree' : 'table')
  if (dbcViewMode.value === 'tree') {
    // el-tree 的 expanded-keys 只在属性「内容变化」时应用，而树是懒挂载的（默认表格视图）：
    // 切回树视图后直接按默认层级（展开 sender）重新应用一次，否则会全部收起
    nextTick(() => expandAllMainTree())
  }
}

/** 表格列定义：严格对齐通信矩阵「Test + 这 13 列」再加上「测试参数」。
 *  scope：common = 两类行通用 / msg = 报文级 / sig = 信号级；
 *  path：相对行/节点的取值路径（senderName / msg.xxx / fields.xxx）。 */
const dbcTableColumns: DbcTableColumn[] = [
  { key: 'test', label: 'Test', scope: 'both', type: 'test', defaultVisible: true, width: 70 },
  { key: 'senders', label: '发送节点', en: 'Senders', scope: 'common', path: 'senderName', editable: true, defaultVisible: true, width: 110 },
  { key: 'msgName', label: '报文名称', en: 'Msg_Name', scope: 'msg', path: 'msg.msgName', defaultVisible: true, minWidth: 130 },
  { key: 'msgId', label: '报文标识符', en: 'Msg_ID', scope: 'msg', path: 'msg.msgId', editable: true, defaultVisible: true, minWidth: 120 },
  { key: 'msgCycleTime', label: '报文周期时间', en: 'Msg_Cycle_Time', scope: 'msg', path: 'msg.cycle', editable: true, defaultVisible: true, minWidth: 120 },
  { key: 'msgLength', label: '报文长度', en: 'Msg_Length', scope: 'msg', path: 'msg.length', editable: true, defaultVisible: true, minWidth: 100 },
  { key: 'signalName', label: '信号名称', en: 'Signal_Name', scope: 'sig', path: 'name', defaultVisible: true, minWidth: 150 },
  { key: 'factor', label: '精度', en: 'Factor', scope: 'sig', path: 'fields.factor', editable: true, defaultVisible: true, minWidth: 90 },
  { key: 'offset', label: '偏移量', en: 'Offset', scope: 'sig', path: 'fields.offset', editable: true, defaultVisible: true, minWidth: 90 },
  { key: 'minPhy', label: '物理最小值', en: 'Signal_Min_Value_Phy', scope: 'sig', path: 'fields.minPhy', editable: true, defaultVisible: true, minWidth: 120 },
  { key: 'maxPhy', label: '物理最大值', en: 'Signal_Max_Value_Phy', scope: 'sig', path: 'fields.maxPhy', editable: true, defaultVisible: true, minWidth: 120 },
  { key: 'initialValue', label: '初始值', en: 'Initial_Value', scope: 'sig', path: 'fields.initialValue', editable: true, defaultVisible: true, minWidth: 100 },
  { key: 'invalidValue', label: '无效值', en: 'Invalid_Value', scope: 'sig', path: 'fields.invalidValue', editable: true, defaultVisible: true, minWidth: 110 },
  { key: 'valueDesc', label: '信号值描述', en: 'Signal_Value_Descriptions', scope: 'sig', path: 'fields.valueDesc', editable: true, defaultVisible: true, minWidth: 150 },
  { key: 'params', label: '测试参数', scope: 'both', type: 'params', defaultVisible: true, minWidth: 200 },
]

// ==================== 表格列显隐 / 顺序 / 列宽（工具按钮放在页签头部，与树形图共用）====================

const DBC_TABLE_COLUMNS_KEY = 'canview_dbc_table_columns_v3'

interface DbcColumnState {
  key: string
  visible: boolean
  width?: number
}

const dbcColumnState = ref<DbcColumnState[]>([])
/**
 * 按内容自适应算出的列宽（表头不参与，见 DbcSignalTable 的 `auto-widths`）。
 * 只作用于「没手动拖过」的列；**不持久化**，每次数据/列变化都会重算。
 */
const dbcAutoWidth = ref<Record<string, number>>({})

/** 用户手动拖拽过的列宽（持久化在 dbcColumnState 里）；没拖过则 undefined */
function userWidthOf(key: string): number | undefined {
  return dbcColumnState.value.find((s) => s.key === key)?.width
}

function loadDbcColumnState() {
  try {
    const raw = localStorage.getItem(DBC_TABLE_COLUMNS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const list: DbcColumnState[] = []
    for (const item of parsed) {
      const key = String(item?.key ?? '')
      if (!key) continue
      const width = Number(item?.width)
      list.push({
        key,
        visible: item?.visible !== false,
        width: Number.isFinite(width) && width > 0 ? Math.round(width) : undefined,
      })
    }
    dbcColumnState.value = list
  } catch { /* ignore */ }
}

function persistDbcColumnState() {
  try {
    localStorage.setItem(DBC_TABLE_COLUMNS_KEY, JSON.stringify(dbcColumnState.value))
  } catch { /* ignore */ }
}

/** 全列（顺序 + 显隐 + 宽度）：已删除的列忽略，新列追加末尾 */
const dbcOrderedColumns = computed(() => {
  const byKey = new Map(dbcTableColumns.map((c) => [c.key, c]))
  const out: Array<DbcTableColumn & { visible: boolean }> = []
  const push = (c: DbcTableColumn, st?: DbcColumnState) => {
    const base: DbcTableColumn & { visible: boolean } = {
      ...c,
      visible: st ? st.visible : c.defaultVisible !== false,
    }
    // 手动拖过的列宽优先；没拖过的用内容自适应宽度；两者都没有则回落到列自带的 minWidth
    const w = st?.width ?? dbcAutoWidth.value[c.key]
    if (w) base.width = w
    out.push(base)
  }
  for (const st of dbcColumnState.value) {
    const c = byKey.get(st.key)
    if (!c) continue
    push(c, st)
    byKey.delete(st.key)
  }
  for (const c of byKey.values()) push(c)
  return out
})

const dbcTableVisibleColumns = computed(() => dbcOrderedColumns.value.filter((c) => c.visible))

function snapshotDbcColumnState(overrides: Record<string, Partial<DbcColumnState>> = {}) {
  dbcColumnState.value = dbcOrderedColumns.value.map((c) => {
    // 这里必须取「用户手动宽度」而不是 c.width —— 后者可能是自适应算出来的，
    // 一旦写进 state 就会被当成手动宽度持久化，自适应从此不再生效。
    const cur: DbcColumnState = { key: c.key, visible: c.visible, width: userWidthOf(c.key) }
    return { ...cur, ...(overrides[c.key] || {}) }
  })
  persistDbcColumnState()
}

function onDbcColumnVisibleChange(key: string, visible: boolean) {
  snapshotDbcColumnState({ [key]: { visible } })
}

function moveDbcColumn(index: number, delta: number) {
  // 同 snapshotDbcColumnState：只带用户手动宽度，别把自适应算出的宽度写进 state 持久化
  const list = dbcOrderedColumns.value.map((c) => ({ key: c.key, visible: c.visible, width: userWidthOf(c.key) }))
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  dbcColumnState.value = list
  persistDbcColumnState()
}

function resetDbcColumns() {
  dbcColumnState.value = []
  try {
    localStorage.removeItem(DBC_TABLE_COLUMNS_KEY)
  } catch { /* ignore */ }
}

function onDbcColumnResize(key: string, width: number) {
  snapshotDbcColumnState({ [key]: { width } })
}

/** 采纳表格按内容算出的自适应宽度；值没变就不动 state，避免与 props.columns 来回触发 */
function onDbcAutoWidths(widths: Record<string, number>) {
  const cur = dbcAutoWidth.value
  const keys = Object.keys(widths)
  if (keys.length === Object.keys(cur).length && keys.every((k) => cur[k] === widths[k])) return
  dbcAutoWidth.value = widths
}

loadDbcColumnState()

// ==================== 表格视图：顶部共用的展开/折叠与批量按钮 ====================

const dbcTableRef = ref<any>(null)
const dbcTableSelectedCount = ref(0)

function onDbcExpandAll() {
  if (dbcViewMode.value === 'table') dbcTableRef.value?.expandAll?.()
  else expandAllMainTree()
}

function onDbcCollapseAll() {
  if (dbcViewMode.value === 'table') dbcTableRef.value?.collapseAll?.()
  else collapseAllMainTree()
}

function onDbcBatchTest(checked: boolean) {
  dbcTableRef.value?.applyBatch?.(checked)
}

/** 表格行：报文父行 + 信号子行（行对象引用 treeData 真实节点，写入即改真源） */
function buildDbcTableRows(nodes: any[]): DbcTableRow[] {
  const out: DbcTableRow[] = []
  for (const senderNode of nodes || []) {
    if (senderNode.type !== 'sender') continue
    const children: any[] = senderNode.children || []
    const msgNodes = children.filter((c: any) => c.type === 'message')
    // 兼容两种树布局：配置加载时信号在 message.children；DBC 导入时信号与报文平级
    const sigPool: any[] = []
    for (const c of children) {
      if (c.type === 'signal') sigPool.push(c)
      else if (c.type === 'message' && c.children?.length) {
        for (const s of c.children) if (s.type === 'signal') sigPool.push(s)
      }
    }
    const byMsg = new Map<string, any[]>()
    for (const s of sigPool) {
      const mn = String(s.msg?.msgName || s.msg?.name || '')
      if (!byMsg.has(mn)) byMsg.set(mn, [])
      byMsg.get(mn)!.push(s)
    }
    for (const m of msgNodes) {
      const sigs = byMsg.get(m.name) || []
      byMsg.delete(m.name)
      out.push({
        id: m.id,
        kind: 'message',
        node: m,
        senderName: senderNode.name,
        children: sigs.map((s: any) => ({
          id: s.id,
          kind: 'signal' as const,
          node: s,
          senderName: senderNode.name,
          children: [],
        })),
      })
    }
  }
  return out
}

const dbcTableRows = computed<DbcTableRow[]>(() => buildDbcTableRows(treeData.value))

/** 取节点上某路径的值（用于搜索匹配） */
function valueByPath(node: any, path: string): string {
  if (!node || !path) return ''
  const v = path.split('.').reduce((acc: any, k: string) => (acc == null ? undefined : acc[k]), node)
  return v === undefined || v === null ? '' : String(v)
}

/** 行内所有可搜索文本（报文名/发送节点/各列值） */
function rowSearchText(row: DbcTableRow): string {
  const parts: string[] = [String(row.node?.name || ''), String(row.senderName || '')]
  for (const c of dbcTableColumns) {
    if (!c.path) continue
    if (c.scope === 'sig' && row.kind === 'message') continue
    if (c.scope === 'msg' && row.kind === 'signal') continue
    parts.push(valueByPath(row.node, c.path))
  }
  return parts.join(' ').toLowerCase()
}

/** 表格搜索：报文命中则保留其全部信号，否则只保留命中的信号行 */
const filteredDbcTableRows = computed<DbcTableRow[]>(() => {
  const kw = String(dbcSearch.value || '').trim().toLowerCase()
  if (!kw) return dbcTableRows.value
  const out: DbcTableRow[] = []
  for (const r of dbcTableRows.value) {
    if (rowSearchText(r).includes(kw)) {
      out.push(r)
      continue
    }
    const hits = (r.children || []).filter((s) => rowSearchText(s).includes(kw))
    if (hits.length) out.push({ ...r, children: hits })
  }
  return out
})

/** 同步节点下 attr 子节点的显示值（保证切回树视图显示一致） */
function syncAttrNodeValue(node: any, tableKey: string, value: any) {
  for (const child of node?.children || []) {
    if (child?.type === 'attr' && child.tableKey === tableKey) child.value = value
  }
}

/** 按列路径写入节点（fields.xxx / msg.xxx），并同步属性子节点；同时记录撤销历史 */
function setNodeField(node: any, path: string, value: any) {
  if (!node || !path) return
  const before = readNodeField(node, path)
  if (String(before ?? '') !== String(value ?? '')) {
    recordUndo({ kind: 'field', node, path, before }, '编辑单元格')
  }
  applyNodeField(node, path, value)
}

/** 报文级属性 key（信号行拖入报文属性时写到所属报文上） */
const MSG_ATTR_KEYS = ['msgType', 'msgId', 'msgSendType', 'cycle', 'cycleFast', 'nrOfReption', 'length', 'lostDtc', 'dlcDtc']

/** 表格「测试参数」单元格的复制文本：序列化为 JSON，使参数可随单元格一起复制（空参数返回空串） */
function serializeParamsForCell(node: any): string {
  const list = (node?.testParams || [])
    .filter((p: any) => p && p.value)
    .map((p: any) => ({ value: p.value, label: p.label, target: p.target, params: { ...(p.params || {}) } }))
  return list.length ? JSON.stringify(list) : ''
}

/** 表格「测试参数」单元格的粘贴：解析 JSON 并整体替换该节点的测试参数（空文本=清空） */
function applyParamsFromCell(node: any, text: string) {
  if (!node || (node.type !== 'message' && node.type !== 'signal')) return
  const raw = String(text ?? '').trim()
  let list: any[] = []
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('not array')
      list = migrateParamList(parsed)
    } catch {
      ElMessage.warning('该单元格不是测试参数内容，未粘贴')
      return
    }
  }
  const normalized = list
    .filter((p: any) => p && p.value)
    .map((p: any) => ({
      value: p.value,
      label: p.label || p.value,
      target: p.target || (node.type === 'message' ? 'message' : 'signal'),
      params: { ...(p.params || {}) },
      enabled: hasParamData(p),
    }))
  const key = node.type === 'message'
    ? getTestParamsKey(node.name)
    : getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
  recordParamsUndo(node, '修改测试参数')
  const next = new Map(testParamMap.value)
  if (normalized.length) next.set(key, normalized)
  else next.delete(key)
  testParamMap.value = next
  mergeTestParamsIntoTree(treeData.value)

  // 被替换掉的参数如果正在详情面板中，关闭面板
  if (selectedTestParamKey.value) {
    const sel = selectedTestParamKey.value
    const msgName = node.type === 'message' ? node.name : (node.msg?.msgName || node.msg?.name)
    const signalName = node.type === 'signal' ? node.name : undefined
    if (sel.msgName === msgName && sel.signalName === signalName &&
        !normalized.some((p: any) => p.value === sel.paramValue)) {
      selectedTestParamKey.value = null
    }
  }
  ElMessage.success(normalized.length ? `已粘贴 ${normalized.length} 个测试参数` : '已清空测试参数')
}

// ==================== 撤销（Ctrl+Z） ====================
//
// 只记录「值级别」的修改（单元格编辑 / 粘贴 / 自动填充 / Test 勾选 / 测试参数单元格），
// 这些是用户最容易批量误操作的地方。一次用户操作（如一次粘贴写多格）会产生多条 entry，
// 通过微任务合并成一步，保证 Ctrl+Z 一次撤销整个操作。

interface UndoEntry {
  kind: 'field' | 'params' | 'checked' | 'rename' | 'sender'
  node: any
  /** field：属性路径（fields.xxx / msg.xxx） */
  path?: string
  /** params：测试参数在 testParamMap 中的 key */
  key?: string
  /** 修改前的值（params 存深拷贝） */
  before: any
}

interface UndoStep {
  entries: UndoEntry[]
  label: string
}

const UNDO_LIMIT = 200
const undoStack: UndoStep[] = []
let undoPending: UndoEntry[] = []
let undoLabel = ''
let undoFlushScheduled = false

function flushUndoStep() {
  undoFlushScheduled = false
  if (!undoPending.length) return
  // 过滤掉没有实际变化的 entry（例如操作被判为非法而没写数据），避免 Ctrl+Z「按了没反应」
  const effective = undoPending.filter((e) => {
    if (e.kind === 'field' && e.path) return String(readNodeField(e.node, e.path) ?? '') !== String(e.before ?? '')
    if (e.kind === 'checked') return !!e.node.checked !== !!e.before
    if (e.kind === 'rename') return String(e.node?.name ?? '') !== String(e.before ?? '')
    if (e.kind === 'sender') return String(e.node?.msg?.senders ?? '') !== String(e.before ?? '')
    if (e.kind === 'params' && e.key) {
      return JSON.stringify(testParamMap.value.get(e.key) || []) !== JSON.stringify(e.before || [])
    }
    return false
  })
  const label = undoLabel || '修改'
  undoPending = []
  undoLabel = ''
  if (!effective.length) return
  undoStack.push({ entries: effective, label })
  if (undoStack.length > UNDO_LIMIT) undoStack.shift()
}

/** 记录一次可撤销的修改；同一批操作里同一目标只保留最早的旧值 */
function recordUndo(entry: UndoEntry, label: string) {
  const dup = undoPending.some(
    (x) => x.kind === entry.kind && x.node === entry.node && x.path === entry.path && x.key === entry.key
  )
  if (!dup) undoPending.push(entry)
  if (!undoLabel) undoLabel = label
  if (!undoFlushScheduled) {
    undoFlushScheduled = true
    Promise.resolve().then(flushUndoStep)
  }
}

function deepCloneParams(list: any): any[] {
  try {
    return JSON.parse(JSON.stringify(Array.isArray(list) ? list : []))
  } catch {
    return []
  }
}

/** 仅写入，不记历史（撤销回放时使用） */
function applyNodeField(node: any, path: string, value: any) {
  if (!node || !path) return
  const dot = path.indexOf('.')
  if (dot < 0) return
  const scope = path.slice(0, dot)
  const key = path.slice(dot + 1)
  if (scope === 'fields') {
    if (!node.fields) node.fields = {}
    node.fields[key] = value
  } else if (scope === 'msg') {
    if (!node.msg || typeof node.msg !== 'object') return
    node.msg[key] = value
  } else {
    return
  }
  syncAttrNodeValue(node, key, value)
}

function readNodeField(node: any, path: string) {
  const dot = path.indexOf('.')
  if (dot < 0) return undefined
  const scope = path.slice(0, dot)
  const key = path.slice(dot + 1)
  if (scope === 'fields') return node?.fields?.[key]
  if (scope === 'msg') return node?.msg?.[key]
  return undefined
}

/** 记录某节点测试参数修改前的状态（供撤销用），返回该节点在 testParamMap 中的 key */
function recordParamsUndo(node: any, label: string): string {
  const key = node?.type === 'message'
    ? getTestParamsKey(node.name)
    : getTestParamsKey(node?.msg?.msgName || node?.msg?.name, node?.name)
  recordUndo({ kind: 'params', node, key, before: deepCloneParams(testParamMap.value.get(key) || []) }, label)
  return key
}

/** 把 testParamMap 中某个 key 恢复成指定参数列表，并同步到树节点 */
function restoreParamsForKey(key: string, list: any[]) {
  if (!key) return
  const next = new Map(testParamMap.value)
  if (list.length) next.set(key, deepCloneParams(list))
  else next.delete(key)
  testParamMap.value = next
  mergeTestParamsIntoTree(treeData.value)
}

/** 撤销后同步树形图勾选状态（node.checked 是数据源，el-tree 需重新 setCheckedKeys） */
function resyncTreeCheckedKeys() {
  const tree = mainDbcTreeRef.value
  if (!tree) return
  const keys: string[] = []
  const walk = (list: any[]) => {
    for (const n of list || []) {
      if ((n.type === 'message' || n.type === 'signal') && n.checked) keys.push(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(treeData.value)
  tree.setCheckedKeys(keys, false)
}

function undo() {
  flushUndoStep()
  const step = undoStack.pop()
  if (!step) {
    ElMessage.info('没有可撤销的操作')
    return
  }
  // 倒序回放：同一目标被改多次时，最早记录的旧值最后写入
  for (let i = step.entries.length - 1; i >= 0; i--) {
    const e = step.entries[i]
    if (e.kind === 'field' && e.path) applyNodeField(e.node, e.path, e.before)
    else if (e.kind === 'params' && e.key) restoreParamsForKey(e.key, e.before)
    else if (e.kind === 'checked') e.node.checked = e.before
    else if (e.kind === 'rename') renameTreeNode(e.node, e.before, false)
    else if (e.kind === 'sender') moveMessageToSender(e.node, e.before, false)
  }
  if (step.entries.some((e) => e.kind === 'checked')) resyncTreeCheckedKeys()
  ElMessage.success(`已撤销：${step.label}`)
}

/** 把对象浏览器拖入的 payload 落到表格行/单元格上 */
function applyPayloadToTreeNode(event: DragEvent | null, payload: any, node: any, path?: string | null) {
  if (!payload?.type || !node) return

  if (payload.type === 'attr') {
    const tk = String(payload.tableKey || '')
    if (!tk) return
    const val = payload.value ?? ''
    if (path && path.endsWith(`.${tk}`)) {
      setNodeField(node, path, val)
      return
    }
    if (node.type === 'signal' && MSG_ATTR_KEYS.includes(tk)) setNodeField(node.msg, `msg.${tk}`, val)
    else setNodeField(node, `${node.type === 'message' ? 'msg' : 'fields'}.${tk}`, val)
    return
  }

  if (payload.type === 'signal') {
    if (node.type !== 'signal') {
      ElMessage.warning('信号只能拖拽到信号行')
      return
    }
    const f = payload.fields || {}
    const map: Array<[string, string]> = [
      ['invalidValue', 'fields.invalidValue'], ['dataType', 'fields.dataType'],
      ['signalType', 'fields.signalType'], ['factor', 'fields.factor'],
      ['offset', 'fields.offset'], ['minPhy', 'fields.minPhy'], ['maxPhy', 'fields.maxPhy'],
      ['initialValue', 'fields.initialValue'], ['valueDesc', 'fields.valueDesc'],
      ['xcpVar', 'fields.xcpVar'], ['byteOrder', 'fields.byteOrder'],
      ['startByte', 'fields.startByte'], ['startBit', 'fields.startBit'],
      ['bitLength', 'fields.bitLength'], ['unit', 'fields.unit'],
    ]
    for (const [k, p] of map) {
      if (f[k] !== undefined && f[k] !== null && f[k] !== '') setNodeField(node, p, f[k])
    }
    const mm = payload.msg || {}
    for (const [k, p] of MSG_ATTR_PATHS) {
      if (mm[k] !== undefined && mm[k] !== null && mm[k] !== '') setNodeField(node.msg, p, mm[k])
    }
    ElMessage.success(`已填充信号 "${payload.name}" 及其属性`)
    return
  }

  if (payload.type === 'message') {
    const mm = payload.msg || {}
    for (const [k, p] of MSG_ATTR_PATHS) {
      if (mm[k] !== undefined && mm[k] !== null && mm[k] !== '') setNodeField(node.msg, p, mm[k])
    }
    ElMessage.success(`已填充报文 "${payload.name}" 属性`)
    return
  }

  if (payload.type === 'dtc') {
    if (node.type !== 'signal') {
      ElMessage.warning('DTC 只能拖拽到信号行或测试参数标签')
      return
    }
    const code = String(payload.code || payload.name || '').trim()
    if (!code) return
    const hits = (node.testParams || []).filter((p: any) => DTC_PARAM_VALUES.includes(p.value))
    if (!hits.length) {
      ElMessage.warning('该信号还没有可填 DTC 的测试参数，请先把测试参数拖到该信号')
      return
    }
    for (const p of hits) {
      p.params = { ...(p.params || {}), dtc: code }
      p.enabled = hasParamData(p)
      saveParamToMap(node, p)
    }
    ElMessage.success(`已填充 DTC "${code}"`)
    return
  }

  if (payload.type === 'a2l-measurement' || payload.type === 'a2l-characteristic') {
    if (node.type !== 'signal') {
      ElMessage.warning('A2L 变量只能填充到信号的 FactorTest')
      return
    }
    const varName = String(event?.dataTransfer?.getData('text/plain') || payload.name || '').trim()
    if (!varName) return
    const ft = (node.testParams || []).find((p: any) => p.value === 'FactorTest')
    if (!ft) {
      ElMessage.warning('该信号没有 FactorTest 测试参数，请先把 FactorTest 拖到该信号')
      return
    }
    ft.params = { ...(ft.params || {}), variable: varName }
    ft.enabled = hasParamData(ft)
    saveParamToMap(node, ft)
    ElMessage.success(`已填充变量名 "${varName}" 到 FactorTest`)
  }
}

/** 报文级属性 key → 树节点 msg 上的字段名 */
const MSG_ATTR_PATHS: Array<[string, string]> = [
  ['msgId', 'msg.msgId'], ['cycle', 'msg.cycle'], ['length', 'msg.length'],
  ['lostDtc', 'msg.lostDtc'], ['dlcDtc', 'msg.dlcDtc'],
  ['msgType', 'msg.msgType'], ['msgSendType', 'msg.msgSendType'],
]

/** 表格里拖拽落点：测试参数卡片走节点添加，其余走 payload 落库 */
function onDbcTableDrop(event: DragEvent, node: any, path: string | null) {
  const payload = parseDragPayload(event)
  if (!payload?.type) return
  if (payload.type === 'testParam') {
    if (addTestParamToNode(node, payload)) {
      ElMessage.success(`已添加测试参数 "${payload.label}" 到 "${node.label}"`)
    }
    return
  }
  applyPayloadToTreeNode(event, payload, node, path)
}

/** 表格行点击 → 同步树选中节点，保证「删除选中」可用 */
function onDbcTableRowSelect(node: any) {
  if (node) selectedTreeNode.value = node
}

/** 批量设置测试勾选（不级联，只改传入对象自身） */
function batchSetTest(nodes: any[], checked: boolean) {
  let count = 0
  for (const node of nodes || []) {
    if (node && (node.type === 'message' || node.type === 'signal')) {
      if (!!node.checked !== checked) {
        recordUndo({ kind: 'checked', node, before: !!node.checked }, checked ? '标记测试' : '取消测试')
      }
      node.checked = checked
      count++
    }
  }
  if (count) {
    resyncTreeCheckedKeys()
    ElMessage.success(`已${checked ? '标记为测试' : '取消测试'} ${count} 个对象`)
  }
}

watch(mainDbcTree, (baseTree) => {
  try {
  treeData.value = JSON.parse(JSON.stringify(baseTree))
  // 仅当存在用户上传的 DBC 时，才将其与配置 DBC 对比并高亮差异；
  // 加载/切换配置本身不会触发高亮（dbcRaw 为 null 时直接清空标记）。
  if (dbcRaw.value) {
    const baseSnapshot = extractDbcSnapshot(buildDbcTreeFromRaw(configDbcRaw.value))
    computeDbChangeMarks(extractDbcSnapshot(baseTree), baseSnapshot)
  } else {
    dbChangeMarks.value = {}
  }
  // 从树节点已携带的 testParams 重建 testParamMap，避免「加载配置后丢失测试参数」。
  // dict（配置）分支在 buildTreeFromDict 中已把 tp/et 写进 node.testParams；
  // 记录（上传）分支由 autoMatchTestParams 补充生成。
  const loadedParams = new Map<string, any[]>()
  function collectLoaded(nodes: any[]) {
    for (const n of nodes) {
      if ((n.type === 'message' || n.type === 'signal') && Array.isArray(n.testParams) && n.testParams.length) {
        const key = n.type === 'message'
          ? getTestParamsKey(n.name)
          : getTestParamsKey(n.msg?.msgName || n.msg?.name, n.name)
        loadedParams.set(key, n.testParams.map((s: any) => ({
          value: s.value,
          label: s.label,
          target: s.target,
          params: { ...(s.params || {}) },
        })))
      }
      if (n.children?.length) collectLoaded(n.children)
    }
  }
  if (loadedParams.size) {
    testParamMap.value = loadedParams
  }
  if (!dbcRaw.value) {
    // 配置加载（无上传 DBC）：保留已恢复的测试参数；对缺少的默认测试参数补全显示
    mergeTestParamsIntoTree(treeData.value)
    autoMatchMissingParams(treeData.value)
  } else {
    autoMatchTestParams(treeData.value)
    mergeTestParamsIntoTree(treeData.value)
  }
  initTreeExpandedKeys()

  nextTick(() => {
    const checkedIds: string[] = []
    function collect(nodes: any[]) {
      for (const n of nodes) {
        if ((n.type === 'message' || n.type === 'signal') && n.checked) {
          checkedIds.push(n.id)
        }
        if (n.children?.length) collect(n.children)
      }
    }
    collect(treeData.value)
    if (checkedIds.length > 0) {
      mainDbcTreeRef.value?.setCheckedKeys(checkedIds)
    }
  })
  } catch (e) {
    console.error('[CAN] watch mainDbcTree error:', e)
  }
}, { immediate: true })

// 测试参数映射变化时重新合并到树（兼容旧 Excel 自动生成测试参数卡片）
watch(testParamMap, () => {
  if (treeData.value.length) {
    mergeTestParamsIntoTree(treeData.value)
  }
})

function getNodeIcon(type: string) {
  if (type === 'sender') return Monitor
  if (type === 'message') return Document
  if (type === 'group') return Menu
  if (type === 'signal') return Cpu
  return Link
}

function getSignalInfo(fields: any): string {
  if (!fields) return ''
  const tags = [
    fields.invalidValue ? `无效值:${fields.invalidValue}` : '',
    fields.dataType ? `数据类型:${fields.dataType}` : '',
    fields.dtc ? `DTC:${fields.dtc}` : '',
    fields.signalType ? `信号类型:${fields.signalType}` : '',
  ].filter(Boolean)
  return tags.join(' | ')
}

function onTestParamInput(node: any) {
  const key = node.type === 'message'
    ? getTestParamsKey(node.name)
    : getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
  const current = testParamMap.value.get(key) || []
  testParamMap.value = new Map(testParamMap.value)
  testParamMap.value.set(key, [...current])
}

function hasParamData(param: any): boolean {
  if (!param.params) return false
  if (param.target === 'eps') return true
  const p = param.params
  switch (param.value) {
    case 'LostTest':
    case 'DlcTest':
      return p.dtc !== '' && p.dtc !== null && p.dtc !== undefined
    case 'CRCTest':
    case 'CounterTest':
      // CRC / Counter：报值写死，只需填写 DTC 才算已配置（未填 DTC 时为灰色）
      return p.dtc !== '' && p.dtc !== null && p.dtc !== undefined
    case 'SigInvalidTest': {
      // 填哪项生成哪项：「报DTC的值」「不报DTC的值」至少填一项即算已配置，可留空其一。
      // 填了「报DTC的值」时必须有「DTC」（否则后端按 NullDTC 生成，语义错误）；
      // 只填「不报DTC的值」时 DTC 可空（该组用例的 DTC 恒为 0）。
      const filled = (v: any) => v !== '' && v !== null && v !== undefined
      const hasReportValue = filled(p.dtcValue)
      const hasNullValue = filled(p.noDtcValue)
      return (hasReportValue || hasNullValue) && (!hasReportValue || filled(p.dtc))
    }
    case 'FactorTest': {
      // 已配置判定：仅要求「变量名非空」。
      // 之前还要求 autoRange === true 或 testValues 非空，导致「只拖入 A2L 变量、
      // 未设置测试值」的 FactorTest 既不高亮、保存时也被丢弃（DBC 导入/重载后丢失）。
      return p.variable !== '' && p.variable !== null && p.variable !== undefined
    }
    default:
      return false
  }
}

function isParamConfigured(param: any): boolean {
  return param.enabled === true
}

function isTestParamSelected(node: any, param: any): boolean {
  if (!selectedTestParamKey.value) return false
  const msgName = node.type === 'message' ? node.name : (node.msg?.msgName || node.msg?.name)
  const signalName = node.type === 'signal' ? node.name : undefined
  return selectedTestParamKey.value.msgName === msgName &&
    selectedTestParamKey.value.signalName === signalName &&
    selectedTestParamKey.value.paramValue === param.value
}

function saveParamToMap(node: any, param: any) {
  const msgName = node.type === 'message' ? node.name : (node.msg?.msgName || node.msg?.name)
  const signalName = node.type === 'signal' ? node.name : undefined
  const key = getTestParamsKey(msgName, signalName)
  recordParamsUndo(node, '修改测试参数')
  const current = testParamMap.value.get(key) || []
  const existingIndex = current.findIndex((p: any) => p.value === param.value)
  if (existingIndex >= 0) {
    current[existingIndex] = { ...param }
  } else {
    current.push({ ...param })
  }
  testParamMap.value = new Map(testParamMap.value)
  testParamMap.value.set(key, [...current])
}

function selectTestParam(node: any, param: any) {
  // EPS 类型（Counter / 具体 CRC 算法）为单选类型，无参数可编辑，点击仅提示
  if (param.target === 'eps') {
    ElMessage.info('EPS 类型通过拖拽 Counter / CRC 卡片覆盖，删除请点标签上的 ×')
    return
  }

  const isSelected = isTestParamSelected(node, param)

  // 点击当前已选中的参数 → 取消选中（toggle）
  if (isSelected) {
    param.enabled = hasParamData(param)
    selectedTestParamKey.value = null
    saveParamToMap(node, param)
    return
  }

  // 切换到新参数前，先保存当前选中参数的数据（不关闭面板，避免闪烁）
  if (selectedTestParamKey.value) {
    const { msgName: curMsg, signalName: curSig, paramValue: curVal } = selectedTestParamKey.value
    const curNode = findNodeInTree(treeData.value, curMsg, curSig)
    const curParam = curNode?.testParams?.find((p: any) => p.value === curVal)
    if (curParam) {
      curParam.enabled = hasParamData(curParam)
      saveParamToMap(curNode, curParam)
    }
  }

  // 直接选中并展示面板（无论参数是否已启用，点击即展示填写面板）
  const msgName = node.type === 'message' ? node.name : (node.msg?.msgName || node.msg?.name)
  const signalName = node.type === 'signal' ? node.name : undefined
  selectedTestParamKey.value = { msgName, signalName, paramValue: param.value }
}

function closeSelectedTestParam() {
  if (!selectedTestParamKey.value) return
  const { msgName, signalName, paramValue } = selectedTestParamKey.value
  const targetNode = findNodeInTree(treeData.value, msgName, signalName)
  const param = targetNode?.testParams?.find((p: any) => p.value === paramValue)
  
  if (param) {
    param.enabled = hasParamData(param)
    saveParamToMap(targetNode, param)
  }
  
  selectedTestParamKey.value = null
}

/** 删除某个节点上的测试参数 */
function removeTestParam(node: any, param: any) {
  const key = node.type === 'message'
    ? getTestParamsKey(node.name)
    : getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
  recordParamsUndo(node, '删除测试参数')
  const current = testParamMap.value.get(key) || []
  const filtered = current.filter((p: any) => p.value !== param.value)

  const next = new Map(testParamMap.value)
  if (filtered.length) next.set(key, filtered)
  else next.delete(key)
  testParamMap.value = next

  // 若删除的是当前选中的参数，关闭详情面板
  if (selectedTestParamKey.value) {
    const sel = selectedTestParamKey.value
    const msgName = node.type === 'message' ? node.name : (node.msg?.msgName || node.msg?.name)
    const signalName = node.type === 'signal' ? node.name : undefined
    if (sel.msgName === msgName && sel.signalName === signalName && sel.paramValue === param.value) {
      selectedTestParamKey.value = null
    }
  }

  mergeTestParamsIntoTree(treeData.value)
  ElMessage.success(`已删除测试参数 "${param.label}"`)
}

// ==================== 测试参数标签拖拽填充 ====================

/** 带 DTC 输入框的测试参数类型 */
const DTC_PARAM_VALUES = ['LostTest', 'DlcTest', 'CRCTest', 'CounterTest', 'SigInvalidTest']

/** 拖拽悬停在测试参数标签上：允许放置并高亮 */
function onTestParamTagDragOver(event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.add('test-param-tag-drop-over')
}

function onTestParamTagDragLeave(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.remove('test-param-tag-drop-over')
}

/** 拖拽对象落到测试参数标签上：自动填充对应输入框并展开配置面板。
 *  - DTC → 填充「配置参数」里的 DTC 输入框
 *  - A2L 变量（测量/标定）→ 填充 FactorTest 的变量名输入框 */
function onTestParamTagDrop(event: DragEvent, node: any, param: any) {
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.remove('test-param-tag-drop-over')
  const payload = parseDragPayload(event)
  if (!payload || param.target === 'eps') return

  let filled = false
  if (payload.type === 'dtc') {
    if (!DTC_PARAM_VALUES.includes(param.value)) {
      ElMessage.warning(`「${param.label}」没有 DTC 输入框`)
      return
    }
    const code = String(payload.code || payload.name || '').trim()
    if (!code) return
    if (!param.params) param.params = {}
    param.params.dtc = code
    filled = true
    ElMessage.success(`已填充 DTC "${code}" 到「${param.label}」`)
  } else if (payload.type === 'a2l-measurement' || payload.type === 'a2l-characteristic') {
    if (param.value !== 'FactorTest') {
      ElMessage.warning('A2L 变量只能填充到 FactorTest 的变量名')
      return
    }
    const varName = String(event.dataTransfer?.getData('text/plain') || payload.name || '').trim()
    if (!varName) return
    if (!param.params) param.params = {}
    param.params.variable = varName
    filled = true
    ElMessage.success(`已填充变量名 "${varName}" 到 FactorTest`)
  }

  if (!filled) return
  param.enabled = hasParamData(param)
  saveParamToMap(node, param)
  // 展开该参数的配置面板（已选中则不再切换，避免 toggle 取消选中）
  if (!isTestParamSelected(node, param)) selectTestParam(node, param)
}

// ==================== 测试参数卡片「先配置再拖拽」 ====================
const cardConfigDialogVisible = ref(false)
const editingCardValue = ref('')
const cardConfigForm = reactive<Record<string, any>>({})

function onTestParamCardConfigure(card: TestParamCard) {
  // EPS 卡片（Counter / CRC 算法）为类型选择，无需配置参数，直接拖拽
  if (card.target === 'eps') {
    ElMessage.info(`「${card.label}」为 EPS 类型选择，直接拖拽到 EPS 信号节点即可`)
    return
  }
  editingCardValue.value = card.value
  // 清空表单
  for (const k of Object.keys(cardConfigForm)) {
    delete cardConfigForm[k]
  }
  // 深拷贝卡片当前配置到表单
  const base = testParamCardConfig.value[card.value] || getDefaultParams(card.value)
  for (const k of Object.keys(base)) {
    cardConfigForm[k] = base[k]
  }
  cardConfigDialogVisible.value = true
}

// ====== 测试参数复制 / 粘贴（Ctrl+C / Ctrl+V） ======
function setTestParamClipboard(param: any) {
  testParamClipboard.value = {
    value: param.value,
    label: param.label,
    target: param.target,
    params: param.params ? JSON.parse(JSON.stringify(param.params)) : {},
  }
  ElMessage.success(`已复制测试参数 "${param.label}"，选中对象后按 Ctrl+V 粘贴`)
}

// 复制源 1：对象浏览器里的测试参数卡片
function onTestParamCopy(card: TestParamCard) {
  setTestParamClipboard(card)
}

// 复制源 2：树上已有的测试参数标签
function copySelectedTestParam() {
  if (!selectedTestParam.value) return
  setTestParamClipboard(selectedTestParam.value)
}

// 粘贴到当前选中的树节点
function pasteTestParamToSelectedNode() {
  const node = selectedTreeNode.value
  if (!node || (node.type !== 'message' && node.type !== 'signal')) {
    ElMessage.warning('请先在树中选中一个报文或信号对象')
    return
  }
  if (!testParamClipboard.value) {
    ElMessage.warning('剪贴板中没有测试参数，请先 Ctrl+C 复制')
    return
  }
  addTestParamToNode(node, testParamClipboard.value)
}

function saveCardConfig() {
  testParamCardConfig.value = {
    ...testParamCardConfig.value,
    [editingCardValue.value]: { ...cardConfigForm },
  }
  cardConfigDialogVisible.value = false
  ElMessage.success('测试参数已配置，可拖拽到树形图')
}

function _startAttrEdit(data: any) {
  editingAttrId.value = data.id
  nextTick(() => {
    const input = document.querySelector('.attr-edit-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function finishAttrEdit(data: any) {
  editingAttrId.value = null
  // 属性行编辑落库：写回所属节点（报文 → msg.xxx / 信号 → fields.xxx），
  // 否则只是改了属性子节点的显示值，保存时会被丢弃。
  if (!data || data.type !== 'attr' || !data.tableKey) return
  const parent = data.parentSignal
    ? findNodeInTree(treeData.value, data.parentMsg, data.parentSignal)
    : findNodeInTree(treeData.value, data.parentMsg)
  if (!parent) return
  setNodeField(parent, `${parent.type === 'message' ? 'msg' : 'fields'}.${data.tableKey}`, data.value)
}

function cancelAttrEdit() {
  editingAttrId.value = null
}

// ==================== 树节点标签重命名（双击报文/信号标签）====================

const editingLabelId = ref<string | null>(null)
const labelEditValue = ref('')

function _startLabelEdit(data: any) {
  if (data?.type !== 'message' && data?.type !== 'signal') return
  editingLabelId.value = data.id
  labelEditValue.value = String(data.name ?? '')
  nextTick(() => {
    const input = document.querySelector('.label-edit-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function cancelLabelEdit() {
  editingLabelId.value = null
  labelEditValue.value = ''
}

function finishLabelEdit(data: any) {
  const value = labelEditValue.value
  editingLabelId.value = null
  labelEditValue.value = ''
  renameTreeNode(data, value)
}

/** 重命名报文/信号节点：同步 label / name / 关联的 msg 名与测试参数 key
 *  报文改名会连带更新其所有信号子节点的 msg.msgName（保持归属关系） */
function renameTreeNode(node: any, newName: string, record = true) {
  if (!node || (node.type !== 'message' && node.type !== 'signal')) return
  const name = String(newName ?? '').trim()
  const oldName = String(node.name ?? '')
  if (!name || name === oldName) return

  if (record) recordUndo({ kind: 'rename', node, before: oldName }, '重命名节点')

  // 1. 测试参数 key 迁移（key 形如 msgName 或 msgName:::signalName）
  const next = new Map(testParamMap.value)
  if (node.type === 'message') {
    const msgParams = next.get(oldName)
    if (msgParams) {
      next.delete(oldName)
      next.set(name, msgParams)
    }
    for (const child of node.children || []) {
      if (child?.type !== 'signal') continue
      if (child.msg) child.msg.msgName = name
      const oldKey = getTestParamsKey(oldName, child.name)
      const params = next.get(oldKey)
      if (params) {
        next.delete(oldKey)
        next.set(getTestParamsKey(name, child.name), params)
      }
    }
    if (node.msg) node.msg.msgName = name
  } else {
    const msgName = node.msg?.msgName || node.msg?.name || ''
    const oldKey = getTestParamsKey(msgName, oldName)
    const params = next.get(oldKey)
    if (params) {
      next.delete(oldKey)
      next.set(getTestParamsKey(msgName, name), params)
    }
  }
  testParamMap.value = next

  // 2. 节点自身（label 与 name 保持一致）
  node.name = name
  node.label = name
}

/** 该节点是否是「这个报文」的信号。
 *  DBC 导入的树把信号放在发送节点下、与报文**平级**（见 buildDbcTreeFromRaw），
 *  靠共享的 msg 对象（或 msgName / msgId）归属；配置加载的树则把信号放在 msgNode.children 里。 */
function isSignalOfMessage(node: any, msgNode: any): boolean {
  if (!node || node.type !== 'signal') return false
  if (msgNode?.msg && node.msg === msgNode.msg) return true
  const msgName = String(msgNode?.name ?? '')
  const msgId = String(msgNode?.msg?.msgId ?? '')
  const sigName = String(node.msg?.msgName || node.msg?.name || '')
  const sigId = String(node.msg?.msgId ?? '')
  return (!!msgName && sigName === msgName) || (!!msgId && sigId === msgId)
}

function moveMessageToSender(msgNode: any, sender: string, record = true) {
  if (!msgNode || msgNode.type !== 'message') return
  const newSender = String(sender ?? '').trim()
  const oldSender = String(msgNode.msg?.senders ?? '')
  if (!newSender || newSender === oldSender) return

  if (record) recordUndo({ kind: 'sender', node: msgNode, before: oldSender }, '修改发送节点')

  const root = treeData.value
  // 1. 从原发送节点下移除「报文 + 与它平级的同报文信号」。
  //    之前只搬报文：平级的信号被留在原发送节点下，表格里没有对应报文行给它们挂，
  //    于是这些信号在表格里整个消失（表现就是「改完发送节点，所属信号没了」）。
  const moving: any[] = [msgNode]
  for (const s of root) {
    if (!Array.isArray(s.children) || !s.children.includes(msgNode)) continue
    s.children = s.children.filter((c: any) => {
      if (c === msgNode) return false
      if (isSignalOfMessage(c, msgNode)) {
        moving.push(c)
        return false
      }
      return true
    })
  }
  // 2. 目标发送节点不存在则新建
  let target = root.find((s: any) => s.type === 'sender' && s.name === newSender)
  if (!target) {
    target = {
      id: `sender${mainTreeIdSeq++}`,
      label: newSender,
      type: 'sender',
      name: newSender,
      children: [],
      disabled: true,
    }
    root.push(target)
  }
  // 顺序保持「报文在前、信号在后」，与导入时的树布局一致
  target.children.push(...moving)
  // 3. 同步 senders（报文、一起搬过来的信号、以及报文 children 里的信号）
  for (const n of moving) {
    if (n.msg) n.msg.senders = newSender
  }
  for (const c of msgNode.children || []) {
    if (c.type === 'signal' && c.msg) c.msg.senders = newSender
  }
  // 4. 清理空发送节点并整体替换数组，触发树与表格重算
  treeData.value = root.filter((s: any) => s.type !== 'sender' || (s.children && s.children.length > 0))
}

/** 表格「发送节点」单元格提交 */
function onSenderRename(node: any, sender: string) {
  const newSender = String(sender ?? '').trim()
  if (!newSender || String(node?.msg?.senders ?? '') === newSender) return
  moveMessageToSender(node, newSender)
  ElMessage.success(`已将报文移动到发送节点「${newSender}」`)
}

watch(mergedDbcRaw, (raw) => {
  signalRows.value = buildSignalRowsFromRaw(raw)
})

function addSignalRow() {
  signalRows.value.push(emptySignalRow())
}

function _onSignalSelectionChange(rows: SignalRow[]) {
  selectedSignalRows.value = rows
}

function removeSelectedRows() {
  // 1. 删除 el-table 中选中的行
  if (selectedSignalRows.value.length) {
    const ids = new Set(selectedSignalRows.value.map((r) => r.__id))
    signalRows.value = signalRows.value.filter((r) => !ids.has(r.__id))
    selectedSignalRows.value = []
  }

  // 2. 删除树中鼠标点击选中的节点（直接操作 treeData）
  if (selectedTreeNode.value) {
    const node = selectedTreeNode.value
    const deleteMsgNames = new Set<string>()
    const deleteSignalKeys = new Set<string>()
    const deleteSenderNames = new Set<string>()

    if (node.type === 'sender') {
      deleteSenderNames.add(node.name)
    } else if (node.type === 'message' && node.name) {
      deleteMsgNames.add(node.name)
    } else if (node.type === 'signal' && node.msg?.msgName && node.name) {
      deleteSignalKeys.add(`${node.msg.msgName}:::${node.name}`)
    }

    // 直接从 treeData 中删除节点
    if (deleteSenderNames.size) {
      treeData.value = treeData.value.filter((n: any) => !deleteSenderNames.has(n.name))
    }
    if (deleteMsgNames.size || deleteSignalKeys.size) {
      for (const senderNode of treeData.value) {
        if (!senderNode.children) continue
        senderNode.children = senderNode.children.filter((msgNode: any) => {
          if (msgNode.type === 'message' && deleteMsgNames.has(msgNode.name)) {
            return false
          }
          if (msgNode.type === 'message' && msgNode.children) {
            msgNode.children = msgNode.children.filter((sigNode: any) => {
              if (sigNode.type === 'signal' && deleteSignalKeys.has(`${msgNode.name}:::${sigNode.name}`)) {
                return false
              }
              return true
            })
          }
          return true
        })
      }
      // 清理空的 sender 节点
      treeData.value = treeData.value.filter((n: any) => n.children && n.children.length > 0)
    }

    // 同步删除 signalRows 中的对应行
    if (deleteMsgNames.size || deleteSignalKeys.size) {
      signalRows.value = signalRows.value.filter((r) => {
        if (deleteMsgNames.has(r.msgName)) return false
        if (deleteSignalKeys.has(`${r.msgName}:::${r.signalName}`)) return false
        return true
      })
    }

    selectedTreeNode.value = null

    // 3. 从 treeData 重建 dbcRaw，防止 mainDbcTree 重新计算时恢复已删除节点
    const rebuilt = buildDbcRawFromSignalRows()
    dbcRaw.value = rebuilt
    jsonDbcRaw.value = rebuilt
  }
}

function onTestParamsChange(params: { msgParams: string[]; sigParams: string[] }) {
  const { msgParams, sigParams } = params
  
  for (const row of signalRows.value) {
    if (msgParams.includes('LostTest') && !row.lostDtc && row.dtc) {
      row.lostDtc = row.dtc
    }
    if (msgParams.includes('DlcTest') && !row.dlcDtc && row.dtc) {
      row.dlcDtc = row.dtc
    }
    
    if (sigParams.includes('SigInvalidTest') || sigParams.includes('CRCTest') || sigParams.includes('CounterTest')) {
      if (!row.invalidValue && row.dtc) {
        row.invalidValue = '0'
      }
    }
    
    if (sigParams.includes('FactorTest')) {
      if (!row.factor) {
        row.factor = '1'
      }
      if (!row.offset) {
        row.offset = '0'
      }
    }
  }
}

/** 从事件目标向上查找最近的 .cell-drop 单元格 */
function findCellFromTarget(target: EventTarget | null): { el: HTMLElement; rowId: number; colKey: string } | null {
  let el = target as HTMLElement | null
  while (el && el.nodeType === 1) {
    const rowId = el.getAttribute('data-row-id')
    const colKey = el.getAttribute('data-col-key')
    if (rowId && colKey && el.classList.contains('cell-drop')) {
      return { el, rowId: Number(rowId), colKey }
    }
    el = el.parentElement
  }
  return null
}

function applyCellHighlight(target: EventTarget | null) {
  const cell = findCellFromTarget(target)
  if (!cell) return
  const newKey = `${cell.rowId}-${cell.colKey}`
  if (dragCellKey === newKey) return
  if (dragCellEl) dragCellEl.classList.remove('cell-drag-over')
  dragCellKey = newKey
  dragCellEl = cell.el
  cell.el.classList.add('cell-drag-over')
}

function clearCellHighlight() {
  if (dragRafId) {
    cancelAnimationFrame(dragRafId)
    dragRafId = 0
  }
  pendingDragTarget = null
  if (dragCellEl) {
    dragCellEl.classList.remove('cell-drag-over')
    dragCellEl = null
  }
  dragCellKey = ''
}

function _onTableDragOver(event: DragEvent) {
  pendingDragTarget = event.target
  if (dragRafId) return
  dragRafId = requestAnimationFrame(() => {
    dragRafId = 0
    applyCellHighlight(pendingDragTarget)
  })
}

function _onTableDragLeave(event: DragEvent) {
  const to = event.relatedTarget as HTMLElement | null
  if (to && event.currentTarget && (event.currentTarget as HTMLElement).contains(to)) return
  clearCellHighlight()
}

/** 从拖拽事件解析 payload */
function parseDragPayload(event: DragEvent): any | null {
  const json = event.dataTransfer?.getData('application/json')
  if (json) {
    try {
      return JSON.parse(json)
    } catch {
      /* ignore */
    }
  }
  const plain = event.dataTransfer?.getData('text/plain')
  if (plain) return { type: 'signal', name: plain, fields: {}, msg: {} }
  return null
}

function _onTreeDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  const treeNode = findTreeNodeFromTarget(event.target)
  if (treeNode && (treeNode.type === 'message' || treeNode.type === 'signal')) {
    hoveredTreeNode.value = treeNode
  } else {
    hoveredTreeNode.value = null
  }
}

function _onTreeDragEnter(event: DragEvent) {
  event.preventDefault()
}

function _onTreeDragLeave() {
  hoveredTreeNode.value = null
}

/** 节点级 dragover：允许放置并高亮当前节点 */
function onTreeNodeDragOver(event: DragEvent, data: any) {
  if (!data || (data.type !== 'message' && data.type !== 'signal')) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.add('tree-node-drop-over')
}

function onTreeNodeDragLeave(event: DragEvent, data: any) {
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.remove('tree-node-drop-over')
}

/** 节点级 drop：直接拿到 data，绕过 DOM data-key 反查，兼容测试参数拖拽 */
function onTreeNodeDrop(event: DragEvent, data: any) {
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.remove('tree-node-drop-over')
  const payload = parseDragPayload(event)

  if (payload?.type === 'testParam') {
    event.stopPropagation()
    if (!data || (data.type !== 'message' && data.type !== 'signal')) {
      ElMessage.warning('测试参数只能拖拽到报文或信号节点')
      return
    }
    addTestParamToNode(data, payload)
    return
  }

  // 其它类型（信号 / DTC / 属性）交回容器统一处理
  event.stopPropagation()
  _onTableDrop(event)
}

/** 事件委托：拖拽落到表格区域 */
function _onTableDrop(event: DragEvent) {
  event.preventDefault()
  clearCellHighlight()
  const payload = parseDragPayload(event)

  if (payload?.type === 'testParam') {
    const treeNode = hoveredTreeNode.value || findTreeNodeFromTarget(event.target)
    if (treeNode) {
      if (addTestParamToNode(treeNode, payload)) {
        ElMessage.success(`已添加测试参数 "${payload.label}" 到 "${treeNode.label}"`)
      }
    }
    hoveredTreeNode.value = null
    return
  }

  const cell = findCellFromTarget(event.target)
  if (cell) {
    const row = signalRows.value.find((r) => r.__id === cell.rowId)
    if (row) {
      applyPayloadToCell(payload, row, cell.colKey)
    }
  } else {
    if (signalRows.value.length === 0) {
      ElMessage.warning('请先导入 DBC 文件生成报文信号表')
      return
    }
    const row = emptySignalRow()
    signalRows.value.push(row)
    applyPayloadToRow(payload, row)
  }
}

/** 【修复】查找树节点 - 兼容 data-key 和 data-node-key */
function findTreeNodeFromTarget(target: EventTarget | null): any | null {
  const el = target as HTMLElement
  if (!el) {
    return null
  }
  let current: HTMLElement | null = el
  while (current) {
    const treeNodeEl = current.closest('.el-tree-node')
    if (treeNodeEl) {
      // 尝试两种属性名
      let nodeKey = treeNodeEl.getAttribute('data-key')
      if (!nodeKey) nodeKey = treeNodeEl.getAttribute('data-node-key')
      if (nodeKey) {
        const node = findNodeByKey(treeData.value, nodeKey)
        if (node && (node.type === 'message' || node.type === 'signal')) {
          return node
        }
      }
      return null
    }
    current = current.parentElement
  }
  return null
}

function findNodeByKey(nodes: any[], key: string): any | null {
  for (const node of nodes) {
    if (node.id === key) return node
    if (node.children) {
      const found = findNodeByKey(node.children, key)
      if (found) return found
    }
  }
  return null
}

/** 【改进】添加测试参数到节点，放宽 target 限制 */
function addTestParamToNode(node: any, param: any): boolean {
  if (!param.value) {
    ElMessage.warning('测试参数缺少 value 字段')
    return false
  }
  recordParamsUndo(node, '添加测试参数')

  // EPS 测试参数：作为测试参数统一管理（Counter / 具体 CRC 算法，单选覆盖）
  if (param.target === 'eps') {
    if (node.type !== 'signal' || node.msg?.senders !== 'EPS') {
      ElMessage.warning(`「${param.label}」为 EPS 测试参数，只能添加到 EPS 信号节点`)
      return false
    }
    const key = getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
    const current = testParamMap.value.get(key) || []
    // EPS 类型单选：移除旧的 eps 项后加入新项
    const filtered = current.filter((p: any) => p.target !== 'eps')
    const newParams = [...filtered, {
      value: param.value,
      label: param.label,
      target: 'eps',
      params: {},
    }]
    testParamMap.value = new Map(testParamMap.value)
    testParamMap.value.set(key, newParams)
    mergeTestParamsIntoTree(treeData.value)
    ElMessage.success(`已设置 ${node.label} 的 EPS 类型为 ${param.value}`)
    return true
  }

  // 有 target 则严格检查
  if (param.target === 'message' && node.type !== 'message') {
    ElMessage.warning(`「${param.label}」为报文测试参数，不能添加到信号对象`)
    return false
  }
  if (param.target === 'signal') {
    if (node.type !== 'signal') {
      ElMessage.warning(`「${param.label}」为信号测试参数，不能添加到报文对象`)
      return false
    }
    if (node.msg?.senders === 'EPS') {
      ElMessage.warning(`「${param.label}」为普通信号测试参数，EPS 信号只能配置 CRC / Counter`)
      return false
    }
  }

  const key = node.type === 'message'
    ? getTestParamsKey(node.name)
    : getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
  const current = testParamMap.value.get(key) || []
  const existing = current.find((p: any) => p.value === param.value)
  if (!existing) {
    // 优先使用拖拽携带的 params（先配置再拖拽），否则用默认值
    const params = param.params && Object.keys(param.params).length > 0
      ? { ...param.params }
      : getDefaultParams(param.value)
    const newParams = [...current, {
      value: param.value,
      label: param.label,
      target: param.target || node.type, // 若未指定则设为当前节点类型
      params,
    }]
    testParamMap.value = new Map(testParamMap.value)
    testParamMap.value.set(key, newParams)
    mergeTestParamsIntoTree(treeData.value)
    return true
  } else {
    // 已存在：若拖拽携带了有效配置参数，则覆盖更新（兼容「先配置再拖拽」流程）
    if (param.params && hasParamData({ value: param.value, target: param.target, params: param.params })) {
      const idx = current.findIndex((p: any) => p.value === param.value)
      current[idx] = { ...current[idx], params: { ...param.params } }
      testParamMap.value = new Map(testParamMap.value)
      testParamMap.value.set(key, [...current])
      mergeTestParamsIntoTree(treeData.value)
      return true
    }
    ElMessage.warning(`测试参数 "${param.label}" 已存在`)
    return false
  }
}

/** 将拖拽 payload 填充到指定单元格 */
function applyPayloadToCell(payload: any, row: SignalRow, colKey: string) {
  if (!payload || !payload.type) return
  let value = ''
  let label = ''
  if (payload.type === 'signal') {
    value = payload.name || ''
    label = '信号名'
  } else if (payload.type === 'message') {
    value = payload.name || ''
    label = '报文名'
  } else if (payload.type === 'dtc') {
    value = payload.code || payload.name || ''
    label = 'DTC'
  } else if (payload.type === 'attr') {
    value = payload.value ?? ''
    label = payload.name || '属性'
  }
  if (value !== '') {
    row[colKey] = value
    ElMessage.success(`已填充${label} "${value}" 到当前单元格`)
  }
}

function assignMsg(row: SignalRow, m: Record<string, any>) {
  if (m.senders != null && m.senders !== '') row.senders = m.senders
  if (m.msgId != null && m.msgId !== '') row.msgId = m.msgId
  if (m.cycle != null && m.cycle !== '') row.msgCycleTime = m.cycle
  if (m.length != null && m.length !== '') row.msgLength = m.length
  if (m.lostDtc != null && m.lostDtc !== '') row.lostDtc = m.lostDtc
  if (m.dlcDtc != null && m.dlcDtc !== '') row.dlcDtc = m.dlcDtc
}

/** 将拖拽 payload 应用到目标行 */
function applyPayloadToRow(payload: any, row: SignalRow) {
  if (!payload || !payload.type) return
  if (payload.type === 'signal') {
    row.signalName = payload.name || row.signalName
    const f = payload.fields || {}
    if (f.factor != null) row.factor = f.factor
    if (f.offset != null) row.offset = f.offset
    if (f.minPhy != null) row.minPhy = f.minPhy
    if (f.maxPhy != null) row.maxPhy = f.maxPhy
    if (f.initialValue != null) row.initialValue = f.initialValue
    if (f.invalidValue != null) row.invalidValue = f.invalidValue
    if (f.dataType != null) { row.dataType = f.dataType; row.dataType2 = f.dataType }
    if (f.dtc != null) row.dtc = f.dtc
    if (f.signalType != null) row.signalType = f.signalType
    if (f.xcpVar != null) row.xcpVar = f.xcpVar
    if (f.valueDesc != null) row.valueDesc = f.valueDesc
    assignMsg(row, payload.msg || {})
    ElMessage.success(`已填充信号 "${payload.name}" 及其属性`)
  } else if (payload.type === 'message') {
    assignMsg(row, payload.msg || {})
    ElMessage.success(`已填充报文 "${payload.name}" 属性`)
  } else if (payload.type === 'attr') {
    if (payload.tableKey) {
      row[payload.tableKey] = payload.value ?? ''
      if (payload.tableKey === 'dataType') row.dataType2 = payload.value ?? ''
    }
  } else if (payload.type === 'dtc') {
    row.dtc = payload.code || payload.name || row.dtc
    ElMessage.success(`已填充 DTC "${row.dtc}"`)
  } else if (payload.type === 'testParam') {
    addTestParamToRow(row, payload)
    ElMessage.success(`已添加测试参数 "${payload.label}"`)
  }
}

function addTestParamToRow(row: SignalRow, param: any) {
  if (!param.value) return
  if (!row.testParams) {
    row.testParams = []
  }
  const existing = row.testParams.find((p: any) => p.value === param.value)
  if (!existing) {
    row.testParams.push({
      value: param.value,
      label: param.label,
      target: param.target,
      params: getDefaultParams(param.value),
    })
  }
}

function _onInputFocus(event: Event) {
  const target = event.target as HTMLElement
  target.classList.add('input-focus')
  // 鼠标点击输入框时全选内容
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select()
  } else {
    // el-input 内部 input
    const input = target.querySelector?.('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
    if (input) input.select()
  }
}

function _onInputBlur(event: Event) {
  const target = event.target as HTMLElement
  target.classList.remove('input-focus')
}

void _startAttrEdit
void _onSignalSelectionChange
void _onTableDragOver
void _onTableDragLeave
void _onTableDrop
void _onInputFocus
void _onInputBlur
void getSignalInfo
void onTestParamInput

/** 测试参数入库（写入配置 tp）前的归一化。
 *  FactorTest 只填了变量名、既未开「自动遍历」也未填「测试值」时，按自动遍历保存，
 *  避免参数保存成功后因 testValues 为空而不生成任何用例。 */
function normalizeTestParamPayload(param: any): Record<string, any> {
  const payload = { ...(param.params || {}) }
  if (param.value === 'FactorTest' && payload.variable) {
    const tv = payload.testValues
    const hasTestValues = tv !== '' && tv !== null && tv !== undefined
    if (payload.autoRange !== true && !hasTestValues) payload.autoRange = true
  }
  return payload
}

function buildDbcRawFromSignalRows(): any {
  const result: Record<string, any> = {}
  for (const node of treeData.value) {
    if (node.type !== 'sender') continue
    const senderName = node.name
    const messages: Record<string, any> = {}
    let hasMsg = false

    for (const child of node.children || []) {
      if (child.type === 'message') {
        const msgName = child.name
        const msgData: any = {}
        if (child.msg?.msgId) msgData.id = child.msg.msgId
        if (child.msg?.cycle) msgData.cy = child.msg.cycle
        if (child.msg?.length) msgData.ln = child.msg.length
        if (child.msg?.lostDtc) msgData.ld = child.msg.lostDtc
        if (child.msg?.dlcDtc) msgData.dd = child.msg.dlcDtc
        if (child.msg?.msgSendType) msgData.mst = child.msg.msgSendType
        if (child.msg?.msgType) msgData.mt = child.msg.msgType
        msgData.lk = !!child.checked

        if (child.testParams?.length) {
          const tpObj: Record<string, any> = {}
          for (const p of child.testParams) {
            if (p.params && hasParamData(p)) {
              tpObj[p.value] = normalizeTestParamPayload(p)
            }
          }
          if (Object.keys(tpObj).length) msgData.tp = tpObj
        }

        // 信号在 message 的 children 里（JSON 配置加载时所有 sender 都如此；
        // EPS 由 buildTreeFromDict 也放入 message.children）
        if (child.children?.length) {
          const signals: Record<string, any> = {}
          let hasSig = false
          for (const sigNode of child.children) {
            if (sigNode.type !== 'signal') continue
            const sigName = sigNode.name
            const sigData: any = { lk: !!sigNode.checked }
            if (sigNode.fields?.dataType) sigData.dt = sigNode.fields.dataType
            if (sigNode.fields?.factor) sigData.fc = sigNode.fields.factor
            if (sigNode.fields?.offset) sigData.of = sigNode.fields.offset
            if (sigNode.fields?.minPhy) sigData.mn = sigNode.fields.minPhy
            if (sigNode.fields?.maxPhy) sigData.mx = sigNode.fields.maxPhy
            if (sigNode.fields?.startBit) sigData.sb = sigNode.fields.startBit
            if (sigNode.fields?.bitLength) sigData.bl = sigNode.fields.bitLength
            if (sigNode.fields?.startByte) sigData.sbyte = sigNode.fields.startByte
            if (sigNode.fields?.byteOrder) sigData.bo = sigNode.fields.byteOrder
            if (sigNode.fields?.invalidValue) sigData.iv = sigNode.fields.invalidValue
            if (sigNode.fields?.initialValue) sigData.iv_init = sigNode.fields.initialValue
            if (sigNode.fields?.signalType) sigData.st = sigNode.fields.signalType
            if (sigNode.fields?.unit) sigData.unit = sigNode.fields.unit
            if (sigNode.fields?.valueDesc) sigData.vd = sigNode.fields.valueDesc
            // EPS 类型（target === 'eps'）写回 et，其余测试参数写回 tp
            const epsParam = sigNode.testParams?.find((p: any) => p.target === 'eps')
            if (epsParam) sigData.et = epsParam.value
            if (sigNode.testParams?.length) {
              const tpObj: Record<string, any> = {}
              for (const p of sigNode.testParams) {
                if (p.target === 'eps') continue
                if (p.params && hasParamData(p)) {
                  tpObj[p.value] = normalizeTestParamPayload(p)
                }
              }
              if (Object.keys(tpObj).length) sigData.tp = tpObj
            }
            signals[sigName] = sigData
            hasSig = true
          }
          if (hasSig) msgData.signals = signals
        }

        messages[msgName] = msgData
        hasMsg = true
      } else if (child.type === 'signal') {
        // 非 EPS：信号和报文同级，信号挂到对应报文下
        const msgName = child.msg?.msgName
        if (!msgName) continue
        if (!messages[msgName]) {
          const m: any = { lk: false, signals: {} }
          if (child.msg?.msgId) m.id = child.msg.msgId
          if (child.msg?.cycle) m.cy = child.msg.cycle
          if (child.msg?.length) m.ln = child.msg.length
          if (child.msg?.msgSendType) m.mst = child.msg.msgSendType
          if (child.msg?.msgType) m.mt = child.msg.msgType
          messages[msgName] = m
          hasMsg = true
        }
        if (!messages[msgName].signals) messages[msgName].signals = {}
        const sigName = child.name
        const sigData: any = { lk: !!child.checked }
        if (child.fields?.dataType) sigData.dt = child.fields.dataType
        if (child.fields?.factor) sigData.fc = child.fields.factor
        if (child.fields?.offset) sigData.of = child.fields.offset
        if (child.fields?.minPhy) sigData.mn = child.fields.minPhy
        if (child.fields?.maxPhy) sigData.mx = child.fields.maxPhy
        if (child.fields?.invalidValue) sigData.iv = child.fields.invalidValue
        if (child.fields?.initialValue) sigData.iv_init = child.fields.initialValue
        if (child.fields?.valueDesc) sigData.vd = child.fields.valueDesc
        if (child.fields?.byteOrder) sigData.bo = child.fields.byteOrder
        if (child.fields?.startBit) sigData.sb = child.fields.startBit
        if (child.fields?.bitLength) sigData.bl = child.fields.bitLength
        if (child.fields?.startByte) sigData.sbyte = child.fields.startByte
        if (child.fields?.unit) sigData.unit = child.fields.unit
        if (child.fields?.signalType) sigData.st = child.fields.signalType

        // EPS 类型（target === 'eps'）写回 et，其余测试参数写回 tp
        const epsParam = child.testParams?.find((p: any) => p.target === 'eps')
        if (epsParam) sigData.et = epsParam.value
        if (child.testParams?.length) {
          const tpObj: Record<string, any> = {}
          for (const p of child.testParams) {
            if (p.target === 'eps') continue
            if (p.params && hasParamData(p)) {
              tpObj[p.value] = normalizeTestParamPayload(p)
            }
          }
          if (Object.keys(tpObj).length) sigData.tp = tpObj
        }

        messages[msgName].signals[sigName] = sigData
      }
    }

    if (hasMsg) result[senderName] = messages
  }
  return result
}


/** 检查报文信号属性缺失值并弹窗提示 */
function checkMissingSignalAttributes() {
  const missingRows: string[] = []
  const coreKeys = ['invalidValue', 'dataType', 'signalType']
  for (const row of signalRows.value) {
    if (!row.signalName) continue // 报文行无信号属性，跳过
    const missingCols = coreKeys.filter((k) => !row[k])
    if (missingCols.length > 0) {
      const name = row.signalName || row.msgName || `信号#${row.__id}`
      missingRows.push(`${name}: ${missingCols.join(', ')}`)
    }
  }
  if (missingRows.length > 0) {
    ElMessage.warning(
      `以下信号属性值缺失（已留空，不影响导入）:\n${missingRows.slice(0, 5).join('\n')}${missingRows.length > 5 ? '\n...等共 ' + missingRows.length + ' 条' : ''}`
    )
  }
}

/** 是否显示右侧对象展示面板 */
const showObjectPanel = computed(() => {
  const raw = mergedDbcRaw.value
  const hasDbc = (raw?.rows?.length > 0) || (raw && typeof raw === 'object' && !Array.isArray(raw) && !raw.columns && !raw.rows && Object.keys(raw).length > 0)
  const hasDtc = dtcRaw.value?.rows?.length > 0
  const hasA2l = a2lVars.value.measurements.length > 0 || a2lVars.value.characteristics.length > 0
  return hasDbc || hasDtc || hasA2l
})

// ====== 容器尺寸（可拖拽调整） ======
// can-side 默认宽度 420；可拖拽调整
const [canSideWidth, setCanSideWidth] = useResizableSize('can-side', 420, 240, 1200)
const [dbcTreeHeight, setDbcTreeHeight] = useResizableSize('dbc-tree-main', 560, 200, 1200)
const [testParamPanelHeight, setTestParamPanelHeight] = useResizableSize('test-param-detail-panel', 360, 200, 800)

function onCanSideDrag(delta: number) {
  // can-side 在右侧；splitter 在 main 与 side 之间
  // 用户拖动 splitter：向左拖（delta<0）= side 增大
  if (!showObjectPanel.value || panelCollapsed.value) return
  setCanSideWidth(canSideWidth.value - delta)
}
function onDbcTreeDrag(delta: number) {
  // splitter 位于 dbc-tree-main 与 test-param-detail-panel 之间
  // 向下拖（delta>0）= dbc-tree-main 增大、test-param-panel 减小
  setDbcTreeHeight(dbcTreeHeight.value + delta)
  setTestParamPanelHeight(testParamPanelHeight.value - delta)
}

/** 表格视图下 splitter 仅调整详情面板高度（表格自动铺满剩余空间） */
function onTestParamPanelDrag(delta: number) {
  setTestParamPanelHeight(testParamPanelHeight.value - delta)
}

/** 生成结果展示 */
const resultSuccess = computed(() => generateResult.value?.result?.success !== false)
const resultMessage = computed(
  () => generateResult.value?.result?.message || generateResult.value?.message || '生成完成'
)
const previewData = computed(() => {
  const uiData = generateResult.value?.result?.ui_data
  return uiData ? JSON.stringify(uiData, null, 2) : null
})

/** Test Environment 创建结果展示 */
const teResult = computed(() => generateResult.value?.te_result)
const teResultSuccess = computed(() => !!teResult.value?.success)
const teResultMessage = computed(() => {
  const te = teResult.value
  if (!te) return ''
  if (te.success) {
    const libs = (te.libraries_added || []).map((p: string) => p.split(/[\\/]/).pop()).filter(Boolean)
    return `Test Environment "${te.te_name}" 已创建并保存，已导入 XML：${(te.xml_path || '').split(/[\\/]/).pop() || ''}${libs.length ? `；libraries：${libs.join(', ')}` : ''}`
  }
  return `Test Environment 创建失败：${te.error || '未知错误'}`
})

// ==================== 数据加载 ====================

function transformChartData(data: any): VoltageChartData | null {
  if (!data || !data.segments) return null
  return data as VoltageChartData
}

function setChartData(type: string, data: any) {
  const transformed = transformChartData(data)
  if (type === 'communication') {
    commChartData.value = transformed
  } else if (type === 'diagnostic') {
    diagChartData.value = transformed
  } else {
    paChartData.value = transformed
  }
}

async function loadChartData(type: string) {
  try {
    const res: any = await getChartData(type)
    const data = res?.data || {}
    setChartData(type, data)
    if (data.params) {
      if (type === 'communication') commParams.value = { ...data.params }
      else if (type === 'diagnostic') diagParams.value = { ...data.params }
      else paParams.value = { ...data.params }
    }
  } catch { /* 错误由拦截器处理 */ }
}

async function loadAllChartData() {
  voltageLoading.value = true
  try {
    await Promise.all([
      loadChartData('communication'),
      loadChartData('diagnostic'),
      loadChartData('power_assist'),
    ])
  } finally {
    voltageLoading.value = false
  }
}

async function applyParams(type: string) {
  const params =
    type === 'communication' ? commParams.value
    : type === 'diagnostic' ? diagParams.value
    : paParams.value

  if (!params || Object.keys(params).length === 0) {
    await loadChartData(type)
    return
  }

  voltageLoading.value = true
  try {
    const res: any = await updateParams(type, params)
    const data = res?.data || {}
    if (data.params) {
      if (type === 'communication') commParams.value = { ...data.params }
      else if (type === 'diagnostic') diagParams.value = { ...data.params }
      else paParams.value = { ...data.params }
    }
    if (data.chart_data) {
      setChartData(type, data.chart_data)
    }
    ElMessage.success('参数已应用，图表已刷新')
  } catch { /* 错误由拦截器处理 */ } finally {
    voltageLoading.value = false
  }
}

// ==================== 配置管理 ====================

/** 静默持久化指定配置（用于切换前的自动保存），返回是否成功 */
async function persistConfig(name: string): Promise<boolean> {
  if (!name) return false
  try {
    await saveConfig('can', name, collectConfigData())
    return true
  } catch {
    return false
  }
}

/** 配置被删除：清除内存数据归属，避免切换时自动保存"复活"已删除配置 */
function onConfigDelete(name: string) {
  if (loadedConfig.value === name) loadedConfig.value = ''
}

async function onConfigChange(name: string) {
  const token = ++configChangeToken
  const prevName = loadedConfig.value
  // 切换配置前自动保存当前配置，避免未保存的编辑内容丢失（静默：失败才提示）
  if (prevName && prevName !== name) {
    const ok = await persistConfig(prevName)
    if (!ok) {
      ElMessage.warning(`配置「${prevName}」自动保存失败，切换后可能丢失改动`)
    }
  }
  // 自动保存期间用户又切换了配置：放弃本次加载，由最新一次调用处理
  if (token !== configChangeToken) return
  // 换配置/重置数据后，历史里的节点已不是当前树，撤销会改错对象 → 清空撤销栈
  undoStack.length = 0
  undoPending = []
  undoLabel = ''
  currentConfig.value = name
  loadedConfig.value = ''
  if (name) {
    loadConfig(name, token)
  } else {
    resetData()
  }
}

async function loadConfig(name: string, token: number = configChangeToken) {
  try {
    const res: any = await getConfig('can', name)
    if (token !== configChangeToken) return
    const data = res?.data || {}
    // 加载配置时清空已上传的 DBC，避免残留的上传 DBC 优先级高于配置中的 DBC，
    // 导致配置里保存的测试参数（tp/et）无法显示。
    dbcRaw.value = null
    uploadedFiles.value = []
    applyConfigData(data)
    // 树形图在当前 tick 的 watcher 中构建，等待后兜底补全默认测试参数卡片
    // （幂等：仅对尚无对应参数的节点按信号名/Signal_Type/最小最大值识别，不覆盖配置已保存参数）
    await nextTick()
    if (treeData.value.length) autoMatchMissingParams(treeData.value)
    // 标记内存数据归属该配置，后续切换时据此安全自动保存
    loadedConfig.value = name
  } catch { /* 错误由拦截器处理 */ }
}

/** 把 Configuration（配置页）数据写入 configPageData。
 *  merge=true 时只覆盖表里给出的项（Excel 上传用：保留 CFG 解析出的 cfgDir 等已有值）；
 *  merge=false 时整表替换（加载已保存的配置）。Ready 兼容 readyOn/readyOff 字符串
 *  （旧表形如 `$VehModMngtGlbSafe1UsgModSts=13;`）与 readySignal/readyOnValue 拆分两种形态。 */
function applyConfigurationData(raw: any, merge = false) {
  const rawCfg = { ...(raw || {}) }

  // 有刷模式：CCP 精度/偏移回填（保存时存于 Configuration.ccp_var_scales）。
  // 加载配置（merge=false）时以配置为准，缺失即清空；上传 Excel（merge=true）时只在表里
  // 带该字段才覆盖，避免把用户已设的换算系数冲掉。
  if (!merge || rawCfg.ccp_var_scales) {
    store.setCcpVarScales(rawCfg.ccp_var_scales)
  }
  // 该字段由 store 统一持有，这里从配置表里摘掉，避免整表替换后再回写旧值
  delete rawCfg.ccp_var_scales

  let readyOnParsed = { signal: '', value: '' }
  let readyOffParsed = { signal: '', value: '' }
  if (rawCfg.readyOn) {
    readyOnParsed = parseReadyString(String(rawCfg.readyOn))
  } else if (rawCfg.readyOnSignal !== undefined) {
    readyOnParsed = { signal: rawCfg.readyOnSignal || '', value: rawCfg.readyOnValue || '' }
  }
  if (rawCfg.readyOff) {
    readyOffParsed = parseReadyString(String(rawCfg.readyOff))
  } else if (rawCfg.readyOffSignal !== undefined) {
    readyOffParsed = { signal: rawCfg.readyOffSignal || '', value: rawCfg.readyOffValue || '' }
  }

  // 配置加载：数据与配置内的限定符本就一致，跳过「旧限定符实时替换」
  suppressQualifierReplace = true
  configPageData.value = merge ? { ...configPageData.value, ...rawCfg } : { ...rawCfg }
  suppressQualifierReplace = false

  // 回填主机厂选择（保存时存于 Configuration.serviceObject）
  if (rawCfg.serviceObject) {
    store.setSelectedOem(rawCfg.serviceObject)
  }

  // 回填安全算法（保存时存于 securityAlgo）
  if (rawCfg.securityAlgo) {
    store.setSelectedAlgo(rawCfg.securityAlgo)
  }

  const page = configPageData.value
  page.readySignal = rawCfg.readySignal !== undefined
    ? rawCfg.readySignal
    : readyOnParsed.signal || readyOffParsed.signal || (merge ? page.readySignal : '') || ''
  page.readyOnValue = rawCfg.readyOnValue !== undefined
    ? rawCfg.readyOnValue
    : readyOnParsed.value || (merge ? page.readyOnValue : '') || ''
  page.readyOffValue = rawCfg.readyOffValue !== undefined
    ? rawCfg.readyOffValue
    : readyOffParsed.value || (merge ? page.readyOffValue : '') || ''
}

function applyConfigData(data: any, syncChart: boolean = true) {
  // Json 配置中的 DBC 写入 jsonDbcRaw（不覆盖用户上传的 dbcRaw）
  const cfgDbc = data['DBC Canmatrix'] || data['DBC'] || null
  jsonDbcRaw.value = cfgDbc
  dtcRaw.value = data['DTC'] || null
  dllRaw.value = data['DataLinkLayer'] || null
  buildDllTreeFromRaw(dllRaw.value)

  otherData.value = { ...(data['Other'] || data['other_page'] || {}) }

  // 从 Other 数据中提取 Group 卡片数据（数组形式）
  const otherRaw = data['Other'] || data['other_page'] || {}
  for (const card of groupCardDefs.value) {
    const raw = otherRaw[card.key]
    if (Array.isArray(raw)) {
      card.groups = raw.map((v: any) => ({ id: genId(), values: v }))
    } else {
      card.groups = []
    }
  }

  // 配置页数据（兼容旧 key：Configuration / config_page）
  applyConfigurationData(data['Configuration'] || data['config_page'] || {})

  otherCheckboxStates.value = { ...(data['OtherCheckboxes'] || {}) }

  const volt = data['Volt'] || data['volt_page'] || {}
  const commRaw = volt.communication || volt.communication_params || {}
  const diagRaw = volt.diagnostic || volt.diagnostic_params || {}
  const paRaw = volt.power_assist || volt.power_assist_params || {}
  commParams.value = Object.keys(commRaw).length ? { ...commRaw } : { ...DEFAULT_COMM_PARAMS }
  diagParams.value = Object.keys(diagRaw).length ? { ...diagRaw } : { ...DEFAULT_DIAG_PARAMS }
  paParams.value = Object.keys(paRaw).length ? { ...paRaw } : { ...DEFAULT_PA_PARAMS }

  if (syncChart) {
    syncChartDataWithParams()
  }
}

async function syncChartDataWithParams() {
  voltageLoading.value = true
  try {
    const tasks: Promise<any>[] = []
    if (Object.keys(commParams.value).length) {
      tasks.push(updateParams('communication', commParams.value).then((res: any) => {
        const d = res?.data || {}
        if (d.params) commParams.value = { ...d.params }
        if (d.chart_data) setChartData('communication', d.chart_data)
      }))
    } else {
      tasks.push(loadChartData('communication'))
    }
    if (Object.keys(diagParams.value).length) {
      tasks.push(updateParams('diagnostic', diagParams.value).then((res: any) => {
        const d = res?.data || {}
        if (d.params) diagParams.value = { ...d.params }
        if (d.chart_data) setChartData('diagnostic', d.chart_data)
      }))
    } else {
      tasks.push(loadChartData('diagnostic'))
    }
    if (Object.keys(paParams.value).length) {
      tasks.push(updateParams('power_assist', paParams.value).then((res: any) => {
        const d = res?.data || {}
        if (d.params) paParams.value = { ...d.params }
        if (d.chart_data) setChartData('power_assist', d.chart_data)
      }))
    } else {
      tasks.push(loadChartData('power_assist'))
    }
    await Promise.all(tasks)
  } finally {
    voltageLoading.value = false
  }
}

function buildReadyString(signal: string, value: string): string {
  if (!signal) return ''
  return `$${signal}=${value || '0'};`
}

function parseReadyString(str: string): { signal: string; value: string } {
  const m = str.match(/^\$([^=]+)=(.+);$/)
  if (m) return { signal: m[1], value: m[2] }
  return { signal: str, value: '' }
}

function collectConfigData(): any {
  const cfg = { ...configPageData.value }
  cfg.serviceObject = store.selectedOem || 'BYD'
  cfg.securityAlgo = store.selectedAlgo || 'BYD_CBC'
  // 有刷模式：CCP 符号的精度/偏移（对象浏览器双击设置）随配置保存。
  // store 是唯一来源，所以这里按当前值整体写入（清空后即为 {}）
  cfg.ccp_var_scales = { ...store.ccpVarScales }

  // 兜底：确保 cfgDir 来自最新的 store.cfgData（避免老配置未保存 cfgDir 时丢失）
  if (!cfg.cfgDir && store.cfgData?.cfg_dir) {
    cfg.cfgDir = store.cfgData.cfg_dir
  }

  const readySig = cfg.readySignal || cfg.readyOnSignal || cfg.readyOffSignal || ''
  if (readySig) {
    cfg.readyOn = buildReadyString(readySig, cfg.readyOnValue || '')
    cfg.readyOff = buildReadyString(readySig, cfg.readyOffValue || '')
  }

  // 收集 Other 数据（简单字段）
  const otherDataClean: Record<string, any> = {}
  for (const [k, v] of Object.entries(otherData.value)) {
    if (v === '' || v === null || v === undefined) continue
    otherDataClean[k] = v
  }

  // 收集 Group 卡片数据（拖拽生成的多组参数）
  const groupDataClean: Record<string, any> = {}
  for (const card of groupCardDefs.value) {
    if (card.groups.length > 0) {
      groupDataClean[card.key] = card.groups.map(g => g.values)
    }
  }

  // 收集 Hex ID 卡片数据
  const hexDataClean: Record<string, any> = {}
  for (const card of hexIdCardDefs.value) {
    const v = otherData.value[card.key]
    if (v) hexDataClean[card.key] = v
  }

  // 收集 Signal_InvalidValue 数据：直接取 DBC 报文信号表的 Invalid_Value 列（EPS 信号）。
  // 无效值未填写的信号默认不测试，因此不会出现在该列表中（信号名不传给后端）。
  // CRC / Counter 信号不参与该用例，保存时剔除。
  const signalInvalidData: Array<{ signalName: string; invalidValue: string }> = []
  for (const [name, value] of Object.entries(signalInvalidValueLookup.value)) {
    const key = String(name || '').trim()
    const val = String(value || '').trim()
    if (!key || !val) continue
    if (isCrcOrCounterSignal(key, signalTypeLookup.value[key])) continue
    signalInvalidData.push({ signalName: key, invalidValue: val })
  }

  // 收集 checkbox 状态
  const checkboxClean: Record<string, boolean> = {}
  for (const def of otherFieldDefs) {
    if (!def.key || def.key === 'emptyRow') continue
    checkboxClean[def.key] = !!otherCheckboxStates.value[def.key]
  }
  for (const card of groupCardDefs.value) {
    checkboxClean[card.key] = isGroupActive(card.key)
  }
  for (const card of hexIdCardDefs.value) {
    checkboxClean[card.key] = !!otherCheckboxStates.value[card.key]
  }
  for (const d of compoundSliderDefs) {
    for (const s of d.sliders) {
      checkboxClean[s.key] = otherData.value[s.key] === 'TRUE'
    }
  }

  // 合并所有 Other 数据
  const mergedOther = {
    ...otherDataClean,
    ...groupDataClean,
    ...hexDataClean,
    ...(signalInvalidData.length ? { signalInvalidValue: signalInvalidData } : {}),
  }

  // DTC 数据双重保证：空单元格填 0（DTC 码列除外），避免后端 pandas 解析为 NaN
  const dtcSanitized = (() => {
    const raw = dtcRaw.value
    if (!raw || !raw.rows) return raw
    const rows = raw.rows.map((row: any[]) =>
      row.map((cell: any, idx: number) => {
        // 第 0 列为 DTC 码，留空待用户填写，不默认 0
        if (idx === 0) return cell
        if (cell === '' || cell === null || cell === undefined) return 0
        return cell
      })
    )
    return { ...raw, rows }
  })()

  return {
    'DBC Canmatrix': treeData.value.length ? buildDbcRawFromSignalRows() : (dbcRaw.value || jsonDbcRaw.value),
    'DataLinkLayer': dllTreeData.value.length ? buildDllRawFromTree() : dllRaw.value,
    'DTC': dtcSanitized,
    'Other': mergedOther,
    'OtherCheckboxes': checkboxClean,
    'Configuration': cfg,
    'Volt': {
      communication: { ...commParams.value },
      diagnostic: { ...diagParams.value },
      power_assist: { ...paParams.value },
    },
  }
}

async function onSave() {
  if (!currentConfig.value) {
    ElMessage.warning('请先选择配置')
    return
  }
  try {
    await saveConfig('can', currentConfig.value, collectConfigData())
    loadedConfig.value = currentConfig.value
    ElMessage.success('配置保存成功')
  } catch { /* 错误由拦截器处理 */ }
}

/** base64 内容触发浏览器下载（Web 环境兜底） */
function downloadBase64(base64: string, filename: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 导出当前配置为 Excel（三张矩阵表：DBC Canmatrix / DTC / DataLinkLayer）
 *  Electron 环境弹系统「另存为」后由后端写盘；Web 环境回退浏览器下载。 */
async function onExportExcel() {
  if (!currentConfig.value) {
    ElMessage.warning('请先选择配置')
    return
  }
  const defaultName = `${currentConfig.value.replace(/[\\/:*?\[\]]/g, '_')}.xlsx`
  let savePath = ''
  const api = (window as any).electronAPI
  if (api?.saveDialog) {
    savePath = (await api.saveDialog({
      title: '导出配置为 Excel',
      defaultPath: defaultName,
      filters: [['Excel 文件', '*.xlsx']],
    })) || ''
    if (!savePath) return
  }
  // 导出列 = 表格视图当前显示的列（跟随显隐与顺序），后端据此生成 Excel 表头；
  // scope 供后端判断报文级列（信号行留空，由报文行承载）
  const exportColumns = dbcTableVisibleColumns.value.map((c) => ({
    key: c.key,
    label: c.label,
    en: c.en,
    scope: c.scope,
  }))
  try {
    const res: any = await exportConfigExcel(collectConfigData(), currentConfig.value, savePath, exportColumns)
    const data = res?.data || {}
    if (savePath) {
      ElMessage.success(res?.message || `已导出至 ${savePath}`)
    } else if (data.content_base64) {
      downloadBase64(data.content_base64, data.filename || defaultName)
      ElMessage.success(res?.message || '已导出配置 Excel')
    }
  } catch { /* 错误由拦截器处理 */ }
}

/** 有刷模式：收集生成脚本用到的符号 → { addr, size, type?, precision?, offset? }，供后端生成 CCP 采集模块 */
function collectCcpSymbols(): Record<string, { addr: string; size: number; type?: string; precision?: number; offset?: number }> {
  const table = new Map<string, { addr: string; size: number; precision?: number; offset?: number }>()
  for (const v of store.objA2lVars.measurements) {
    const name = String(v?.name || '').trim()
    const addr = String(v?.type || '').trim()
    const size = Number(v?.size || 0)
    if (name && addr && size > 0) {
      table.set(name, { addr, size, precision: v?.precision, offset: v?.offset })
    }
  }
  if (!table.size) return {}

  const used = new Set<string>()
  const addName = (raw: any) => {
    const name = String(raw ?? '').trim()
    if (name && table.has(name)) used.add(name)
  }
  // 配置区中作为变量引用的字段（batteryVoltage / torqueLimit 等）
  for (const val of Object.values(configPageData.value)) {
    if (typeof val === 'string') addName(val)
  }
  // DBC 表的 XCP_CCP_varname 列
  const dbc = dbcRaw.value
  const cols: string[] = Array.isArray(dbc?.columns) ? dbc.columns : []
  const xcpIdx = cols.findIndex((c: string) => String(c).includes('XCP_CCP_varname'))
  if (xcpIdx >= 0 && Array.isArray(dbc?.rows)) {
    for (const row of dbc.rows) {
      addName(Array.isArray(row) ? row[xcpIdx] : row?.[cols[xcpIdx]])
    }
  }

  // CCP 系统变量类型 / 精度 / 偏移（对象浏览器双击符号设置）：
  // 精度/偏移优先级：对象浏览器设置 > mapxml 对象自带值 > 默认 1 / 0；等于默认值时不发该字段
  const out: Record<string, { addr: string; size: number; type?: string; precision?: number; offset?: number }> = {}
  for (const name of used) {
    const info = table.get(name)!
    const entry: { addr: string; size: number; type?: string; precision?: number; offset?: number } = {
      addr: info.addr,
      size: info.size,
    }
    const type = store.ccpVarTypes[name]
    if (type) entry.type = type
    const scale = store.ccpVarScales[name]
    const precision = scale?.precision ?? Number(info.precision ?? DEFAULT_CCP_PRECISION)
    const offset = scale?.offset ?? Number(info.offset ?? DEFAULT_CCP_OFFSET)
    if (Number.isFinite(precision) && precision !== DEFAULT_CCP_PRECISION) entry.precision = precision
    if (Number.isFinite(offset) && offset !== DEFAULT_CCP_OFFSET) entry.offset = offset
    out[name] = entry
  }
  return out
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 无效值单元格校验未通过（后端已中止生成）：逐条列出问题，让用户改完再生成 */
async function showInvalidValueDialog(
  entries: Array<{ signal?: string; raw?: string; kind?: string }>
) {
  const items = (entries || [])
    .map((it) => {
      const sig = escapeHtml(String(it.signal || '（未命名信号）'))
      const raw = escapeHtml(String(it.raw || ''))
      const kind = escapeHtml(String(it.kind || '非法'))
      return `<li><code>${sig}</code> 的无效值里 <code>${raw}</code> 无法解析（${kind}）</li>`
    })
    .join('')
  await ElMessageBox.alert(
    '<div>以下单元格导致本次生成已中止，请改完再重新生成：</div>'
      + `<ul style="margin:8px 0;padding-left:18px;line-height:1.8">${items}</ul>`
      + '<div style="color:#909399">写法：单点直接写数值，区间写成 <code>[下限,上限]</code>，'
      + '例如 <code>1,[3,5],6</code>；十六进制写作 <code>0x1F</code>。</div>',
    '无效值单元格存在非法内容，已中止生成',
    { dangerouslyUseHTMLString: true, type: 'warning', confirmButtonText: '知道了' }
  ).catch(() => {})
}

async function onGenerate() {
  if (!currentConfig.value) {
    ElMessage.warning('请先选择配置')
    return
  }
  // 校验链路层 TRC 必填参数：StepUpValue 为空/0 会导致后端除零
  for (const node of dllTreeData.value) {
    const d = node.data
    if (!d.StepUpValue || String(d.StepUpValue).trim() === '' || Number(d.StepUpValue) === 0) {
      ElMessage.warning(`链路层「${d['DTC Test'] || '?'} [${d.Item}]」的 StepUpValue 未填写或为 0，请补充后再生成`)
      return
    }
  }
  try {
    await saveConfig('can', currentConfig.value, collectConfigData())
  } catch (e) {
    console.error('[CAN] 配置保存失败:', e)
    return
  }
  activeTab.value = 'config'
  generating.value = true
  generateResult.value = null
  try {
    const cfgDir = store.cfgData?.cfg_dir || ''
    // 有刷模式：把用到的符号（配置区 + DBC 的 XCP_CCP_varname 列）解析成地址/长度随请求下发
    const ccpSymbols = store.canMotorMode === 'brushed' ? collectCcpSymbols() : {}
    // 继电器模块 / CAN 通道：侧边栏配置，写入 TestFunction.cin 里共用的 RelayON/RelayOFF
    const relayCfg = store.relayConfigs.can
    const res: any = await generateCAN(
      currentConfig.value,
      store.selectedOem,
      cfgDir,
      store.canMotorMode,
      ccpSymbols,
      relayCfg.relayModule,
      relayCfg.canChannel,
    )
    const payload = res?.data || res
    // 后端校验「无效值」单元格未通过：已中止生成，逐条弹窗列出，不走下面的结果面板
    if (payload?.blocked) {
      await showInvalidValueDialog(payload.invalid_values || [])
      return
    }
    generateResult.value = payload
  } catch (e) {
    console.error('[CAN] generateCAN 失败:', e)
  } finally {
    generating.value = false
  }
}

async function handleOpenDir() {
  const dir = generateResult.value?.output_dir
  if (!dir) {
    ElMessage.warning('没有可打开的目录')
    return
  }
  try {
    await openFolder(dir)
  } catch {
    /* 错误由拦截器处理 */
  }
}

async function onCreate(name: string) {
  if (!name) return
  const hasConfig = !!currentConfig.value
  // 新建配置会切走当前配置：先自动保存当前配置，避免未保存内容丢失
  const prevName = loadedConfig.value
  if (prevName && prevName !== name) {
    await persistConfig(prevName)
  }
  try {
    // 有选择配置时清空数据，无配置时保留当前数据
    if (hasConfig) {
      resetData(false)
    }
    await saveConfig('can', name, collectConfigData())
    currentConfig.value = name
    loadedConfig.value = name
    await configToolbarRef.value?.loadConfigs?.()
    if (configToolbarRef.value?.selectedConfig !== undefined) {
      configToolbarRef.value.selectedConfig = name
    }
    ElMessage.success(`已创建新配置 "${name}"，请编辑后保存`)
  } catch { /* 错误由拦截器处理 */ }
}

function onRefresh() {
  if (currentConfig.value) {
    loadConfig(currentConfig.value)
  } else {
    loadAllChartData()
  }
}

function resetData(loadChart: boolean = true) {
  dbcRaw.value = null
  jsonDbcRaw.value = null
  dllRaw.value = null
  dtcRaw.value = null
  otherData.value = {}
  otherCheckboxStates.value = {}
  groupCardDefs.value.forEach(c => { c.groups = [] })
  hexIdCardDefs.value.forEach(c => { otherData.value[c.key] = '' })
  configPageData.value = {}
  lastA2lQualifier = ''
  lastCddQualifier = ''
  uploadedFiles.value = []
  a2lVars.value = { measurements: [], characteristics: [] }
  commParams.value = { ...DEFAULT_COMM_PARAMS }
  diagParams.value = { ...DEFAULT_DIAG_PARAMS }
  paParams.value = { ...DEFAULT_PA_PARAMS }
  generateResult.value = null
  signalRows.value = []
  selectedSignalRows.value = []
  signalRowSeq = 0
  testParamMap.value = new Map()
  loadedConfig.value = ''
  try {
    localStorage.removeItem(STORAGE_KEY_SIGNALS)
  } catch { /* ignore */ }
  if (loadChart) {
    loadAllChartData()
  }
}

// ==================== 统一文件上传 ====================

function getFileType(fileName: string): { type: UploadedFile['type']; typeLabel: string } | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return { type: 'excel', typeLabel: 'Excel' }
  } else if (lower.endsWith('.dbc')) {
    return { type: 'dbc', typeLabel: 'DBC' }
  } else if (lower.endsWith('.a2l')) {
    return { type: 'a2l', typeLabel: 'A2L' }
  }
  return null
}

function updateFileStatus(name: string, status: UploadedFile['status']) {
  const idx = uploadedFiles.value.findIndex(f => f.name === name)
  if (idx >= 0) {
    uploadedFiles.value[idx].status = status
  }
}

async function onUnifiedFileChange(uploadFile: any) {
  const file = uploadFile?.raw || uploadFile
  if (!file) return

  const fileInfo = getFileType(file.name)
  if (!fileInfo) {
    ElMessage.warning('不支持的文件格式')
    return
  }

  const existingIdx = uploadedFiles.value.findIndex(f => f.name === file.name)
  if (existingIdx >= 0) {
    uploadedFiles.value.splice(existingIdx, 1)
  }
  uploadedFiles.value.unshift({
    name: file.name,
    type: fileInfo.type,
    typeLabel: fileInfo.typeLabel,
    status: 'parsing',
  })
  unifiedParsing.value = true

  try {
    if (fileInfo.type === 'excel') {
      const res: any = await parseCAN(file)
      const parsed = res?.data || res || {}
      if (parsed.DBC) {
        dbcRaw.value = parsed.DBC
        signalRows.value = buildSignalRowsFromRaw(parsed.DBC)
      }
      if (parsed.DTC) {
        dtcRaw.value = parsed.DTC
        sanitizeImportedDtcTable(dtcRaw.value)
      }
      if (parsed.DataLinkLayer) { dllRaw.value = parsed.DataLinkLayer; buildDllTreeFromRaw(dllRaw.value) }
      // 旧版 Excel 的 Configuration 表（限定符 / Ready / 内部变量名等）一并回填配置页
      if (parsed.Configuration) {
        applyConfigurationData(parsed.Configuration, true)
        ElMessage.success(`已回填配置参数 ${Object.keys(parsed.Configuration).length} 项`)
      }
      if (parsed.DBC) {
        activeTab.value = 'dbc'
        // 延迟检查缺失属性值，等待 signalRows 更新
        setTimeout(() => checkMissingSignalAttributes(), 100)
      }
      else if (parsed.DTC) activeTab.value = 'dtc'
      else if (parsed.DataLinkLayer) activeTab.value = 'dataLink'
      ElMessage.success('Excel 解析成功')
    } else if (fileInfo.type === 'dbc') {
      const res: any = await parseDbcFile(file)
      const raw = res?.data || res
      if (raw?.columns && raw?.rows) {
        dbcRaw.value = raw
        signalRows.value = buildSignalRowsFromRaw(raw)
        activeTab.value = 'dbc'
        setTimeout(() => checkMissingSignalAttributes(), 100)
        ElMessage.success(res?.message || 'DBC 解析成功')
      } else {
        console.error('[CAN] DBC unexpected response:', res)
        ElMessage.error('DBC 解析返回数据异常')
      }
    } else if (fileInfo.type === 'a2l') {
      const res: any = await parseA2lFile(file)
      const data = res?.data || {}
      a2lVars.value = {
        measurements: data.measurements || [],
        characteristics: data.characteristics || [],
      }
      const fields = []
      if (data.total_vars) fields.push(`${data.total_vars} 个变量`)
      ElMessage.success(
        fields.length
          ? `A2L 解析成功，已回填：${fields.join('、')}`
          : 'A2L 解析完成，未提取到关键字段'
      )
    }
    updateFileStatus(file.name, 'success')
  } catch {
    updateFileStatus(file.name, 'error')
    ElMessage.error(`${fileInfo.typeLabel} 解析失败`)
  } finally {
    unifiedParsing.value = uploadedFiles.value.some(f => f.status === 'parsing')
  }
}

// ==================== 拖拽 ====================

function onConfigDragEnter(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  const key = el.getAttribute('data-drop-key')
  if (!key || dragOverKey === key) return
  if (dragOverEl) dragOverEl.classList.remove('drag-over')
  dragOverKey = key
  dragOverEl = el
  el.classList.add('drag-over')
}

function onConfigDragLeave(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  if (dragOverEl === el) {
    el.classList.remove('drag-over')
    dragOverEl = null
    dragOverKey = ''
  }
}

function onDropField(event: DragEvent, target: Record<string, any>, key: string) {
  event.preventDefault()
  if (dragOverEl) {
    dragOverEl.classList.remove('drag-over')
    dragOverEl = null
  }
  dragOverKey = ''
  const name = event.dataTransfer?.getData('text/plain')
  if (name) {
    target[key] = name
  }
}

/** 拖拽替换输入框内容（通用）：仅替换不追加 */
function onDropReplace(event: DragEvent, setVal: (v: string) => void) {
  event.preventDefault()
  event.stopPropagation()
  const name = event.dataTransfer?.getData('text/plain')
  if (name) setVal(name)
}

watch(() => store.selectedOem, (newVal) => {
  if (newVal !== 'GEEA_3.0' && activeTab.value === 'dataLink') {
    activeTab.value = 'dbc'
  }
})

// 监听全局 CFG 数据变化：仅同步配置表单字段（A2L/DBC 加载由 store 统一处理）
watch(() => store.cfgData, (cfgData) => {
  if (!cfgData) return
  // 更新配置表单的 CDDQualifier 和 A2LQualifier，同步 cfg_dir 用于生成时定位输出目录
  if (cfgData.cdd_qualifier || cfgData.a2l_qualifier || cfgData.cfg_dir) {
    configPageData.value = {
      ...configPageData.value,
      cddQualifier: cfgData.cdd_qualifier || configPageData.value.cddQualifier || '',
      // 有刷模式不使用 A2L 限定符，保持为空
      a2lQualifier: store.canMotorMode === 'brushed'
        ? ''
        : (cfgData.a2l_qualifier || configPageData.value.a2lQualifier || ''),
      cfgDir: cfgData.cfg_dir || configPageData.value.cfgDir || '',
    }
  }
  // 加载 CFG 工程：按解析出的限定符对已配置数据全面归一化一次
  forceQualifierReplace()
}, { deep: true })

// ==================== 限定符实时替换 ====================
// A2L_Qualifier / CDD_Qualifier 变化时，把已拖入/已配置数据里的旧限定符段替换为新值，
// 例如已拉取的内部变量（Battery_Voltage、Torque_limit）中的 `sysvar::XCP::<旧限定符>::...`。

/** 限定符字段自身不参与替换 */
const QUALIFIER_META_KEYS = new Set(['a2lQualifier', 'cddQualifier'])

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 替换单个字符串中的限定符段（只动限定符本身，不影响路径其余部分）：
 *  - a2l：`sysvar::XCP::<旧>::path` 形式，或直接以 `<旧>::` 开头的引用；
 *  - cdd：`<旧>::xxx` / `<旧>.xxx` 前缀形式（兼容旧占位符 ABS_ESP）。 */
function replaceQualifierInString(text: string, oldQ: string, newQ: string, mode: 'a2l' | 'cdd'): string {
  const o = String(oldQ || '').trim()
  const n = String(newQ || '').trim()
  if (!text || !n || o === n) return text
  // 快速跳过：限定符仅出现在 `xxx::yyy` 或 `xxx.yyy` 形式中，
  // 绝大多数字符串（信号名 / DTC 码 / 数值）不含 `::` 或 `.`。
  // 加此判断可避免扫描大量无关字符串的正则开销（大配置文件每次事件触发遍历数千节点）。
  if (!text.includes('::') && !text.includes('.')) return text
  let out = text
  if (mode === 'a2l') {
    // sysvar::XCP::<限定符>::path —— 不论原先嵌的是哪个限定符（拖拽时的旧值、模板占位符 XCPDemo、
    // 或限定符输入框当时为空），统一归一化为当前 A2L_Qualifier，保证已配置的变量跟着限定符走
    out = out.replace(/(sysvar::xcp::)[^:]*(?=::)/gi, `$1${n}`)
  }
  if (o) {
    const token = escapeRegExp(o)
    if (mode === 'a2l') {
      // 已知旧限定符时，兼容省略前缀的写法 `xcp::<旧>::` 与 `<旧>::path`
      out = out.replace(new RegExp(`(xcp::)${token}(?=::|$)`, 'gi'), `$1${n}`)
      out = out.replace(new RegExp(`^${token}(?=::)`, 'i'), n)
    } else {
      out = out.replace(new RegExp(`^${token}(?=::|\\.)`, 'i'), n)
    }
  }
  if (mode === 'cdd') {
    // 旧配置沿用模板占位符 ABS_ESP 时同样替换
    out = out.replace(/^ABS_ESP(?=::|\.)/i, n)
  }
  return out
}

/** 递归替换对象/数组/Map 内所有字符串中的限定符段 */
function replaceQualifierDeep(node: any, oldQ: string, newQ: string, mode: 'a2l' | 'cdd'): any {
  if (typeof node === 'string') return replaceQualifierInString(node, oldQ, newQ, mode)
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = replaceQualifierDeep(node[i], oldQ, newQ, mode)
    return node
  }
  if (node instanceof Map) {
    node.forEach((v, k) => node.set(k, replaceQualifierDeep(v, oldQ, newQ, mode)))
    return node
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (QUALIFIER_META_KEYS.has(key)) continue
      node[key] = replaceQualifierDeep(node[key], oldQ, newQ, mode)
    }
    return node
  }
  return node
}

/** 把旧限定符替换到所有「已拉取/已配置」的数据面上 */
function applyQualifierReplace(oldQ: string, newQ: string, mode: 'a2l' | 'cdd') {
  replaceQualifierDeep(configPageData.value, oldQ, newQ, mode)
  replaceQualifierDeep(otherData.value, oldQ, newQ, mode)
  for (const card of groupCardDefs.value) {
    for (const g of card.groups) replaceQualifierDeep(g.values, oldQ, newQ, mode)
  }
  // 测试参数卡片（先配置再拖拽）与卡片配置弹窗：FactorTest 的变量名存在这里
  replaceQualifierDeep(testParamCardConfig.value, oldQ, newQ, mode)
  replaceQualifierDeep(cardConfigForm, oldQ, newQ, mode)
  replaceQualifierDeep(commParams.value, oldQ, newQ, mode)
  replaceQualifierDeep(diagParams.value, oldQ, newQ, mode)
  replaceQualifierDeep(paParams.value, oldQ, newQ, mode)
  replaceQualifierDeep(testParamMap.value, oldQ, newQ, mode)
  replaceQualifierDeep(treeData.value, oldQ, newQ, mode)
  replaceQualifierDeep(signalRows.value, oldQ, newQ, mode)
  replaceQualifierDeep(dtcRaw.value, oldQ, newQ, mode)
}

/** 加载配置时数据与配置内的限定符本就一致，避免用旧配置的限定符误替换新数据 */
let suppressQualifierReplace = false
/** 记录上一次生效的限定符：中途清空输入框再输入时，仍能拿它作为「旧值」 */
let lastA2lQualifier = ''
let lastCddQualifier = ''

/** CFG 工程加载时按当前限定符对已配置数据全面归一化一次：
 *  不比较新旧值（数据里可能嵌着模板占位符 XCPDemo / ABS_ESP，或上次会话遗留的限定符）。 */
function forceQualifierReplace() {
  const a2l = String(configPageData.value.a2lQualifier || '').trim()
  if (a2l) {
    lastA2lQualifier = a2l
    applyQualifierReplace('', a2l, 'a2l')
  }
  const cdd = String(configPageData.value.cddQualifier || '').trim()
  if (cdd) {
    lastCddQualifier = cdd
    applyQualifierReplace('', cdd, 'cdd')
  }
}

/**
 * 限定符替换的防抖调度。
 *
 * 限定符输入框每敲一个字符都会触发 watcher，而 applyQualifierReplace 要全量深度遍历
 * treeData / signalRows / dtcRaw / testParamMap 等十余个结构，配置越大越卡（原本还是
 * flush:'sync'，直接阻塞输入）。此处把连续输入合并成一次替换：停止输入 300ms 后执行。
 *
 * 为保持与「逐字符执行」一致的替换语义，记录本轮输入**起始**的旧限定符（而非上一次按键的值），
 * 例如 XCPDemo → 逐字打 "ABC" 时仍以 XCPDemo 为旧值替换，而不是 A/AB。
 */
const QUALIFIER_DEBOUNCE_MS = 300

function createDebouncedQualifierReplacer(mode: 'a2l' | 'cdd') {
  let timer: ReturnType<typeof setTimeout> | undefined
  let burstOld = ''
  return (oldQ: string, newQ: string) => {
    if (timer === undefined) burstOld = oldQ
    else clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      const from = burstOld
      burstOld = ''
      if (from !== newQ) applyQualifierReplace(from, newQ, mode)
    }, QUALIFIER_DEBOUNCE_MS)
  }
}

const scheduleA2lReplace = createDebouncedQualifierReplacer('a2l')
const scheduleCddReplace = createDebouncedQualifierReplacer('cdd')

watch(() => configPageData.value.a2lQualifier, (val) => {
  const nv = String(val ?? '').trim()
  const ov = lastA2lQualifier
  // 同步到全局 store，供其他模块对象浏览器使用（即时，不防抖）
  if (nv) store.setA2lQualifier(nv)
  if (nv) lastA2lQualifier = nv
  // a2l 的 sysvar 引用按「当前限定符」归一化，不依赖旧值（旧值为空或嵌入的是模板占位符时同样生效）
  if (suppressQualifierReplace || !nv || ov === nv) return
  scheduleA2lReplace(ov, nv)
})

watch(() => configPageData.value.cddQualifier, (val) => {
  const nv = String(val ?? '').trim()
  const ov = lastCddQualifier
  if (nv) lastCddQualifier = nv
  if (suppressQualifierReplace || !ov || !nv || ov === nv) return
  scheduleCddReplace(ov, nv)
})

// 切换到有刷模式：清空 A2L 限定符（该模式不使用 a2l_qualifier）
watch(() => store.canMotorMode, (mode) => {
  if (mode !== 'brushed') return
  configPageData.value.a2lQualifier = ''
  lastA2lQualifier = ''
}, { flush: 'sync' })

watch(() => store.moduleStates.can.lastUploadResult, (result) => {
  if (!result) return
  try {
    if (result.type === 'excel') {
      const parsed = result.data || {}
      if (parsed.DBC) {
        dbcRaw.value = parsed.DBC
        signalRows.value = buildSignalRowsFromRaw(parsed.DBC)
      }
      if (parsed.DTC) {
        dtcRaw.value = parsed.DTC
        sanitizeImportedDtcTable(dtcRaw.value)
      }
      if (parsed.DataLinkLayer) { dllRaw.value = parsed.DataLinkLayer; buildDllTreeFromRaw(dllRaw.value) }
      if (parsed.DBC) {
        activeTab.value = 'dbc'
        setTimeout(() => checkMissingSignalAttributes(), 100)
      }
      else if (parsed.DTC) activeTab.value = 'dtc'
      else if (parsed.DataLinkLayer) activeTab.value = 'dataLink'
    } else if (result.type === 'dbc') {
      const raw = result.data
      if (raw?.columns && raw?.rows) {
        dbcRaw.value = raw
        signalRows.value = buildSignalRowsFromRaw(raw)
        activeTab.value = 'dbc'
        setTimeout(() => checkMissingSignalAttributes(), 100)
      }
    } else if (result.type === 'a2l') {
      const data = result.data || {}
      a2lVars.value = {
        measurements: data.measurements || [],
        characteristics: data.characteristics || [],
      }
    } else if (result.type === 'mapxml') {
      // .mapxml 符号复用 A2L 视图加载到对象浏览器
      const data = result.data || {}
      a2lVars.value = {
        measurements: data.measurements || [],
        characteristics: data.characteristics || [],
      }
    }
  } finally {
    store.moduleStates.can.lastUploadResult = null
  }
})

// ==================== 初始化 ====================

watch([activeTab, activeVoltageTab], () => {
  if (activeTab.value !== 'voltage') return
  nextTick(() => {
    commChartRef.value?.resize?.()
    diagChartRef.value?.resize?.()
    paChartRef.value?.resize?.()
  })
})

// ==================== 快捷键（统一快捷键层注册） ====================
// 注意：useShortcut 必须在 setup 同步执行期调用（内部用 onUnmounted 自动注销）

/** 焦点是否在 DTC 表格内：是则交给 DtcCardList 的 context 快捷键处理 */
function focusInDtcCardList(): boolean {
  const el = document.activeElement as HTMLElement | null
  return !!el?.closest?.('.dtc-card-list')
}

// 链路层 DTC 复制 / 粘贴
useShortcut({
  id: 'can:dllCopy',
  keys: 'Ctrl+C',
  desc: '复制链路层选中的 DTC 配置',
  when: () => isModuleActive('/can') && activeTab.value === 'dataLink' && !!selectedDllNode.value,
  run: () => {
    dllClipboard.value = { ...selectedDllNode.value!.data }
    ElMessage.success('已复制 DTC 配置，按 Ctrl+V 粘贴')
    return true
  },
})
useShortcut({
  id: 'can:dllPaste',
  keys: 'Ctrl+V',
  desc: '粘贴新增链路层 DTC',
  when: () => isModuleActive('/can') && activeTab.value === 'dataLink' && !!dllClipboard.value,
  run: () => {
    const src = dllClipboard.value!
    const newNode: DllTreeNode = {
      id: `dll-${Date.now()}`,
      label: `${src.Item}`,
      type: 'dll-item',
      data: { ...src, 'DTC Test': '' },
    }
    dllTreeData.value.push(newNode)
    dllSelectedType.value = src.Item
    dllNavLevel.value = 'items'
    selectedDllNode.value = newNode
    ElMessage.success('已粘贴 DTC')
    return true
  },
})

// 撤销（焦点在 DTC 表格内时交给 DtcCardList 自己的快捷键）
useShortcut({
  id: 'can:undo',
  keys: 'Ctrl+Z',
  desc: '撤销上一步操作',
  when: () => isModuleActive('/can') && !focusInDtcCardList(),
  run: () => {
    undo()
    return true
  },
})

// 测试参数复制 / 粘贴（树上标签 + 对象节点）
useShortcut({
  id: 'can:testParamCopy',
  keys: 'Ctrl+C',
  desc: '复制当前选中的测试参数',
  when: () => isModuleActive('/can') && !!selectedTestParam.value && !focusInDtcCardList(),
  run: () => {
    copySelectedTestParam()
    return true
  },
})
useShortcut({
  id: 'can:testParamPaste',
  keys: 'Ctrl+V',
  desc: '粘贴测试参数到当前选中的报文/信号',
  when: () => isModuleActive('/can') && !!testParamClipboard.value && !focusInDtcCardList(),
  run: () => {
    pasteTestParamToSelectedNode()
    return true
  },
})

// 条目级：删除选中项（Shift+Delete，Delete/Backspace 在表格内仍是清空单元格）/ 新增条目
useShortcut({
  id: 'can:deleteItem',
  keys: 'Shift+Delete',
  scope: 'context',
  desc: '删除当前选中的信号（DBC）或 DTC 行',
  when: () =>
    isModuleActive('/can') &&
    ((activeTab.value === 'dbc' && (selectedSignalRows.value.length > 0 || !!selectedTreeNode.value)) ||
      (activeTab.value === 'dtc' && selectedDtcRow.value >= 0)),
  run: () => {
    if (activeTab.value === 'dtc') removeDtcRow()
    else removeSelectedRows()
    return true
  },
})
useShortcut({
  id: 'can:addItem',
  keys: 'Insert',
  scope: 'context',
  desc: '新增信号（DBC）或 DTC 行',
  when: () =>
    isModuleActive('/can') &&
    ((activeTab.value === 'dbc' && dbcViewMode.value === 'tree') || activeTab.value === 'dtc'),
  run: () => {
    if (activeTab.value === 'dtc') addDtcRow()
    else addSignalRow()
    return true
  },
})

onMounted(() => {
  loadAllChartData()
  loadCrcAlgorithms()
  // CFG 解析的 A2L/DBC 由 store 统一加载；此处做兜底：若 store 尚未加载则触发
  if (store.cfgData?.cfg_dir && !store.objCfgDbcRaw) {
    store.loadDbcFromCfgDir(store.cfgData.cfg_dir)
  }
  if (store.cfgData?.a2l_path && store.canMotorMode === 'brushless' && !store.objA2lVars?.measurements?.length) {
    store.loadA2lFromPath(store.cfgData.a2l_path)
  }

  // 全局事件委托：鼠标点击输入框时全选内容
  document.addEventListener('focusin', handleGlobalFocusIn)
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', handleGlobalFocusIn)
})

function handleGlobalFocusIn(e: Event) {
  const target = e.target as HTMLElement
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    // 仅对文本类输入框全选，排除 checkbox/radio/button
    if (target.type === 'text' || target.type === 'number' || target.type === 'search' || target.tagName === 'TEXTAREA') {
      target.select()
    }
  }
}

onActivated(() => {
})
</script>

<style scoped lang="scss">
.can-view {
  padding: 4px 0;
}

.can-content {
  min-height: calc(100vh - var(--header-height) - var(--tab-height) - 100px);
}

.can-sub-tabs {
  :deep(.el-tabs__header.is-left) {
    width: 130px;
    margin-right: 16px;
  }

  :deep(.el-tabs__item) {
    height: 42px;
    line-height: 42px;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.sub-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 400px;
}

.sub-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sub-page-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.sub-page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.search-input {
  width: 240px;
  margin-left: auto;
}

.table-area {
  height: 520px;
}

.dbc-tree-main {
  overflow-y: auto;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  padding: 8px 0;
  flex-shrink: 0;
}

/* 表格视图容器：高度自适应铺满页签，表格内部按容器高度滚动 */
.dbc-table-main {
  min-height: 0;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  padding: 4px 8px 8px;
  background: var(--bg-card);
}

/* 表格视图顶部工具区（与树形图共用头部那排按钮） */
.dst-selected-hint {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.dst-col-setting {
  max-height: 360px;
  overflow-y: auto;
}

.dst-col-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}

.dst-col-ops {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.dst-col-foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--border-color-light);
  margin-top: 6px;
}

/* 表格视图：把 DBC 页签的高度贯通到表格容器，使表格铺满页面。
   注意：这里必须给「确定高度」而不是沿用 min-height，否则下方 height: 100% 会退化成
   内容高度——打开测试参数详情面板时会撑高整页，而不是让表格让出空间。 */
.can-content.fill-height {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height) - var(--tab-height) - 100px);
}

.can-content.fill-height .can-sub-tabs {
  flex: 1;
  min-height: 0;
}

.can-content.fill-height .can-sub-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.can-content.fill-height .sub-page {
  height: 100%;
  min-height: 0;
}

.can-content.fill-height .dbc-table-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.main-dbc-tree {
  background: transparent;

  :deep(.el-tree-node__content) {
    height: auto;
    min-height: 32px;
    align-items: flex-start;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  :deep(.el-tree-node__label) {
    flex: 1;
  }

  // 隐藏 disabled 节点的复选框（sender、属性）
  :deep(.el-tree-node[aria-disabled="true"] > .el-tree-node__content > .el-checkbox) {
    display: none !important;
  }

  // 隐藏展开/折叠三角箭头
  :deep(.el-tree-node__expand-icon) {
    display: none !important;
  }
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-small);
  width: 100%;
  font-size: 14px;
  transition: background 0.15s ease;
  flex-wrap: wrap;
  row-gap: 6px;

  &:hover {
    background: var(--bg-hover);
  }

  &.tree-node-drop-over {
    background: rgba(79, 70, 229, 0.12);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  &.is-new {
    background: rgba(250, 173, 20, 0.18);
    box-shadow: inset 0 0 0 1px rgba(250, 173, 20, 0.7);
  }

  &.is-diff {
    background: rgba(250, 173, 20, 0.10);
    box-shadow: inset 0 0 0 1px rgba(250, 173, 20, 0.45);
  }

  &.is-sender .node-label {
    font-weight: 600;
    color: var(--color-primary);
  }

  &.is-msg .node-label {
    font-weight: 500;
  }

  &.is-signal .node-label {
    font-weight: 500;
  }

  &.is-group .node-label {
    color: var(--text-secondary);
    font-size: 14px;
  }

  &.is-attr {
    .node-label {
      color: var(--text-secondary);
      font-size: 14px;
      flex-shrink: 0;
    }
  }
}

.node-icon {
  font-size: 16px;
  flex-shrink: 0;

  &.sender {
    color: var(--color-primary);
  }

  &.message {
    color: var(--color-warning);
  }

  &.group {
    color: var(--color-primary);
  }

  &.signal {
    color: var(--color-success);
  }

  &.attr {
    color: var(--text-secondary);
  }
}

.node-label {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-info {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
  padding-left: 8px;
  white-space: nowrap;
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attr-value {
  color: var(--text-primary);
  font-size: 13px;
  cursor: text;
  margin-left: auto;
  padding-left: 8px;
  white-space: nowrap;
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.test-param-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.test-param-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 13px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.configured {
    background: rgba(79, 70, 229, 0.15);
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  &.test-param-tag-drop-over {
    border-color: var(--color-primary);
    background: rgba(79, 70, 229, 0.2);
    color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.25);
  }

  .test-param-tag-close {
    font-size: 11px;
    opacity: 0.6;

    &:hover {
      opacity: 1;
      color: var(--color-danger);
    }
  }
}

.test-param-detail-panel {
  margin-top: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-medium);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: auto;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  .detail-panel-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: var(--bg-sidebar);
    border-bottom: 1px solid var(--border-color-light);

    .detail-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .detail-close {
      font-size: 22px;
      color: var(--text-secondary);
      cursor: pointer;
      line-height: 1;

      &:hover {
        color: var(--color-danger);
      }
    }
  }

  .detail-panel-body {
    padding: 20px;
  }

  .param-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .param-card {
    flex: 1;
    min-width: 280px;
    max-width: 100%;
    background: transparent;
    border: none;
    border-radius: var(--radius-small);
    padding: 0;

    &.param-card-inline {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 0 0 auto;
      min-width: auto;

      &.param-card-right {
        margin-left: auto;
      }
    }

    .param-card-label {
      display: none;
    }

    .param-card-hint {
      display: none;
    }

    :deep(.el-input) {
      width: 100%;
    }

    :deep(.el-input__wrapper) {
      background: var(--bg-sidebar);
      border: 1px solid transparent;
      box-shadow: none;
      border-radius: var(--radius-small);
      height: 52px;

      &:hover {
        border-color: var(--color-primary);
      }

      &.is-focus {
        border-color: var(--color-primary);
        box-shadow: none;
      }
    }

    :deep(.el-input__inner) {
      font-size: 14px;
      padding: 12px 14px;
    }

    :deep(.el-switch) {
      margin-top: 4px;
    }
  }
}

.attr-edit-input {
  width: 100%;
  height: 24px;
  padding: 0 6px;
  font-size: 13px;
  border: 1px solid var(--color-primary);
  border-radius: 3px;
  outline: none;
  background: #fff;
}

.label-edit-input {
  min-width: 120px;
  height: 24px;
  padding: 0 6px;
  font-size: 13px;
  border: 1px solid var(--color-primary);
  border-radius: 3px;
  outline: none;
  background: #fff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* 面板操作说明：原来铺在表头下的一整行提示，收进 ? 里 */
.can-help {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 13px;
  line-height: 1;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}

.can-hint {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-regular);

  .hint-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;

    & + .hint-row {
      margin-top: 6px;
    }
  }

  b {
    flex-shrink: 0;
    width: 30px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.signal-table-area {
  margin: 12px 0;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  overflow: hidden;
}

.signal-table {
  // 简约风格：柔和分隔线 + 舒展行高
  --el-table-border-color: transparent;

  :deep(.el-table__cell) {
    padding: 4px 0;
    border-bottom: 1px solid var(--border-color-lighter);
  }

  :deep(.cell) {
    padding: 0 8px;
    line-height: 1.5;
    font-size: 12px;
  }

  // 表头：淡背景 + 轻分隔
  :deep(th.el-table__cell) {
    background: var(--bg-sidebar);
    border-bottom: 1px solid var(--border-color-light);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: pre-line;
    line-height: 1.4;
    padding: 6px 4px;
  }

  // 输入框样式
  :deep(.el-input__wrapper) {
    padding: 0 4px;
    box-shadow: none;
    background: transparent;
  }

  :deep(.el-input__inner) {
    font-size: 12px;
    height: 24px;
    line-height: 24px;
  }
}

// 单元格输入框：默认无边框朴素样式，仅 hover/focus 时显示浅边框
// 单元格输入框：原生 input 替代 el-input，大幅减少组件开销
.native-input {
  width: 100%;
  height: 24px;
  padding: 0 6px;
  font-size: 13px;
  color: inherit;
  background: transparent;
  border: none;
  outline: none;
  box-sizing: border-box;
  transition: background 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    background: var(--bg-card);
    box-shadow: 0 0 0 1px var(--border-color) inset;
  }

  &:focus {
    background: var(--bg-card);
    box-shadow: 0 0 0 1px var(--color-primary) inset;
  }
}

.cell-input {
  width: 100%;

  :deep(.el-input__wrapper) {
    box-shadow: none;
    background: transparent;
    padding: 2px 6px;
    transition: box-shadow 0.15s ease, background 0.15s ease;
  }

  :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--border-color) inset;
    background: var(--bg-card);
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--color-primary) inset;
    background: var(--bg-card);
  }
}

.dual-header {
  display: flex;
  flex-direction: column;
  line-height: 1.25;

  .h-cn {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .h-en {
    font-size: 10px;
    color: var(--text-secondary);
    font-weight: 400;
  }
}

.cell-drop {
  border-radius: 4px;
  transition: box-shadow 0.15s ease, background 0.15s ease;

  &.cell-drag-over {
    background: rgba(24, 144, 255, 0.08);
    box-shadow: 0 0 0 2px var(--color-primary) inset;
  }
}

.signal-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 36px;
    opacity: 0.3;
  }
}

// ====== Other 表单（卡片网格布局） ======
.other-form-container {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-auto-rows: 92px;
  gap: 10px;
  padding: 16px;
  background: var(--bg-sidebar);
  border-radius: var(--radius-base);
  flex: 1;
  overflow-y: auto;
  align-content: start;
}

.other-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 2px solid var(--border-color-lighter);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-color-light);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &--active {
    border-color: var(--primary-color);
    background: rgba(59, 130, 246, 0.04);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);

    &:hover {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18), 0 2px 8px rgba(0, 0, 0, 0.06);
    }
  }

  // 卡片尺寸：--span-<列数>x<行数>，名字与实际跨度一一对应
  // 外层网格 8 列、每行 92px；例：--span-4x2 = 占 4 列宽 × 2 行高（≈194px）
  // 这里生成 1~8 列 × 1~4 行的全部组合，卡片按需选用（见 otherFieldDefs 的 span / getCardSpan）
  @for $c from 1 through 8 {
    @for $r from 1 through 4 {
      &--span-#{$c}x#{$r} {
        grid-column: span $c;
        grid-row: span $r;
      }
    }
  }

  // 分组卡片（groupCardDefs）：宽度由外层 .other-group-wrap 子网格决定（两列并排），
  // 这里只保留高度（由 getGroupRowSpan 控制）
  &--group {
    cursor: default;
    min-height: 120px;
  }

  // 纯参数卡片（paramCardDefs）：跟随自动落位依次排布。
  // 注意：不要给 grid-column 固定列（如 4），否则会挤在单列上、右侧留下大片空白
  &--param {
    cursor: default;
  }
}

// 分组卡片专用子网格：整行另起（占满外层 8 列）+ 内部两列并排，
// 避免 4 列宽的卡片在外层网格里落位参差、留下空白；行高与卡片内的跨行数保持一致
.other-group-wrap {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 92px;
  gap: 10px;
  align-content: start;
}

.other-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.2s ease;
  flex-shrink: 0;
}

.other-card--active .other-card-header {
  color: var(--primary-color);
}

.other-card-title {
  user-select: none;
}

.other-add-btn {
  font-size: 12px !important;
  padding: 0 4px !important;
}

// 卡片右上角「?」使用说明入口
.other-card-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.other-card-help {
  margin-left: auto;
  font-size: 14px;
  color: var(--text-placeholder);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--color-primary);
  }
}

.other-card-header-actions .other-card-help {
  margin-left: 0;
}

.other-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-height: 0;

  .el-input,
  .el-switch {
    width: 100%;
  }
  // 输入框拉伸填满卡片剩余空间，方便拖拽操作
  :deep(.el-input) {
    flex: 1;
    .el-input__wrapper {
      height: 100%;
    }
  }
}

// 其他配置卡片里的开关配色：Element Plus 默认关闭态用边框灰（--el-switch-off-color），
// 在小卡片里很不显眼，这里改成「开=主色、关=警告色」，两态都有颜色、一眼可辨。
// 只改这两个变量即可换色（也可只在某个卡片上覆盖，见 otherFieldDefs 的 key）
.other-card-body :deep(.el-switch) {
  --el-switch-on-color: var(--color-primary);
  --el-switch-off-color: var(--color-warning);
  --el-switch-border-color: transparent;
}

// 宽卡片（--span-4x2，即占 4 列宽 × 2 行高）：内部用 2 列 grid 排列输入框
.other-card--span-4x2 .other-card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: min-content;
  gap: 5px;
  align-content: start;
  justify-content: initial;

  :deep(.el-input) {
    flex: initial;
    .el-input__wrapper {
      height: auto;
    }
  }
}

// layout='break'：强制从第 1 列开始 → 该卡必定另起一行，
// 后面同宽（span 相同）的卡就依次并排成一整排，不受前面卡片落位影响
.other-card--layout-break {
  grid-column-start: 1;
}

// layout='rows'：12 列栅格，靠每个输入框的 span 让「每组参数各占一行」
// （快恢复/慢恢复各 3 项 × span4 = 12；DTC 4 项 × span3 = 12，自然换行）
.other-card--layout-rows .other-card-body {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: min-content;
  gap: 5px;
  align-content: center;
  justify-content: initial;

  :deep(.el-input) {
    flex: initial;
    .el-input__wrapper {
      height: auto;
    }
  }

  :deep(.el-switch) {
    width: 100%;
    justify-content: center;
  }
}

// Compound 滑块卡片：小卡片两两一行（2 列网格）
.other-card-body--sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding-top: 4px;
  align-content: start;

  :deep(.el-input) {
    flex: initial;
  }
}

.other-slider-row {
  display: flex;
  align-items: center;
  // 标签靠左、切换按钮贴小卡片右端
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--bg-sidebar);
  cursor: pointer;
  transition: background 0.15s;

  // 覆盖 .other-card-body .el-switch{width:100%}：否则开关会撑满整行，
  // space-between 没有可分配空间，开关会贴在标签右边而不是小卡片的右端
  :deep(.el-switch) {
    width: auto;
    flex-shrink: 0;
  }

  &:hover {
    background: var(--border-color-lighter);
  }

  &--on {
    background: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
}

.other-slider-label {
  font-size: 12px;
  color: var(--text-regular);
  white-space: nowrap;
  // 空间不足时优先压缩标签，保证右侧开关始终可见
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Group 卡片 body
.other-card-body--groups {
  gap: 8px;
  flex: 1;
  min-height: 0;
  padding: 6px;
  border: 2px dashed transparent;
  border-radius: 6px;
  transition: border-color 0.15s, background 0.15s;

  &--drop {
    border-color: var(--primary-color);
    background: rgba(59, 130, 246, 0.05);
  }
}

.other-drop-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  border: 2px dashed var(--border-color-light);
  border-radius: 6px;
  color: var(--text-placeholder);
  font-size: 12px;
  text-align: center;
}

.other-group-item {
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg-sidebar);
}

.other-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.other-group-idx {
  font-size: 11px;
  color: var(--text-placeholder);
  font-weight: 600;
}

.other-group-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 5px;
}

.other-section-title {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  padding: 8px 4px;
  margin-top: 4px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color-lighter);
    margin: 0 12px;
  }
}

.other-select-all {
  margin-left: auto;
}

// ====== Configuration 表单（剩余控件比例放大） ======
.config-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;

    .el-form-item__label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .el-form-item__content {
      // 加长普通输入框，与 Ready 信号输入框保持一致
      .el-input {
        width: 560px;
        max-width: 100%;
      }

      // drop-zone 包裹的输入框也要撑满
      .drop-zone {
        width: 560px;
        max-width: 100%;

        .el-input {
          width: 100%;
        }
      }
    }
  }

  :deep(.el-input__wrapper) {
    padding: 4px 12px;
    min-height: 36px;
  }

  :deep(.el-input__inner) {
    font-size: 14px;
  }
}

.signal-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  .signal-name {
    flex: 1;
  }

  .signal-value-input {
    flex: 0 0 120px;
  }
}

.ready-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 560px;
  max-width: 100%;

  > .signal-name {
    flex: 1;
    width: 100%;
  }

  .ready-values-row {
    display: flex;
    gap: 8px;

    .ready-value-item {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 140px;

      .ready-value-label {
        flex: 0 0 28px;
        font-size: 12px;
        font-weight: 600;
        color: var(--el-color-primary);
      }

      // 覆盖 .config-form 里 :deep(.el-input) { width: 560px } 的规则
      // 通过 .ready-group .ready-values-row .ready-value-item[data-v-xxx] .el-input 提升特异性到 0,5,0
      :deep(.el-input) {
        width: 100%;
        flex: 1;
      }
    }
  }
}

.other-special-row {
  background: var(--bg-sidebar);
  border-radius: var(--radius-small);
  padding: 4px 8px;
  margin-top: 8px;
}

// ====== Voltage 页面 ======
.voltage-page {
  .voltage-sub-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 12px;
    }
  }
}

.voltage-chart-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.params-panel {
  background: var(--bg-sidebar);
  border-radius: var(--radius-base);
  padding: 16px;
}

.params-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.params-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.enable-switch {
  :deep(.el-switch__label) {
    font-size: 12px;
    font-weight: 500;
  }
  :deep(.el-switch.is-checked .el-switch__core) {
    background-color: #6366f1;
  }
}

.params-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.params-form {
  :deep(.el-form-item) {
    margin-bottom: 8px;
  }
}

.param-input {
  width: 100%;

  :deep(.el-input__inner) {
    text-align: left;
  }
}

// 助力电压参数表单：5个一排
.pa-form {
  .pa-group {
    margin-top: 12px;

    &:first-child {
      margin-top: 0;
    }
  }

  .pa-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    padding: 2px 8px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }

  .pa-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 12px;
    transition: opacity 0.2s ease;

    &.is-disabled {
      opacity: 0.5;
    }
  }

  .pa-item {
    flex: 1 1 20%;
    min-width: 0;
    margin-bottom: 0;

    :deep(.el-form-item__label) {
      font-size: 12px;
      line-height: 36px;
      height: 36px;
      padding-bottom: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :deep(.el-form-item__content) {
      width: 100%;
      line-height: 36px;
    }

    // 增大输入框高度，方便输入和拖拽
    :deep(.el-input__wrapper) {
      padding: 4px 11px;
      min-height: 36px;
    }

    :deep(.el-input__inner) {
      height: 28px;
      line-height: 28px;
      font-size: 13px;
    }

    :deep(.el-input-number) {
      .el-input__inner {
        text-align: left;
      }
    }
  }
}

.chart-area {
  height: 540px;
  min-height: 540px;
}

// ====== Configuration 页面 ======
.config-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.generate-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.output-path {
  :deep(.el-input__inner) {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px;
  }
}

.code-preview {
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  padding: 12px 16px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-regular);
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

// ====== 空状态 ======
.empty-placeholder.small {
  min-height: 120px;
}

// ====== 分割布局 ======
.can-layout {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.can-left {
  flex: 0 0 260px;
  position: sticky;
  top: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.left-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.left-upload {
  margin-top: 8px;
}

.unified-uploader {
  :deep(.el-upload-dragger) {
    padding: 24px 16px;
  }

  .el-icon--upload {
    font-size: 36px;
    color: var(--color-primary);
    margin-bottom: 8px;
  }

  .el-upload__text {
    font-size: 13px;
    color: var(--text-regular);

    em {
      color: var(--color-primary);
      font-style: normal;
      font-weight: 600;
    }
  }

  .el-upload__tip {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 6px;
  }
}

.uploaded-file-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.uploaded-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-hover);
  font-size: 12px;
  border: 1px solid var(--border-color-lighter);
}

.uploaded-file-item.success {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.06);
}

.uploaded-file-item.error {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.06);
}

.uploaded-file-item.parsing {
  border-color: rgba(79, 70, 229, 0.3);
  background: rgba(79, 70, 229, 0.06);
}

.uploaded-file-item .file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.uploaded-file-item .file-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-weight: 500;
}

.uploaded-file-item .file-status-icon {
  font-size: 14px;
  flex-shrink: 0;

  &.success {
    color: var(--color-success);
  }

  &.error {
    color: var(--color-danger);
  }
}

.can-body {
  display: flex;
  gap: 12px;
  position: relative;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
}

.can-main {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: visible;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.can-body.with-panel .can-main {
  flex: 1 1 auto;
  min-width: 0;
}

.can-side {
  flex: 0 0 auto;
  width: 420px;
  overflow: hidden;
  height: calc(100vh - var(--header-height) - var(--tab-height) - 120px);
  position: sticky;
  top: 0;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

// ====== 拖拽放置区 ======
.drop-zone {
  border-radius: var(--radius-small);
  transition: var(--transition-base);

  &.drag-over {
    background: rgba(24, 144, 255, 0.08);
    box-shadow: 0 0 0 2px var(--color-primary);
    border-radius: var(--radius-small);

    :deep(.el-input__wrapper) {
      box-shadow: 0 0 0 1px var(--color-primary) inset !important;
    }
  }
}

/* ==================== Data Link Layer 树形图（两栏布局） ==================== */
.dll-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 520px;
  height: calc(100vh - var(--header-height) - var(--tab-height) - 140px);
}

/* 面包屑导航栏 */
.dll-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  background: var(--bg-card);
  flex-shrink: 0;
}

.dll-back-btn {
  flex-shrink: 0;
}

.dll-crumb-link {
  cursor: pointer;
  color: var(--text-secondary);
  transition: color var(--transition-base);
}

.dll-crumb-link:hover {
  color: var(--color-primary);
}

.dll-crumb-link.is-current {
  color: var(--text-primary);
  font-weight: 600;
  cursor: default;
}

.dll-crumb-current {
  font-weight: 600;
  color: var(--text-primary);
}

/* 第一层：测试类型列表 */
.dll-types-view {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dll-drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 72px;
  color: var(--text-secondary);
  font-size: 13px;
  border: 2px dashed var(--border-color-light);
  border-radius: var(--radius-small);
  transition: all var(--transition-base);

  .empty-icon {
    font-size: 26px;
    opacity: 0.5;
  }
}

.dll-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
}

.dll-type-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: all var(--transition-base);

  &:hover {
    border-color: var(--color-primary);
    background: rgba(79, 70, 229, 0.06);
  }
}

.dll-type-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 第二层：DTC 列表 + 配置（同一页，两栏） */
.dll-items-view {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 12px;
  min-height: 0;
}

.dll-list-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  background: var(--bg-card);
  overflow: hidden;
  min-height: 0;
}

.dll-list-panel .sub-page-header {
  padding: 10px 14px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-color-light);
}

.dll-config-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  background: var(--bg-card);
  overflow: hidden;
  min-height: 0;
}

.dll-items-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.dll-item-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dll-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--transition-base);

  &:hover {
    border-color: var(--color-primary);
    background: rgba(79, 70, 229, 0.06);
  }
}

.dll-item-row.is-active {
  border-color: var(--color-primary);
  background: rgba(79, 70, 229, 0.1);
}

.dll-item-dtc {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dll-detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;

  .empty-icon {
    font-size: 40px;
    opacity: 0.4;
  }
}

/* 左侧：树形图面板 */
.dll-tree-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  background: var(--bg-card);
  overflow: hidden;
}

.dll-tree-panel .sub-page-header {
  padding: 10px 14px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-color-light);
}

.dll-drop-tip {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.dll-tree-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.dll-tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-right: 8px;
}

.dll-node-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dll-drop-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 320px;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  border: 2px dashed var(--border-color-light);
  border-radius: var(--radius-small);
  transition: all var(--transition-base);

  .empty-icon {
    font-size: 40px;
    opacity: 0.4;
  }
}

.dll-tree-area:has(.dll-drop-hint) {
  padding: 10px;
}

/* 拖拽悬停高亮 */
.dll-tree-area.drag-over-active .dll-drop-hint {
  border-color: var(--color-primary);
  background: rgba(79, 70, 229, 0.05);
  color: var(--color-primary);
}

/* 右侧：属性面板 */
.dll-prop-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  background: var(--bg-card);
  overflow: hidden;
}

.dll-prop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-color-light);
}

.dll-prop-form {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.dll-prop-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.dll-prop-form :deep(.el-form-item__label) {
  white-space: normal;
  line-height: 1.4;
}

.dll-form-group-title {
  margin: 10px 0 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(79, 70, 229, 0.06);
  border-left: 3px solid var(--color-primary);
  border-radius: 0 4px 4px 0;
}

.dll-prop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;

  .empty-icon {
    font-size: 40px;
    opacity: 0.4;
  }
}

/* 类型选择弹窗 */
.dll-type-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dll-type-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-regular);
  background: var(--bg-hover);
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--transition-base);

  &:hover {
    background: rgba(79, 70, 229, 0.08);
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: translateX(2px);
  }
}

/* 树形图节点高亮 */
.dll-tree-panel :deep(.el-tree) {
  background: transparent;

  .el-tree-node__content {
    height: 36px;
    border-radius: 6px;
    padding: 0 4px;
    transition: background var(--transition-base);

    &:hover {
      background: var(--bg-hover);
    }
  }

  .el-tree-node.is-current > .el-tree-node__content {
    background: rgba(79, 70, 229, 0.1);
  }
}
</style>

<!-- 其他配置卡片「使用说明」气泡内容会渲染到 body 上，需用非 scoped 样式 -->
<style lang="scss">
.other-card-help-text {
  white-space: pre-line;
  line-height: 1.7;
  font-size: 12px;
  color: var(--text-regular);
}
</style>
