<template>
  <div class="step-editor">
    <template v-if="form">
      <div class="se-toolbar">
        <div class="se-form">
          <el-select v-model="form.type" class="se-type" size="small">
            <el-option v-for="t in tabs" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-select v-if="form.type === 'inject'" v-model="form.role" class="se-role" size="small">
            <el-option label="故障注入" value="inject" />
            <el-option label="故障恢复" value="recover" />
          </el-select>
          <el-input ref="nameInputRef" v-model="form.name" class="se-name" size="small" placeholder="卡片名称" />
          <el-button type="primary" size="small" :icon="Check" @click="save">保存</el-button>
        </div>
        <div class="se-actions">
          <el-tooltip content="从粘贴的代码段识别生成步骤" placement="bottom">
            <el-button size="small" :icon="Document" @click="codeDialogVisible = true">代码生成</el-button>
          </el-tooltip>
          <el-button size="small" type="primary" plain :icon="Plus" @click="addStep()">添加步骤</el-button>
          <el-dropdown trigger="click" @command="(k: CardStep['kind']) => addStep(k)">
            <el-button
              size="small"
              plain
              :icon="CaretBottom"
              title="按指定类型新增步骤"
              aria-label="按指定类型新增步骤"
            />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="k in STEP_KINDS" :key="k.value" :command="k.value">
                  {{ k.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 卡片参数（接口）：声明后，引用本卡片时可填不同值 -->
      <div class="se-params">
        <div class="se-params-head">
          <span class="se-step-title">参数（接口）</span>
          <span class="se-params-tip">
            步骤里用 <code class="se-code">{{ PARAM_HINT }}</code> 占位；拖参数名到参数框、或在参数框里打
            <code class="se-code">{{ BRACE_HINT }}</code> 都能插入；悬停参数框可「提为参数 / 取消参数」
          </span>
          <el-button size="small" text type="primary" :icon="Plus" @click="addParam">添加参数</el-button>
        </div>
        <div v-if="params.length" class="se-params-list">
          <div v-for="(p, i) in params" :key="i" class="se-param-row">
            <span
              class="se-param-grip"
              :title="`拖拽「${p.name || '参数'}」到步骤参数框，自动插入占位符`"
              draggable="true"
              @dragstart.stop="onParamDragStart($event, p)"
            >⠿</span>
            <el-input
              v-model="p.name"
              size="small"
              placeholder="参数名（如 dtc）"
              style="width: 200px"
              :class="{ 'se-input-error': !!paramNameError(params, i) }"
            />
            <!-- 参数名即时校验：原来只在保存时用一个 toast 报一次，指不出是哪一行 -->
            <span
              v-if="paramNameError(params, i)"
              class="se-param-err"
              :title="paramNameError(params, i) || ''"
            >⚠</span>
            <template v-if="paramExtraOpen[i]">
              <el-input v-model="p.default" size="small" placeholder="默认值（留空=默认不参与）" style="width: 140px" />
              <el-input v-model="p.label" size="small" placeholder="显示名（可选）" style="width: 150px" />
            </template>
            <template v-else>
              <span v-if="p.default" class="se-param-def">默认 {{ p.default }}</span>
              <span v-if="p.label" class="se-param-lab">{{ p.label }}</span>
              <span v-if="!p.default && !p.label" class="se-param-lab">未设默认值（引用处不填则该项不参与）</span>
            </template>
            <span class="se-param-spacer" />
            <el-button
              size="small"
              text
              class="expand-btn"
              :title="paramExtraOpen[i] ? '收起默认值 / 显示名' : '展开默认值 / 显示名'"
              @click.stop="toggleParamExtra(i)"
            >
              <el-icon><component :is="paramExtraOpen[i] ? CaretTop : CaretBottom" /></el-icon>
            </el-button>
            <el-button size="small" text :icon="Close" title="删除参数" @click.stop="removeParam(i)" />
          </div>
        </div>
        <div v-else class="se-params-empty">
          暂无参数；步骤里用 <code class="se-code">{{ PARAM_HINT }}</code> 占位后，引用本卡片时可分别填值（留空=该项不参与）
        </div>
      </div>

      <!-- 用例局部变量（生成时在 testcase 顶部声明） -->
      <div class="se-locals">
        <div class="se-locals-head">
          <span class="se-step-title">局部变量</span>
          <el-button size="small" text type="primary" :icon="Plus" @click="addLocal">添加变量</el-button>
        </div>
        <div v-if="locals.length" class="se-locals-list">
          <div
            v-for="(lv, li) in locals"
            :key="li"
            class="local-row"
            :class="{ 'local-editing': editingLocalIdx === li }"
            draggable="true"
            @dragstart="onLocalDragStart($event, lv)"
            @dblclick="editingLocalIdx = li"
          >
            <template v-if="editingLocalIdx === li">
              <el-select v-model="lv.type" size="small" class="local-type" placeholder="类型">
                <el-option v-for="t in CAPL_TYPES" :key="t" :label="t" :value="t" />
              </el-select>
              <el-input v-model="lv.name" size="small" class="local-name" placeholder="变量名" />
              <el-input v-model="lv.value" size="small" class="local-value" placeholder="初始值" />
              <el-button size="small" text type="primary" :icon="Check" title="完成" @click.stop="editingLocalIdx = -1" />
            </template>
            <template v-else>
              <span class="local-view-type">{{ lv.type || '—' }}</span>
              <span class="local-view-name" :title="'拖拽到参数框 / 双击编辑'">{{ lv.name || '未命名' }}</span>
              <span class="local-view-value">{{ lv.value !== undefined && lv.value !== '' ? lv.value : '0' }}</span>
              <el-button size="small" text :icon="Edit" title="双击编辑" @click.stop="editingLocalIdx = li" />
            </template>
            <el-button size="small" text :icon="Close" title="删除" @click.stop="locals.splice(li, 1)" />
          </div>
        </div>
        <div v-else class="local-empty">无局部变量，点击「添加变量」新增</div>
      </div>

      <div class="se-step-head">
        <span class="se-step-title">步骤编排</span>
        <span v-if="selectedStepIds.size" class="se-step-sel-tip">已选 {{ selectedStepIds.size }} 项 · Ctrl+C 复制 · Ctrl+V 粘贴</span>
        <el-button v-if="selectedStepIds.size" size="small" text :icon="Close" @click="clearSelection">取消选择</el-button>
      </div>

      <div
        ref="stepListRef"
        class="se-step-list"
        :class="{ 'list-drag-over': listDragOver }"
        @dragover.prevent.self="onListDragOver"
        @dragleave="onListDragLeave"
        @drop.prevent="onListDrop"
      >
        <template v-for="(step, i) in form.steps" :key="step.id">
          <div
            class="step-row"
            :class="{
              'drag-over': dragOverStepIdx === i,
              'step-row-object': isObjectKind(step.kind),
              'step-row-selected': selectedStepIds.has(step.id),
              'step-row-dragging': isSorting && dragStepIdx === i,
              'insert-before': isSorting && insertIdx === i,
              'insert-after': isSorting && insertIdx === form.steps.length && i === form.steps.length - 1,
            }"
            @click="onStepRowClick($event, i)"
            @dragover="onStepDragOver($event, i)"
            @dragleave="onStepDragLeave($event, i)"
            @dragend="onStepDragEnd"
            @drop.prevent.stop="onStepDrop(i, $event)"
          >
          <!-- 设置 / 检查 / 限时检查 / 斜率请求 / 恢复：一个卡片块，下方多行对象参数（一行 = 一个对象）。
               整个卡片都是对象投放区（拖到已有参数行上则填该行，见 onFillDrop） -->
          <div
            v-if="isObjectKind(step.kind)"
            class="obj-card"
            @dragover.prevent
            @drop.prevent.stop="onObjectCardDrop(step, $event)"
          >
            <div class="step-head">
              <span class="step-drag" title="拖拽排序" draggable="true" @dragstart.stop="onStepDragStart($event, i)">⠿</span>
              <span class="step-index">{{ i + 1 }}</span>
              <el-select
                :model-value="step.kind"
                size="small"
                class="step-kind-select step-kind-select-sm"
                @change="(v: any) => onKindChange(step, v)"
              >
                <!-- 与其它分支一致：列完整类型表。原先只列 OBJECT_KINDS（6 项），
                     既看不到全部类型，也回不到函数/弹窗提示/Loop/卡片引用/自定义 -->
                <el-option v-for="k in STEP_KINDS" :key="k.value" :label="k.label" :value="k.value" />
              </el-select>
              <!-- 判定方式：限时检查（SignalWaitCheck 系列）/ 检查（SignalCheck 系列）/ 背景检测（Chk 系列） -->
              <el-select
                v-if="step.kind === 'wait_check' || step.kind === 'check' || step.kind === 'chk_check'"
                :model-value="waitFormOf(step)"
                size="small"
                class="wait-form-select"
                title="判定方式：限时检查生成 SignalWaitCheck 系列，检查生成 SignalCheck 系列，背景检测生成 Chk 系列"
                @change="(v: any) => applyWaitForm(step, v)"
              >
                <el-option v-for="f in assertFormsOf(step.kind)" :key="f.value" :label="f.label" :value="f.value" />
              </el-select>
              <template v-for="nf in numFieldsOf(step.kind)" :key="nf.key">
                <span class="rate-label">{{ nf.label }}</span>
                <el-input
                  :model-value="step[nf.key]"
                  size="small"
                  class="rate-input"
                  :placeholder="nf.placeholder"
                  :title="nf.title"
                  @update:model-value="(v: string) => setStepNum(step, nf.key, v)"
                />
              </template>
              <span class="kind-static">{{ objectKindHint(step) }}</span>
            </div>

            <div class="step-args">
              <div v-for="(arg, ai) in step.args" :key="ai" class="arg-row">
                <div
                  class="arg-key fill-drop"
                  :class="{ 'fill-over': fillOver === `key-${i}-${ai}` }"
                  @dragover.prevent
                  @dragenter.prevent="fillOver = `key-${i}-${ai}`"
                  @dragleave.prevent="fillOver = ''"
                  @drop.prevent.stop="onFillDrop($event, arg, 'key')"
                >
                  <el-input v-model="arg.key" size="small" :placeholder="step.kind === 'check' ? '信号（拖拽信号对象）' : '对象名（拖拽信号/变量）'" />
                  <ParamFieldAssist
                    :text="arg.key || ''"
                    :params="params"
                    @paramify="(pl: any) => paramifyField(arg, 'key', pl)"
                    @inline="(ns: string[]) => inlineField(arg, 'key', ns)"
                    @setText="(v: string) => (arg.key = v)"
                  />
                </div>
                <div
                  v-if="needsObjectValue(step.kind) && !isKeepForm(step)"
                  class="arg-value fill-drop"
                  :class="{ 'fill-over': fillOver === `value-${i}-${ai}` }"
                  @dragover.prevent
                  @dragenter.prevent="fillOver = `value-${i}-${ai}`"
                  @dragleave.prevent="fillOver = ''"
                  @drop.prevent.stop="onFillDrop($event, arg, 'value')"
                >
                  <el-input v-model="arg.value" size="small" :placeholder="objectValuePlaceholder(step)" />
                  <ParamFieldAssist
                    :text="arg.value || ''"
                    :params="params"
                    @paramify="(pl: any) => paramifyField(arg, 'value', pl)"
                    @inline="(ns: string[]) => inlineField(arg, 'value', ns)"
                    @setText="(v: string) => (arg.value = v)"
                  />
                </div>
                <span v-else class="obj-type-tag">{{ typeLabel(arg.argType) }}</span>
                <!-- 限时检查的区间形式：第二个值（上限） -->
                <div
                  v-if="isWaitRange(step)"
                  class="arg-value fill-drop"
                  :class="{ 'fill-over': fillOver === `value2-${i}-${ai}` }"
                  @dragover.prevent
                  @dragenter.prevent="fillOver = `value2-${i}-${ai}`"
                  @dragleave.prevent="fillOver = ''"
                  @drop.prevent.stop="onFillDrop($event, arg, 'value2')"
                >
                  <el-input v-model="arg.value2" size="small" placeholder="上限" />
                  <ParamFieldAssist
                    :text="arg.value2 || ''"
                    :params="params"
                    @paramify="(pl: any) => paramifyField(arg, 'value2', pl)"
                    @inline="(ns: string[]) => inlineField(arg, 'value2', ns)"
                    @setText="(v: string) => (arg.value2 = v)"
                  />
                </div>
                <el-button size="small" text title="从映射表填充：按参数名查同名别名/对象并填入值" @click.stop="fillArgFromMapping(arg)">映射填充</el-button>
                <el-button size="small" text :icon="Close" title="删除" @click.stop="step.args.splice(ai, 1)" />
              </div>
              <div v-if="!step.args.length" class="obj-empty-tip">拖拽信号 / 变量对象到此处，自动生成一行</div>
            </div>
          </div>

          <!-- 卡片引用：显示为一个卡片节点，双击标题行跳转到被引用卡片编辑 -->
          <div
            v-else-if="step.kind === 'card'"
            class="card-ref-card"
            :class="{ 'card-ref-unbound': !step.cardId }"
          >
            <div
              class="step-head"
              :title="step.cardId ? `双击跳转到「${step.cardName || step.cardId}」` : '尚未关联卡片'"
              @dblclick.stop="openCardRef(step)"
            >
              <span class="step-drag" title="拖拽排序" draggable="true" @dragstart.stop="onStepDragStart($event, i)">⠿</span>
              <span class="step-index">{{ i + 1 }}</span>
              <el-tag :type="cardRefTagType(step.cardType)" size="small" effect="light" class="card-ref-tag">
                {{ cardRefTypeLabel(step.cardType) }}
              </el-tag>
              <span class="card-ref-name">{{ step.cardName || '未选择卡片' }}</span>
              <el-button size="small" text :icon="Link" title="跳转到卡片" @click.stop="openCardRef(step)" />
            </div>
            <div class="card-ref-tip">双击标题行跳转编辑被引用的卡片</div>

            <!-- 卡片参数取值：仅当被引用卡片声明了参数时显示。
                 三态：未填=用卡片默认值 / 填值=覆盖 / 勾选「不参与」=生成时跳过该参数 -->
            <div v-if="cardRefParams(step).length" class="card-ref-params">
              <div class="card-ref-params-title">参数取值（未填=用卡片默认值）</div>
              <div v-for="p in cardRefParams(step)" :key="p.name" class="card-ref-param-row">
                <el-tag
                  size="small"
                  class="card-ref-param-state"
                  :type="cardArgState(step, p.name).type"
                  :title="cardArgState(step, p.name).title"
                >
                  {{ cardArgState(step, p.name).label }}
                </el-tag>
                <span class="card-ref-param-name" :title="p.label || p.name">{{ p.name }}</span>
                <el-input
                  :model-value="cardArgValue(step, p.name)"
                  size="small"
                  :disabled="isCardArgSkipped(step, p.name)"
                  :placeholder="cardArgPlaceholder(p)"
                  @update:model-value="(v: string) => setCardArg(step, p.name, v)"
                />
                <el-checkbox
                  :model-value="isCardArgSkipped(step, p.name)"
                  size="small"
                  title="勾选后生成时跳过该参数（这一项不生成）"
                  @update:model-value="(v: any) => setCardSkip(step, p.name, !!v)"
                >
                  不参与
                </el-checkbox>
                <el-button
                  v-if="cardArgValue(step, p.name) !== ''"
                  size="small"
                  text
                  :icon="Close"
                  title="清除自定义取值（回落默认值）"
                  @click.stop="clearCardArg(step, p.name)"
                />
              </div>
            </div>
          </div>

          <!-- 循环体：for（次数/步增可控）/ while（条件满足退出） -->
          <div v-else-if="step.kind === 'loop_start'" class="loop-card">
            <div class="step-head">
              <span class="step-drag" title="拖拽排序" draggable="true" @dragstart.stop="onStepDragStart($event, i)">⠿</span>
              <span class="step-index">{{ i + 1 }}</span>
              <span class="kind-static">Loop Start</span>
              <el-radio-group v-model="step.loopMode" size="small" class="loop-mode-group" @change="onLoopModeChange(step)">
                <el-radio-button value="for">次数可控</el-radio-button>
                <el-radio-button value="while">条件退出</el-radio-button>
              </el-radio-group>
            </div>

            <!-- for：初值 / 次数 / 步增 -->
            <div v-if="!step.loopMode || step.loopMode === 'for'" class="loop-params">
              <div class="loop-param-row">
                <span class="loop-param-label">初值</span>
                <el-input v-model="loopArg(step, 'init').value" size="small" placeholder="0" />
                <span class="loop-param-label">次数</span>
                <el-input v-model="loopArg(step, 'count').value" size="small" placeholder="循环次数" />
                <span class="loop-param-label">步增</span>
                <el-input v-model="loopArg(step, 'step').value" size="small" placeholder="1" />
              </div>
              <div class="loop-param-hint">生成：for (loopIdx = 初值; loopIdx &lt; 次数; loopIdx += 步增) {</div>
            </div>

            <!-- while：退出条件（次数不可控） -->
            <div v-else class="loop-params">
              <div class="loop-param-row">
                <span class="loop-param-label">退出条件</span>
                <el-input v-model="loopArg(step, 'condition').value" size="small" placeholder="如 loopIdx >= 10 或 signal > 5" />
              </div>
              <div class="loop-param-hint">生成：while (1) { if (退出条件) break; …（条件满足即退出）</div>
            </div>
          </div>

          <!-- 弹窗提示：人工确认弹窗（生成 char Str_Temp[] + testWaitForTesterConfirmation） -->
          <div v-else-if="step.kind === 'tester_prompt'" class="prompt-card">
            <div class="step-head">
              <span class="step-drag" title="拖拽排序" draggable="true" @dragstart.stop="onStepDragStart($event, i)">⠿</span>
              <span class="step-index">{{ i + 1 }}</span>
              <el-select
                :model-value="step.kind"
                size="small"
                class="step-kind-select"
                @change="(v: any) => onKindChange(step, v)"
              >
                <el-option v-for="k in STEP_KINDS" :key="k.value" :label="k.label" :value="k.value" />
              </el-select>
              <template v-for="nf in numFieldsOf(step.kind)" :key="nf.key">
                <span class="rate-label">{{ nf.label }}</span>
                <el-input
                  :model-value="step[nf.key]"
                  size="small"
                  class="rate-input"
                  :placeholder="nf.placeholder"
                  :title="nf.title"
                  @update:model-value="(v: string) => setStepNum(step, nf.key, v)"
                />
              </template>
              <span class="kind-static">等待测试人员确认（生成 testWaitForTesterConfirmation）</span>
            </div>

            <div class="step-args">
              <div class="arg-row">
                <el-input
                  v-model="step.prompt"
                  size="small"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 6 }"
                  placeholder="弹窗提示内容（如：请确认 XXX 已上电，确认后点「确定」继续）"
                />
                <ParamFieldAssist
                  :text="step.prompt || ''"
                  :params="params"
                  @paramify="(pl: any) => paramifyField(step, 'prompt', pl)"
                  @inline="(ns: string[]) => inlineField(step, 'prompt', ns)"
                  @setText="(v: string) => (step.prompt = v)"
                />
              </div>
              <div class="obj-empty-tip">生成：char Str_Temp[N]="提示内容"; + testWaitForTesterConfirmation(Str_Temp, 超时)（N 按内容长度自动给，下限 100）</div>
            </div>
          </div>

          <!-- 其它 kind：完整两步式布局 -->
          <template v-else>
            <div class="step-head">
              <span class="step-drag" title="拖拽排序" draggable="true" @dragstart.stop="onStepDragStart($event, i)">⠿</span>
              <span class="step-index">{{ i + 1 }}</span>
              <el-select
                :model-value="step.kind"
                size="small"
                class="step-kind-select"
                @change="(v: any) => onKindChange(step, v)"
              >
                <el-option v-for="k in STEP_KINDS" :key="k.value" :label="k.label" :value="k.value" />
              </el-select>

              <div
                class="step-fun fill-drop"
                :class="{ 'fill-over': fillOver === `fun-${i}` }"
                @dragover.prevent
                @dragenter.prevent="fillOver = `fun-${i}`"
                @dragleave.prevent="fillOver = ''"
                @drop.prevent.stop="onFillDrop($event, step, 'fun')"
              >
                <template v-if="isCallLike(step)">
                  <el-autocomplete
                    v-if="!isExpanded(`fun-${step.id}`)"
                    v-model="step.fun"
                    size="small"
                    class="fun-autocomplete"
                    placeholder="函数名（输入匹配 / 拖拽填充）"
                    :fetch-suggestions="queryFunctions"
                    :trigger-on-focus="true"
                    @select="(item: any) => onFunSelect(step, item.value)"
                  />
                  <el-input
                    v-else
                    v-model="step.fun"
                    size="small"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 8 }"
                    placeholder="函数名 / 源代码"
                  />
                </template>
                <div v-else-if="step.kind === 'loop_end'" class="kind-static">Loop End（与 Loop Start 自动配对）</div>
                <div v-else-if="step.kind === 'reset_all'" class="kind-static">恢复全部（生成时自动展开）</div>
                <template v-else>
                  <el-input
                    v-if="!isExpanded(`fun-${step.id}`)"
                    v-model="step.raw"
                    size="small"
                    placeholder="原始 CAPL 行"
                  />
                  <el-input
                    v-else
                    v-model="step.raw"
                    size="small"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 8 }"
                    placeholder="自定义源代码"
                  />
                </template>
                <ParamFieldAssist
                  :text="step.kind === 'raw' ? step.raw || '' : step.fun || ''"
                  :params="params"
                  :allow-paramify="step.kind !== 'raw'"
                  @paramify="(pl: any) => paramifyField(step, step.kind === 'raw' ? 'raw' : 'fun', pl)"
                  @inline="(ns: string[]) => inlineField(step, step.kind === 'raw' ? 'raw' : 'fun', ns)"
                  @setText="(v: string) => setFunText(step, v)"
                />
              </div>
              <el-button size="small" text class="expand-btn" :title="isExpanded(`fun-${step.id}`) ? '收起源代码' : '展开源代码'" @click.stop="toggleExpand(`fun-${step.id}`)">
                <el-icon><component :is="isExpanded(`fun-${step.id}`) ? CaretTop : CaretBottom" /></el-icon>
              </el-button>
            </div>

            <div v-if="isCallLike(step)" class="step-args">
              <div v-for="(arg, ai) in step.args" :key="ai" class="arg-row">
                <div
                  class="arg-key fill-drop"
                  :class="{ 'fill-over': fillOver === `key-${i}-${ai}` }"
                  @dragover.prevent
                  @dragenter.prevent="fillOver = `key-${i}-${ai}`"
                  @dragleave.prevent="fillOver = ''"
                  @drop.prevent.stop="onFillDrop($event, arg, 'key')"
                >
                  <el-autocomplete
                    v-model="arg.key"
                    size="small"
                    class="arg-key-autocomplete"
                    placeholder="参数名"
                    :fetch-suggestions="queryArgNames"
                    :trigger-on-focus="true"
                  />
                  <ParamFieldAssist
                    :text="arg.key || ''"
                    :params="params"
                    @paramify="(pl: any) => paramifyField(arg, 'key', pl)"
                    @inline="(ns: string[]) => inlineField(arg, 'key', ns)"
                    @setText="(v: string) => (arg.key = v)"
                  />
                </div>
                <div
                  class="arg-value fill-drop"
                  :class="{ 'fill-over': fillOver === `value-${i}-${ai}` }"
                  @dragover.prevent
                  @dragenter.prevent="fillOver = `value-${i}-${ai}`"
                  @dragleave.prevent="fillOver = ''"
                  @drop.prevent.stop="onFillDrop($event, arg, 'value')"
                >
                  <el-input
                    v-if="!isExpanded(`arg-${step.id}-${ai}`)"
                    v-model="arg.value"
                    size="small"
                    placeholder="对象 / 变量 / 值"
                  />
                  <el-input
                    v-else
                    v-model="arg.value"
                    size="small"
                    type="textarea"
                    :autosize="{ minRows: 1, maxRows: 6 }"
                    placeholder="对象 / 变量 / 值"
                  />
                  <ParamFieldAssist
                    :text="arg.value || ''"
                    :params="params"
                    @paramify="(pl: any) => paramifyField(arg, 'value', pl)"
                    @inline="(ns: string[]) => inlineField(arg, 'value', ns)"
                    @setText="(v: string) => (arg.value = v)"
                  />
                </div>
                <el-button size="small" text title="从映射表填充：按参数名查同名别名/对象并填入值" @click.stop="fillArgFromMapping(arg)">映射填充</el-button>
                <el-button size="small" text class="expand-btn" :title="isExpanded(`arg-${step.id}-${ai}`) ? '收起' : '展开'" @click.stop="toggleExpand(`arg-${step.id}-${ai}`)">
                  <el-icon><component :is="isExpanded(`arg-${step.id}-${ai}`) ? CaretTop : CaretBottom" /></el-icon>
                </el-button>
              </div>
            </div>
          </template>
          <el-button
            class="step-del"
            size="small"
            text
            :icon="Close"
            title="删除"
            @click.stop="form.steps.splice(i, 1)"
          />
          </div>
        </template>
        <div v-if="!form.steps.length" class="se-empty">暂无步骤：拖入函数库函数自动生成，或点击「添加步骤」</div>
      </div>

      <!-- 拖拽排序：鼠标跟随的悬浮指示器 -->
      <div
        v-if="isSorting"
        class="drag-ghost"
        :style="{ left: dragMouseX + 'px', top: dragMouseY + 'px' }"
      >
        <span class="drag-ghost-tag" :class="{ 'drag-ghost-tag-copy': dragCopyMode }">{{ dragCopyMode ? '复制' : '移动' }}</span>
        <span class="drag-ghost-name">{{ draggingStepLabel }}</span>
      </div>
    </template>

    <div v-else class="se-blank">
      <div>从左侧列表选择一个对象进行编辑</div>
    </div>

    <el-dialog v-model="codeDialogVisible" title="从代码段识别函数名" width="720px" append-to-body>
      <el-input
        v-model="codeSnippet"
        type="textarea"
        :rows="10"
        placeholder="粘贴函数名列表或 CAPL 代码，例如：&#10;Init&#10;Wait&#10;setSignal&#10;TestNoDTC&#10;ClearAll"
      />
      <div v-if="recognizedNames.length" class="recognized">
        <div class="recognized-title">识别到 {{ recognizedNames.length }} 个函数名（可删除不需要的）</div>
        <div class="recognized-list">
          <el-tag
            v-for="(n, i) in recognizedNames"
            :key="i"
            size="small"
            closable
            @close="recognizedNames.splice(i, 1)"
          >{{ n }}</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="codeDialogVisible = false">取消</el-button>
        <el-button @click="recognizeNames">识别函数名</el-button>
        <el-button type="primary" :disabled="!recognizedNames.length" @click="generateFromNames">生成步骤</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, inject, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Close, Check, Document, CaretTop, CaretBottom, Link, Edit } from '@element-plus/icons-vue'
import type { Card, CardLibrary, CardParam, CardStep, CardStepArg, CardType, MappingKind } from '@/types/functionGraph'
import { genId, CARD_PARAM_MIME } from '@/types/functionGraph'
import {
  newStep,
  CARD_TYPE_LABEL,
  buildCardLookup,
  stepNumFieldsOf as numFieldsOf,
  assertFormsOf,
  waitFormOf,
  applyWaitForm,
  isWaitRange,
  isKeepForm,
  waitCheckFunOf,
  chkCheckFunOf,
  paramNameError,
} from '@/utils/functionGraph'
import type { StepNumField, WaitFormOption } from '@/utils/functionGraph'
import ParamFieldAssist from './ParamFieldAssist.vue'
import { parseFunctionNames } from '@/api/function'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'

// 画布层上下文：用于「剪贴板里没有步骤数据」时把 Ctrl+V 让给画布粘贴工况/库卡片（P2-2）
const geCtx = inject<any>('geCtx', null)

interface ParsedFunction {
  name: string
  params?: Array<{ name?: string; type?: string }>
}

// 预设 CAPL 基本函数：函数库中不包含、但步骤编排常用。含参数名便于补全。
const PRESET_FUNCTIONS: ParsedFunction[] = [
  { name: 'setSignal', params: [{ name: 'signal' }, { name: 'value' }] },
  { name: 'setRawSignal', params: [{ name: 'signal' }, { name: 'value' }] },
  { name: 'setSignalValue', params: [{ name: 'signal' }, { name: 'value' }] },
  { name: 'putValue', params: [{ name: 'signal' }, { name: 'value' }] },
  { name: 'getValue', params: [{ name: 'signal' }] },
  { name: 'getRawSignal', params: [{ name: 'signal' }] },
  { name: 'getSignal', params: [{ name: 'signal' }] },
  { name: 'testWaitForTimeout', params: [{ name: 'time' }] },
  { name: 'testWaitForSignalMatch', params: [{ name: 'signal' }, { name: 'value' }, { name: 'time' }] },
  { name: 'testWaitForSignalInRange', params: [{ name: 'signal' }, { name: 'min' }, { name: 'max' }, { name: 'time' }] },
  { name: 'testJoinMessageEvent', params: [{ name: 'message' }] },
  { name: 'testWaitForMessage', params: [{ name: 'message' }, { name: 'time' }] },
  { name: 'output', params: [{ name: 'message' }] },
  { name: 'testSetMsgDlc', params: [{ name: 'message' }, { name: 'dlc' }] },
  { name: 'testResetMsgDlc', params: [{ name: 'message' }] },
  { name: 'testDisableMsg', params: [{ name: 'signal' }] },
  { name: 'testEnableMsg', params: [{ name: 'signal' }] },
  { name: 'testResetSignalValue', params: [{ name: 'signal' }] },
  { name: 'testStepPass', params: [{ name: 'title' }, { name: 'msg' }] },
  { name: 'testStepFail', params: [{ name: 'title' }, { name: 'msg' }] },
  { name: 'testStepWarning', params: [{ name: 'title' }, { name: 'msg' }] },
  { name: 'lookupSignal', params: [{ name: 'name' }] },
  { name: 'checkSignalInRange', params: [{ name: 'signal' }, { name: 'min' }, { name: 'max' }] },
  { name: 'CheckSignalMatch', params: [{ name: 'signal' }, { name: 'value' }] },
]

const props = defineProps<{
  card: Card | null
  cards?: CardLibrary
  functions?: ParsedFunction[]
  /** 外部保存信号（Ctrl+S 优先保存当前卡片时由父级递增触发） */
  saveSignal?: number
  /** 新建/复制卡片后由父级置真：自动聚焦卡片名输入框并全选（P0-6）；处理完回告父级复位 */
  focusName?: boolean
}>()
const emit = defineEmits<{
  (e: 'save', card: Card): void
  (e: 'add-mapping', payload: { kind: MappingKind; name: string }): void
  (e: 'open-card', cardId: string): void
  /** 已消费一次「聚焦卡片名」请求（父级据此复位 focusName） */
  (e: 'focus-name-done'): void
}>()

const tabs: Array<{ value: CardType; label: string }> = [
  { value: 'inject', label: CARD_TYPE_LABEL.inject },
  { value: 'sequence', label: CARD_TYPE_LABEL.sequence },
  { value: 'result', label: CARD_TYPE_LABEL.result },
]

const STEP_KINDS: Array<{ value: CardStep['kind']; label: string }> = [
  { value: 'call', label: '函数' },
  { value: 'set', label: '设置' },
  { value: 'check', label: '检查' },
  { value: 'wait_check', label: '限时检查' },
  { value: 'chk_check', label: '背景检测' },
  { value: 'rate', label: '斜率请求' },
  { value: 'ramp', label: '斜率请求(同步)' },
  { value: 'tester_prompt', label: '弹窗提示' },
  { value: 'reset', label: '恢复' },
  { value: 'reset_all', label: '恢复全部' },
  { value: 'loop_start', label: 'Loop Start' },
  { value: 'loop_end', label: 'Loop End' },
  { value: 'card', label: '卡片引用' },
  { value: 'raw', label: '自定义' },
]

const VALID_KINDS = new Set<CardStep['kind']>(STEP_KINDS.map((k) => k.value))

// 设置/恢复/检查/限时检查/斜率请求步骤的对象行下拉选项
const OBJECT_KINDS: Array<{ value: CardStep['kind']; label: string }> = [
  { value: 'set', label: '设置' },
  { value: 'check', label: '检查' },
  { value: 'wait_check', label: '限时检查' },
  { value: 'chk_check', label: '背景检测' },
  { value: 'rate', label: '斜率请求' },
  { value: 'ramp', label: '斜率请求(同步)' },
  { value: 'reset', label: '恢复' },
]

/** 对象行类步骤：一行 = 一个对象（设置 / 检查 / 限时检查 / 斜率请求 / 恢复） */
const OBJECT_STEP_KINDS = new Set<CardStep['kind']>(OBJECT_KINDS.map((k) => k.value))
function isObjectKind(kind: CardStep['kind']): boolean {
  return OBJECT_STEP_KINDS.has(kind)
}

/** 需要填「值」的对象行类型（恢复是取初始值，不需要填） */
function needsObjectValue(kind: CardStep['kind']): boolean {
  return kind !== 'reset' && isObjectKind(kind)
}

/** 对象行类步骤的中文名（取 OBJECT_KINDS 的 label） */
function objectKindLabel(kind: CardStep['kind']): string {
  return OBJECT_KINDS.find((k) => k.value === kind)?.label || '设置'
}

/** 步骤级数值参数（填在步骤头部）：斜率请求 / 斜率请求(同步) / 限时检查各不一样（定义见 utils） */
function setStepNum(step: CardStep, key: StepNumField['key'], v: string) {
  step[key] = v
}

/** 斜率请求（含同步）：会写入信号、参与「恢复全部」的对象行步骤 */
function isRateKind(kind: CardStep['kind']): boolean {
  return kind === 'rate' || kind === 'ramp'
}

/** 对象行「值」输入框的占位文案 */
function objectValuePlaceholder(step: CardStep): string {
  if (step.kind === 'wait_check' || step.kind === 'chk_check') return step.waitRange ? '下限' : '期望值'
  if (step.kind === 'check') return step.waitRange ? '下限' : '期望值'
  if (step.kind === 'rate') return '目标值'
  if (step.kind === 'ramp') return '最大值'
  return '设置值'
}

function typeLabel(t?: CardStepArg['argType']): string {
  if (t === 'signal') return '信号'
  if (t === 'sysvar') return '系统变量'
  if (t === 'envvar') return '环境变量'
  if (t === 'a2l') return 'A2L'
  if (t === 'message') return '报文'
  if (t === 'dtc') return 'DTC'
  return ''
}

// 对象行卡片的提示文案（设置/检查/限时检查/斜率请求/恢复）
function objectKindHint(step: CardStep): string {
  const kind = step.kind
  if (kind === 'set') return '拖拽对象到下方参数行，填写设置值'
  if (kind === 'check') {
    const fun = step.waitNot ? 'SignalCheckNot' : 'SignalCheck'
    if (step.waitCmp === 'gt') return '拖拽信号到下方参数行填阈值（生成 SignalCheck(信号, 阈值, CHK_HIGH_LIMIT) 开区间）'
    if (step.waitCmp === 'lt') return '拖拽信号到下方参数行填阈值（生成 SignalCheck(信号, CHK_LOW_LIMIT, 阈值) 开区间）'
    return step.waitRange
      ? `拖拽信号到下方参数行，填下限 / 上限（生成 ${fun} 区间形式）`
      : `拖拽信号到下方参数行，填期望值（生成 ${fun}）`
  }
  if (kind === 'chk_check') {
    const fun = chkCheckFunOf(step)
    if (step.waitKeep) return `拖拽信号 / 系统变量到下方参数行（生成 ${fun}，窗口由「时间」控制：值一变化即判失败）`
    if (step.waitHold)
      return step.waitRange
        ? `拖拽信号 / 系统变量到下方参数行，填下限 / 上限（生成 ${fun}，窗口内必须全程满足，一次违反即失败）`
        : `拖拽信号 / 系统变量到下方参数行，填期望值（生成 ${fun}，窗口内必须全程满足，一次违反即失败）`
    return step.waitRange
      ? `拖拽信号 / 系统变量到下方参数行，填下限 / 上限（生成 ${fun}，窗口由「时间」控制）`
      : `拖拽信号 / 系统变量到下方参数行，填期望值（生成 ${fun}，窗口由「时间」控制）`
  }
  if (kind === 'wait_check') {
    const fun = waitCheckFunOf(step)
    if (step.waitCmp) {
      const dir = step.waitCmp === 'gt' ? '大于' : '小于'
      return `拖拽信号到下方参数行；已按「${dir}期望值」自动填入区间下限 / 上限（生成 ${fun} 区间形式，超时由「时间」控制），可手动修改`
    }
    return step.waitRange
      ? `拖拽信号到下方参数行，填下限 / 上限（生成 ${fun} 区间形式，超时由「时间」控制）`
      : `拖拽信号到下方参数行，填期望值（生成 ${fun}，超时由「时间」控制）`
  }
  if (kind === 'rate') return '拖拽信号到下方参数行，填目标值（生成 SetSignalRate）'
  if (kind === 'ramp') return '拖拽信号到下方参数行，填最大值（生成 SetSignalRamp）'
  return '拖拽对象到下方参数行，生成时恢复初始值'
}

// 历史遗留的其它 kind 统一归入函数
function normalize(card: Card): Card {
  const c: Card = JSON.parse(JSON.stringify(card))
  c.steps = c.steps.map((s) => {
    if (!VALID_KINDS.has(s.kind)) s.kind = 'call'
    if (s.kind === 'loop_start') {
      if (s.loopMode !== 'while') s.loopMode = 'for'
      // 旧数据 arg key 为 count，统一迁移为 for 三参数结构
      if (s.loopMode === 'for' && !s.args.some((a) => a.key === 'init')) {
        const oldCount = (s.args.find((a) => a.key === 'count')?.value || s.fun || '').toString()
        s.args = [
          { key: 'init', value: '' },
          { key: 'count', value: oldCount },
          { key: 'step', value: '' },
        ]
      }
    }
    return s
  })
  if (!Array.isArray(c.locals)) c.locals = []
  if (!Array.isArray(c.params)) c.params = []
  if (c.type === 'inject' && !c.role) c.role = 'inject'
  return c
}

const form = ref<Card | null>(props.card ? normalize(props.card) : null)

// 用例局部变量（始终为数组，供模板安全访问）
const locals = computed(() => form.value?.locals || [])
// 卡片参数（接口），始终为数组，供模板安全访问
const params = computed(() => form.value?.params || [])

/** 参数占位符示例（模板里直接写 {{ }} 会被 Vue 当成插值，故用变量渲染） */
const PARAM_HINT = '{{名称}}'
/** 触发参数补全的开头两个字符（同上，用变量渲染） */
const BRACE_HINT = '{{'

/** 「默认值 / 显示名」按行展开状态：默认收起，只留「参数名」一个输入框 */
const paramExtraOpen = ref<Record<number, boolean>>({})
function toggleParamExtra(i: number) {
  paramExtraOpen.value[i] = !paramExtraOpen.value[i]
}

/** 拖拽参数行到步骤参数框：插入 {{参数名}} 占位符（生成时按引用处填的值替换） */
function onParamDragStart(e: DragEvent, p: CardParam) {
  const name = String(p?.name || '').trim()
  if (!e.dataTransfer) return
  if (!name) {
    ElMessage.warning('请先填写参数名')
    e.preventDefault()
    return
  }
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData(CARD_PARAM_MIME, name)
  e.dataTransfer.setData('text/plain', `{{${name}}}`)
}

/** 收集卡片内所有可能含占位符的文本（与后端替换范围一致：args.value/key/argType、raw、fun） */
function collectCardTexts(card: Card): string[] {
  const out: string[] = []
  for (const s of card.steps ?? []) {
    if (s.raw) out.push(String(s.raw))
    if (s.fun) out.push(String(s.fun))
    if (s.prompt) out.push(String(s.prompt))
    for (const a of s.args ?? []) {
      if (a.key) out.push(String(a.key))
      if (a.value) out.push(String(a.value))
      if (a.argType) out.push(String(a.argType))
    }
  }
  return out
}

/** 参数名清洗：只保留 \w，非法字符换成下划线，数字开头补下划线 */
function sanitizeParamName(s: string): string {
  return String(s || '')
    .trim()
    .replace(/[^\w]/g, '_')
    .replace(/^(\d)/, '_$1')
}

/**
 * 自动命名（不再弹框问名字）：优先用**信号名**（该行的 key），
 * 其次按值特征（DTC），最后 p1/p2…；重名自动加序号。
 */
function autoParamName(target: any, current: string): string {
  const used = new Set(
    (form.value?.params ?? []).map((p) => String(p.name || '').trim()).filter(Boolean),
  )
  const candidates: string[] = []
  const key = sanitizeParamName(String(target?.key ?? ''))
  if (key.length >= 2 && !/^_?\d+$/.test(key)) candidates.push(key)
  if (/^(0x)?[0-9A-Fa-f]{4,}$/.test(current.trim())) candidates.push('dtc')
  for (let i = 1; i < 200; i++) candidates.push(`p${i}`)
  for (const c of candidates) {
    if (!used.has(c)) return c
    for (let i = 2; i < 200; i++) {
      const alt = `${c}_${i}`
      if (!used.has(alt)) return alt
    }
  }
  return 'param'
}

/**
 * 就地「提为参数」——点一下即完成，不再弹框问名字/确认：
 * - 参数名自动取信号名（该行的 key），重名自动加序号；
 * - 默认值取当前框里的内容（**允许为空**，空了就是「待填」，引用处再填值）；
 * - payload.prefix 存在（从「{{」补全里选「新建参数」）→ 占位符接在 prefix 之后，默认值留空。
 */
function paramifyField(
  target: any,
  field: 'key' | 'value' | 'value2' | 'fun' | 'raw' | 'prompt',
  payload?: { prefix?: string },
) {
  const card = form.value
  if (!card) return
  const cur = String(target?.[field] ?? '')
  const fromPartial = !!payload && typeof payload.prefix === 'string'
  if (!fromPartial && /^\s*\{\{\w+\}\}\s*$/.test(cur)) return
  const name = autoParamName(target, cur)
  if (!card.params) card.params = []
  card.params.push({ name, label: '', default: fromPartial ? '' : cur })
  target[field] = fromPartial ? `${payload!.prefix}{{${name}}}` : `{{${name}}}`
  paramExtraOpen.value[card.params.length - 1] = false
  ElMessage.success(`已提为参数「${name}」，默认值可在「参数（接口）」里改`)
}

/** 取消参数：把 {{参数}} 回填为默认值；不再被任何字段引用的参数声明一并删除 */
function inlineField(target: any, field: 'key' | 'value' | 'value2' | 'fun' | 'raw' | 'prompt', names: string[]) {
  const card = form.value
  if (!card || !names.length) return
  const byName = new Map((card.params ?? []).map((p) => [String(p.name), p]))
  let next = String(target?.[field] ?? '')
  for (const n of names) {
    const def = String(byName.get(n)?.default ?? '')
    next = next.split(`{{${n}}}`).join(def)
  }
  target[field] = next
  const stillUsed = new Set<string>()
  const re = /\{\{(\w+)\}\}/g
  for (const s of collectCardTexts(card)) {
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) stillUsed.add(m[1])
  }
  const removed = names.filter((n) => !stillUsed.has(n))
  if (removed.length && card.params) {
    card.params = card.params.filter((p) => !removed.includes(String(p.name)))
    paramExtraOpen.value = {}
  }
  ElMessage.success(removed.length ? `已取消参数 ${removed.join('、')}` : '已回填默认值')
}

/** fun / raw 共用一个输入框：按 kind 写回对应字段 */
function setFunText(step: CardStep, v: string) {
  if (step.kind === 'raw') step.raw = v
  else step.fun = v
}

function addParam() {
  if (!form.value) return
  if (!form.value.params) form.value.params = []
  form.value.params.push({ name: '', label: '', default: '' })
}
function removeParam(i: number) {
  form.value?.params?.splice(i, 1)
}
/** 校验并规范化卡片参数：名称必填、仅字母数字下划线、不可重名 */
function normalizeParams(): boolean {
  const list = form.value?.params ?? []
  const seen = new Set<string>()
  for (const p of list) {
    const n = String(p.name || '').trim()
    if (!n) {
      ElMessage.warning('参数名不能为空')
      return false
    }
    if (!/^\w+$/.test(n)) {
      ElMessage.warning(`参数名「${n}」只能包含字母、数字、下划线`)
      return false
    }
    if (seen.has(n)) {
      ElMessage.warning(`参数名「${n}」重复`)
      return false
    }
    seen.add(n)
    p.name = n
    if (!String(p.label || '').trim()) delete p.label
    if (p.default === undefined || p.default === null) delete p.default
  }
  return true
}

/**
 * 最近一次已应用的外部卡片内容。父级（FunctionGraphEditor）在 emit('update:graph') 后
 * 会把整份 graph 深拷贝重建，卡片对象引用随之变化但内容没变 —— 此时必须跳过重置，
 * 否则「拖入对象（会 emit add-mapping → 触发 update:graph）」等未保存改动会被立刻丢掉。
 */
let lastCardJson = JSON.stringify(props.card ?? null)

watch(
  () => props.card,
  (c) => {
    const ser = JSON.stringify(c ?? null)
    if (ser === lastCardJson) return
    lastCardJson = ser
    form.value = c ? normalize(c) : null
    // 切到另一张卡片：重置步骤编辑撤销栈（P2-1）
    resetStepHistory()
  },
)

/**
 * P1-4：记忆「上次选的步骤类型」，作为下次「添加步骤」的默认类型（localStorage 持久化）。
 * 初值仍是 call（与改动前一致）；只有在用户主动改过某步类型后才会变。
 * 新步骤的结构初始化与「建好后手动改类型」完全同源（都走 onKindChange），不新增分支。
 */
const LAST_STEP_KIND_KEY = 'function.lastStepKind'
/**
 * 步骤类型白名单校验。
 * 两个必要性：① `addStep` 可能被当作事件处理器直接调用（此时 kind 是事件对象）——
 * 实测 `@click="addStep"` 会把 MouseEvent 当类型写进步骤并持久化；
 * ② localStorage 可能被历史脏数据写入。
 */
function safeStepKind(k: unknown): CardStep['kind'] {
  return typeof k === 'string' && STEP_KINDS.some((x) => x.value === k) ? (k as CardStep['kind']) : 'call'
}
function readLastStepKind(): CardStep['kind'] {
  try {
    return safeStepKind(localStorage.getItem(LAST_STEP_KIND_KEY))
  } catch {
    /* 隐私模式等不可用时忽略，回落默认 */
    return 'call'
  }
}
const lastStepKind = ref<CardStep['kind']>(readLastStepKind())
function rememberStepKind(kind: unknown) {
  const k = safeStepKind(kind)
  lastStepKind.value = k
  try {
    localStorage.setItem(LAST_STEP_KIND_KEY, k)
  } catch {
    /* ignore */
  }
}
function addStep(kind?: unknown) {
  if (!form.value) return
  // 下拉直接指定用传入值；否则用记忆值。两者都过白名单校验，避免把事件对象当类型。
  const k = safeStepKind(typeof kind === 'string' ? kind : lastStepKind.value)
  const step = newStep('call')
  if (k !== 'call') onKindChange(step, k)
  form.value.steps.push(step)
}
// 常用 CAPL 变量类型（局部变量下拉选择）
const CAPL_TYPES = [
  'int', 'long', 'float', 'double', 'byte', 'word', 'dword', 'qword',
  'char', 'string', 'timer', 'msTimer', 'long Array',
]
// 当前处于编辑态的变量行索引（双击进入编辑）
const editingLocalIdx = ref(-1)
function addLocal() {
  if (!form.value) return
  if (!Array.isArray(form.value.locals)) form.value.locals = []
  form.value.locals.push({ name: '', type: 'int', value: '0' })
  editingLocalIdx.value = form.value.locals.length - 1
}
// 拖拽局部变量到参数框：写入变量名
function onLocalDragStart(e: DragEvent, lv: { name: string }) {
  if (!e.dataTransfer) return
  if (!lv.name) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/plain', lv.name)
  e.dataTransfer.setData('application/x-local-var', lv.name)
}
// 函数类步骤（使用函数名补全 + 参数列表）
function isCallLike(step: CardStep): boolean {
  return step.kind === 'call' || step.kind === 'wait'
}
function onKindChange(step: CardStep, kind: CardStep['kind']) {
  step.kind = kind
  // P1-4：记住用户主动选过的类型，作为下次「添加步骤」的默认
  rememberStepKind(kind)
  // 依据新 kind 重置结构字段
  if (kind === 'raw') {
    step.fun = undefined
    if (step.raw === undefined) step.raw = ''
    step.args = []
    step.cardId = undefined
    step.cardType = undefined
    step.cardName = undefined
  } else {
    step.raw = undefined
    if (kind === 'call' || kind === 'wait') {
      step.args = step.args || []
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'set' || kind === 'check' || kind === 'reset') {
      step.fun = undefined
      if (kind === 'check') {
        step.args = step.args && step.args.length ? step.args : [{ key: '', value: '' }]
      } else {
        step.args = step.args || []
      }
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'rate' || kind === 'ramp') {
      step.fun = undefined
      step.args = step.args || []
      if (step.rate === undefined || step.rate === '') step.rate = '10'
      if (kind === 'ramp' && (step.cycleTime === undefined || step.cycleTime === '')) step.cycleTime = '10'
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'wait_check') {
      step.fun = undefined
      if (step.args && step.args.length) step.args = step.args
      else step.args = [{ key: '', value: '' }]
      if (step.time === undefined || step.time === '') step.time = '1000'
      if (step.waitNot === undefined) step.waitNot = false
      if (step.waitRange === undefined) step.waitRange = false
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'chk_check') {
      step.fun = undefined
      if (step.args && step.args.length) step.args = step.args
      else step.args = [{ key: '', value: '' }]
      if (step.time === undefined || step.time === '') step.time = '1000'
      if (step.waitNot === undefined) step.waitNot = false
      if (step.waitRange === undefined) step.waitRange = false
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'tester_prompt') {
      step.fun = undefined
      step.args = []
      if (step.prompt === undefined) step.prompt = ''
      if (step.time === undefined || step.time === '') step.time = '60000'
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'reset_all' || kind === 'loop_end') {
      step.args = []
      if (!step.fun) step.fun = ''
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'loop_start') {
      if (!step.loopMode) step.loopMode = 'for'
      step.fun = undefined
      initLoopArgs(step)
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'card') {
      step.fun = undefined
      step.raw = undefined
      step.args = []
      if (!step.cardId) step.cardId = ''
      if (!step.cardType) step.cardType = 'sequence'
      if (!step.cardName) step.cardName = ''
    }
  }
}

// ===== 循环体参数（for / while） =====
// 按 loopMode 初始化 args 结构；for：init/count/step，while：condition
function initLoopArgs(step: CardStep) {
  const mode = step.loopMode === 'while' ? 'while' : 'for'
  if (mode === 'for') {
    step.args = [
      { key: 'init', value: '' },
      { key: 'count', value: '' },
      { key: 'step', value: '' },
    ]
  } else {
    step.args = [{ key: 'condition', value: '' }]
  }
}
// 返回指定 key 的循环参数引用（不存在则补一行，保证模板 v-model 可写）
function loopArg(step: CardStep, key: string): CardStepArg {
  if (!Array.isArray(step.args)) step.args = []
  let arg = step.args.find((a) => a.key === key)
  if (!arg) {
    arg = { key, value: '' }
    step.args.push(arg)
  }
  return arg
}
// 切换循环模式时重置参数结构
function onLoopModeChange(step: CardStep) {
  if (!step.loopMode) step.loopMode = 'for'
  initLoopArgs(step)
}

// ===== 步骤多选 / 复制 / 粘贴 =====
// 剪贴板数据前缀，用于识别本组件复制的步骤数据
const STEP_CLIP_PREFIX = 'x-mm-steps::'
// 选中的步骤 id 集合（保持 Set 实例稳定，仅 mutate 内容）
const selectedStepIds = ref<Set<string>>(new Set())
// 范围选择锚点（最近一次单击的步骤索引）
const anchorIdx = ref(-1)

function clearSelection() {
  if (selectedStepIds.value.size) selectedStepIds.value = new Set()
  anchorIdx.value = -1
}

// 步骤行点击：单选 / Ctrl 多选 / Shift 范围选
function onStepRowClick(e: MouseEvent, i: number) {
  if (!form.value) return
  const arr = form.value.steps
  const step = arr[i]
  if (!step) return
  const id = step.id
  const sel = new Set(selectedStepIds.value)
  if (e.shiftKey && anchorIdx.value >= 0) {
    // 范围选：从锚点到当前，全部加入选中（保留已有选中）
    const from = Math.min(anchorIdx.value, i)
    const to = Math.max(anchorIdx.value, i)
    for (let k = from; k <= to; k++) sel.add(arr[k].id)
  } else if (e.ctrlKey || e.metaKey) {
    // 切换选中
    if (sel.has(id)) sel.delete(id)
    else sel.add(id)
    anchorIdx.value = i
  } else {
    // 单击：仅选当前
    sel.clear()
    sel.add(id)
    anchorIdx.value = i
  }
  selectedStepIds.value = sel
}

// 复制选中的步骤到剪贴板（按原顺序）
async function copySelected() {
  if (!form.value || !selectedStepIds.value.size) return
  const sel = selectedStepIds.value
  const steps = form.value.steps.filter((s) => sel.has(s.id))
  if (!steps.length) {
    ElMessage.warning('没有可复制的步骤')
    return
  }
  const payload = JSON.stringify(steps)
  const text = STEP_CLIP_PREFIX + payload
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // 降级：使用隐藏 textarea 执行 copy
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success(`已复制 ${steps.length} 个步骤，可到其他卡片粘贴`)
  } catch (err: any) {
    // 剪贴板失败时降级到内存变量，仍支持同页面跨编辑器粘贴
    memoryClip.value = text
    ElMessage.success(`已复制 ${steps.length} 个步骤（剪贴板不可用，使用内存拷贝）`)
  }
}

// 内存拷贝降级：当剪贴板 API 不可用时使用
const memoryClip = ref('')

// 从剪贴板粘贴步骤到列表末尾
async function pasteFromClipboard() {
  if (!form.value) return
  let text = ''
  try {
    if (navigator.clipboard?.readText) {
      text = await navigator.clipboard.readText()
    }
  } catch {
    // 剪贴板读取失败时降级到内存变量
  }
  if (!text) text = memoryClip.value
  const steps = text ? parseStepClip(text) : []
  if (!steps.length) {
    // 剪贴板里没有步骤数据：把 Ctrl+V 让给画布层粘贴「工况 / 库卡片」，
    // 这样在编辑卡片时也能粘贴实体，而不必先退出卡片编辑（P2-2）
    if (geCtx?.pasteEntity) {
      geCtx.pasteEntity()
      return
    }
    ElMessage.warning(text ? '剪贴板内容不是有效的步骤数据' : '剪贴板为空或无步骤数据')
    return
  }
  const copies = steps.map((s) => ({ ...JSON.parse(JSON.stringify(s)), id: genId('step') }))
  form.value.steps.push(...copies)
  ElMessage.success(`已粘贴 ${copies.length} 个步骤`)
}

// 解析剪贴板文本为步骤数组（仅识别本组件复制的带前缀数据）
function parseStepClip(text: string): CardStep[] {
  if (!text) return []
  const raw = text.startsWith(STEP_CLIP_PREFIX) ? text.slice(STEP_CLIP_PREFIX.length) : text
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    // 简单校验：至少有 kind 字段
    return arr.filter((s: any) => s && typeof s === 'object' && typeof s.kind === 'string')
  } catch {
    return []
  }
}

// 步骤级快捷键：注册到统一快捷键层（context 作用域，比"整工况/库卡片"更内层）
// 限定在功能模块内：视图被 keep-alive 缓存，不限定会在其它模块抢 Ctrl+C/V
function stepShortcuts() {
  useShortcut({
    id: 'steps:copy',
    keys: 'Ctrl+C',
    scope: 'context',
    desc: '复制选中的步骤',
    when: () => isModuleActive('/function') && !!form.value && selectedStepIds.value.size > 0,
    run: () => {
      copySelected()
      return true
    },
  })
  useShortcut({
    id: 'steps:paste',
    keys: 'Ctrl+V',
    scope: 'context',
    desc: '粘贴步骤（支持跨卡片）',
    when: () => isModuleActive('/function') && !!form.value,
    run: () => {
      pasteFromClipboard()
      return true
    },
  })
  useShortcut({
    id: 'steps:add',
    keys: 'Alt+Insert',
    scope: 'context',
    desc: '新增一个步骤',
    // 允许在输入框内触发：新建卡片后焦点会自动落在卡片名输入框（P0-6），
    // 若跳过输入框，这条键位在最需要的时候反而是死的（Alt+Insert 不参与文本编辑）
    allowInInput: true,
    when: () => isModuleActive('/function') && !!form.value,
    run: () => {
      addStep()
      return true
    },
  })
  useShortcut({
    id: 'params:add',
    keys: 'Alt+P',
    scope: 'context',
    desc: '新增一个卡片参数',
    // 同上：Alt+P 不是文本编辑键，输入框内也应生效
    allowInInput: true,
    when: () => isModuleActive('/function') && !!form.value,
    run: () => {
      addParam()
      return true
    },
  })
  useShortcut({
    id: 'steps:clearSelection',
    keys: 'Escape',
    scope: 'context',
    desc: '取消步骤多选（无选中时交由外层处理）',
    when: () => isModuleActive('/function') && !!form.value,
    run: () => {
      if (selectedStepIds.value.size) {
        clearSelection()
        // soft：不拦截，输入框/弹窗的 Esc 行为照常
        return 'soft'
      }
      // 无步骤选中 → 继续向外层匹配（弹窗 Esc、画布 Esc 等）
      return false
    },
  })
  useShortcut({
    id: 'steps:undo',
    keys: 'Ctrl+Z',
    scope: 'context',
    desc: '撤销步骤编辑改动（与画布撤销栈隔离）',
    when: () => isModuleActive('/function') && !!form.value,
    run: () => undoStepEdit(),
  })
  useShortcut({
    id: 'steps:redo',
    keys: 'Ctrl+Y',
    scope: 'context',
    desc: '重做步骤编辑改动',
    when: () => isModuleActive('/function') && !!form.value,
    run: () => redoStepEdit(),
  })
  useShortcut({
    id: 'steps:redo2',
    keys: 'Ctrl+Shift+Z',
    scope: 'context',
    desc: '重做步骤编辑改动',
    when: () => isModuleActive('/function') && !!form.value,
    run: () => redoStepEdit(),
  })
}
stepShortcuts()

// ===== P2-1 步骤编辑独立撤销栈（快照粒度 = form.steps + form.params；与画布 Ctrl+Z 隔离）=====
const STEP_HISTORY_MAX = 60
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
/** 已记录的「当前状态」快照，用来判断有没有新改动 */
let lastStepSnapshot = ''
let stepSnapTimer: number | null = null

function stepSnapshotOf(): string {
  const f = form.value
  if (!f) return ''
  return JSON.stringify({ steps: f.steps ?? [], params: f.params ?? [] })
}
/** 把「改动前的状态」压入撤销栈（同一状态不重复入栈） */
function commitStepSnapshot() {
  const s = stepSnapshotOf()
  if (!s || s === lastStepSnapshot) return
  // 首个快照（form 尚未就绪）只做基线，不入栈
  if (lastStepSnapshot) {
    if (undoStack.value.length >= STEP_HISTORY_MAX) undoStack.value.shift()
    undoStack.value.push(lastStepSnapshot)
    redoStack.value = []
  }
  lastStepSnapshot = s
}
/** 结束防抖、立即提交挂起的快照（撤销前调用，保证最近一次输入可回退） */
function flushStepSnapshot() {
  if (stepSnapTimer !== null) {
    window.clearTimeout(stepSnapTimer)
    stepSnapTimer = null
  }
  commitStepSnapshot()
}
function applyStepSnapshot(s: string) {
  const f = form.value
  if (!f || !s) return
  try {
    const data = JSON.parse(s)
    f.steps = data.steps ?? []
    f.params = data.params ?? []
    lastStepSnapshot = s
    clearSelection()
  } catch {
    /* 快照损坏：忽略 */
  }
}
/** 切换卡片 / 初始化时重置撤销栈 */
function resetStepHistory() {
  if (stepSnapTimer !== null) {
    window.clearTimeout(stepSnapTimer)
    stepSnapTimer = null
  }
  undoStack.value = []
  redoStack.value = []
  lastStepSnapshot = stepSnapshotOf()
}
function undoStepEdit(): boolean {
  flushStepSnapshot()
  if (!undoStack.value.length) {
    ElMessage.info('没有可撤销的步骤改动')
    return true
  }
  const cur = stepSnapshotOf()
  const prev = undoStack.value.pop()!
  redoStack.value.push(cur)
  applyStepSnapshot(prev)
  ElMessage.success('已撤销步骤改动')
  return true
}
function redoStepEdit(): boolean {
  if (!redoStack.value.length) {
    ElMessage.info('没有可重做的步骤改动')
    return true
  }
  const cur = stepSnapshotOf()
  const next = redoStack.value.pop()!
  undoStack.value.push(cur)
  applyStepSnapshot(next)
  ElMessage.success('已重做步骤改动')
  return true
}
// 监听 steps/params 变化：400ms 防抖后记录快照（避免逐字符入栈）
watch(
  () => stepSnapshotOf(),
  (now) => {
    if (now === lastStepSnapshot) return
    if (stepSnapTimer !== null) window.clearTimeout(stepSnapTimer)
    stepSnapTimer = window.setTimeout(() => {
      stepSnapTimer = null
      commitStepSnapshot()
    }, 400)
  },
)
onUnmounted(() => {
  if (stepSnapTimer !== null) window.clearTimeout(stepSnapTimer)
})
resetStepHistory()

// 切换卡片时清空选中
watch(
  () => props.card?.id,
  () => {
    clearSelection()
    editingLocalIdx.value = -1
  },
)

// 外部保存信号：Ctrl+S 优先保存当前卡片
watch(
  () => props.saveSignal,
  (v) => {
    if (v && v > 0) save()
  },
)

// P0-6：新建卡片后自动聚焦「卡片名称」并全选，省一次点击。
// immediate：新建卡片是「先建卡再挂载编辑器」，置真发生在挂载之前，必须立刻检查一次。
const nameInputRef = ref<any>(null)
watch(
  () => props.focusName,
  async (v) => {
    if (!v) return
    await nextTick()
    const input = nameInputRef.value?.input || nameInputRef.value?.$el?.querySelector?.('input')
    if (input && typeof input.focus === 'function') {
      input.focus()
      input.select?.()
    }
    emit('focus-name-done')
  },
  { immediate: true },
)

const dragStepIdx = ref(-1)
const dragOverStepIdx = ref(-1)
const insertIdx = ref(-1)
const dragCopyMode = ref(false)
const dragMouseX = ref(0)
const dragMouseY = ref(0)
const isSorting = computed(() => dragStepIdx.value >= 0)
const stepListRef = ref<HTMLElement | null>(null)

// 根据鼠标 Y 坐标在所有步骤行之间精确计算插入位置（行上半部=插到该行前，下半部=插到该行后）
/**
 * 拖拽排序的行几何缓存：各步骤行中线相对「列表内容顶部」的偏移。
 * dragover 每秒触发几十~上百次，原来每次都 querySelectorAll('.step-row') + 逐行
 * getBoundingClientRect（强制同步布局、O(步骤数)），步骤一多排序就明显掉帧。
 * 这里只在拖拽开始时量一次，dragover 期间只做数值比较。
 */
let stepRowMids: number[] = []
function cacheStepRowMids() {
  const listEl = stepListRef.value
  const steps = form.value?.steps
  if (!listEl || !steps?.length) {
    stepRowMids = []
    return
  }
  const listTop = listEl.getBoundingClientRect().top - listEl.scrollTop
  stepRowMids = Array.from(listEl.querySelectorAll('.step-row')).map((el) => {
    const r = (el as HTMLElement).getBoundingClientRect()
    return r.top + r.height / 2 - listTop
  })
}
function calcInsertIdx(clientY: number): number {
  const listEl = stepListRef.value
  const steps = form.value?.steps
  if (!listEl || !steps?.length) return steps?.length ?? 0
  if (stepRowMids.length !== steps.length) cacheStepRowMids()
  if (!stepRowMids.length) return steps.length
  const y = clientY - (listEl.getBoundingClientRect().top - listEl.scrollTop)
  for (let idx = 0; idx < stepRowMids.length; idx++) {
    if (y < stepRowMids[idx]) return idx
  }
  return stepRowMids.length
}
// dragover 合并到下一帧：同一帧内多次移动只算一次插入点
let insertIdxRaf = 0
let pendingInsertY = 0
function scheduleInsertIdx(clientY: number) {
  pendingInsertY = clientY
  if (insertIdxRaf) return
  insertIdxRaf = requestAnimationFrame(() => {
    insertIdxRaf = 0
    insertIdx.value = calcInsertIdx(pendingInsertY)
  })
}

// 拖拽悬浮指示器显示的步骤名称
const draggingStepLabel = computed(() => {
  if (!form.value || dragStepIdx.value < 0) return ''
  const s = form.value.steps[dragStepIdx.value]
  if (!s) return ''
  if (s.kind === 'set') return '设置'
  if (s.kind === 'check') return '检查'
  if (s.kind === 'wait_check') return '限时检查'
  if (s.kind === 'chk_check') return '背景检测'
  if (s.kind === 'rate') return '斜率请求'
  if (s.kind === 'ramp') return '斜率请求(同步)'
  if (s.kind === 'tester_prompt') return '弹窗提示'
  if (s.kind === 'reset') return '恢复'
  if (s.kind === 'reset_all') return '恢复全部'
  if (s.kind === 'loop_start') return 'Loop Start'
  if (s.kind === 'loop_end') return 'Loop End'
  if (s.kind === 'card') return '卡片引用'
  if (s.kind === 'raw') return '自定义'
  return s.fun || '函数'
})

function resetDrag() {
  dragStepIdx.value = -1
  dragOverStepIdx.value = -1
  insertIdx.value = -1
  dragCopyMode.value = false
  listDragOver.value = false
  stepRowMids = []
  if (insertIdxRaf) {
    cancelAnimationFrame(insertIdxRaf)
    insertIdxRaf = 0
  }
}

function onStepDragStart(e: DragEvent, i: number) {
  dragStepIdx.value = i
  insertIdx.value = i
  dragCopyMode.value = !!(e.ctrlKey || e.metaKey)
  dragMouseX.value = e.clientX
  dragMouseY.value = e.clientY
  // 排序期间行几何只量一次（dragover 里不再逐行读 DOM）
  cacheStepRowMids()
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = dragCopyMode.value ? 'copy' : 'move'
    e.dataTransfer.setData('text/plain', String(i))
    // 用透明图像替代浏览器默认的半透明拖影，拖拽视觉交给 drag-ghost 悬浮指示器，
    // 避免卡片内容（input/select）被截图成模糊拖影干扰判断停靠位置
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }
}

function onStepDragOver(e: DragEvent, i: number) {
  if (dragStepIdx.value < 0) {
    // 外部拖入（函数/对象/卡片）：高亮目标卡片
    e.preventDefault()
    dragOverStepIdx.value = i
    return
  }
  // 内部排序：根据鼠标在所有步骤行之间的精确位置决定插入点
  e.preventDefault()
  dragMouseX.value = e.clientX
  dragMouseY.value = e.clientY
  scheduleInsertIdx(e.clientY)
  if (e.dataTransfer) e.dataTransfer.dropEffect = dragCopyMode.value ? 'copy' : 'move'
}

function onStepDragLeave(_e: DragEvent, _i: number) {
  if (dragStepIdx.value < 0) dragOverStepIdx.value = -1
}

function onStepDragEnd() {
  resetDrag()
}

function commitMove() {
  if (!form.value || dragStepIdx.value < 0) return
  const arr = form.value.steps
  const from = dragStepIdx.value
  let to = insertIdx.value
  if (to < 0 || to > arr.length) to = arr.length

  // Ctrl+拖拽：复制一份插入目标位置，保留原步骤
  if (dragCopyMode.value) {
    const src = arr[from]
    if (src) {
      const copy: CardStep = JSON.parse(JSON.stringify(src))
      copy.id = genId('step')
      arr.splice(to, 0, copy)
      ElMessage.success('已复制步骤')
    }
    resetDrag()
    return
  }

  if (from === to || from + 1 === to) {
    resetDrag()
    return
  }
  const [moved] = arr.splice(from, 1)
  if (to > from) to -= 1
  arr.splice(to, 0, moved)
  resetDrag()
}

/** 往对象行步骤里追加一个对象参数行（拖入对象的统一入口） */
function appendObjectToStep(step: CardStep, e: DragEvent): boolean {
  const obj = extractObjectPayload(e)
  if (!obj?.name) return false
  step.args.push({ key: obj.name, value: '', argType: obj.argType })
  emit('add-mapping', { kind: obj.kind, name: obj.name })
  ElMessage.success(`已添加${objectKindLabel(step.kind)}对象：${obj.name}`)
  return true
}

/** 对象卡片内任意位置拖入对象 → 追加一行（与拖到步骤行上等价） */
function onObjectCardDrop(step: CardStep, e: DragEvent) {
  if (dragStepIdx.value >= 0) return
  appendObjectToStep(step, e)
}

function onStepDrop(i: number, e?: DragEvent) {
  if (dragStepIdx.value < 0) {
    dragOverStepIdx.value = -1
    if (e) {
      // 拖对象到某个对象行步骤（设置/检查/限时检查/斜率请求/恢复）上时，直接追加到该步骤
      const targetStep = form.value?.steps[i]
      if (targetStep && isObjectKind(targetStep.kind) && appendObjectToStep(targetStep, e)) return
      appendFromDrop(e)
    }
    return
  }
  // dragover 的插入点更新被合并到 rAF，drop 可能早一帧：这里按最新鼠标位置同步补算一次
  insertIdx.value = calcInsertIdx(dragMouseY.value)
  commitMove()
}

const fillOver = ref('')
interface FuncPayload {
  name: string
  params?: Array<string | { name?: string; type?: string }>
}
function extractFuncPayload(e: DragEvent): FuncPayload | null {
  const dt = e.dataTransfer
  if (!dt) return null
  const raw = dt.getData('application/x-mm-func')
  if (!raw) return null
  try {
    return JSON.parse(raw) as FuncPayload
  } catch {
    return null
  }
}
function extractCardPayload(e: DragEvent): Card | null {
  const dt = e.dataTransfer
  if (!dt) return null
  const raw = dt.getData('application/x-graph-card')
  if (!raw) return null
  try {
    return JSON.parse(raw) as Card
  } catch {
    return null
  }
}
function extractObjectPayload(e: DragEvent): { kind: MappingKind; name: string; argType: CardStepArg['argType'] } | null {
  const dt = e.dataTransfer
  if (!dt) return null
  const raw = dt.getData('application/json')
  if (!raw) return null
  let p: any = null
  try {
    p = JSON.parse(raw)
  } catch {
    return null
  }
  if (!p || !p.type) return null
  if (p.type === 'signal') return { kind: 'signal', name: p.name || '', argType: 'signal' }
  if (p.type === 'message') return { kind: 'message', name: p.name || '', argType: 'message' }
  if (p.type === 'dtc') return { kind: 'dtc', name: p.code || p.name || '', argType: 'dtc' }
  if (p.type === 'envvar') return { kind: 'envvar', name: p.name || '', argType: 'envvar' }
  if (p.type === 'a2l-measurement' || p.type === 'a2l-characteristic') return { kind: 'a2l', name: p.name || '', argType: 'sysvar' }
  return null
}
// 映射表变量拖入：{ alias, name, kind }，创建设置卡片时 key 用变量名 alias
function extractMappingPayload(e: DragEvent): { alias: string; name: string; kind: MappingKind } | null {
  const dt = e.dataTransfer
  if (!dt) return null
  const raw = dt.getData('application/x-mapping')
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (!p || !p.alias) return null
    return { alias: p.alias, name: p.name || p.alias, kind: p.kind || 'signal' }
  } catch {
    return null
  }
}
const mappingArgType: Record<MappingKind, CardStepArg['argType']> = {
  signal: 'signal',
  dtc: 'dtc',
  message: 'message',
  envvar: 'envvar',
  a2l: 'sysvar',
}
function extractFillText(e: DragEvent): string {
  const dt = e.dataTransfer
  if (!dt) return ''
  const func = dt.getData('application/x-mm-func')
  if (func) {
    try {
      const p = JSON.parse(func)
      if (p.name) return p.name
    } catch { /* ignore */ }
  }
  const json = dt.getData('application/json')
  const plain = dt.getData('text/plain')
  if (json) {
    try {
      const p = JSON.parse(json)
      if ((p.type === 'a2l-measurement' || p.type === 'a2l-characteristic') && plain) return plain
      if (p.name) return p.name
      if (p.code) return p.code
      if (p.value != null) return String(p.value)
    } catch { /* ignore */ }
  }
  if (plain) return plain
  return ''
}
/**
 * P2-4：按 arg.key 在映射表中查同名「别名 / 对象」，显式填入 arg.value。
 * 显式按钮，不点不改值（保证产出一致性）。
 */
function fillArgFromMapping(arg: CardStepArg) {
  const mp: any = geCtx?.mapping?.value
  const keys = ['signals', 'dtcs', 'messages', 'envvars', 'a2l']
  const entries: any[] = []
  for (const k of keys) entries.push(...(mp?.[k] ?? []))
  if (!entries.length) {
    ElMessage.warning('映射表为空，请先在「对象映射表」中添加条目')
    return
  }
  const query = String(arg.key ?? '').trim() || String(arg.value ?? '').trim()
  if (!query) {
    ElMessage.warning('请先填写参数名（或值），再按映射表填充')
    return
  }
  const found = entries.find(
    (e) => String(e.alias ?? '').trim() === query || String(e.name ?? '').trim() === query,
  )
  if (!found) {
    ElMessage.warning(`映射表中未找到与「${query}」同名的别名或对象`)
    return
  }
  const alias = String(found.alias ?? '').trim() || String(found.name ?? '').trim()
  if (String(arg.value ?? '').trim() === alias) {
    ElMessage.info(`已是映射表别名：${alias}`)
    return
  }
  arg.value = alias
  ElMessage.success(`已按映射表填入：${alias}`)
}

function onFillDrop(e: DragEvent, target: any, field: 'fun' | 'key' | 'value' | 'value2') {
  fillOver.value = ''
  // 参数行拖入：直接插入 {{参数名}} 占位符（生成时按引用处填的值替换）
  const paramName = e.dataTransfer?.getData(CARD_PARAM_MIME)
  if (paramName) {
    const token = `{{${paramName}}}`
    if (field === 'fun') {
      if (target.kind === 'raw') target.raw = token
      else target.fun = token
    } else if (field === 'key') {
      target.key = token
    } else if (field === 'value2') {
      target.value2 = token
    } else {
      target.value = token
    }
    return
  }
  if (field === 'fun') {
    const func = extractFuncPayload(e)
    if (func?.name) {
      target.fun = func.name
      const params = Array.isArray(func.params) ? func.params : []
      target.args = params.map((p) => ({
        key: typeof p === 'string' ? p : (p.name || p.type || 'arg'),
        value: '',
      }))
      return
    }
  }
  if (field === 'key') {
    const obj = extractObjectPayload(e)
    if (obj?.name) {
      target.key = obj.name
      target.argType = obj.argType
      emit('add-mapping', { kind: obj.kind, name: obj.name })
      return
    }
  }
  if (field === 'value' || field === 'value2') {
    const obj = extractObjectPayload(e)
    if (obj?.name) {
      if (field === 'value2') target.value2 = obj.name
      else target.value = obj.name
      target.argType = obj.argType
      emit('add-mapping', { kind: obj.kind, name: obj.name })
      return
    }
  }
  const text = extractFillText(e)
  if (!text) return
  if (field === 'fun') {
    if (target.kind === 'raw') target.raw = text
    else target.fun = text
  } else if (field === 'key') {
    target.key = text
  } else {
    target.value = text
  }
}

const listDragOver = ref(false)
function onListDragOver(e: DragEvent) {
  if (dragStepIdx.value >= 0) {
    // 鼠标在列表空白间隙/底部时，同样按精确位置计算插入点，避免指示线跳动
    scheduleInsertIdx(e.clientY)
    dragMouseX.value = e.clientX
    dragMouseY.value = e.clientY
  }
  listDragOver.value = true
}
function onListDragLeave(e: DragEvent) {
  const el = e.currentTarget as HTMLElement
  const related = e.relatedTarget as Node | null
  if (!related || !el.contains(related)) listDragOver.value = false
}
function appendStepFromFunc(e: DragEvent): boolean {
  const func = extractFuncPayload(e)
  if (!func?.name || !form.value) return false
  const step = newStep('call')
  step.fun = func.name
  const params = Array.isArray(func.params) ? func.params : []
  step.args = params.map((p) => ({
    key: typeof p === 'string' ? p : (p.name || p.type || 'arg'),
    value: '',
  }))
  form.value.steps.push(step)
  ElMessage.success(`已添加步骤：${func.name}`)
  return true
}
function isBlankStep(s: CardStep): boolean {
  if (s.kind === 'raw') return !s.raw || !s.raw.trim()
  if (s.kind === 'card') return !s.cardId
  if (isObjectKind(s.kind)) {
    return !s.args || !s.args.length || s.args.every((a) => !a.key)
  }
  if (s.kind === 'reset_all' || s.kind === 'loop_end' || s.kind === 'loop_start' || s.kind === 'tester_prompt') return false
  return !s.fun
}
function appendCardRef(card: Card): boolean {
  if (!form.value) return false
  // 避免自引用（把自身卡片拖入自身）
  if (form.value.id === card.id) {
    ElMessage.warning('不能引用自身卡片')
    return false
  }
  const step = newStep('card')
  step.cardId = card.id
  step.cardType = card.type
  step.cardName = card.name || card.id
  const current = form.value.steps
  // 当前卡片只有空白步骤时，直接用引用步骤顶替，避免残留空白步骤
  if (current.length && current.every(isBlankStep)) {
    current.splice(0, current.length, step)
  } else {
    current.push(step)
  }
  ElMessage.success(`已添加卡片引用：${card.name || card.id}`)
  return true
}
// 跳转到被引用的卡片进行编辑
function openCardRef(step: CardStep) {
  if (!step.cardId) {
    ElMessage.warning('该步骤未关联卡片')
    return
  }
  emit('open-card', step.cardId)
}
// 卡片引用类型标签
function cardRefTagType(t?: CardType): 'danger' | 'primary' | 'success' {
  if (t === 'inject') return 'danger'
  if (t === 'result') return 'success'
  return 'primary'
}
function cardRefTypeLabel(t?: CardType): string {
  if (!t) return '卡片'
  return CARD_TYPE_LABEL[t] || '卡片'
}

// ===== 卡片引用：参数取值 =====
const cardLookup = computed(() => buildCardLookup(props.cards))

/** 被引用卡片声明的参数（未声明则返回空数组，界面不显示参数区） */
function cardRefParams(step: CardStep): CardParam[] {
  const ref = step.cardId ? cardLookup.value.get(step.cardId) : undefined
  return ref?.params ?? []
}
/** 当前引用为该参数填的值（未填返回空串，占位符会显示默认值提示） */
function cardArgValue(step: CardStep, name: string): string {
  const a = (step.args || []).find((x) => x.key === name)
  return a?.value ?? ''
}
/** 是否被显式设为「不参与」：引用项存在但值为空（生成时跳过该参数） */
function isCardArgSkipped(step: CardStep, name: string): boolean {
  const a = (step.args || []).find((x) => x.key === name)
  return !!a && String(a.value ?? '').trim() === ''
}
/** 取值提示：有默认值显示默认值；无默认值提示必须填写（否则会保留占位符） */
function cardArgPlaceholder(p: CardParam): string {
  if (p.default !== undefined && String(p.default) !== '') return `默认 ${p.default}`
  return '未设默认，需填写'
}
/** P1-8：三态显式化 —— 默认 / 已覆盖 / 不参与（纯视觉标注，不改取值语义与判定） */
function cardArgState(
  step: CardStep,
  name: string,
): { label: string; type: 'info' | 'success' | 'warning'; title: string } {
  if (isCardArgSkipped(step, name)) {
    return { label: '不参与', type: 'warning', title: '生成时跳过该参数（这一项不生成）' }
  }
  if (String(cardArgValue(step, name)).trim() !== '') {
    return { label: '已覆盖', type: 'success', title: '已填自定义值，覆盖卡片默认值；点右侧 ✕ 可清空，回落默认值' }
  }
  return { label: '默认', type: 'info', title: '未填，使用卡片默认值' }
}
/** 填值：清空=未覆盖（回落默认值）；非空=覆盖 */
function setCardArg(step: CardStep, name: string, v: string) {
  if (!step.args) step.args = []
  const i = step.args.findIndex((x) => x.key === name)
  if (v === '') {
    if (i >= 0) step.args.splice(i, 1)
    return
  }
  if (i >= 0) step.args[i].value = v
  else step.args.push({ key: name, value: v })
}
/** 勾选/取消「不参与」：勾选=写入空值（生成时跳过）；取消=删除该项（回落默认值） */
function setCardSkip(step: CardStep, name: string, skip: boolean) {
  if (!step.args) step.args = []
  const i = step.args.findIndex((x) => x.key === name)
  if (skip) {
    if (i >= 0) step.args[i].value = ''
    else step.args.push({ key: name, value: '' })
  } else if (i >= 0) {
    step.args.splice(i, 1)
  }
}
/** 清除自定义取值 → 回落卡片默认值 */
function clearCardArg(step: CardStep, name: string) {
  if (!step.args) return
  const i = step.args.findIndex((x) => x.key === name)
  if (i >= 0) step.args.splice(i, 1)
}
function appendStepFromObject(e: DragEvent): boolean {
  const obj = extractObjectPayload(e)
  if (!obj || !obj.name || !form.value) return false
  const steps = form.value.steps
  // 复用最后一个「会写入值」的对象行步骤（设置/恢复/斜率请求）；
  // 检查步骤不复用（它的每行都要填期望值，静默追加空行没有意义）
  let step = steps[steps.length - 1]
  if (!step || !(step.kind === 'set' || step.kind === 'reset' || isRateKind(step.kind))) {
    step = newStep('set')
    steps.push(step)
  }
  step.args.push({ key: obj.name, value: '', argType: obj.argType })
  emit('add-mapping', { kind: obj.kind, name: obj.name })
  ElMessage.success(`已添加${objectKindLabel(step.kind)}对象：${obj.name}`)
  return true
}
// 映射表变量拖入：创建/复用「设置」卡片，key 填变量名 alias（生成时对照映射表解析为对象名）
function appendStepFromMapping(e: DragEvent): boolean {
  const m = extractMappingPayload(e)
  if (!m || !form.value) return false
  const steps = form.value.steps
  let step = steps[steps.length - 1]
  if (!step || step.kind !== 'set') {
    step = newStep('set')
    steps.push(step)
  }
  step.args.push({ key: m.alias, value: '', argType: mappingArgType[m.kind] || 'signal' })
  ElMessage.success(`已创建设置变量：${m.alias}`)
  return true
}
function appendFromDrop(e: DragEvent): boolean {
  const card = extractCardPayload(e)
  if (card) return appendCardRef(card)
  if (appendStepFromMapping(e)) return true
  if (appendStepFromFunc(e)) return true
  return appendStepFromObject(e)
}
function onListDrop(e: DragEvent) {
  listDragOver.value = false
  if (dragStepIdx.value >= 0) {
    commitMove()
    return
  }
  appendFromDrop(e)
}

const expandedKeys = ref<Set<string>>(new Set())
function isExpanded(key: string): boolean {
  return expandedKeys.value.has(key)
}
function toggleExpand(key: string) {
  const s = new Set(expandedKeys.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  expandedKeys.value = s
}

// ===== 从代码段识别函数名并生成步骤 =====
const codeDialogVisible = ref(false)
const codeSnippet = ref('')
const recognizedNames = ref<string[]>([])

async function recognizeNames() {
  const code = codeSnippet.value.trim()
  if (!code) {
    ElMessage.warning('请先粘贴代码')
    return
  }
  try {
    const res: any = await parseFunctionNames(code)
    const data = res?.data?.data ?? res?.data ?? []
    recognizedNames.value = Array.isArray(data) ? data : []
    if (!recognizedNames.value.length) {
      ElMessage.warning('未识别到函数名')
    } else {
      ElMessage.success(`识别到 ${recognizedNames.value.length} 个函数名`)
    }
  } catch (e: any) {
    ElMessage.error('识别失败：' + (e?.message || String(e)))
  }
}

function generateFromNames() {
  if (!form.value) return
  const names = recognizedNames.value
  if (!names.length) {
    ElMessage.warning('请先识别函数名')
    return
  }
  const steps = names.map((n) => {
    const s = newStep('call')
    s.fun = n
    return s
  })
  form.value.steps.push(...steps)
  codeDialogVisible.value = false
  codeSnippet.value = ''
  recognizedNames.value = []
  ElMessage.success(`已生成 ${steps.length} 个步骤`)
}

// ===== 模糊匹配补全 =====
interface Suggestion {
  value: string
  label: string
}

// 合并：预设函数 + 函数库函数（去重，预设优先）。
// 改 computed：原来每次按键补全都要重建一遍合并数组（O(函数数)），函数库大时输入明显变卡。
const allFunctions = computed<ParsedFunction[]>(() => {
  const seen = new Set<string>()
  const result: ParsedFunction[] = []
  for (const f of PRESET_FUNCTIONS) {
    if (seen.has(f.name)) continue
    seen.add(f.name)
    result.push(f)
  }
  for (const f of props.functions || []) {
    if (!f.name || seen.has(f.name)) continue
    seen.add(f.name)
    result.push(f)
  }
  return result
})
/** 函数名候选（补全用，随函数库变化缓存） */
const allFunctionNames = computed<string[]>(() => allFunctions.value.map((f) => f.name))
/** 参数名候选（预设函数参数名 + 函数库函数参数名，去重后缓存） */
const allArgNames = computed<string[]>(() => {
  const names = new Set<string>()
  for (const f of allFunctions.value) {
    for (const p of f.params || []) {
      if (p.name) names.add(p.name)
    }
  }
  return [...names]
})

function fuzzyMatch(query: string, candidates: string[]): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return candidates
  const exact = candidates.filter((c) => c.toLowerCase() === q)
  const prefix = candidates.filter((c) => c.toLowerCase().startsWith(q))
  const contains = candidates.filter((c) => c.toLowerCase().includes(q) && !c.toLowerCase().startsWith(q))
  return [...exact, ...prefix, ...contains]
}

function queryFunctions(query: string, cb: (list: Suggestion[]) => void) {
  cb(fuzzyMatch(query, allFunctionNames.value).map((name) => ({ value: name, label: name })))
}

// 参数名补全：预设函数参数名 + 函数库函数参数名
function queryArgNames(query: string, cb: (list: Suggestion[]) => void) {
  cb(fuzzyMatch(query, allArgNames.value).map((n) => ({ value: n, label: n })))
}

// 函数名选中后，自动按函数定义填充参数名
function onFunSelect(step: CardStep, name: string) {
  const fn = allFunctions.value.find((f) => f.name === name)
  if (!fn) return
  const params = fn.params || []
  step.args = params.map((p) => ({ key: p.name || 'arg', value: '' }))
}

function save() {
  const card = form.value
  if (!card) return
  if (!card.name.trim()) {
    ElMessage.warning('请输入函数名称')
    return
  }
  if (!card.steps.length) {
    ElMessage.warning('至少需要一个步骤')
    return
  }
  // Loop Start / Loop End 配对检查
  let depth = 0
  for (const s of card.steps) {
    if (s.kind === 'loop_start') depth += 1
    else if (s.kind === 'loop_end') depth -= 1
    if (depth < 0) break
  }
  if (depth !== 0) {
    ElMessage.warning(depth > 0 ? `存在 ${depth} 个 Loop Start 未配对 Loop End` : '存在多余的 Loop End 未配对')
  }
  if (!normalizeParams()) return
  emit('save', JSON.parse(JSON.stringify(card)))
}
</script>

<style scoped>
.step-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 12px 14px;
  background: #fafbfc;
}
.se-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.se-form {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  /* 窄栏内让子项自身换行：否则 .se-form 可被压缩到内容宽度以下，
     末尾的「保存」按钮会溢出到右侧 .se-actions 区域、被「添加步骤」盖住点不到 */
  flex-wrap: wrap;
}
.se-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.se-name {
  flex: 1;
  min-width: 140px;
  max-width: 420px;
}
.se-type {
  width: 120px;
  flex-shrink: 0;
}
.se-role {
  width: 110px;
  flex-shrink: 0;
}
.se-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.se-step-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.se-params {
  margin-bottom: 10px;
  flex-shrink: 0;
}
.se-params-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.se-params-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 132px;
  overflow-y: auto;
  padding-right: 4px;
}
.se-param-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.se-params-tip {
  flex: 1;
  min-width: 0;
  margin-left: 8px;
  font-size: 11px;
  color: #c0c4cc;
}
.se-param-grip {
  color: #c0c4cc;
  cursor: grab;
  font-size: 12px;
  line-height: 1;
  padding: 0 2px;
  user-select: none;
}
.se-param-grip:hover {
  color: var(--el-color-primary);
}
/* 参数名即时校验：出错时输入框描红 + 行内 ⚠（与画布上「未连线卡片」的提示方式一致） */
.se-input-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset;
}
.se-param-err {
  flex-shrink: 0;
  color: #f56c6c;
  font-weight: 700;
  cursor: help;
}
.se-param-def {
  font-size: 11px;
  color: #67c23a;
  background: #f0f9eb;
  border-radius: 3px;
  padding: 1px 5px;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.se-param-lab {
  font-size: 11px;
  color: #c0c4cc;
  white-space: nowrap;
}
.se-param-spacer {
  flex: 1;
}
/* 字段助手按钮：悬停所在参数行 / 函数框时才显形（覆盖在输入框右内侧，不占布局） */
.arg-row:hover :deep(.pfa-btn),
.step-fun:hover :deep(.pfa-btn) {
  opacity: 1;
  pointer-events: auto;
}
.se-params-empty {
  font-size: 11px;
  color: #c0c4cc;
  line-height: 1.6;
}
.se-code {
  background: #f5f7fa;
  border-radius: 3px;
  padding: 0 3px;
  color: var(--el-color-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}
.se-locals {
  margin-bottom: 10px;
  flex-shrink: 0;
}
.se-locals-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.se-locals-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.local-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: default;
}
.local-row:hover {
  background: #f0f6ff;
  border-color: #d9ecff;
}
.local-row.local-editing {
  background: #fff;
  border-color: var(--el-color-primary);
}
.local-type {
  width: 120px;
  flex-shrink: 0;
}
.local-name {
  width: 150px;
  flex-shrink: 0;
}
.local-value {
  flex: 1;
  min-width: 0;
}
/* 只读显示态：类型 / 变量名 / 初始值 */
.local-view-type {
  width: 70px;
  flex-shrink: 0;
  font-size: 12px;
  color: #67c23a;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.local-view-name {
  width: 120px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  cursor: grab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.local-view-name:hover {
  color: var(--el-color-primary);
}
.local-view-name:active {
  cursor: grabbing;
}
.local-view-value {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #909399;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.local-empty {
  font-size: 12px;
  color: #c0c4cc;
  padding: 4px 0;
}
.se-step-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 6px;
}
.se-step-list.list-drag-over {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
/* 拖拽排序插入位置指示线：用卡片伪元素渲染在卡片上/下边缘，不插入 DOM、不改变布局，
   避免拖拽过程中步骤跳动，保证排序手感灵动。 */
.step-row.insert-before::before,
.step-row.insert-after::after {
  content: '';
  position: absolute;
  left: 2px;
  right: 2px;
  height: 5px;
  border-radius: 3px;
  background: var(--el-color-primary);
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.75);
  z-index: 3;
  pointer-events: none;
}
.step-row.insert-before::before {
  top: -6px;
}
.step-row.insert-after::after {
  bottom: -6px;
}
/* 插入线左端圆点指示 */
.step-row.insert-before::after,
.step-row.insert-after::before {
  content: '';
  position: absolute;
  left: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
  z-index: 4;
  pointer-events: none;
}
.step-row.insert-before::after {
  top: -9px;
}
.step-row.insert-after::before {
  bottom: -9px;
}
/* 拖拽过程中，正在被拖拽的那一行轻量化，突出可停靠的目标 */
.step-row.step-row-dragging {
  opacity: 0.45;
  box-shadow: none;
}
.drag-ghost {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  transform: translate(-50%, -16px);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid var(--el-color-primary);
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  font-size: 12px;
  color: #303133;
  white-space: nowrap;
}
.drag-ghost-tag {
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
}
.drag-ghost-tag-copy {
  background: #67c23a;
}
.drag-ghost-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-row {
  position: relative;
  border: 1px solid #ebeef5;
  border-left: 4px solid var(--el-color-primary);
  border-radius: 6px;
  padding: 6px;
  padding-right: 34px;
  background: #fafbfc;
  cursor: default;
  transition: box-shadow 0.15s, border-color 0.15s, background 0.15s;
}
.step-row:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #fff;
}
.step-del {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #c0c4cc;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  padding: 2px;
}
.step-row:hover .step-del {
  opacity: 1;
}
.step-del:hover {
  color: #f56c6c;
}
.step-row.drag-over {
  border-color: var(--el-color-primary);
  background: #ecf5ff;
}
.step-row.step-row-selected {
  border-color: var(--el-color-primary);
  background: #ecf5ff;
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
.step-row.step-row-selected.step-row-object {
  border-left-color: #67c23a;
}
.se-step-sel-tip {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-left: 4px;
}
.step-head {
  display: flex;
  align-items: center;
  gap: 5px;
}
.step-drag {
  cursor: grab;
  color: #c0c4cc;
  font-size: 16px;
  line-height: 1;
  user-select: none;
  flex-shrink: 0;
  /* 扩大命中区域，便于准确抓取拖拽手柄（否则 14px 字符太难点中，拖拽不灵动） */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
}
.step-drag:hover {
  color: var(--el-color-primary);
  background: #ecf5ff;
}
.step-drag:active {
  cursor: grabbing;
}
.step-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ecf5ff;
  color: var(--el-color-primary);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-kind-select {
  width: 110px;
  flex-shrink: 0;
}
.step-kind-select-sm {
  width: 90px;
}
/* 斜率请求：步骤级「斜率」标签与输入框（不参与 .kind-static 的 flex 撑开） */
.rate-label {
  flex: 0 0 auto;
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
}
.rate-input {
  flex: 0 0 auto;
  width: 72px;
  margin: 0 4px;
}
/* 限时检查：判定方式下拉（等于/不等于期望值、在/不在区间内、大于/小于期望值） */
.wait-form-select {
  flex: 0 0 auto;
  width: 118px;
  margin-left: 4px;
}
.step-row-object {
  border-left-color: #67c23a;
  background: #f0f9eb;
}
.step-row.step-row-object:hover {
  background: #f5fbf0;
}
.step-row-object .step-index {
  background: #e1f3d8;
  color: #67c23a;
}
/* 卡片引用步骤：突出显示为一个卡片节点 */
.card-ref-card {
  padding: 2px 0;
  cursor: pointer;
  border-radius: 4px;
}
.card-ref-card:hover {
  background: #f5faff;
}
.card-ref-card.card-ref-unbound {
  opacity: 0.7;
}
.card-ref-tag {
  flex-shrink: 0;
}
.card-ref-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
  border-radius: 3px;
}
.card-ref-name:hover {
  background: #ecf5ff;
  color: var(--el-color-primary);
}
.card-ref-unbound .card-ref-name {
  color: #c0c4cc;
}
.card-ref-tip {
  margin-top: 4px;
  padding: 4px 26px;
  font-size: 11px;
  color: #c0c4cc;
}
.card-ref-params {
  margin-top: 6px;
  padding: 4px 26px 2px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-ref-params-title {
  font-size: 11px;
  color: #909399;
}
.card-ref-param-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* P1-8：三态标签（默认/已覆盖/不参与）定宽，保证各行对齐 */
.card-ref-param-state {
  width: 56px;
  flex-shrink: 0;
  text-align: center;
}
.card-ref-param-name {
  width: 110px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-color-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.obj-type-tag {
  width: 72px;
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.obj-empty-tip {
  padding: 6px 8px;
  font-size: 11px;
  color: #c0c4cc;
  text-align: center;
  border: 1px dashed #e4e7ed;
  border-radius: 4px;
}
/* 循环体卡片 */
.loop-card {
  padding: 2px 0;
}
.prompt-card {
  padding: 2px 0;
}
.loop-mode-group {
  margin-left: auto;
  flex-shrink: 0;
}
.loop-params {
  margin-top: 4px;
  padding-left: 22px;
}
.loop-param-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.loop-param-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  white-space: nowrap;
}
.loop-param-row :deep(.el-input) {
  width: 120px;
}
.loop-param-row :deep(.el-input):last-of-type {
  width: 120px;
}
.loop-param-hint {
  margin-top: 4px;
  font-size: 11px;
  color: #c0c4cc;
}
.kind-static {
  flex: 1;
  min-width: 0;
  max-width: 460px;
  font-size: 12px;
  color: #909399;
  line-height: 24px;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.step-fun {
  flex: 1;
  min-width: 0;
  max-width: 460px;
  /* 承载覆盖在输入框内的字段助手 */
  position: relative;
}
.expand-btn {
  color: #909399;
  font-size: 14px;
  flex-shrink: 0;
  padding: 2px;
}
.step-head .el-button + .expand-btn {
  margin-left: 4px;
}
.fill-drop {
  border-radius: 4px;
  transition: box-shadow 0.12s, background 0.12s;
  /* 承载覆盖在输入框内的字段助手（提为参数 / 取消参数） */
  position: relative;
}
.fill-drop :deep(.el-input) {
  width: 100%;
}
.fill-drop.fill-over {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  background: #ecf5ff;
}
.step-args {
  margin-top: 4px;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.arg-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.arg-key {
  width: 100px;
  flex-shrink: 0;
}
.fun-autocomplete,
.arg-key-autocomplete {
  width: 100%;
}
.fun-autocomplete :deep(.el-input),
.arg-key-autocomplete :deep(.el-input) {
  width: 100%;
}
.arg-value {
  flex: 1;
}
/* 设置/恢复卡片：对象名占宽，设置值窄 */
.obj-card .arg-key {
  width: auto;
  flex: 1;
  min-width: 0;
}
.obj-card .arg-key :deep(.el-input) {
  width: 100%;
}
.obj-card .arg-value {
  flex: none;
  width: 140px;
}
.obj-card .arg-value :deep(.el-input) {
  width: 100%;
}
.se-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 16px 0;
}
.recognized {
  margin-top: 10px;
}
.recognized-title {
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
}
.recognized-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
  padding: 4px 0;
}
.se-blank {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 13px;
}
</style>
