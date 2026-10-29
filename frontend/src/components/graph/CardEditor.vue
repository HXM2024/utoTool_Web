<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="720px"
    append-to-body
    :modal="false"
    :close-on-click-modal="false"
    draggable
    modal-class="ce-modal-pass"
    :style="{ marginLeft: '16px' }"
    :before-close="beforeClose"
    @update:model-value="onVisibleChange"
    @open="sync"
  >
    <!-- 引用卡片编辑态：面包屑 + 返回（编辑栈为空时不显示，不影响既有编辑流程） -->
    <div v-if="isSubEdit" class="ce-crumb">
      <el-button size="small" text :icon="ArrowLeft" @click="backToParent">返回组合卡片</el-button>
      <span class="ce-crumb-path">{{ crumbPath }}</span>
    </div>

    <!-- P2-7 叠层子面板：编辑引用卡片时不再整表单替换，父级卡片信息在左侧保持可见 -->
    <div class="ce-body" :class="{ 'ce-body-stacked': isSubEdit }">
      <aside v-if="isSubEdit" class="ce-parent">
        <div class="ce-parent-title">组合卡片（父级）</div>
        <div v-for="(l, i) in stackLayers" :key="i" class="ce-parent-row">
          <span class="ce-parent-idx">L{{ i + 1 }}</span>
          <span class="ce-parent-name" :title="l.name">{{ l.name }}</span>
          <span class="ce-parent-meta">{{ l.typeLabel }} · {{ l.stepCount }} 步</span>
        </div>
        <div class="ce-parent-row ce-parent-cur">
          <span class="ce-parent-idx">编辑中</span>
          <span class="ce-parent-name" :title="form.name">{{ form.name || '未命名' }}</span>
          <span class="ce-parent-meta">{{ curTypeLabel }} · {{ (form.steps || []).length }} 步</span>
        </div>
        <div class="ce-parent-hint">父级内容未被替换：点「返回组合卡片」即可原样回到上层继续编辑。</div>
      </aside>
      <div class="ce-main">
    <el-form :model="form" label-width="72px" size="small">
      <el-form-item label="类型">
        <!-- P1-1：与 StepEditor 对齐 —— 放开「类型可改」（原来仅新建时可改） -->
        <el-select v-model="form.type" style="width: 180px">
          <el-option label="故障注入" value="inject" />
          <el-option label="测试序列" value="sequence" />
          <el-option label="结果判断" value="result" />
        </el-select>
        <!-- P1-1：与 StepEditor 对齐 —— 补齐「故障角色」（inject/recover） -->
        <el-select
          v-if="form.type === 'inject'"
          v-model="form.role"
          style="width: 130px; margin-left: 8px"
        >
          <el-option label="故障注入" value="inject" />
          <el-option label="故障恢复" value="recover" />
        </el-select>
      </el-form-item>
      <el-form-item label="名称">
        <el-input
          v-model="form.name"
          placeholder="卡片名称"
          @dragover.prevent
          @drop.stop.prevent="onFieldDrop($event, (v: string) => (form.name = v))"
        />
      </el-form-item>
      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          placeholder="可选，用途说明"
          @dragover.prevent
          @drop.stop.prevent="onFieldDrop($event, (v: string) => (form.description = v))"
        />
      </el-form-item>
    </el-form>

    <!-- 卡片参数（接口）：声明后，引用本卡片时可填不同值 -->
    <div class="ce-params">
      <div class="ce-params-head">
        <span class="ce-step-title">参数（接口）</span>
        <span class="ce-params-tip">
          步骤里用 <code class="ce-code">{{ PARAM_HINT }}</code> 占位；拖参数名到参数框、或在参数框里打
          <code class="ce-code">{{ BRACE_HINT }}</code> 都能插入；悬停参数框可「提为参数 / 取消参数」
        </span>
        <el-button size="small" text type="primary" :icon="Plus" @click="addParam">添加参数</el-button>
      </div>
      <div v-if="params.length" class="ce-params-list">
        <div v-for="(p, i) in params" :key="i" class="ce-param-row">
          <span
            class="ce-param-grip"
            :title="`拖拽「${p.name || '参数'}」到参数框，自动插入占位符`"
            draggable="true"
            @dragstart.stop="onParamDragStart($event, p)"
          >⠿</span>
          <el-input
            v-model="p.name"
            size="small"
            placeholder="参数名（如 dtc）"
            style="width: 140px"
            :class="{ 'ce-input-error': !!paramNameError(params, i) }"
            @dragover.prevent
            @drop.stop.prevent="onFieldDrop($event, (v: string) => (p.name = v))"
          />
          <!-- 参数名即时校验：原来只在点保存时用一个 toast 报一次，用户不知道是哪一行 -->
          <span
            v-if="paramNameError(params, i)"
            class="ce-param-err"
            :title="paramNameError(params, i) || ''"
          >⚠</span>
          <template v-if="paramExtraOpen[i]">
            <el-input
              v-model="p.default"
              size="small"
              placeholder="默认值（留空=默认不参与）"
              style="width: 200px"
              @dragover.prevent
              @drop.stop.prevent="onFieldDrop($event, (v: string) => (p.default = v))"
            />
            <el-input
              v-model="p.label"
              size="small"
              placeholder="显示名（可选）"
              style="width: 140px"
              @dragover.prevent
              @drop.stop.prevent="onFieldDrop($event, (v: string) => (p.label = v))"
            />
          </template>
          <template v-else>
            <span v-if="p.default" class="ce-param-def">默认 {{ p.default }}</span>
            <span v-else class="ce-param-lab">未设默认值（引用处不填则该项不参与）</span>
          </template>
          <span class="ce-param-spacer" />
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
    </div>

    <!-- P1-1：与 StepEditor 对齐 —— 补齐「局部变量」编辑区（生成时在 testcase 顶部声明） -->
    <div class="ce-locals">
      <div class="ce-locals-head">
        <span class="step-title">局部变量</span>
        <span class="step-hint">拖变量名到参数框可快速填值</span>
        <el-button size="small" text type="primary" :icon="Plus" @click="addLocal">添加变量</el-button>
      </div>
      <div v-if="locals.length" class="ce-locals-list">
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
            <span class="local-view-name" title="拖拽到参数框 / 双击编辑">{{ lv.name || '未命名' }}</span>
            <span class="local-view-value">{{ lv.value !== undefined && lv.value !== '' ? lv.value : '0' }}</span>
            <el-button size="small" text :icon="EditPen" title="双击编辑" @click.stop="editingLocalIdx = li" />
          </template>
          <el-button size="small" text :icon="Close" title="删除" @click.stop="locals.splice(li, 1)" />
        </div>
      </div>
      <div v-else class="local-empty">无局部变量，点击「添加变量」新增</div>
    </div>

    <div class="step-editor-head">
      <span class="step-title">步骤（组合卡片）</span>
      <span class="step-hint">可拖入函数 / 别名到步骤或参数</span>
      <el-button size="small" :icon="Link" type="primary" text @click="openCardPicker(-1)">添加引用卡片</el-button>
      <el-button size="small" :icon="Plus" type="primary" text @click="addStep()">添加步骤</el-button>
      <el-dropdown trigger="click" @command="(k: CardStep['kind']) => addStep(k)">
        <el-button
          size="small"
          text
          :icon="CaretBottom"
          title="按指定类型新增步骤"
          aria-label="按指定类型新增步骤"
        />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="k in stepKinds" :key="k" :command="k">
              {{ STEP_KIND_LABEL[k] }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="step-list" @dragover.prevent @drop="onStepListDrop">
      <div
        v-for="(step, i) in form.steps"
        :key="step.id"
        class="step-row"
        :class="{ 'step-drop-before': stepDropIdx === i }"
        @dragover.prevent="onStepDragOver(i)"
        @dragleave="onStepDragLeave(i)"
        @drop.stop.prevent="onStepDrop(i)"
      >
        <div class="step-row-head">
          <span class="step-grip" draggable="true" title="拖拽调整步骤顺序（也可用上/下移按钮）" @dragstart.stop="onStepDragStart($event, i)">⠿</span>
          <span class="step-index">{{ i + 1 }}</span>
          <span class="step-move">
            <el-button size="small" text :icon="Top" :disabled="i === 0" title="上移" @click.stop="moveStep(i, -1)" />
            <el-button size="small" text :icon="Bottom" :disabled="i === form.steps.length - 1" title="下移" @click.stop="moveStep(i, 1)" />
          </span>
          <el-select v-model="step.kind" size="small" style="width: 120px" @change="(v: any) => onKindChange(step, v)">
            <el-option
              v-for="k in stepKinds"
              :key="k"
              :label="STEP_KIND_LABEL[k]"
              :value="k"
            />
          </el-select>

          <!-- 卡片引用：显示卡片名；双击名称/点「编辑」进入被引用卡片的编辑页 -->
          <template v-if="step.kind === 'card'">
            <el-tag size="small" type="primary" effect="light">{{ cardTypeLabel(step.cardType) }}</el-tag>
            <span
              class="card-ref-name"
              :class="{ 'card-ref-unbound': !step.cardId }"
              :title="step.cardId ? `双击编辑引用卡片「${step.cardName || step.cardId}」` : '尚未关联卡片，点右侧「选择卡片」'"
              @dblclick.stop="openCardRef(step)"
            >{{ step.cardName || step.cardId || '未选择卡片' }}</span>
            <el-button
              v-if="step.cardId"
              size="small"
              text
              :icon="EditPen"
              title="编辑该引用卡片（保存后所有引用处同步更新）"
              @click.stop="openCardRef(step)"
            />
            <el-button v-else size="small" text type="primary" @click.stop="openCardPicker(i)">选择卡片</el-button>
          </template>

          <!-- 恢复全部 -->
          <span v-else-if="step.kind === 'reset_all'" class="kind-static">恢复全部（生成时自动展开）</span>

          <!-- Loop End -->
          <span v-else-if="step.kind === 'loop_end'" class="kind-static">Loop End（与 Loop Start 配对）</span>

          <!-- Loop Start：循环模式 -->
          <el-radio-group v-else-if="step.kind === 'loop_start'" v-model="step.loopMode" size="small" style="flex:1">
            <el-radio-button value="for">次数可控</el-radio-button>
            <el-radio-button value="while">条件退出</el-radio-button>
          </el-radio-group>

          <!-- 原始行 -->
          <span v-else-if="step.kind === 'raw'" class="ce-fun-field">
            <el-input
              v-model="step.raw"
              size="small"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              placeholder="原始 CAPL 行"
              @dragover.prevent
              @drop.stop.prevent="onFieldDrop($event, (v: string) => (step.raw = v))"
            />
            <ParamFieldAssist
              :text="step.raw || ''"
              :params="params"
              :allow-paramify="false"
              @paramify="(pl: any) => paramifyField(step, 'raw', pl)"
              @inline="(ns: string[]) => inlineField(step, 'raw', ns)"
              @setText="(v: string) => (step.raw = v)"
            />
          </span>

          <!-- 函数调用 / 等待 -->
          <span v-else-if="step.kind === 'call' || step.kind === 'wait'" class="ce-fun-field">
            <el-input
              v-model="step.fun"
              size="small"
              placeholder="函数名（如 setSignal）"
              @dragover.prevent
              @drop.stop.prevent="onFieldDrop($event, (v: string) => (step.fun = v))"
            />
            <ParamFieldAssist
              :text="step.fun || ''"
              :params="params"
              @paramify="(pl: any) => paramifyField(step, 'fun', pl)"
              @inline="(ns: string[]) => inlineField(step, 'fun', ns)"
              @setText="(v: string) => (step.fun = v)"
            />
          </span>

          <!-- 斜率请求 / 斜率请求(同步) / 限时检查 / 弹窗提示：步骤级数值参数 -->
          <span v-else-if="numFieldsOf(step.kind).length" class="ce-rate-field">
            <!-- 弹窗提示：提示内容（生成 char Str_Temp[]="…"） -->
            <template v-if="step.kind === 'tester_prompt'">
              <el-input
                v-model="step.prompt"
                size="small"
                style="flex: 1"
                placeholder="弹窗提示内容（如：请确认 XXX 已上电）"
                @dragover.prevent
                @drop.stop.prevent="onFieldDrop($event, (v: string) => (step.prompt = v))"
              />
              <ParamFieldAssist
                :text="step.prompt || ''"
                :params="params"
                @paramify="(pl: any) => paramifyField(step, 'prompt', pl)"
                @inline="(ns: string[]) => inlineField(step, 'prompt', ns)"
                @setText="(v: string) => (step.prompt = v)"
              />
            </template>
            <!-- 判定方式：限时检查（SignalWaitCheck 系列）/ 检查（SignalCheck 系列）/ 背景检测（Chk 系列） -->
            <el-select
              v-if="step.kind === 'wait_check' || step.kind === 'check' || step.kind === 'chk_check'"
              :model-value="waitFormOf(step)"
              size="small"
              style="width: 118px"
              title="判定方式：限时检查生成 SignalWaitCheck 系列，检查生成 SignalCheck 系列，背景检测生成 Chk 系列"
              @change="(v: any) => applyWaitForm(step, v)"
            >
              <el-option v-for="f in assertFormsOf(step.kind)" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
            <template v-for="nf in numFieldsOf(step.kind)" :key="nf.key">
              <span class="ce-rate-label">{{ nf.label }}</span>
              <el-input
                :model-value="step[nf.key]"
                size="small"
                style="width: 80px"
                :placeholder="nf.placeholder"
                :title="nf.title"
                @update:model-value="(v: string) => setStepNum(step, nf.key, v)"
                @dragover.prevent
                @drop.stop.prevent="onFieldDrop($event, (v: string) => setStepNum(step, nf.key, v))"
              />
            </template>
            <span class="kind-static">{{ stepKindHint(step) }}</span>
          </span>

          <!-- 设置 / 检查 / 恢复 -->
          <span v-else class="kind-static">{{ stepKindHint(step) }}</span>

          <el-button size="small" :icon="Close" text @click="removeStep(i)" />
        </div>
        <!-- 引用卡片内容预览：初始状态即可看到被引用卡片有哪些步骤 -->
        <div v-if="step.kind === 'card'" class="card-ref-preview">
          <div class="crp-title">
            <span>引用卡片内容</span>
            <span class="crp-count">{{ refStepsOf(step).length }} 步</span>
            <el-button
              v-if="step.cardId"
              size="small"
              text
              type="primary"
              :icon="EditPen"
              @click.stop="openCardRef(step)"
            >编辑引用卡片</el-button>
          </div>
          <div v-if="refStepsOf(step).length" class="crp-list">
            <div v-for="(rs, ri) in refStepsOf(step)" :key="ri" class="crp-row">
              <span class="crp-idx">{{ ri + 1 }}</span>
              <span class="crp-label">{{ refStepLabel(rs) }}</span>
            </div>
          </div>
          <div v-else class="crp-empty">
            {{ step.cardId ? '未找到该引用卡片（可能已被删除），请重新选择' : '请先选择要引用的卡片' }}
          </div>
        </div>
        <div v-if="step.kind === 'card' && cardRefParams(step).length" class="card-ref-params">
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
              @dragover.prevent
              @drop.stop.prevent="onFieldDrop($event, (v: string) => setCardArg(step, p.name, v))"
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
        <div v-if="stepHasArgs(step)" class="arg-list">
          <div
            v-for="(arg, ai) in step.args"
            :key="ai"
            class="arg-row"
            :class="{ 'arg-drag-over': dragOverArg === `${i}-${ai}` }"
            @dragover.prevent
            @dragenter="dragOverArg = `${i}-${ai}`"
            @dragleave="dragOverArg = ''"
            @drop.stop="onArgDrop($event, i, ai)"
          >
            <span
              class="arg-field arg-field-key"
              @dragover.prevent
              @drop.stop.prevent="onArgFieldDrop($event, arg, 'key')"
            >
              <el-input v-model="arg.key" size="small" placeholder="参数名" />
              <ParamFieldAssist
                :text="arg.key || ''"
                :params="params"
                @paramify="(pl: any) => paramifyField(arg, 'key', pl)"
                @inline="(ns: string[]) => inlineField(arg, 'key', ns)"
                @setText="(v: string) => (arg.key = v)"
              />
            </span>
            <span
              v-if="!isKeepForm(step)"
              class="arg-field arg-field-value"
              @dragover.prevent
              @drop.stop.prevent="onArgFieldDrop($event, arg, 'value')"
            >
              <el-input v-model="arg.value" size="small" placeholder="对象 / 别名 / 值" />
              <ParamFieldAssist
                :text="arg.value || ''"
                :params="params"
                @paramify="(pl: any) => paramifyField(arg, 'value', pl)"
                @inline="(ns: string[]) => inlineField(arg, 'value', ns)"
                @setText="(v: string) => (arg.value = v)"
              />
            </span>
            <!-- 限时检查的区间形式：第二个值（上限） -->
            <span
              v-if="isWaitRange(step)"
              class="arg-field arg-field-value"
              @dragover.prevent
              @drop.stop.prevent="onArgFieldDrop($event, arg, 'value2')"
            >
              <el-input v-model="arg.value2" size="small" placeholder="上限" />
              <ParamFieldAssist
                :text="arg.value2 || ''"
                :params="params"
                @paramify="(pl: any) => paramifyField(arg, 'value2', pl)"
                @inline="(ns: string[]) => inlineField(arg, 'value2', ns)"
                @setText="(v: string) => (arg.value2 = v)"
              />
            </span>
            <el-button size="small" text title="从映射表填充：按参数名查同名别名/对象并填入值" @click.stop="fillArgFromMapping(arg)">映射填充</el-button>
            <el-button size="small" :icon="Close" text @click="removeArg(i, ai)" />
          </div>
          <el-button size="small" text type="primary" :icon="Plus" @click="addArg(i)">
            参数
          </el-button>
        </div>
      </div>
      <div v-if="!form.steps.length" class="empty-tip">暂无步骤，点击「添加步骤」</div>
    </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="onCancelClick">{{ isSubEdit ? '返回组合卡片' : '取消' }}</el-button>
      <el-button type="primary" @click="save">{{ isSubEdit ? '保存引用卡片' : '保存' }}</el-button>
    </template>
  </el-dialog>

  <!-- 引用卡片选择器：按类型分组 + 搜索，排除自身与循环引用 -->
  <el-dialog
    v-model="pickerVisible"
    title="选择引用卡片"
    width="480px"
    append-to-body
    class="ce-picker"
  >
    <el-input
      v-model="pickerKeyword"
      size="small"
      placeholder="搜索卡片名称"
      :prefix-icon="Search"
      clearable
    />
    <div class="pk-list">
      <template v-for="g in pickerGroups" :key="g.type">
        <div v-if="g.cards.length" class="pk-group">{{ g.label }}</div>
        <div v-for="c in g.cards" :key="c.id" class="pk-item" @click="chooseCard(c)">
          <span class="pk-name">{{ c.name || c.id }}</span>
          <span class="pk-meta">
            {{ c.steps?.length || 0 }} 步<span v-if="c.params?.length"> · {{ c.params.length }} 参数</span>
          </span>
        </div>
      </template>
      <div v-if="!pickerTotal" class="pk-empty">没有可引用的卡片</div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Close, Check, CaretTop, CaretBottom, Link, Top, Bottom, EditPen, ArrowLeft, Search } from '@element-plus/icons-vue'
import type { Card, CardLibrary, CardParam, CardStep, CardStepArg, CardType, MappingKind } from '@/types/functionGraph'
import {
  newStep,
  newCard,
  STEP_KIND_LABEL,
  CARD_TYPE_LABEL,
  buildCardLookup,
  stepNumFieldsOf,
  assertFormsOf,
  waitFormOf,
  applyWaitForm,
  isWaitRange,
  isKeepForm,
  waitCheckFunOf,
  chkCheckFunOf,
  collectStepParamNames,
  paramNameError,
} from '@/utils/functionGraph'
import type { StepNumField } from '@/utils/functionGraph'
import { CARD_PARAM_MIME } from '@/types/functionGraph'
import ParamFieldAssist from './ParamFieldAssist.vue'

const props = defineProps<{
  visible: boolean
  card: Card | null
  defaultType?: Card['type']
  /** 卡片库：用于查被引用卡片声明的参数，供节点内的卡片引用填值 */
  cards?: CardLibrary
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', card: Card): void
  /** 在编辑栈里保存「被引用的库卡片」：由外层写回卡片库，触发所有引用处同步 */
  (e: 'save-card', card: Card): void
}>()

const stepKinds = Object.keys(STEP_KIND_LABEL) as CardStep['kind'][]

const isNew = computed(() => !props.card)
const form = ref<Card>(newCard('inject'))
/** 「载入时的表单快照」：用于判断是否有未保存修改（见 hasChanges / confirmBeforeSwitch） */
const loadedSnapshot = ref(JSON.stringify(form.value))
const dragOverArg = ref('')

// 画布层上下文（geCtx）：提供对象映射表，供「映射填充」按钮使用（P2-4）
const geCtx = inject<any>('geCtx', null)

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

/**
 * 引用卡片编辑栈：非空表示当前正在编辑「被引用的库卡片」。
 * 每层存父级表单快照，返回时原样恢复（不影响外层已编辑内容）。
 */
const editStack = ref<{ form: Card; snapshot: string }[]>([])
const isSubEdit = computed(() => editStack.value.length > 0)

function sync() {
  editStack.value = []
  pickerVisible.value = false
  pickerKeyword.value = ''
  if (props.card) {
    form.value = JSON.parse(JSON.stringify(props.card))
  } else {
    form.value = newCard(props.defaultType || 'inject')
  }
  if (!Array.isArray(form.value.params)) form.value.params = []
  if (!Array.isArray(form.value.steps)) form.value.steps = []
  // P1-1：与 StepEditor 对齐 —— 补全局部变量与故障角色默认值
  if (!Array.isArray(form.value.locals)) form.value.locals = []
  if (form.value.type === 'inject' && !form.value.role) form.value.role = 'inject'
  ensureParamsFromSteps()
  markLoaded()
}
/** 记录「当前表单 = 刚载入的状态」，之后 hasChanges() 才有意义 */
function markLoaded() {
  loadedSnapshot.value = JSON.stringify(form.value)
}
/** 兜底：步骤里写了 {{X}} 却没声明参数 X 时自动补一条声明。
 *  否则界面上没有可填值的「参数（接口）」行，占位符会一直原样留在步骤里。 */
function ensureParamsFromSteps() {
  const list = form.value.params ?? (form.value.params = [])
  const declared = new Set(list.map((p) => String(p?.name ?? '').trim()).filter(Boolean))
  for (const n of collectStepParamNames(form.value.steps)) {
    if (declared.has(n) || !/^\w+$/.test(n)) continue
    declared.add(n)
    list.push({ name: n })
  }
}
// 对话框是非模态的、可以一直开着：外层直接切换编辑对象时不会经过 close→open，
// 只靠 @open 同步会停留在上一张卡片上（表现为「另一张卡片打不开、重复打开不刷新」）。
watch(
  () => props.card,
  () => {
    if (props.visible) sync()
  },
)

const dialogTitle = computed(() => {
  if (isSubEdit.value) return `编辑引用卡片：${form.value.name || '未命名'}`
  return isNew.value ? '新建卡片' : '编辑卡片'
})
/** 面包屑：组合卡片 › 引用卡片 › … */
const crumbPath = computed(() => {
  const names = editStack.value.map((s) => s.form.name || '未命名')
  return [...names, form.value.name || '未命名'].join(' › ')
})
/** P2-7 叠层子面板：父级各层摘要（编辑栈自底向上），用于编辑引用卡片时保留上下文 */
const CE_TYPE_LABEL: Record<string, string> = { inject: '故障注入', sequence: '测试序列', result: '结果判断' }
const stackLayers = computed(() =>
  editStack.value.map((l) => ({
    name: l.form?.name || '未命名',
    typeLabel: CE_TYPE_LABEL[l.form?.type || 'inject'] || '',
    stepCount: (l.form?.steps || []).length,
  })),
)
/** 当前正在编辑的那张卡片的类型名（叠层子面板「编辑中」一行用） */
const curTypeLabel = computed(() => CE_TYPE_LABEL[form.value.type || 'inject'] || '')

// ===== 步骤顺序调整（上移 / 下移 / 拖拽） =====
function moveStep(i: number, dir: -1 | 1) {
  const list = form.value.steps
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const [s] = list.splice(i, 1)
  list.splice(j, 0, s)
}
const stepDragFrom = ref(-1)
const stepDropIdx = ref(-1)
function onStepDragStart(e: DragEvent, i: number) {
  stepDragFrom.value = i
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // 必须带一个 data，否则部分浏览器不触发 drop
    e.dataTransfer.setData('text/plain', String(i))
  }
}
function onStepDragOver(i: number) {
  if (stepDragFrom.value < 0 || stepDragFrom.value === i) {
    stepDropIdx.value = -1
    return
  }
  stepDropIdx.value = i
}
function onStepDragLeave(i: number) {
  if (stepDropIdx.value === i) stepDropIdx.value = -1
}
function onStepDrop(i: number) {
  const from = stepDragFrom.value
  stepDragFrom.value = -1
  stepDropIdx.value = -1
  if (from < 0 || from === i) return
  const list = form.value.steps
  const [s] = list.splice(from, 1)
  list.splice(i, 0, s)
}

// ===== 引用卡片选择器 =====
const pickerVisible = ref(false)
const pickerKeyword = ref('')
/** 打开选择器时的目标步骤下标；-1 表示新增步骤 */
const pickerTarget = ref(-1)

/** 「选择引用卡片」时不能被选中的卡片 id：自身 + 编辑栈每一层 + 各自的引用源（防自引用 / 循环引用） */
const forbiddenIds = computed(() => {
  const ids = new Set<string>()
  ids.add(form.value.id)
  if (form.value.refId) ids.add(form.value.refId)
  for (const s of editStack.value) {
    ids.add(s.form.id)
    if (s.form.refId) ids.add(s.form.refId)
  }
  return ids
})

/**
 * 「进入引用卡片编辑」的守卫：只拦截当前编辑链上正在编辑的 id（自身 + 编辑栈每一层）。
 * 注意不能把 refId 也算进来：纯引用节点（steps 仅 1 步且 cardId === refId）的那一步
 * 正是它的引用源，属于要进入编辑的合法目标。
 */
const editingChainIds = computed(() => {
  const ids = new Set<string>()
  ids.add(form.value.id)
  for (const s of editStack.value) ids.add(s.form.id)
  return ids
})

const pickerGroups = computed(() => {
  const kw = pickerKeyword.value.trim().toLowerCase()
  const lib = props.cards
  const groups: Array<{ type: CardType; label: string; cards: Card[] }> = [
    { type: 'inject', label: '故障注入', cards: lib?.inject ?? [] },
    { type: 'sequence', label: '测试序列', cards: lib?.sequence ?? [] },
    { type: 'result', label: '结果判断', cards: lib?.result ?? [] },
  ]
  return groups.map((g) => ({
    ...g,
    cards: g.cards.filter((c) => {
      if (forbiddenIds.value.has(c.id)) return false
      if (!kw) return true
      return `${c.name || ''} ${c.id}`.toLowerCase().includes(kw)
    }),
  }))
})
const pickerTotal = computed(() => pickerGroups.value.reduce((n, g) => n + g.cards.length, 0))

function openCardPicker(stepIndex: number) {
  pickerTarget.value = stepIndex
  pickerKeyword.value = ''
  pickerVisible.value = true
}
/** 选中卡片：填到目标步骤，或新增一条引用步骤 */
function chooseCard(card: Card) {
  const list = form.value.steps
  const idx = pickerTarget.value
  const target = idx >= 0 && idx < list.length ? list[idx] : null
  const step: CardStep = target ?? newStep('card')
  step.kind = 'card'
  step.cardId = card.id
  step.cardType = card.type
  step.cardName = card.name || card.id
  step.args = step.args ?? []
  step.indent = step.indent ?? 0
  if (!target) list.push(step)
  pickerVisible.value = false
  ElMessage.success(`已引用卡片「${card.name || card.id}」`)
}

// ===== 引用卡片内容预览 + 进入引用卡片编辑 =====
function refCardOf(step: CardStep): Card | undefined {
  return step.cardId ? cardLookup.value.get(step.cardId) : undefined
}
function refStepsOf(step: CardStep): CardStep[] {
  return refCardOf(step)?.steps ?? []
}
function refStepLabel(s: CardStep): string {
  const label = STEP_KIND_LABEL[s.kind] || s.kind
  const detail = s.fun || s.raw || (s.args || []).map((a) => a.value).filter(Boolean).join(', ')
  return detail ? `${label}：${detail}` : label
}
/** 双击 / 点「编辑引用卡片」：进入被引用卡片的编辑页（压栈，返回时恢复） */
function openCardRef(step: CardStep) {
  const idx = form.value.steps.indexOf(step)
  if (!step.cardId) {
    openCardPicker(idx)
    return
  }
  const found = refCardOf(step)
  if (!found) {
    ElMessage.warning('未找到该引用卡片（可能已被删除），请重新选择')
    openCardPicker(idx)
    return
  }
  if (editingChainIds.value.has(found.id)) {
    ElMessage.warning('不能引用自身或形成循环引用')
    return
  }
  editStack.value.push({ form: JSON.parse(JSON.stringify(form.value)), snapshot: loadedSnapshot.value })
  form.value = JSON.parse(JSON.stringify(found))
  markLoaded()
}
/** 真正退栈（不询问）：恢复父级表单与它的「载入基线」 */
function popEditStack() {
  const prev = editStack.value.pop()
  if (!prev) return
  form.value = prev.form
  loadedSnapshot.value = prev.snapshot
}
/**
 * 返回上一层：原来直接退栈，本层未保存的修改会被静默丢弃。
 * 有改动时先询问「保存 / 不保存」；取消（右上角关闭、Esc）则留在当前层。
 */
async function backToParent() {
  if (!editStack.value.length) return
  if (hasChanges()) {
    try {
      await ElMessageBox.confirm('被引用的卡片有未保存的修改，是否保存？', '未保存的修改', {
        confirmButtonText: '保存',
        cancelButtonText: '不保存',
        distinguishCancelAndClose: true,
        type: 'warning',
      })
    } catch (action) {
      // 右上角关闭 / Esc：留在当前层继续编辑
      if (action === 'close') return
      // 选「不保存」：丢弃本层改动并退栈
      popEditStack()
      return
    }
    // 选「保存」：走既有 save()（子编辑态下它会 saveSub 写回库卡片并退栈）
    save()
    return
  }
  popEditStack()
}
/** 关闭弹窗：子编辑态先退栈，只有回到顶层才真正关闭 */
function onVisibleChange(v: boolean) {
  if (v) return
  emit('update:visible', false)
}
/**
 * 关闭前置钩子（点右上角 X / Esc / 遮罩时触发；只有调用 done() 才真正关闭）。
 * 子编辑态：语义是「返回父卡片」而不是关掉整个弹窗 —— 拦截关闭、退栈回到父卡片，
 * 不调用 done()，弹窗保持打开。避免 el-dialog 受控关闭后与父组件 visible 失配
 * （弹窗已关但父组件仍以为在编辑 → 回画布双击卡片打不开）。
 */
function beforeClose(done: () => void) {
  if (isSubEdit.value) {
    backToParent()
    return
  }
  done()
}
/** 「取消 / 返回组合卡片」按钮：与关闭钩子同一套语义 —— 子编辑态返回父卡片，顶层才真正关闭 */
function onCancelClick() {
  if (isSubEdit.value) {
    backToParent()
    return
  }
  emit('update:visible', false)
}

// ===== 卡片引用：参数取值（被引用卡片声明了 params 时显示） =====
const cardLookup = computed(() => buildCardLookup(props.cards))

function cardRefParams(step: CardStep): CardParam[] {
  const ref = step.cardId ? cardLookup.value.get(step.cardId) : undefined
  return ref?.params ?? []
}
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

// ===== 卡片参数（接口）：声明 / 拖拽插入 / 就地提参数 / 取消参数 =====
/** 参数占位符示例（模板里直接写 {{ }} 会被 Vue 当成插值，故用变量渲染） */
const PARAM_HINT = '{{名称}}'
/** 触发参数补全的开头两个字符（同上，用变量渲染） */
const BRACE_HINT = '{{'

const params = computed(() => form.value?.params || [])

// ===== P1-1：局部变量编辑区（与 StepEditor 同规则、同数据结构）=====
const locals = computed(() => form.value?.locals || [])
/** 常用 CAPL 变量类型（与 StepEditor 保持一致） */
const CAPL_TYPES = [
  'int', 'long', 'float', 'double', 'byte', 'word', 'dword', 'qword',
  'char', 'string', 'timer', 'msTimer', 'long Array',
]
/** 当前处于编辑态的变量行索引（双击进入编辑） */
const editingLocalIdx = ref(-1)
function addLocal() {
  if (!form.value) return
  if (!Array.isArray(form.value.locals)) form.value.locals = []
  form.value.locals.push({ name: '', type: 'int', value: '0' })
  editingLocalIdx.value = form.value.locals.length - 1
}
/** 拖拽局部变量到参数框：写入变量名（走既有 text/plain 通道） */
function onLocalDragStart(e: DragEvent, lv: { name: string }) {
  if (!e.dataTransfer || !lv.name) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/plain', lv.name)
  e.dataTransfer.setData('application/x-local-var', lv.name)
}
/** 「默认值 / 显示名」按行展开状态：默认收起，只留「参数名」一个输入框 */
const paramExtraOpen = ref<Record<number, boolean>>({})
function toggleParamExtra(i: number) {
  paramExtraOpen.value[i] = !paramExtraOpen.value[i]
}
function addParam() {
  if (!form.value.params) form.value.params = []
  form.value.params.push({ name: '', label: '', default: '' })
}
function removeParam(i: number) {
  form.value.params?.splice(i, 1)
  paramExtraOpen.value = {}
}

/** 拖拽参数行到参数框：插入 {{参数名}} 占位符（生成时按引用处填的值替换） */
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
    (form.value.params ?? []).map((p) => String(p.name || '').trim()).filter(Boolean),
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
  if (!names.length) return
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

/** 校验并规范化卡片参数：名称必填、仅字母数字下划线、不可重名 */
function normalizeParams(): boolean {
  // 先兜底：保存前把步骤里新出现的 {{X}} 也补成参数声明
  ensureParamsFromSteps()
  const list = form.value.params ?? []
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

function cardTypeLabel(t?: CardType): string {
  if (!t) return '卡片'
  return CARD_TYPE_LABEL[t] || '卡片'
}
function stepKindHint(step: CardStep): string {
  const kind = step.kind
  if (kind === 'set') return '设置：下方参数行填写 对象 + 设置值'
  if (kind === 'check') {
    if (step.waitCmp === 'gt') return '检查：下方参数行填 信号 + 阈值（生成 SignalCheck 开区间：CHK_HIGH_LIMIT 作上限）'
    if (step.waitCmp === 'lt') return '检查：下方参数行填 信号 + 阈值（生成 SignalCheck 开区间：CHK_LOW_LIMIT 作下限）'
    const fun = step.waitNot ? 'SignalCheckNot' : 'SignalCheck'
    return step.waitRange
      ? `检查：下方参数行填写 信号 + 下限 / 上限（生成 ${fun} 区间形式）`
      : `检查：下方参数行填写 信号 + 期望值（生成 ${fun}）`
  }
  if (kind === 'chk_check') {
    const fun = chkCheckFunOf(step)
    if (step.waitKeep) return `背景检测：下方参数行填写 对象（生成 ${fun}，窗口由「时间」控制，值变化即失败）`
    return step.waitRange
      ? `背景检测：下方参数行填写 对象 + 下限 / 上限（生成 ${fun}，窗口由「时间」控制）`
      : `背景检测：下方参数行填写 对象 + 期望值（生成 ${fun}，窗口由「时间」控制）`
  }
  if (kind === 'wait_check') {
    const fun = waitCheckFunOf(step)
    if (step.waitCmp) {
      const dir = step.waitCmp === 'gt' ? '大于' : '小于'
      return `限时检查：已按「${dir}期望值」自动填入信号的下限 / 上限（生成 ${fun} 区间形式），可手动修改`
    }
    return step.waitRange
      ? `限时检查：下方参数行填写 信号 + 下限 / 上限（生成 ${fun} 区间形式）`
      : `限时检查：下方参数行填写 信号 + 期望值（生成 ${fun}）`
  }
  if (kind === 'reset') return '恢复：下方参数行填写 对象'
  if (kind === 'rate') return '斜率请求：下方参数行填写 信号 + 目标值（生成 SetSignalRate）'
  if (kind === 'ramp') return '斜率请求(同步)：下方参数行填写 信号 + 最大值（生成 SetSignalRamp）'
  if (kind === 'tester_prompt') return '弹窗提示：填写提示内容与超时（生成 testWaitForTesterConfirmation）'
  return ''
}
/** 斜率请求（含同步）：需要步骤级「斜率」等数值输入框 */
function isRateKind(kind: CardStep['kind']): boolean {
  return kind === 'rate' || kind === 'ramp'
}
/** 该步骤在头部要填的步骤级数值参数（斜率/周期时间/时间） */
function numFieldsOf(kind: CardStep['kind']): StepNumField[] {
  return stepNumFieldsOf(kind)
}
function setStepNum(step: CardStep, key: StepNumField['key'], v: string) {
  step[key] = v
}
function stepHasArgs(step: CardStep): boolean {
  return step.kind === 'call' || step.kind === 'wait' || step.kind === 'set' || step.kind === 'check' || step.kind === 'wait_check' || step.kind === 'chk_check' || step.kind === 'reset' || isRateKind(step.kind) || step.kind === 'loop_start'
}
// 切换步骤类型时重置结构字段，避免残留旧字段
function onKindChange(step: CardStep, kind: CardStep['kind']) {
  step.kind = kind
  // P1-4：记住用户主动选过的类型，作为下次「添加步骤」的默认
  rememberStepKind(kind)
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
      if (step.fun === undefined) step.fun = ''
      step.args = step.args || []
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'set' || kind === 'check' || kind === 'reset') {
      step.fun = undefined
      step.args = step.args && step.args.length ? step.args : [{ key: '', value: '' }]
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
      step.args = step.args && step.args.length ? step.args : [{ key: '', value: '' }]
      if (step.time === undefined || step.time === '') step.time = '1000'
      if (step.waitNot === undefined) step.waitNot = false
      if (step.waitRange === undefined) step.waitRange = false
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'chk_check') {
      step.fun = undefined
      step.args = step.args && step.args.length ? step.args : [{ key: '', value: '' }]
      if (step.time === undefined || step.time === '') step.time = '1000'
      if (step.waitNot === undefined) step.waitNot = false
      if (step.waitRange === undefined) step.waitRange = false
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'loop_start') {
      step.fun = undefined
      if (!step.loopMode) step.loopMode = 'for'
      if (step.loopMode === 'for') {
        step.args = [
          { key: 'init', value: '' },
          { key: 'count', value: '' },
          { key: 'step', value: '' },
        ]
      } else {
        step.args = [{ key: 'condition', value: '' }]
      }
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
      if (step.fun === undefined) step.fun = ''
      step.cardId = undefined
      step.cardType = undefined
      step.cardName = undefined
    } else if (kind === 'card') {
      step.fun = undefined
      step.args = []
      if (!step.cardId) step.cardId = ''
      if (!step.cardType) step.cardType = 'sequence'
      if (!step.cardName) step.cardName = ''
    }
  }
}

/**
 * P1-4：记忆「上次选的步骤类型」，作为下次「添加步骤」的默认（localStorage 持久化，与 StepEditor 共用同一键）。
 * 初值仍是 call；新步骤的结构初始化与「建好后手动改类型」同源（都走 onKindChange），不新增分支。
 */
const LAST_STEP_KIND_KEY = 'function.lastStepKind'
/** 步骤类型白名单校验：addStep 可能被当事件处理器调用（kind 会是事件对象），localStorage 也可能被写脏 */
function safeStepKind(k: unknown): CardStep['kind'] {
  return typeof k === 'string' && stepKinds.includes(k as CardStep['kind']) ? (k as CardStep['kind']) : 'call'
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
function removeStep(i: number) {
  const step = form.value.steps[i]
  if (!step) return
  // 关键操作确认：删除「引用卡片」步骤会一并丢掉它的参数取值
  if (step.kind === 'card' && step.cardId) {
    ElMessageBox.confirm(
      `确认删除该引用步骤（引用「${step.cardName || step.cardId}」）？其参数取值会一并删除。`,
      '提示',
      { type: 'warning' },
    )
      .then(() => form.value.steps.splice(i, 1))
      .catch(() => {})
    return
  }
  form.value.steps.splice(i, 1)
}
function addArg(i: number) {
  form.value.steps[i].args.push({ key: '', value: '' })
}
function removeArg(i: number, ai: number) {
  form.value.steps[i].args.splice(ai, 1)
}

/** 拖入步骤列表：函数库卡片 → 追加 call 步骤 */
function onStepListDrop(e: DragEvent) {
  const raw = e.dataTransfer?.getData('application/x-mm-func')
  if (!raw) return
  let payload: { name?: string; params?: Array<string | { name?: string; type?: string }> } | null = null
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }
  if (!payload?.name) return
  const step = newStep('call')
  step.fun = payload.name
  const params = Array.isArray(payload.params) ? payload.params : []
  step.args = params.map((p) => ({
    key: typeof p === 'string' ? p : (p.name || p.type || 'arg'),
    value: '',
  }))
  form.value.steps.push(step)
  ElMessage.success(`已从函数库添加步骤：${payload.name}`)
}

/** 拖入参数：对象映射别名 / 对象浏览器对象 → 写入参数行（与 StepEditor 同规则） */
function onArgDrop(e: DragEvent, i: number, ai: number) {
  dragOverArg.value = ''
  const arg = form.value.steps[i].args[ai]
  if (!arg) return
  // 落在行内非字段处（内边距等）时按「值」字段处理
  applyDropToField(e, arg, 'value')
}

/** 映射表分类 → 步骤参数的 argType（与 StepEditor 保持一致） */
const mappingArgType: Record<MappingKind, CardStepArg['argType']> = {
  signal: 'signal',
  dtc: 'dtc',
  message: 'message',
  envvar: 'envvar',
  a2l: 'sysvar',
}

/** 对象浏览器拖入的对象载荷：{ kind, name, argType } */
function extractObjectPayload(e: DragEvent): { kind: MappingKind; name: string; argType: CardStepArg['argType'] } | null {
  const raw = e.dataTransfer?.getData('application/json')
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
  if (p.type === 'a2l-measurement' || p.type === 'a2l-characteristic') {
    // A2L 对象名取拖拽源的 text/plain（已按 CAN 模块的补全规则拼好），与映射表/步骤编辑器同源
    const plain = e.dataTransfer?.getData('text/plain') || ''
    return { kind: 'a2l', name: plain || p.name || '', argType: 'sysvar' }
  }
  return null
}

/** 映射表变量拖入的载荷：{ alias, name, kind } */
function extractMappingPayload(e: DragEvent): { alias: string; name: string; kind: MappingKind } | null {
  const raw = e.dataTransfer?.getData('application/x-mapping')
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (!p || !p.alias) return null
    return { alias: p.alias, name: p.name || p.alias, kind: p.kind || 'signal' }
  } catch {
    return null
  }
}

/**
 * 把拖拽载荷解析成「待写入的文本」：卡片参数占位符 → `{{参数名}}`；映射表变量 → 变量名；
 * 对象浏览器对象 → 对象名（并带上 argType，便于生成时按类型处理）；兜底纯文本。
 */
function extractDrop(e: DragEvent): { text: string; argType?: CardStepArg['argType']; kind?: string } | null {
  // 参数行拖入：插入 {{参数名}} 占位符（生成时按引用处填的值替换）
  const paramName = e.dataTransfer?.getData(CARD_PARAM_MIME)
  if (paramName) return { text: `{{${paramName}}}` }
  const obj = extractObjectPayload(e)
  if (obj?.name) return { text: obj.name, argType: obj.argType, kind: '对象' }
  const mp = extractMappingPayload(e)
  if (mp) return { text: mp.alias, argType: mappingArgType[mp.kind], kind: '映射变量' }
  const plain = e.dataTransfer?.getData('text/plain') || ''
  return plain ? { text: plain } : null
}

/** 把拖拽载荷写进参数行的某个字段（参数名 / 对象 / 上限） */
function applyDropToField(e: DragEvent, arg: CardStepArg, field: 'key' | 'value' | 'value2') {
  const d = extractDrop(e)
  if (!d) return false
  arg[field] = d.text
  if (d.argType) arg.argType = d.argType
  if (d.kind) ElMessage.success(`已填入${d.kind}：${d.text}`)
  return true
}

/** 拖到某个具体字段框（参数名 / 对象 / 上限）上 */
function onArgFieldDrop(e: DragEvent, arg: CardStepArg, field: 'key' | 'value' | 'value2') {
  dragOverArg.value = ''
  applyDropToField(e, arg, field)
}

/** 任意输入框的拖拽填充：卡片名 / 描述 / 函数名 / 提示内容 / 步骤数值 / 参数名与默认值… */
function onFieldDrop(e: DragEvent, set: (v: string) => void) {
  const d = extractDrop(e)
  if (!d) return
  set(d.text)
  ElMessage.success(d.kind ? `已填入${d.kind}：${d.text}` : `已填入：${d.text}`)
}

/**
 * 组合卡片化后解除库卡片绑定：拖入的「纯引用节点」被加/改成多步后，若仍留 refId，
 * 下次「从卡片库同步」会按库卡片整块覆盖步骤，把这里加的组合步骤冲掉。
 * 只在「原本是纯引用节点」时才解除，避免影响主序列等既有引用节点的同步行为。
 */
function normalizeRefBinding() {
  const f = form.value
  const orig = props.card
  if (!f.refId || !orig?.refId) return
  const pure = (c?: Card | null) =>
    !!c && c.steps?.length === 1 && c.steps[0]?.kind === 'card' && c.steps[0]?.cardId === c.refId
  if (!pure(orig) || pure(f)) return
  delete f.refId
  ElMessage.info('已成为组合卡片，已与原库卡片解除引用绑定（不再被库卡片同步覆盖）')
}

/** 保存被引用的库卡片：交给外层写回卡片库（触发所有引用处同步），随后回到组合卡片 */
function saveSub() {
  const card = JSON.parse(JSON.stringify(form.value)) as Card
  emit('save-card', card)
  const prev = editStack.value.pop()
  if (prev) {
    // 父级里指向这张卡片的引用步骤：同步刷新显示名 / 类型（内容由外层同步，预览走 cardLookup）
    for (const s of prev.form.steps) {
      if (s.kind === 'card' && s.cardId === card.id) {
        s.cardName = card.name
        s.cardType = card.type
      }
    }
    form.value = prev.form
    loadedSnapshot.value = prev.snapshot
  }
  ElMessage.success(`引用卡片「${card.name}」已保存，所有引用处将同步更新`)
}

/** 是否有相对「载入时」的未保存修改 */
function hasChanges(): boolean {
  return JSON.stringify(form.value) !== loadedSnapshot.value
}
/**
 * 切换编辑对象前的守卫：有未保存修改就询问「保存 / 不保存」。
 * 返回 true = 可以继续切换（已保存或用户选择丢弃）；false = 保存失败（保持当前编辑）。
 */
async function confirmBeforeSwitch(): Promise<boolean> {
  if (!hasChanges()) return true
  try {
    await ElMessageBox.confirm('当前卡片有未保存的修改，是否保存？', '提示', {
      confirmButtonText: '保存',
      cancelButtonText: '不保存',
      type: 'warning',
      closeOnClickModal: false,
    })
  } catch {
    // 选「不保存」/ 关闭弹窗 → 丢弃当前修改
    return true
  }
  // 子编辑态：先把正在编辑的引用卡片存回去，再回到顶层表单继续保存
  if (isSubEdit.value) {
    saveSub()
    if (!hasChanges()) return true
  }
  return save()
}

defineExpose({ hasChanges, confirmBeforeSwitch })

function save(): boolean {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入卡片名称')
    return false
  }
  if (!form.value.steps.length) {
    ElMessage.warning('卡片至少需要一个步骤')
    return false
  }
  if (!normalizeParams()) return false
  if (isSubEdit.value) {
    saveSub()
    return true
  }
  normalizeRefBinding()
  emit('save', JSON.parse(JSON.stringify(form.value)))
  emit('update:visible', false)
  return true
}
</script>

<style scoped>
.card-ref-params {
  margin-top: 6px;
  padding-left: 26px;
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
.step-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 8px;
}
.step-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.step-hint {
  font-size: 11px;
  color: #909399;
  flex: 1;
}
.step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}
.step-row {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px;
  background: #fafafa;
}
.step-row-head {
  display: flex;
  align-items: center;
  gap: 6px;
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
.card-ref-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
}
.kind-static {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #909399;
  line-height: 24px;
  padding: 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.arg-list {
  margin-top: 6px;
  padding-left: 26px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.arg-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px;
}
.arg-row.arg-drag-over {
  border-color: var(--el-color-primary);
  background: #ecf5ff;
}
/* 参数框 + 字段助手：助手覆盖在输入框右内侧，不占布局空间 */
.arg-field {
  display: flex;
  align-items: center;
  min-width: 0;
  position: relative;
}
.arg-field :deep(.el-input) {
  width: 100%;
}
.arg-field-key {
  width: 110px;
  flex-shrink: 0;
}
.arg-field-value {
  flex: 1;
}
.ce-fun-field {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  position: relative;
}
.ce-fun-field :deep(.el-input) {
  width: 100%;
}
/* 斜率请求 / 限时检查：步骤级数值输入框 */
.ce-rate-field {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.ce-rate-label {
  flex: 0 0 auto;
  font-size: 12px;
  color: #909399;
}
/* 卡片参数（接口）声明区 */
.ce-params {
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafbfc;
}
/* P1-1 局部变量编辑区：与 StepEditor 外观保持一致 */
.ce-locals {
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafbfc;
}
.ce-locals-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ce-locals-head .step-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}
.ce-locals-head .step-hint {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #909399;
}
.ce-locals-list {
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
.ce-params-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ce-step-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
}
.ce-params-tip {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #c0c4cc;
}
.ce-code {
  background: #f5f7fa;
  border-radius: 3px;
  padding: 0 3px;
  color: var(--el-color-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}
.ce-params-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 132px;
  overflow-y: auto;
}
.ce-param-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ce-param-grip {
  color: #c0c4cc;
  cursor: grab;
  font-size: 12px;
  line-height: 1;
  padding: 0 2px;
  user-select: none;
}
/* 参数名即时校验：出错时输入框描红 + 行内 ⚠（与画布上「未连线卡片」的提示方式一致） */
.ce-input-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset;
}
.ce-param-err {
  flex-shrink: 0;
  color: #f56c6c;
  font-weight: 700;
  cursor: help;
}
.ce-param-grip:hover {
  color: var(--el-color-primary);
}
.ce-param-def {
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
.ce-param-lab {
  font-size: 11px;
  color: #c0c4cc;
  white-space: nowrap;
}
.ce-param-spacer {
  flex: 1;
}
/* 字段助手按钮：悬停所在参数行 / 字段时才显形（覆盖在输入框右内侧，不占布局） */
.arg-row:hover :deep(.pfa-btn),
.ce-fun-field:hover :deep(.pfa-btn) {
  opacity: 1;
  pointer-events: auto;
}
.empty-tip {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 16px 0;
}
/* ===== 引用卡片编辑：面包屑 / 步骤排序 / 引用内容预览 / 选择器 ===== */
.ce-crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 0 8px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #ecf5ff;
}
.ce-crumb-path {
  font-size: 12px;
  color: var(--el-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* P2-7 叠层子面板：仅编辑引用卡片时启用双栏，父级卡片信息保持可见 */
.ce-body-stacked {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.ce-main {
  flex: 1 1 auto;
  min-width: 0;
  /* 主表单在左、父级上下文面板在右（DOM 顺序为「先主后附」，靠 order 调换视序） */
  order: 1;
}
.ce-parent {
  flex: 0 0 190px;
  order: 2;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafcff;
  padding: 8px;
}
.ce-parent-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
}
.ce-parent-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #303133;
}
.ce-parent-cur {
  background: rgba(64, 158, 255, 0.12);
  color: var(--el-color-primary);
}
.ce-parent-idx {
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
}
.ce-parent-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ce-parent-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
}
.ce-parent-hint {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
  font-size: 11px;
  line-height: 1.5;
  color: #909399;
}
.step-grip {
  color: #c0c4cc;
  cursor: grab;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}
.step-grip:hover {
  color: var(--el-color-primary);
}
.step-move {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.step-move :deep(.el-button) {
  padding: 2px 3px;
  height: 20px;
  margin-left: 0;
}
.step-row.step-drop-before {
  border-color: var(--el-color-primary);
  box-shadow: 0 -2px 0 0 var(--el-color-primary) inset;
}
.card-ref-name {
  cursor: pointer;
}
.card-ref-name.card-ref-unbound {
  color: #e6a23c;
}
.card-ref-preview {
  margin-top: 6px;
  padding-left: 26px;
}
.crp-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #909399;
}
.crp-count {
  color: #c0c4cc;
}
.crp-list {
  margin-top: 2px;
  padding-left: 4px;
  border-left: 2px solid #ebeef5;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.crp-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: #606266;
}
.crp-idx {
  flex-shrink: 0;
  min-width: 14px;
  text-align: right;
  color: #c0c4cc;
}
.crp-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.crp-empty {
  font-size: 11px;
  color: #e6a23c;
  padding: 2px 0 0 4px;
}
.pk-list {
  margin-top: 8px;
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pk-group {
  font-size: 11px;
  font-weight: 600;
  color: #909399;
  margin: 6px 0 2px;
}
.pk-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #303133;
}
.pk-item:hover {
  background: #ecf5ff;
  color: var(--el-color-primary);
}
.pk-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pk-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
}
.pk-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 16px 0;
}
</style>

<!-- 非 scoped：卡片编辑弹窗改成了非模态，遮罩层必须放行鼠标事件，
     否则「从对象映射表 / 对象浏览器拖对象到参数框」时连拖拽都起不来（鼠标按下被遮罩吃掉）。
     只作用在本弹窗自己的遮罩上（modal-class="ce-modal-pass"），不影响其它弹窗。 -->
<style>
.ce-modal-pass,
.ce-modal-pass .el-overlay-dialog {
  pointer-events: none;
}
.ce-modal-pass .el-dialog {
  pointer-events: auto;
}
</style>
