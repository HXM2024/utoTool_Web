<template>
  <div class="cfc">
    <div class="cfc-toolbar">
      <el-button size="small" type="primary" @click="addFrame">＋ 新建工况</el-button>
      <el-button size="small" :disabled="!undoStack.length" title="撤销（Ctrl+Z）" @click="undoCanvas()">↶ 撤销</el-button>
      <el-button size="small" :disabled="!redoStack.length" title="重做（Ctrl+Y）" @click="redoCanvas()">↷ 重做</el-button>
      <el-popover placement="bottom-start" :width="560" trigger="click" popper-class="cfc-hint-pop">
        <template #reference>
          <button type="button" class="cfc-help" title="画布操作说明" aria-label="画布操作说明">?</button>
        </template>
        <div class="cfc-hint">
          <div class="hint-row"><b>结构</b><span>主序列为主干，其它卡片（含辅序列）可互相串联</span></div>
          <div class="hint-row"><b>选中</b><span>点击卡片/泳道即选中，Shift+点击多选</span></div>
          <div class="hint-row"><b>排列</b><span>卡片在泳道内按顺序排列，拖到两张卡片之间即插到该位置</span></div>
          <div class="hint-row"><b>复制</b><span>Ctrl+C / Ctrl+V；按住 Ctrl 拖拽 = 复制到其它泳道/工况</span></div>
          <div class="hint-row"><b>连线</b><span>按住 Ctrl 点击两个端口/卡片自动连线；单击连线或序号徽标高亮；双击连线删除；双击序号徽标选编号（点选已有编号，Ctrl 多选 / Shift 连选 / 拖拽框选；清空 = 全部，徽标显示 All；也可手填 1,2,5-8）</span></div>
          <div class="hint-row"><b>编辑</b><span>双击节点编辑</span></div>
          <div class="hint-row"><b>撤销</b><span>Ctrl+Z 撤销 / Ctrl+Y 重做</span></div>
          <div class="hint-row"><b>横看</b><span>泳道超出宽度后，把鼠标停在该工况上 Shift+滚轮左右查看</span></div>
        </div>
      </el-popover>
      <span class="cfc-spacer" />
      <el-tag size="small" type="info">{{ frames.length }} 个工况框</el-tag>
    </div>

    <!-- 工况标签：画布一次只挂载一个工况（全量挂载时任何改动都要重跑整块画布的 diff）。
         标签上不显示用例数 —— 那需要把所有工况都展开一遍，正是这次要避开的开销。 -->
    <div v-if="frames.length > 1" class="cfc-frame-tabs">
      <button
        type="button"
        class="cfc-frame-nav"
        :disabled="activeIndex <= 0"
        title="上一个工况"
        @click="stepFrame(-1)"
      >◀</button>
      <div class="cfc-frame-tab-strip">
        <button
          v-for="(f, i) in frames"
          :key="f.id"
          type="button"
          class="cfc-frame-tab"
          :class="{ active: f.id === (visibleFrames[0]?.id || '') }"
          :title="f.name"
          @click="emit('update:active-frame-id', f.id)"
        >{{ i + 1 }}. {{ f.name || `工况${i + 1}` }}</button>
      </div>
      <button
        type="button"
        class="cfc-frame-nav"
        :disabled="activeIndex >= frames.length - 1"
        title="下一个工况"
        @click="stepFrame(1)"
      >▶</button>
      <span class="cfc-frame-pos">{{ activeIndex + 1 }} / {{ frames.length }}</span>
    </div>

    <div
      ref="canvasEl"
      class="cfc-canvas"
      @dragover.prevent="onCanvasDragOverScroll"
      @drop.prevent="onCanvasDrop"
      @wheel="onCanvasWheel"
      @mousedown="onCanvasMouseDown"
      @mousedown.capture="onCanvasMouseDownCapture"
      @click.capture="onCanvasClickCapture"
      @click="onCanvasBlankClick"
    >
      <div v-if="!frames.length" class="cfc-empty">
        <div>画布为空，从左侧卡片库拖入卡片或新建工况</div>
        <el-button type="primary" @click="addFrame">＋ 新建第一个工况</el-button>
      </div>

      <div v-for="f in visibleFrames" :key="f.id" class="frame" :ref="el => setFrameEl(f.id, el)">
        <div class="frame-head" @click="onFrameHeadClick(f.id)">
          <span class="badge">工况 #{{ frameIndex(f) + 1 }}</span>
          <input v-model="f.name" class="frame-name" placeholder="工况名（用例名）" @input="onFrameNameInput" @change="flushFrameName" @blur="flushFrameName" />
          <span class="badge green">展开 {{ caseRows(f).length }} 条用例</span>
          <el-tooltip v-if="diagOf(f).issues.length" placement="top" effect="dark" :show-after="120">
            <template #content>
              <div class="diag-tip">
                <div class="diag-tip-title">连线校验：{{ diagOf(f).issues.length }} 处需修正</div>
                <div v-for="(it, ii) in diagOf(f).issues" :key="ii" class="diag-tip-row">
                  · {{ it.label }}：{{ it.reason }}
                </div>
              </div>
            </template>
            <span class="badge warn">⚠ {{ diagOf(f).issues.length }} 处待修正</span>
          </el-tooltip>
          <div class="frame-actions">
            <button class="icon-btn" title="复制工况" @click="copyFrame(f.id)">⧉</button>
            <button class="icon-btn danger" title="删除工况" @click="removeFrame(f.id)">✕</button>
          </div>
        </div>

        <div class="frame-body" :class="{ 'single-lane': f.lanes.length === 1 }" :ref="el => setBodyEl(f.id, el)">
          <!-- 连线分两层：命中层在卡片下面（只负责点击/双击），可见层在卡片上面（连线压过卡片时也看得见）。
               合成一层做不到：SVG 描边是 pointer-events: stroke 的可点区域，抬到卡片上面就会吃掉卡片的按下与拖拽。 -->
          <svg class="edge-svg edge-hit" :class="{ 'svg-dragging': dragging }">
            <path
              v-for="p in edgePaths(f.id)"
              :key="p.key"
              :d="p.d"
              class="hit"
              @click.stop="p.explicit && toggleEdgeSel(p.edgeId, $event.ctrlKey || $event.metaKey || $event.shiftKey)"
              @dblclick.stop="p.explicit && removeEdge(f.id, p.edgeId)"
            />
          </svg>

          <div
            v-for="p in edgePaths(f.id)"
            :key="'l' + p.key"
            class="edge-label"
            :style="{ left: p.mid.x + 'px', top: p.mid.y + 'px' }"
          >
            <el-popover
              v-if="p.editable && (!p.badgeOnSelect || selectedEdgeIds.includes(p.edgeId))"
              :visible="editingEdgeId === p.edgeId"
              placement="bottom-start"
              :width="272"
              popper-class="cfc-num-pop"
              :teleported="true"
              :persistent="false"
            >
              <template #reference>
                <span
                  class="label-badge"
                  :class="{ 'badge-selected': isEdgeHighlighted(p, f.id), 'badge-editing': editingEdgeId === p.edgeId }"
                  title="单击高亮该连线 · Ctrl/Shift+单击多选 · 双击选编号 · 高亮时右击预览该编号用例代码"
                  @mousedown.stop.prevent
                  @click.stop="p.explicit && toggleEdgeSel(p.edgeId, $event.ctrlKey || $event.metaKey || $event.shiftKey)"
                  @dblclick.stop="editEdge(f.id, p.edgeId)"
                  @contextmenu.stop.prevent="onBadgeContextMenu(f, p)"
                >{{ p.label }}</span>
              </template>

              <!-- 编号选择器：候选编号 = 本工况在用的编号 ∪ 本条线已填的号 -->
              <div class="num-pop">
                <div class="num-pop-head">
                  <span class="num-pop-title">编号</span>
                  <span class="num-pop-kind">{{ edgeKindText(f.id, p.edgeId) }}</span>
                  <span class="num-pop-cur">当前 {{ numsDisplayText(p.nums, frameCaseNums[f.id] || []) }}</span>
                  <span class="num-pop-cur">选择 {{ draftNums.length ? numsDisplayText(draftNums, frameCaseNums[f.id] || []) : '自动' }}</span>
                </div>
                <div
                  class="num-grid"
                  @mousedown="onNumGridMouseDown"
                  @click.capture="onNumGridClickCapture"
                >
                  <button
                    v-for="n in numCandidates(f.id, p.edgeId)"
                    :key="n"
                    type="button"
                    class="num-chip"
                    :class="{ active: selectedNumSet.has(n) }"
                    :data-n="n"
                    @click="onChipClick(n, $event)"
                  >{{ n }}</button>
                  <span v-if="!numCandidates(f.id, p.edgeId).length" class="num-empty">
                    本工况还没有编号：先在注入线上填一个，或用下方手填
                  </span>
                  <div v-if="numMarquee" class="num-marquee" :style="numMarqueeStyle" />
                </div>
                <div class="num-pop-hint">
                  {{ selectedNumSet.size ? '点选 / Ctrl 多选 / Shift 连选 / 拖拽框选' : '未选编号 = 自动排号 / 继承（要全部请点「清空」）' }}
                </div>
                <input
                  v-model="editingEdgeValue"
                  class="edge-input"
                  :style="{ width: edgeInputWidth }"
                  placeholder="如 1,2,5-8"
                  @keydown.enter.stop.prevent="saveEdgeInline"
                  @keydown.esc.stop.prevent="cancelEdgeEdit"
                  @mousedown.stop
                  @click.stop
                />
                <div class="num-pop-foot">
                  <el-button size="small" type="primary" @click="saveEdgeInline">确定</el-button>
                  <el-button size="small" title="选中该工况全部编号（徽标显示 All）" @click="clearEdgeNums">清空</el-button>
                  <el-button size="small" @click="cancelEdgeEdit">取消</el-button>
                </div>
              </div>
            </el-popover>
          </div>

          <!-- 泳道（分栏），从左到右；拖拽卡片时才显示两侧停靠区 -->
          <template v-for="(lane, li) in f.lanes" :key="lane.id">
            <div v-if="dragging" class="gap-anchor">
              <div
                class="gap-zone"
                :class="{ 'drop-hover': dropHover.frameId === f.id && dropHover.zone === 'gap-' + li }"
                @dragover.prevent="onZoneOver(f.id, 'gap-' + li)"
                @dragleave="onZoneLeave"
                @drop.prevent.stop="onGapDrop(f.id, li, $event)"
              >
                <span class="gz-tip">＋</span>
              </div>
            </div>

            <div
              class="lane"
              :class="[
                'lane-' + lane.type,
                {
                  'drop-hover': dropHover.frameId === f.id && dropHover.zone === lane.id,
                  'lane-drop-before': laneDrop.frameId === f.id && laneDrop.laneId === lane.id && laneDrop.pos === 'before',
                  'lane-drop-after': laneDrop.frameId === f.id && laneDrop.laneId === lane.id && laneDrop.pos === 'after',
                  'lane-selected': isLaneSelected(lane.id),
                },
              ]"
              :style="laneStyle(lane)"
              @dragover.prevent="onZoneOver(f.id, lane.id, $event)"
              @dragleave="onZoneLeave"
              @drop.prevent.stop="onZoneDrop(f.id, lane.id, $event)"
            >
            <div
              class="lane-head"
              draggable="true"
              @dragstart.stop="onLaneDragStart($event, f.id, lane.id)"
              @dragend="onLaneDragEnd"
              @click.stop="onLaneHeadClick($event, f.id, lane.id)"
            >
              <span class="lane-grip" title="拖动排序泳道">⣿</span>
              <span class="lt">{{ laneLabel(lane, li) }}</span>
              <span class="lr">{{ lane.type === 'main' ? (lane.nodeIds.length ? '1 个' : '0 个') : lane.nodeIds.length + ' 个' }}</span>
              <span class="mini" title="左移泳道" @click.stop="moveLane(f.id, lane.id, -1)">←</span>
              <span class="mini" title="右移泳道" @click.stop="moveLane(f.id, lane.id, 1)">→</span>
              <span v-if="lane.type !== 'main'" class="mini" title="删除泳道" @click.stop="removeLane(f.id, lane.id)">✕</span>
            </div>

            <div class="lane-body">
              <!-- 主序列泳道：主干，按步骤保留多个接线口 -->
              <template v-if="lane.type === 'main'">
                <div v-if="lane.nodeIds.length && f.nodes[lane.nodeIds[0]]" class="seq-card" @click="onSeqCardClick($event, f.id, lane.nodeIds[0])" @dblclick.stop="openEditor(f.id, lane.nodeIds[0])">
                  <div class="seq-card-head">
                    <span class="sn">⧉<span v-if="f.nodes[lane.nodeIds[0]].refId" class="ref-mark" title="来自卡片库引用">⛓</span> {{ f.nodes[lane.nodeIds[0]].name }}</span>
                    <span class="sc">{{ f.nodes[lane.nodeIds[0]].steps.length }} 步</span>
                    <button class="icon-btn" title="编辑序列" @click.stop="openEditor(f.id, lane.nodeIds[0])">✎</button>
                    <button class="icon-btn danger" title="移除序列" @click.stop="removeNode(f.id, lane.id, lane.nodeIds[0])">✕</button>
                  </div>
                  <div class="seq-card-body">
                    <template v-for="row in sequenceRowsOf(f)" :key="row.key">
                      <div v-if="row.kind === 'slot'" class="seq-slot">
                        <div
                          v-if="row.showIn"
                          class="port port-in"
                          :ref="el => setPortEl(f.id, row.inKey, 'in', el)"
                          @mousedown.stop="onPortMousedown($event, f.id, row.inKey, 'in')"
                          @click.stop="onPortClick(f.id, row.inKey, 'in', $event)"
                        />
                        <div
                          v-if="row.showOut"
                          class="port port-out"
                          :class="{ 'port-selected': isPortSelected(f.id, row.outKey) }"
                          :ref="el => setPortEl(f.id, row.outKey, 'out', el)"
                          @mousedown.stop="onPortMousedown($event, f.id, row.outKey, 'out')"
                          @click.stop="onPortClick(f.id, row.outKey, 'out', $event)"
                        />
                      </div>
                      <div v-else class="seq-step">
                        <div class="step-name">{{ row.label }}</div>
                        <div class="step-sub">{{ stepKindLabel(row.step) }}</div>
                      </div>
                    </template>
                  </div>
                </div>
                <div v-else class="empty-drop-hint">拖入一张序列卡片</div>
              </template>

              <!-- 其它泳道：普通卡片（含辅序列），左右各一个接线口 -->
              <template v-else>
                <div
                  v-for="nid in lane.nodeIds"
                  :key="nid"
                  class="node"
                  :data-nid="nid"
                  :class="[
                    cardCategoryClass(f.nodes[nid]),
                    {
                      'node-invalid': diagOf(f).invalidNodeIds.has(nid),
                      'node-drop-before': isNodeDropBefore(f.id, lane.id, nid),
                      'node-drop-after': isNodeDropAfter(f.id, lane.id, nid),
                      'node-dragging': isDraggingNode(nid),
                      'node-selected': isNodeSelected(nid),
                    },
                  ]"
                  draggable="true"
                  @dragstart="onNodeDragStart($event, f.id, lane.id, nid)"
                  @dragend="onDragEnd"
                  @dragover.prevent="onNodeOver($event, f.id, lane.id, nid)"
                  @drop.stop.prevent="onCardDrop(f.id, lane.id, nid, $event)"
                  @dblclick.stop="openEditor(f.id, nid)"
                  @click.stop="onCardClick($event, f.id, lane.id, nid)"
                  @click.ctrl.stop="onCardCtrlClick(f.id, nid)"
                >
                  <span class="node-grip" title="按住卡片任意位置即可拖动（同泳道内拖到两张卡片之间可调整顺序 / 拖到其它泳道，拖出工况框即删除）">⣿</span>
                  <span class="node-del" title="删除卡片（也可拖出工况删除）" @mousedown.stop @click.stop="removeNode(f.id, lane.id, nid)">✕</span>
                  <div class="node-name">
                    <span v-if="diagOf(f).invalidNodeIds.has(nid)" class="warn-mark" :title="diagReasonOf(f, nid)">⚠</span>
                    <span v-if="f.nodes[nid].type === 'sequence'" class="aux-mark" title="辅序列">⧉</span>
                    <span v-if="f.nodes[nid].refId" class="ref-mark" title="来自卡片库引用">⛓</span>
                    {{ f.nodes[nid].name }}
                  </div>
                  <div class="node-sub">{{ summarizeOf(f, nid) }}</div>
                  <div
                    class="port port-in"
                    :ref="el => setPortEl(f.id, 'node:' + nid, 'in', el)"
                    @mousedown.stop="onPortMousedown($event, f.id, 'node:' + nid, 'in')"
                    @click.stop="onPortClick(f.id, 'node:' + nid, 'in', $event)"
                  />
                  <div
                    class="port port-out"
                    :class="{ 'port-selected': isPortSelected(f.id, 'node:' + nid) }"
                    :ref="el => setPortEl(f.id, 'node:' + nid, 'out', el)"
                    @mousedown.stop="onPortMousedown($event, f.id, 'node:' + nid, 'out')"
                    @click.stop="onPortClick(f.id, 'node:' + nid, 'out', $event)"
                  />
                </div>
                <div v-if="!lane.nodeIds.length" class="empty-drop-hint">拖入卡片（注入/检查/恢复/辅序列）</div>
              </template>
            </div>

            <div
              class="lane-resizer"
              title="拖动调节泳道宽度（双击恢复自适应）"
              @mousedown.stop.prevent="onLaneResizeStart($event, f.id, lane)"
              @dblclick.stop.prevent="resetLaneWidth(f.id, lane.id)"
            />
          </div>
          </template>

          <div v-if="dragging" class="gap-anchor">
            <div
              class="gap-zone"
              :class="{ 'drop-hover': dropHover.frameId === f.id && dropHover.zone === 'gap-' + f.lanes.length }"
              @dragover.prevent="onZoneOver(f.id, 'gap-' + f.lanes.length)"
              @dragleave="onZoneLeave"
              @drop.prevent.stop="onGapDrop(f.id, f.lanes.length, $event)"
            >
              <span class="gz-tip">＋</span>
            </div>
          </div>

          <!-- 可见层：压在卡片上面，pointer-events: none —— 点击仍然落到下面的命中层 -->
          <svg class="edge-svg edge-top">
            <path
              v-for="p in edgePaths(f.id)"
              :key="p.key"
              :d="p.d"
              class="line"
              :class="{ 'edge-selected': isEdgeHighlighted(p, f.id) }"
            />
            <path v-if="tempLine.frameId === f.id" :d="tempLine.d" class="temp" />
          </svg>
        </div>

        <div class="frame-foot">
          <div v-if="danglingOf(f).length" class="foot-warn">
            <div class="foot-warn-title">
              ⚠ 悬空连线 {{ danglingOf(f).length }} 条（端点卡片已删除，画布上不绘制、也不参与用例生成）：
            </div>
            <div v-for="it in danglingOf(f)" :key="it.edgeId" class="foot-warn-item">
              <span class="fw-label">{{ it.label }}</span>
              <span class="fw-reason">{{ it.reason }}</span>
              <button class="icon-btn danger" title="删除这条悬空连线" @click="removeEdge(f.id, it.edgeId || '')">✕</button>
            </div>
          </div>
          <div class="f-title">本工况展开为 {{ caseRows(f).length }} 条用例：</div>
          <div
            v-for="(row, ri) in caseRows(f)"
            :key="ri"
            class="case-row"
            :class="{ 'case-row-hl': isCaseRowHighlighted(f, ri) }"
          >
            <input
              v-if="editingCaseName.frameId === f.id && editingCaseName.row === ri"
              v-model="editingCaseName.value"
              class="case-name-input"
              :style="{ width: caseNameInputWidth }"
              @keydown.enter.stop.prevent="saveCaseName"
              @keydown.esc.stop.prevent="cancelCaseNameEdit"
              @blur="saveCaseName"
              @mousedown.stop
              @click.stop
            />
            <span
              v-else
              class="seq"
              :class="{ 'seq-custom': !!(f.caseNames && f.caseNames[ri]) }"
              title="双击编辑用例名（即生成用例的函数名与 XML title） · 右击预览该用例代码"
              @dblclick.stop="startCaseNameEdit(f, ri)"
              @contextmenu.stop.prevent="openCasePreview(f, ri)"
            >{{ caseNameOf(f, ri) }}</span>
            <span style="margin:0 6px">·</span>
            <span class="chain">
              {{ row.chain }}
              <span v-if="row.labels.length" class="variant">（{{ row.labels.join('，') }}）</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 框选矩形（视口坐标，固定定位，不随画布滚动偏移） -->
    <div v-if="marquee" class="cfc-marquee" :style="marqueeStyle" />

    <CardEditor
      :visible="editorVisible"
      :card="editingCard"
      :cards="cardLibrary"
      @update:visible="editorVisible = $event"
      @save="saveEditor"
      @save-card="emit('save-card', $event)"
    />

    <!-- 用例代码预览：右击「用例展开」里的用例 ID，或高亮态下右击编号徽标 -->
    <el-dialog
      v-model="casePreview.visible"
      title="用例代码预览"
      width="720px"
      class="cfc-case-preview"
      append-to-body
      destroy-on-close
    >
      <div class="cp-head">
        <span class="cp-label">用例</span>
        <div class="cp-tabs">
          <button
            v-for="cid in casePreview.caseIds"
            :key="cid"
            type="button"
            class="cp-tab"
            :class="{ active: cid === casePreview.active }"
            @click="loadPreviewCode(cid)"
          >{{ cid }}</button>
        </div>
      </div>
      <div v-if="casePreview.loading" class="cp-hint">正在展开用例代码…</div>
      <div v-else-if="casePreview.error" class="cp-hint cp-error">{{ casePreview.error }}</div>
      <div v-else class="cp-code">
        <pre class="cp-pre"><code v-html="highlightedPreviewCode" class="hljs"></code></pre>
      </div>
      <template #footer>
        <el-button size="small" @click="casePreview.visible = false">关闭</el-button>
        <el-button size="small" type="primary" :disabled="!casePreview.code" @click="copyCaseCode">复制代码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch, toRaw } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type {
  Card,
  CardLibrary,
  CardType,
  CaseFrame,
  FrameEdge,
  FrameLane,
  FrameLaneType,
  Graph,
  ValueResource,
} from '@/types/functionGraph'
import { genId, FUNC_CARD_MIME } from '@/types/functionGraph'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'
import {
  isNodeKey,
  isCardKey,
  cardKeyNodeId,
  parseSeqPortKey,
  seqPortKey,
  resolveFrameNumbers,
  frameEdgeKey,
  frameLanes,
  frameSequenceId,
  reanchorFrameSeqPorts,
  frameCaseRowsWithLookups,
  frameDiagnostics,
  buildCardLookup,
  buildValueLookup,
  paramDisplayText,
  nodeParamValues,
  FRAME_LANE_LABEL,
} from '@/utils/functionGraph'
import type { FrameCaseRow, FrameDiagnostics, FrameIssue } from '@/utils/functionGraph'
import CardEditor from './CardEditor.vue'
import hljs from 'highlight.js/lib/core'
import cLang from 'highlight.js/lib/languages/c'
import 'highlight.js/styles/atom-one-dark.css'

// 用例代码预览的语法高亮（与「用例预览」用同一套 highlight.js 主题）
hljs.registerLanguage('c', cLang)

const props = defineProps<{
  graph: Graph
  selectedFrameId?: string
  /** 当前展示的工况 id：画布一次只挂载这一个工况（见下方 visibleFrames） */
  activeFrameId?: string
  cardLibrary?: CardLibrary
  valueLibrary?: ValueResource[]
  /** 工况 id → 该工况各行用例的自动生成 case_id（行序与 caseRows 一致），用作用例名默认值 */
  frameCaseIds?: Record<string, string[]>
  /** 用例展开结果：外层编辑器已算好时直接复用，避免同一份展开两边各算一遍 */
  caseRowsMap?: Record<string, FrameCaseRow[]>
  /** 按需取某条用例的 CAPL 代码（右击用例 ID / 编号徽标的代码预览用） */
  loadCaseCode?: (caseId: string) => Promise<string>
}>()
const emit = defineEmits<{
  (e: 'update:graph', graph: Graph): void
  /** 切换画布展示的工况（顶部工况标签 / 上下切换） */
  (e: 'update:active-frame-id', frameId: string): void
  /** 点击工况里的卡片：通知外层让左侧卡片列表聚焦到它引用的库卡片 */
  (e: 'select-card', payload: { cardId: string; type: CardType }): void
  /** 点击工况框（框头 / 泳道）：通知外层让左侧工况列表聚焦到该工况 */
  (e: 'select-frame', frameId: string): void
  /** 卡片编辑框里保存了「被引用的库卡片」：交由外层写回卡片库并同步所有引用处 */
  (e: 'save-card', card: Card): void
}>()

// 旧端口键 inj:/rec:/res: → node:（保证连线渲染与展开一致）
function normalizePortKey(key: string): string {
  if (key.startsWith('node:') || key.startsWith('seq:')) return key
  if (key.startsWith('inj:') || key.startsWith('rec:') || key.startsWith('res:')) return 'node:' + key.slice(4)
  return key
}

// 兼容历史数据：injects/recovers/sequenceId/results 或四类 lanes → main/other lanes；并确保默认存在主序列泳道
function normalizeFrame(f: CaseFrame): CaseFrame {
  let lanes = frameLanes(f).map((l) => ({
    ...l,
    id: l.id.startsWith('legacy-') ? genId('lane') : l.id,
  }))
  if (!lanes.some((l) => l.type === 'main')) {
    lanes = [{ id: genId('lane'), type: 'main', nodeIds: [] }, ...lanes]
  }
  const edges: Record<string, FrameEdge> = {}
  for (const [id, e] of Object.entries(f.edges || {})) {
    // 历史数据可能缺 id（只用对象键当 id）：补回来，否则选中/双击删除会失效
    edges[id] = { ...e, id: e.id || id, from: normalizePortKey(e.from), to: normalizePortKey(e.to) }
  }
  return {
    id: f.id,
    name: f.name,
    lanes,
    nodes: f.nodes || {},
    edges,
    // 用例名覆盖：必须带上，否则画布 emit 回传时会被丢掉
    ...(Array.isArray(f.caseNames) ? { caseNames: f.caseNames } : {}),
  }
}
function normalizeFrames(list: CaseFrame[]): CaseFrame[] {
  return list.map(normalizeFrame)
}

const frames = ref<CaseFrame[]>(
  props.graph.frames ? normalizeFrames(JSON.parse(JSON.stringify(props.graph.frames))) : [],
)
// 最近一次 emit 出去的 frames：引用相等即「自己回传」，直接跳过（省掉整段序列化比对）
let lastEmittedFrames: CaseFrame[] | null = null
watch(
  () => props.graph.frames,
  (v) => {
    // 自己 emit 回传的同一对象（引用相等，O(1) 判据）：直接跳过，省掉下面整段序列化
    if (toRaw(v) === lastEmittedFrames) return
    // 其余情况与「画布当前内容」比对，一致才跳过。
    // 这里不能改成与 lastEmittedRef（最近一次 emit 出去的内容）比对：切换分组时外层会把
    // 之前 emit 过的同一份 frames 重新赋回来，而画布此刻显示的是另一个分组的内容，
    // 序列化恰好相等就会把这次切换误判成「自己回传」而跳过，表现为切换分组后画布空白 / 连线不重绘。
    const ser = JSON.stringify(v ?? [])
    if (ser === JSON.stringify(toRaw(frames.value))) return
    frames.value = v ? normalizeFrames(JSON.parse(JSON.stringify(v))) : []
    // 外部整体替换 frames（加载配置/切换分组/迁移补全）：历史记录作废，避免撤销回放出别的配置的内容
    resetHistory()
    // 外部整体替换 frames 后需重算连线，否则端口 DOM 已就绪但连线不会重绘
    scheduleRecompute()
  },
)

/**
 * 画布一次只挂载一个工况。
 * 原来 9 个工况 / 642 张卡片全在同一个组件里，任何改动都要把整块画布（约 9200 个 DOM 节点）
 * 重新 diff 一遍 —— 实测「改 2 张卡的工况」与「改 8 张卡的工况」耗时一样（254ms / 193ms），
 * 与改了哪个工况无关。只渲染当前工况后，渲染与连线重算都只按这一份来做。
 */
const EMPTY_FRAMES: CaseFrame[] = []
const visibleFrames = computed<CaseFrame[]>(() => {
  const list = frames.value
  if (!list.length) return EMPTY_FRAMES
  const target = list.find((f) => f.id === props.activeFrameId) || list[0]
  return [target]
})
/** 当前展示工况在全部工况里的下标（用于「N / M」与上一个/下一个） */
const activeIndex = computed(() =>
  Math.max(0, frames.value.findIndex((f) => f.id === (visibleFrames.value[0]?.id || ''))),
)
/** 工况在全部工况里的真实序号（画布只渲染一个，不能再用 v-for 的下标） */
function frameIndex(f: CaseFrame): number {
  return frames.value.findIndex((x) => x.id === f.id)
}
/** 上一个 / 下一个工况 */
function stepFrame(delta: number) {
  const next = frames.value[activeIndex.value + delta]
  if (next) emit('update:active-frame-id', next.id)
}

/* 切换展示的工况时清空画布选中：复制工况后卡片 id 与原件重名，
   留着旧选中会让 Delete / 拖拽作用到新工况里的同名卡片上。 */
watch(
  () => props.activeFrameId,
  () => clearSelection(),
)

// ===== 撤销 / 重做（快照式：以整份 frames 为粒度，覆盖拖拽、增删、粘贴等所有画布改动）=====
const UNDO_LIMIT = 60
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
/** 最近一次已提交（已 emit）的 frames 快照，用来记录「改动前」的状态 */
let lastFramesSnapshot = ''
function resetHistory() {
  undoStack.value = []
  redoStack.value = []
  lastFramesSnapshot = JSON.stringify(toRaw(frames.value))
}
resetHistory()
/** 工况名逐字符输入的防抖计时器（见 onFrameNameInput） */
let frameNameTimer: ReturnType<typeof setTimeout> | null = null
function emitChange(opts: { history?: boolean } = {}) {
  // 其它回写已经带上当前状态（含刚输入的新工况名），挂起的那次防抖回写就多余了
  if (frameNameTimer) {
    clearTimeout(frameNameTimer)
    frameNameTimer = null
  }
  // 只序列化一次：先拿到快照文本，再从它解析出要回传的副本
  // （原来 stringify(深拷贝) + stringify(next) 要跑两遍，逐字符输入时开销翻倍）
  // 用 toRaw 取原始对象再序列化：对深层响应式代理做 JSON.stringify 会给每个属性访问
  // 加一层 Proxy 取值 + reactive 缓存查找，650 节点 / 442 连线的工况下这一项就要几十毫秒。
  const ser = JSON.stringify(toRaw(frames.value))
  const next = JSON.parse(ser)
  const prev = lastFramesSnapshot
  lastFramesSnapshot = ser
  lastEmittedFrames = next
  // 记录「改动前」的一份快照，供 Ctrl+Z 回放（默认记录；工况名输入等逐字符改动可关闭）
  if (opts.history !== false && prev && prev !== ser) {
    undoStack.value.push(prev)
    if (undoStack.value.length > UNDO_LIMIT) undoStack.value.shift()
    redoStack.value = []
  }
  emit('update:graph', { ...props.graph, frames: next })
}
/** 工况名逐字符输入：v-model 已经改了本地 f.name，回写（整图深拷贝两次 + 一次全量用例展开）
 *  防抖 300ms 再跑。失焦 / 回车立即补一次，避免「改完名字直接点保存」把新名字丢掉。 */
function onFrameNameInput() {
  if (frameNameTimer) clearTimeout(frameNameTimer)
  frameNameTimer = setTimeout(() => {
    frameNameTimer = null
    emitChange({ history: false })
  }, 300)
}
function flushFrameName() {
  if (!frameNameTimer) return
  clearTimeout(frameNameTimer)
  frameNameTimer = null
  emitChange({ history: false })
}
/** 把画布恢复到某份快照（撤销/重做共用） */
function applyFramesSnapshot(ser: string) {
  frames.value = normalizeFrames(JSON.parse(ser))
  const cur = JSON.stringify(toRaw(frames.value))
  lastFramesSnapshot = cur
  const emitted = JSON.parse(cur)
  lastEmittedFrames = emitted
  emit('update:graph', { ...props.graph, frames: emitted })
  clearSelection()
  scheduleRecompute()
}
function undoCanvas(): boolean {
  const prev = undoStack.value.pop()
  if (!prev) return false
  redoStack.value.push(lastFramesSnapshot || JSON.stringify(frames.value))
  applyFramesSnapshot(prev)
  ElMessage.success('已撤销')
  return true
}
function redoCanvas(): boolean {
  const next = redoStack.value.pop()
  if (!next) return false
  undoStack.value.push(lastFramesSnapshot || JSON.stringify(frames.value))
  applyFramesSnapshot(next)
  ElMessage.success('已重做')
  return true
}

const dropHover = reactive<{ frameId: string; zone: string }>({ frameId: '', zone: '' })
const tempLine = ref<{ frameId: string; d: string }>({ frameId: '', d: '' })
const linkDrag = ref<{ frameId: string; fromKey: string } | null>(null)
// 点击连线：第一次点输出端口记录起点，第二次点输入端口完成连线
const clickLinkFrom = ref<{ frameId: string; fromKey: string } | null>(null)

interface DragPayload {
  source: 'library' | 'node'
  frameId?: string
  laneId?: string
  nodeId?: string
  /** 本次拖拽要一起搬运的节点 id 集合（多选拖动时为整批；未多选时只有被拖的那张） */
  nodeIds?: string[]
  /** 按住 Ctrl 拖拽 = 复制（原件保留，落点处克隆一份） */
  copy?: boolean
  /** 复制拖拽携带的快照（选中多张时是整批） */
  clip?: CanvasClip | null
}
const dragPayload = ref<DragPayload | null>(null)
// 泳道拖动排序状态（Ctrl 拖拽 = 复制泳道）
const laneDrag = ref<{ frameId: string; laneId: string; copy?: boolean; clip?: CanvasClip | null } | null>(null)
const laneDrop = reactive<{ frameId: string; laneId: string; pos: 'before' | 'after' }>({
  frameId: '',
  laneId: '',
  pos: 'after',
})
// 卡片落点（泳道内互相拖拽排序 / 跨泳道移动）：记录目标卡片与插入方向，用于显示停靠指示线
const nodeDrop = reactive<{
  frameId: string
  laneId: string
  nodeId: string
  pos: 'before' | 'after'
}>({ frameId: '', laneId: '', nodeId: '', pos: 'after' })
function clearNodeDrop() {
  nodeDrop.frameId = ''
  nodeDrop.laneId = ''
  nodeDrop.nodeId = ''
}
function isNodeDropBefore(frameId: string, laneId: string, nodeId: string): boolean {
  return nodeDrop.frameId === frameId && nodeDrop.laneId === laneId && nodeDrop.nodeId === nodeId && nodeDrop.pos === 'before'
}
function isNodeDropAfter(frameId: string, laneId: string, nodeId: string): boolean {
  return nodeDrop.frameId === frameId && nodeDrop.laneId === laneId && nodeDrop.nodeId === nodeId && nodeDrop.pos === 'after'
}
// 是否正在拖拽卡片（库卡片或画布内卡片）——用于按需显示泳道间的停靠区
const dragging = ref(false)
function onWindowDragStart(e: DragEvent) {
  const types = e.dataTransfer?.types
  const list = types ? Array.from(types) : []
  if (
    list.includes('application/x-graph-card') ||
    list.includes('application/x-graph-cards') ||
    list.includes(FUNC_CARD_MIME) ||
    dragPayload.value
  ) {
    dragging.value = true
  }
}
function onWindowDragEnd() {
  dragging.value = false
  clearNodeDrop()
  stopAutoScroll()
}

// ===== 选中 / 复制粘贴 / Ctrl 拖拽复制 =====
// 选中态：卡片按 nodeId、泳道按 laneId（都可多选）
const selNodes = ref<string[]>([])
const selLanes = ref<string[]>([])
// 连线选中态：单击高亮（再点一次取消，Ctrl/Shift+单击追加），双击删除；框选可一次选多条
const selectedEdgeIds = ref<string[]>([])
/** 是否把高亮扩展到「同工况同编号」的连线：
 *  只有**单击**（非追加，含点编号徽标）选中一条连线时才展开 —— 用来一眼看清这条用例的整条链路；
 *  Ctrl/Shift 追加多选、框选时都只高亮选中的那些。批量改接的目标集合共用这个规则（所见即所改）。 */
const highlightSameNum = ref(false)
function isNodeSelected(id: string) {
  return selNodes.value.includes(id)
}
function isLaneSelected(id: string) {
  return selLanes.value.includes(id)
}
function clearSelection() {
  selNodes.value = []
  selLanes.value = []
  selectedEdgeIds.value = []
  highlightSameNum.value = false
}
function selectNodeOnly(id: string) {
  selLanes.value = []
  selNodes.value = [id]
  selectedEdgeIds.value = []
}
function toggleNodeSel(id: string) {
  selNodes.value = isNodeSelected(id) ? selNodes.value.filter((x) => x !== id) : [...selNodes.value, id]
}
function selectLaneOnly(id: string) {
  selNodes.value = []
  selLanes.value = [id]
  selectedEdgeIds.value = []
}
function toggleLaneSel(id: string) {
  selLanes.value = isLaneSelected(id) ? selLanes.value.filter((x) => x !== id) : [...selLanes.value, id]
}
/** 本次拖拽要一起搬运的节点 id：被拖的卡片在选中集合里（且多选）时带上整批，否则只有它自己 */
function dragNodeIdsOf(payload: DragPayload | null): string[] {
  if (!payload?.nodeId) return []
  const ids = payload.nodeIds && payload.nodeIds.length ? payload.nodeIds : [payload.nodeId]
  return [...new Set(ids)]
}
/** 跨工况按 id 找节点（多选拖动时选中项可能分散在不同工况） */
function findFrameNodeById(id: string): Card | undefined {
  for (const f of frames.value) {
    const n = f.nodes[id]
    if (n) return n
  }
  return undefined
}
/** 该卡片是否属于「本次正在拖拽的整批」（用于整批高亮拖拽态） */
function isDraggingNode(nid: string): boolean {
  const p = dragPayload.value
  if (p?.source !== 'node') return false
  return p.nodeIds && p.nodeIds.length ? p.nodeIds.includes(nid) : p.nodeId === nid
}
// 复制/粘贴的落点泳道：最近点击或划过的泳道
const lastLane = ref<{ frameId: string; laneId: string } | null>(null)
function markLastLane(frameId: string, laneId: string) {
  lastLane.value = { frameId, laneId }
}
/** 让左侧卡片列表聚焦到该节点引用的库卡片。
 *  只有「引用式」卡片（refId 指向卡片库）才有对应条目，独立副本没有，不发事件。 */
function emitCardFocus(frameId: string, nodeId: string) {
  const node = frames.value.find((x) => x.id === frameId)?.nodes[nodeId]
  if (node?.refId) emit('select-card', { cardId: node.refId, type: node.type })
}
// 点工况框头：清画布选中，并让左侧工况列表聚焦到该工况
function onFrameHeadClick(frameId: string) {
  clearSelection()
  emit('select-frame', frameId)
}
// 普通点击卡片：Ctrl+点击仍留给「连线」，Shift+点击加/减选
function onCardClick(e: MouseEvent, frameId: string, laneId: string, nodeId: string) {
  markLastLane(frameId, laneId)
  if (e.ctrlKey || e.metaKey) return
  if (e.shiftKey) toggleNodeSel(nodeId)
  else selectNodeOnly(nodeId)
  // 同步聚焦卡片列表：卡片库里改过名字/步骤后，从画布上点一下就能定位到那张库卡片
  emitCardFocus(frameId, nodeId)
}
// 点主序列卡片：不改动画布选中（继续冒泡给泳道做「选中泳道」），只让左侧序列列表聚焦到它引用的库卡片
function onSeqCardClick(e: MouseEvent, frameId: string, nodeId: string) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return
  emitCardFocus(frameId, nodeId)
}
function onLaneHeadClick(e: MouseEvent, frameId: string, laneId: string) {
  markLastLane(frameId, laneId)
  if (e.shiftKey) toggleLaneSel(laneId)
  else selectLaneOnly(laneId)
  emit('select-frame', frameId)
}
/** 点画布空白处 = 取消选中。卡片 / 接线口 / 连线（含编号与编辑框）/ 泳道头 / 拖放区 / 输入框
 *  上不算空白，各自有自己的手势；泳道体上的空白也算空白 —— 想选整条泳道请点泳道头。 */
function onCanvasBlankClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null
  if (t?.closest?.('.node, .port, .edge-label, .edge-input, .lane-head, .lane-resizer, .gap-zone, button, input, textarea')) return
  clearSelection()
}

// 复制快照：泳道（含整栏卡片）+ 单独选中的卡片 + 「集合内部」的连线
interface ClipLane {
  type: FrameLaneType
  width?: number
  cards: Card[]
}
interface CanvasClip {
  cards: Card[]
  lanes: ClipLane[]
  edges: FrameEdge[]
}
const clipboard = ref<CanvasClip | null>(null)
function nodeKeyId(key: string): string | null {
  return key.startsWith('node:') ? key.slice('node:'.length) : null
}
function snapshotBySelection(): CanvasClip | null {
  const cards: Card[] = []
  const lanes: ClipLane[] = []
  const taken = new Set<string>()
  for (const f of frames.value) {
    for (const lane of f.lanes) {
      if (!selLanes.value.includes(lane.id)) continue
      const laneCards: Card[] = []
      for (const nid of lane.nodeIds) {
        const n = f.nodes[nid]
        if (!n || taken.has(nid)) continue
        taken.add(nid)
        laneCards.push(JSON.parse(JSON.stringify(n)))
      }
      lanes.push({ type: lane.type, width: lane.width, cards: laneCards })
    }
  }
  for (const f of frames.value) {
    for (const nid of selNodes.value) {
      if (taken.has(nid)) continue
      const n = f.nodes[nid]
      if (!n) continue
      taken.add(nid)
      cards.push(JSON.parse(JSON.stringify(n)))
    }
  }
  if (!cards.length && !lanes.length) return null
  const edges: FrameEdge[] = []
  for (const f of frames.value) {
    for (const e of Object.values(f.edges || {})) {
      const a = nodeKeyId(e.from)
      const b = nodeKeyId(e.to)
      // 只复制「两端都在复制集合内」的连线，跨到主序列/外部的连线不复制
      if (a && b && taken.has(a) && taken.has(b)) edges.push(JSON.parse(JSON.stringify(e)))
    }
  }
  return { cards, lanes, edges }
}
// 单张卡片的快照（Ctrl 拖拽一张未选中的卡片时用）
function snapshotOneNode(f: CaseFrame, nid: string): CanvasClip | null {
  const n = f.nodes[nid]
  if (!n) return null
  return { cards: [JSON.parse(JSON.stringify(n))], lanes: [], edges: [] }
}
// 一条泳道（含整栏卡片与栏内连线）的快照
function laneClip(f: CaseFrame, lane: FrameLane): CanvasClip {
  const cards: Card[] = lane.nodeIds
    .map((nid) => f.nodes[nid])
    .filter(Boolean)
    .map((n) => JSON.parse(JSON.stringify(n)))
  const ids = new Set(cards.map((c) => c.id))
  const edges = Object.values(f.edges || {})
    .filter((e) => {
      const a = nodeKeyId(e.from)
      const b = nodeKeyId(e.to)
      return !!a && !!b && ids.has(a) && ids.has(b)
    })
    .map((e) => JSON.parse(JSON.stringify(e)) as FrameEdge)
  return { cards: [], lanes: [{ type: lane.type, width: lane.width, cards }], edges }
}
function cloneCardsInto(f: CaseFrame, cards: Card[]): Record<string, string> {
  const idMap: Record<string, string> = {}
  for (const c of cards) {
    const nc: Card = JSON.parse(JSON.stringify(c))
    const nid = genId('node')
    nc.id = nid
    // 复制/粘贴不复用原卡片的摆位留白：落点由目标泳道的顺序决定，否则会莫名多出一段空档
    delete nc.topGap
    idMap[c.id] = nid
    f.nodes[nid] = nc
  }
  return idMap
}
function cloneEdgesInto(f: CaseFrame, edges: FrameEdge[], idMap: Record<string, string>) {
  for (const e of edges) {
    const a = nodeKeyId(e.from)
    const b = nodeKeyId(e.to)
    if (!a || !b) continue
    const na = idMap[a]
    const nb = idMap[b]
    if (!na || !nb) continue
    f.edges[genId('edge')] = { ...JSON.parse(JSON.stringify(e)), id: genId('edge'), from: 'node:' + na, to: 'node:' + nb }
  }
}
// 主序列泳道只收序列卡片（与拖拽落点规则一致），返回过滤后的卡片
function filterClipCards(lane: FrameLane, cards: Card[]): { cards: Card[]; dropped: number } {
  const keep = cards.filter((c) => laneAccepts(lane.type, c))
  return { cards: keep, dropped: cards.length - keep.length }
}
// 复制粘贴 / 复制拖拽 的统一落点：卡片进目标泳道，泳道插到目标泳道后面
function applyClip(f: CaseFrame, lane: FrameLane, clip: CanvasClip, at = -1): number {
  const { cards, dropped } = filterClipCards(lane, clip.cards)
  const idMap = cloneCardsInto(f, cards)
  cloneEdgesInto(f, clip.edges, idMap)
  const ids = cards.map((c) => idMap[c.id]).filter(Boolean)
  if (lane.type === 'main' && ids.length) {
    // 主序列泳道：替换原有序列（与拖拽落点行为一致）
    for (const nid of lane.nodeIds) {
      removeNodeEdges(f, nid, 'main')
      delete f.nodes[nid]
    }
    lane.nodeIds = ids
  } else if (ids.length) {
    const rest = lane.nodeIds.slice()
    const pos = at < 0 ? rest.length : Math.min(at, rest.length)
    lane.nodeIds = [...rest.slice(0, pos), ...ids, ...rest.slice(pos)]
  }
  if (clip.lanes.length) {
    // 泳道：插到目标泳道后面
    const idx = f.lanes.findIndex((l) => l.id === lane.id)
    insertClipLanes(f, idx < 0 ? f.lanes.length : idx + 1, clip)
  }
  if (dropped) ElMessage.warning('主序列泳道只放「序列」卡片，已跳过其它卡片')
  return cards.length + clip.lanes.reduce((s, l) => s + l.cards.length, 0)
}
// 把快照里的泳道（含整栏卡片）克隆插入到目标下标处
function insertClipLanes(f: CaseFrame, at: number, clip: CanvasClip) {
  if (!clip.lanes.length) return
  const laneIdMap = cloneCardsInto(f, clip.lanes.flatMap((l) => l.cards))
  cloneEdgesInto(f, clip.edges, laneIdMap)
  let insertAt = Math.max(0, Math.min(at, f.lanes.length))
  for (const l of clip.lanes) {
    // 一个工况只能有一条主序列泳道，复制过来的主序列降级为普通泳道
    const nl: FrameLane = {
      id: genId('lane'),
      type: l.type === 'main' ? 'other' : l.type,
      width: l.width,
      nodeIds: l.cards.map((c) => laneIdMap[c.id]).filter(Boolean),
    }
    f.lanes.splice(insertAt++, 0, nl)
  }
}
/**
 * 把一批卡片一起移到目标泳道（可跨泳道 / 跨工况），返回实际移动的卡片数。
 * 多选拖拽时整批一起搬：原来只按 dragPayload.nodeId 搬一张，多选后拖拽「只动一个」。
 * 语义与单张拖拽保持一致：
 * - 主序列泳道只收「序列」卡片且只能放一张，多选时只取第一张合法的；
 * - 同工况内移动保留原有连线；跨工况移动断开连线；
 * - insertAt 是「移除这一批之后」的下标（与 dropIndexInLane 的语义一致）。
 */
function moveNodesToLane(
  targetFrame: CaseFrame,
  targetLane: FrameLane,
  ids: string[],
  insertAt: number,
): number {
  const moving: Array<{ frame: CaseFrame; lane: FrameLane; node: Card }> = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    for (const f of frames.value) {
      const lane = f.lanes.find((l) => l.nodeIds.includes(id))
      const node = f.nodes[id]
      if (!lane || !node) continue
      seen.add(id)
      moving.push({ frame: f, lane, node })
      break
    }
  }
  const accepted = moving.filter((m) => laneAccepts(targetLane.type, m.node))
  if (!accepted.length) return 0
  const list = targetLane.type === 'main' ? accepted.slice(0, 1) : accepted
  const movedIds = new Set(list.map((m) => m.node.id))
  for (const m of list) m.lane.nodeIds = m.lane.nodeIds.filter((x) => x !== m.node.id)
  for (const m of list) {
    if (m.frame.id === targetFrame.id) continue
    removeNodeEdges(m.frame, m.node.id, m.lane.type)
    delete m.frame.nodes[m.node.id]
    targetFrame.nodes[m.node.id] = m.node
  }
  const order = list.map((m) => m.node.id)
  if (targetLane.type === 'main') {
    // 主序列泳道：替换原有序列（与拖入单张序列卡片的行为一致）
    for (const nid of targetLane.nodeIds) {
      if (movedIds.has(nid)) continue
      removeNodeEdges(targetFrame, nid, 'main')
      delete targetFrame.nodes[nid]
    }
    targetLane.nodeIds = order
  } else {
    const rest = targetLane.nodeIds.filter((x) => !movedIds.has(x))
    const at = insertAt < 0 ? rest.length : Math.min(insertAt, rest.length)
    targetLane.nodeIds = [...rest.slice(0, at), ...order, ...rest.slice(at)]
  }
  return order.length
}
function copySelection(): boolean {
  const clip = snapshotBySelection()
  // 画布内没有选中任何对象 → 不接管，交给上层（FunctionGraphEditor 的 Ctrl+C 复制整个工况）
  if (!clip) return false
  clipboard.value = clip
  const total = clip.cards.length + clip.lanes.reduce((s, l) => s + l.cards.length, 0)
  // 顺带写入系统剪贴板，方便跨窗口/跨标签页查看，失败忽略
  try {
    navigator.clipboard?.writeText(JSON.stringify({ type: 'autotool-case-frame-clip', ...clip }))
  } catch {
    /* ignore */
  }
  ElMessage.success(`已复制 ${total} 张卡片${clip.lanes.length ? ` / ${clip.lanes.length} 条泳道` : ''}`)
  return true
}
function pasteClipboard(): boolean {
  const clip = clipboard.value
  // 画布剪贴板为空 → 不接管，交给上层（粘贴工况/库卡片）
  if (!clip) return false
  const t = lastLane.value
  const f = t ? frames.value.find((x) => x.id === t.frameId) : null
  const lane = f ? f.lanes.find((l) => l.id === (t as { laneId: string }).laneId) : null
  if (!f || !lane) {
    ElMessage.warning('请先点击要粘贴到的泳道，再按 Ctrl+V')
    return true
  }
  const n = applyClip(f, lane, clip)
  emitChange()
  scheduleRecompute()
  ElMessage.success(`已粘贴 ${n} 张卡片`)
  return true
}
// 画布内的快捷键统一注册到「统一快捷键层」（context 作用域，最内层优先）：
// 返回 false 表示画布没接管，会继续向外层匹配（例如没选中对象时让上层去复制工况/测试参数）。
// 注意：FunctionView 被 keep-alive 缓存、画布不会卸载，所以每条都必须用 isModuleActive 限定在功能模块内，
// 否则在其它模块按 Insert/Delete 会被画布抢走（新建/删除工况）。
const canvasShortcutWhen = () => isModuleActive('/function')
function canvasShortcuts() {
  useShortcut({
    id: 'canvas:copy',
    keys: 'Ctrl+C',
    scope: 'context',
    desc: '复制选中的卡片/泳道',
    when: canvasShortcutWhen,
    run: () => copySelection(),
  })
  useShortcut({
    id: 'canvas:paste',
    keys: 'Ctrl+V',
    scope: 'context',
    desc: '粘贴卡片/泳道到目标泳道',
    when: canvasShortcutWhen,
    run: () => pasteClipboard(),
  })
  useShortcut({
    id: 'canvas:undo',
    keys: 'Ctrl+Z',
    scope: 'context',
    desc: '撤销画布改动',
    when: canvasShortcutWhen,
    run: () => undoCanvas(),
  })
  useShortcut({
    id: 'canvas:redo',
    keys: 'Ctrl+Shift+Z',
    scope: 'context',
    desc: '重做画布改动',
    when: canvasShortcutWhen,
    run: () => redoCanvas(),
  })
  useShortcut({
    id: 'canvas:redo2',
    keys: 'Ctrl+Y',
    scope: 'context',
    desc: '重做画布改动',
    when: canvasShortcutWhen,
    run: () => redoCanvas(),
  })
  useShortcut({
    id: 'canvas:selectAll',
    keys: 'Ctrl+A',
    scope: 'context',
    desc: '全选画布卡片',
    when: canvasShortcutWhen,
    run: () => {
      const all: string[] = []
      // 只选当前展示的工况（画布一次只挂一个工况，选中画面外的卡片既看不见也删不到）
      for (const f of visibleFrames.value) for (const lane of f.lanes) all.push(...lane.nodeIds)
      if (!all.length) return false
      selLanes.value = []
      selNodes.value = all
      return true
    },
  })
  useShortcut({
    id: 'canvas:clearSelection',
    keys: 'Escape',
    scope: 'context',
    desc: '清空画布选中',
    when: canvasShortcutWhen,
    // soft：不拦截，输入框/弹窗的 Esc 行为要保留
    run: () => {
      clearSelection()
      return 'soft'
    },
  })
  useShortcut({
    id: 'canvas:newFrame',
    keys: 'Insert',
    scope: 'context',
    desc: '新建工况',
    when: canvasShortcutWhen,
    run: () => {
      addFrame()
      return true
    },
  })
  useShortcut({
    id: 'canvas:deleteSelection',
    keys: 'Delete',
    scope: 'context',
    desc: '删除选中的卡片/泳道/连线',
    when: canvasShortcutWhen,
    run: () => {
      if (deleteSelection()) return true
      return false
    },
  })
}
// 删除画布中选中的卡片 / 泳道 / 连线（主序列泳道不可删；删除卡片与泳道时同步清理其连线）
function deleteSelection(): boolean {
  const nodeIds = [...selNodes.value]
  const laneIds = [...selLanes.value]
  const edgeIds = [...selectedEdgeIds.value]
  if (!nodeIds.length && !laneIds.length && !edgeIds.length) return false
  let cards = 0
  let lanes = 0
  let edges = 0
  let mainLaneHit = false
  // 只在「当前展示的工况」里删：复制工况后卡片 / 泳道 id 与原件重名，
  // 遍历全部工况会把原件里的同名卡片一起删掉（与 ✕ 按钮的 removeNode 行为对齐）
  for (const f of visibleFrames.value) {
    for (const nid of nodeIds) {
      const lane = f.lanes.find((l) => l.nodeIds.includes(nid))
      if (!lane) continue
      lane.nodeIds = lane.nodeIds.filter((x) => x !== nid)
      removeNodeEdges(f, nid, lane.type)
      delete f.nodes[nid]
      cards++
    }
    for (const lid of laneIds) {
      const lane = f.lanes.find((l) => l.id === lid)
      if (!lane) continue
      if (lane.type === 'main') {
        mainLaneHit = true
        continue
      }
      for (const nid of lane.nodeIds) {
        removeNodeEdges(f, nid, lane.type)
        delete f.nodes[nid]
        cards++
      }
      f.lanes = f.lanes.filter((l) => l.id !== lid)
      lanes++
    }
    // 单独选中的连线：已在上面被卡片 / 泳道连带删掉的不重复计数
    for (const eid of edgeIds) {
      if (!f.edges[eid]) continue
      delete f.edges[eid]
      edges++
    }
  }
  clearSelection()
  emitChange()
  scheduleRecompute()
  const parts: string[] = []
  if (cards) parts.push(`${cards} 张卡片`)
  if (lanes) parts.push(`${lanes} 条泳道`)
  if (edges) parts.push(`${edges} 条连线`)
  if (parts.length) ElMessage.success(`已删除 ${parts.join('、')}，Ctrl+Z 可撤销`)
  // 只选中了主序列泳道时什么都没删：必须给个说法，否则就是「按了 Delete 没反应」
  else if (mainLaneHit) ElMessage.warning('主序列泳道不可删除，可删除其上的卡片或连线')
  return true
}
// 在 setup 期注册（useShortcut 内部用 onUnmounted 自动注销）
canvasShortcuts()

const portEls: Record<string, HTMLElement | null> = {}
const bodyEls: Record<string, HTMLElement | null> = {}
/** 画布滚动容器（拖拽时边缘自动滚动用） */
const canvasEl = ref<HTMLElement | null>(null)

interface EdgePath {
  key: string
  d: string
  explicit: boolean
  edgeId: string
  mid: { x: number; y: number }
  label: string
  editable: boolean
  /** 与另一条「同源接线口 + 同编号 + 同目标」的重叠连线重复时，本徽标默认不显示
   *  （选中该连线时仍显示，便于就地改号）；编号相同但目标不同的分叉不在此列 */
  badgeOnSelect?: boolean
  /** 本条连线生效的序号集合（已解析继承 / 汇合，空数组 = 未编号）；
   *  用于「相同序号一起高亮」——注意 label 是它的展示形式，两者同源 */
  nums: number[]
  /** 曲线几何（相对工况框），框选命中判定用 */
  geo: { x1: number; y1: number; x2: number; y2: number; bow: number }
}
const edgePathCache = ref<Record<string, EdgePath[]>>({})
/** 各工况「实际在用的编号」集合（`resolveFrameNumbers` 的 caseNums），编号选择器的候选来源 */
const frameCaseNums = ref<Record<string, number[]>>({})

const editingEdgeId = ref('')
const editingEdgeFrameId = ref('')
const editingEdgeValue = ref('')
/**
 * 序号编辑框宽度：按内容长度自适应（最小 9 个字符，保证面板里的 placeholder「如 1,2,5-8」可见）。
 * 全局 `* { box-sizing: border-box }`，所以要把左右内边距 6+6 与左右边框 1+1 一起算进去（14px）。
 */
const edgeInputWidth = computed(() => `calc(${Math.max(9, editingEdgeValue.value.length)}ch + 14px)`)

const editorFrameId = ref('')
const editorNodeId = ref('')
const editingCard = ref<Card | null>(null)
const editorVisible = ref(false)

// ===== 泳道辅助 =====
const LANE_MIN_W = 160
/** 自适应宽度（未手动设宽）的上限：内容再长，泳道也不会超过这个宽度 */
const LANE_AUTO_MAX_W = 260
/** 手动拖泳道右边缘的硬上限：允许突破自适应上限，只是防手滑拖出离谱宽度 */
const LANE_HARD_MAX_W = 2000
function laneTypeLabel(t: FrameLaneType): string {
  return FRAME_LANE_LABEL[t] || t
}
/**
 * 泳道标题：主序列保留「主序列」，其余泳道按在工况内的**实际位置**编号（从左到右从 1 起）。
 * 编号即视觉顺序，方便口头描述位置（例如「泳道5」= 从左数第 5 条）；主序列占号但不显示，
 * 所以中间会跳号。
 */
function laneLabel(lane: FrameLane, index: number): string {
  return lane.type === 'main' ? laneTypeLabel('main') : `泳道${index + 1}`
}
// 手动设过宽度则为固定宽度（可超过自适应上限）；未设置时在 [最小宽度, 自适应上限] 区间内弹性自适应
function laneStyle(lane: FrameLane): Record<string, string> {
  if (lane.width) {
    const w = Math.max(LANE_MIN_W, Math.min(LANE_HARD_MAX_W, Math.round(lane.width)))
    return { flex: `0 0 ${w}px`, width: `${w}px`, minWidth: `${LANE_MIN_W}px`, maxWidth: 'none' }
  }
  return { minWidth: `${LANE_MIN_W}px`, maxWidth: `${LANE_AUTO_MAX_W}px` }
}
// 拖动泳道右边缘调节宽度（下限 LANE_MIN_W，上限 LANE_HARD_MAX_W，可超过自适应上限）
function onLaneResizeStart(e: MouseEvent, frameId: string, lane: FrameLane) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const startX = e.clientX
  const el = (e.currentTarget as HTMLElement).parentElement
  const startW = el ? el.getBoundingClientRect().width : lane.width || LANE_MIN_W
  // mousemove 合并到下一帧：每移动一次就写 lane.width 会让整个画布重渲染一遍
  let raf = 0
  let pendingX = startX
  const apply = () => {
    raf = 0
    lane.width = Math.max(LANE_MIN_W, Math.min(LANE_HARD_MAX_W, startW + (pendingX - startX)))
    scheduleRecompute()
  }
  const onMove = (ev: MouseEvent) => {
    pendingX = ev.clientX
    if (!raf) raf = requestAnimationFrame(apply)
  }
  const onUp = () => {
    // 收尾：把最后待处理的一帧落地，避免松手时丢掉最后一次移动
    if (raf) {
      cancelAnimationFrame(raf)
      apply()
    }
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    emitChange()
    scheduleRecompute()
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
// 双击恢复自适应宽度
function resetLaneWidth(frameId: string, laneId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  const lane = f && f.lanes.find((l) => l.id === laneId)
  if (!lane) return
  lane.width = undefined
  emitChange()
  scheduleRecompute()
}
function laneAccepts(laneType: FrameLaneType, card: Card): boolean {
  if (laneType === 'main') return card.type === 'sequence'
  return true
}
// 落点在泳道内的插入下标：用鼠标 Y 和各卡片中线比较（排除正在拖动的那张卡片自身）。
// 旧逻辑是一律追加到泳道末尾，拖到卡片之间/上方也只能落到最后，手感像「没生效」。
// movingIds 支持整批：多选拖动时要把这一批卡片都排除在外，下标才对得上（与移除后的顺序一致）。
function dropIndexInLane(laneEl: Element | null, clientY: number, movingIds: string | string[]): number {
  if (!laneEl) return -1
  const skip = new Set(typeof movingIds === 'string' ? [movingIds] : movingIds)
  const rest = Array.from(laneEl.querySelectorAll('.node')).filter((el) => !skip.has(el.getAttribute('data-nid') || ''))
  let idx = 0
  for (const el of rest) {
    const r = el.getBoundingClientRect()
    if (clientY > r.top + r.height / 2) idx++
    else break
  }
  return idx
}
// 拖拽事件里拿所在泳道元素（onZoneDrop 的 currentTarget 就是 .lane，落到卡片上时是 .node）
function laneElOf(e: DragEvent): Element | null {
  const t = e.currentTarget as Element | null
  if (!t) return null
  return t.classList.contains('lane') ? t : t.closest('.lane')
}
// 泳道内卡片一律按 nodeIds 顺序自上而下排列（不再支持自由摆放）：
// 落点只用鼠标 Y 决定「插到哪张卡片前/后」，位置由顺序决定，因此不会有留白也不会有重叠。
// 不同分类的卡片用不同背景色：故障注入/故障恢复/结果/辅序列
function cardCategoryClass(card: Card): string {
  if (card.type === 'inject') return card.role === 'recover' ? 'n-recover' : 'n-inject'
  if (card.type === 'result') return 'n-result'
  if (card.type === 'sequence') return 'n-sequence'
  return 'n-other'
}

// ===== 步骤展示 =====
function stepKindLabel(s: Card['steps'][number]): string {
  switch (s.kind) {
    case 'call': return '函数'
    case 'wait': return '等待'
    case 'check': return '检查'
    case 'wait_check': return '限时检查'
    case 'set': return '设置'
    case 'reset': return '恢复'
    case 'reset_all': return '恢复全部'
    case 'rate': return '斜率请求'
    case 'ramp': return '斜率请求(同步)'
    case 'tester_prompt': return '弹窗提示'
    case 'loop_start': return 'Loop Start'
    case 'loop_end': return 'Loop End'
    case 'card': return '卡片引用'
    case 'raw': return '自定义'
    default: return s.kind
  }
}
function stepLabel(s: Card['steps'][number]): string {
  switch (s.kind) {
    case 'card':
      return s.cardName || s.cardId || '未选择卡片'
    case 'set': {
      const parts = (s.args || []).map((a) => (a.value ? `${a.key}=${a.value}` : a.key))
      return '设置 ' + (parts.join(', ') || '(空)')
    }
    case 'reset': {
      const parts = (s.args || []).map((a) => a.key)
      return '恢复 ' + (parts.join(', ') || '(空)')
    }
    case 'wait_check': {
      const head = s.waitNot ? '限时检查(非)' : '限时检查'
      const parts = (s.args || []).map((a) =>
        s.waitRange ? `${a.key}=${a.value ?? ''}~${a.value2 ?? ''}` : (a.value ? `${a.key}=${a.value}` : a.key),
      )
      const time = s.time ? ` 时间${s.time}` : ''
      return `${head} ${parts.join(', ') || '(空)'}${time}`
    }
    case 'reset_all':
      return '恢复全部'
    case 'rate':
    case 'ramp': {
      const head = s.kind === 'rate' ? '斜率请求' : '斜率请求(同步)'
      const parts = (s.args || []).map((a) => (a.value ? `${a.key}=${a.value}` : a.key))
      const rate = s.rate ? ` 斜率${s.rate}` : ''
      return `${head} ${parts.join(', ') || '(空)'}${rate}`
    }
    case 'tester_prompt':
      return `弹窗提示 ${s.prompt || '(空)'}`
    case 'loop_start':
      return 'Loop Start' + (s.fun ? `(${s.fun})` : '')
    case 'loop_end':
      return 'Loop End'
    case 'raw':
      return s.raw || '(自定义)'
    default: {
      const fn = s.fun || s.kind
      const vals = (s.args || []).map((a) => a.value).filter((v) => v !== '')
      return fn + (vals.length ? `(${vals.join(', ')})` : '')
    }
  }
}
/** 卡片库查找表（卡片 id → 库卡片）：节点 refId 的参数声明/默认值要回落到这里 */
const cardLookup = computed(() => buildCardLookup(props.cardLibrary))

function summarize(n: Card): string {
  // 展示时把 {{参数}} 解析掉（与生成一致）：取「引用卡片默认值 + 节点 params + 引用处参数取值」，
  // 只按节点 params 的 default 解析会让已填的「参数取值」显示成参数名，界面看着像占位符没生效。
  const values = nodeParamValues(n, cardLookup.value)
  const head = n.steps
    .slice(0, 2)
    .map((s) => paramDisplayText(stepLabel(s), values))
    .join(' · ')
  return head + (n.steps.length > 2 ? ' …' : '')
}
// 主序列步骤 + 接线口（槽位）：N 步产生 N+1 个接线口，步骤前后各一个
// 槽位 s：左口（注入，接在步骤 s 之前），右口（结果，接在步骤 s-1 之后）
// 接线口 key 锚定到步骤 id（seq:<seqId>@<stepId>）：步骤增删/重排后连线自动跟随，
// 不再因为序号错位而「画不出来 + 不参与展开」地静默失效。
function sequenceRows(f: CaseFrame): any[] {
  const seqId = frameSequenceId(f)
  if (!seqId) return []
  const seqNode = f.nodes[seqId]
  const steps = seqNode?.steps || []
  // 与生成一致：按「引用卡片默认值 + 节点 params + 引用处参数取值」解析步骤里的 {{参数}}
  const values = seqNode ? nodeParamValues(seqNode, cardLookup.value) : {}
  // 老数据里个别步骤可能没有 id，退回旧序号格式（仍可解析）
  const portOf = (i: number): string =>
    steps[i]?.id ? seqPortKey(seqId, steps[i].id) : `seq:${seqId}:${i}`
  const rows: any[] = []
  for (let s = 0; s <= steps.length; s++) {
    rows.push({
      key: `slot-${s}`,
      kind: 'slot',
      inKey: s < steps.length ? portOf(s) : '',
      outKey: s > 0 ? portOf(s - 1) : '',
      showIn: s < steps.length,
      showOut: s > 0,
    })
    if (s < steps.length) {
      rows.push({
        key: `step-${s}`,
        kind: 'step',
        step: steps[s],
        label: paramDisplayText(stepLabel(steps[s]), values),
      })
    }
  }
  return rows
}
/**
 * 卡片摘要 / 主序列行：原来直接写在渲染函数里，画布每次重渲染（拖拽、连线、选中…）
 * 都会对每张卡片重算一遍 nodeParamValues + paramDisplayText。这里按依赖缓存，
 * 只在工况结构 / 卡片库真正变化时重算。
 */
const summarizeMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  // 只算当前展示的工况（画布一次只挂载一个）
  for (const f of visibleFrames.value) {
    for (const [nid, n] of Object.entries(f.nodes)) map[`${f.id}:${nid}`] = summarize(n)
  }
  return map
})
function summarizeOf(f: CaseFrame, nodeId: string): string {
  return summarizeMap.value[`${f.id}:${nodeId}`] ?? ''
}
const sequenceRowsMap = computed<Record<string, any[]>>(() => {
  const map: Record<string, any[]> = {}
  for (const f of visibleFrames.value) map[f.id] = sequenceRows(f)
  return map
})
const EMPTY_SEQ_ROWS: any[] = []
function sequenceRowsOf(f: CaseFrame): any[] {
  return sequenceRowsMap.value[f.id] || EMPTY_SEQ_ROWS
}
/**
 * 库卡片 → 工况节点。
 * 声明了参数的卡片改为创建「卡片引用」节点（单个 card 步骤 + 空 args）：与 Check_Tq_EpsOff
 * 的写法一致——参数会在节点里渲染成「参数取值」列表、可按实例分别填值，而不是把
 * {{占位符}} 当普通文本复制一份到工况里（那种副本的参数无法按实例覆盖）。
 */
function cardToNode(card: Card): Card {
  const base: Card = JSON.parse(JSON.stringify(card))
  const nodeId = genId('node')
  const libId = card.refId || card.id
  const hasParams = (card.params ?? []).some((p) => String(p.name || '').trim())
  if (hasParams && libId) {
    return {
      ...base,
      id: nodeId,
      refId: libId,
      steps: [
        {
          id: genId('step'),
          kind: 'card',
          cardId: libId,
          cardType: card.type,
          cardName: card.name,
          args: [],
          indent: 0,
        },
      ],
    }
  }
  return { ...base, id: nodeId, refId: libId }
}

// ===== 连线边类型 =====
function edgeKind(e: FrameEdge): 'entry' | 'exit' | 'chain' {
  if (isNodeKey(e.from) && e.to.startsWith('seq:')) return 'entry'
  if (e.from.startsWith('seq:') && isNodeKey(e.to)) return 'exit'
  return 'chain'
}

// ===== 工况框 CRUD =====
function newFrame(name: string): CaseFrame {
  return { id: genId('frame'), name, lanes: [{ id: genId('lane'), type: 'main', nodeIds: [] }], nodes: {}, edges: {} }
}
function addFrame() {
  const f = newFrame(`工况${frames.value.length + 1}`)
  frames.value.push(f)
  emitChange()
  scheduleRecompute()
  // 画布一次只挂载一个工况：新建的工况直接切到前台
  emit('update:active-frame-id', f.id)
}
async function removeFrame(id: string) {
  const f = frames.value.find((x) => x.id === id)
  if (!f) return
  const seq = frames.value.findIndex((x) => x.id === id) + 1
  try {
    await ElMessageBox.confirm(
      `确认删除工况「${f.name || `工况${seq}`}」？将同时删除 ${f.lanes.length} 条泳道、${Object.keys(f.nodes).length} 张卡片、${Object.keys(f.edges).length} 条连线。删除后可按 Ctrl+Z 撤销。`,
      '删除工况',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  // 弹窗期间画布可能已被其它操作改动，这里按 id 重新定位
  const i = frames.value.findIndex((x) => x.id === id)
  if (i < 0) return
  frames.value.splice(i, 1)
  emitChange()
  ElMessage.success('已删除工况，Ctrl+Z 可撤销')
  scheduleRecompute()
}
/** 复制工况：整框深拷贝后把**卡片 / 泳道 / 连线 / 步骤 id 全部换新**，并重写端口键里的引用。
 *  直接沿用原件的 id，会让「按 id 找节点」的操作（Delete、拖拽、程序化选中、按步骤定位工况）
 *  串到原件上 —— Delete 与卡片 ✕ 的删除范围因此会不一致。 */
function cloneFrameWithNewIds(src: CaseFrame): CaseFrame {
  const cp: CaseFrame = JSON.parse(JSON.stringify(src))
  cp.id = genId('frame')

  // 1) 先建 id 映射：步骤 id 被序列接线口的锚点引用（seq:<seqId>@<stepId>），要一起换
  const nodeIdMap = new Map<string, string>()
  const stepIdMap = new Map<string, string>()
  for (const oldId of Object.keys(cp.nodes ?? {})) nodeIdMap.set(oldId, genId('node'))
  for (const [oldId, node] of Object.entries(cp.nodes ?? {})) {
    const nextNodeId = nodeIdMap.get(oldId) ?? oldId
    node.id = nextNodeId
    for (const step of node.steps ?? []) {
      const nextStepId = genId('step')
      stepIdMap.set(step.id, nextStepId)
      step.id = nextStepId
    }
  }

  // 2) nodes 字典换键
  const nodes: Record<string, Card> = {}
  for (const [oldId, node] of Object.entries(cp.nodes ?? {})) nodes[nodeIdMap.get(oldId) ?? oldId] = node
  cp.nodes = nodes

  // 3) 泳道 id + 泳道内的 nodeId
  for (const lane of cp.lanes ?? []) {
    lane.id = genId('lane')
    lane.nodeIds = lane.nodeIds.map((nid) => nodeIdMap.get(nid) ?? nid)
  }
  // 旧字段（迁移到 lanes 后不再写入，历史配置里可能还有）
  const mapNode = (nid: string): string => nodeIdMap.get(nid) ?? nid
  cp.sequenceId = cp.sequenceId ? mapNode(cp.sequenceId) : cp.sequenceId
  if (cp.injects) cp.injects = cp.injects.map(mapNode)
  if (cp.recovers) cp.recovers = cp.recovers.map(mapNode)
  if (cp.results) cp.results = cp.results.map(mapNode)

  // 4) 连线：边 id 换新，端口键里的 nodeId / seqId / stepId 按映射改写
  const remapPort = (key: string): string => {
    const seq = parseSeqPortKey(key)
    if (seq) {
      const seqId = mapNode(seq.seqId)
      // 锚点步骤已不存在（悬空锚点）时保留原 stepId，仍由「悬空连线」逻辑兜着
      if (seq.stepId !== undefined) return seqPortKey(seqId, stepIdMap.get(seq.stepId) ?? seq.stepId)
      return `seq:${seqId}:${seq.idx ?? 0}`
    }
    if (isCardKey(key)) {
      const nodeId = cardKeyNodeId(key)
      return key.slice(0, key.length - nodeId.length) + mapNode(nodeId)
    }
    return key
  }
  const edges: Record<string, FrameEdge> = {}
  for (const edge of Object.values(cp.edges ?? {})) {
    edge.id = genId('edge')
    edge.from = remapPort(edge.from)
    edge.to = remapPort(edge.to)
    edges[edge.id] = edge
  }
  cp.edges = edges
  return cp
}

function copyFrame(id: string) {
  const f = frames.value.find((x) => x.id === id)
  if (!f) return
  const cp = cloneFrameWithNewIds(f)
  cp.name = f.name + ' 副本'
  const idx = frames.value.findIndex((x) => x.id === id)
  frames.value.splice(idx + 1, 0, cp)
  emitChange()
  scheduleRecompute()
  emit('update:active-frame-id', cp.id)
}

// ===== 泳道增删 / 排序 =====
function onGapDrop(frameId: string, index: number, e: DragEvent) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return

  const payload = dragPayload.value
  if (payload?.source === 'node') {
    // Ctrl 拖拽 = 复制：在泳道间隙新建一条泳道放克隆的卡片，原件保留
    const copyClip = resolveCopyClip(e)
    if (copyClip) {
      const created: FrameLane = { id: genId('lane'), type: 'other', nodeIds: [] }
      f.lanes.splice(index, 0, created)
      applyClip(f, created, { ...copyClip, lanes: [] }, -1)
      emitChange()
      onDragEnd()
      scheduleRecompute()
      return
    }
    const ids = dragNodeIdsOf(payload)
    if (!ids.length) {
      onDragEnd()
      return
    }
    // 在泳道间隙新建一条泳道，整批卡片一起搬进去（同工况内移动保留连线，跨工况断开）
    const lane: FrameLane = { id: genId('lane'), type: 'other', nodeIds: [] }
    f.lanes.splice(index, 0, lane)
    if (!moveNodesToLane(f, lane, ids, -1)) {
      // 没有可移动的卡片：撤掉刚建的空泳道，避免留下空泳道
      f.lanes.splice(index, 1)
      onDragEnd()
      return
    }
    emitChange()
    onDragEnd()
    scheduleRecompute()
    return
  }

  const cards = parseCards(e)
  if (!cards.length) return
  // 多选拖入：所有卡片放入同一个新泳道
  const lane: FrameLane = { id: genId('lane'), type: 'other', nodeIds: [] }
  for (const card of cards) {
    const n = cardToNode(card)
    f.nodes[n.id] = n
    lane.nodeIds.push(n.id)
  }
  f.lanes.splice(index, 0, lane)
  onZoneLeave()
  emitChange()
  scheduleRecompute()
}
function moveLane(frameId: string, laneId: string, dir: number) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const i = f.lanes.findIndex((l) => l.id === laneId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= f.lanes.length) return
  const tmp = f.lanes[i]
  f.lanes[i] = f.lanes[j]
  f.lanes[j] = tmp
  emitChange()
  scheduleRecompute()
}
// ===== 泳道拖动排序 =====
function onLaneDragStart(e: DragEvent, frameId: string, laneId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) {
    e.preventDefault()
    return
  }
  // 按住 Ctrl 拖拽泳道 = 复制（原件保留）
  const copy = e.ctrlKey || e.metaKey
  const lane = f.lanes.find((l) => l.id === laneId)
  if (!copy && f.lanes.length < 2) {
    // 只有一条泳道时排序没有意义；Ctrl 复制仍允许
    e.preventDefault()
    return
  }
  laneDrag.value = { frameId, laneId, copy, clip: copy && lane ? laneClip(f, lane) : null }
  laneDrop.frameId = ''
  laneDrop.laneId = ''
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = copy ? 'copy' : 'move'
    // 独立的自定义类型，避免被卡片拖拽逻辑识别（不显示停靠区）
    e.dataTransfer.setData('application/x-graph-lane', laneId)
    e.dataTransfer.setData('text/plain', laneId)
  }
}
function onLaneDragEnd() {
  laneDrag.value = null
  laneDrop.frameId = ''
  laneDrop.laneId = ''
}
// 拖动过程中根据鼠标位于目标泳道左/右半区，决定插入到其前/后
function updateLaneDropTarget(frameId: string, laneId: string, e: DragEvent) {
  const drag = laneDrag.value
  if (!drag || drag.frameId !== frameId) return
  const el = e.currentTarget as HTMLElement | null
  if (el) {
    const r = el.getBoundingClientRect()
    laneDrop.pos = e.clientX < r.left + r.width / 2 ? 'before' : 'after'
  } else {
    laneDrop.pos = 'after'
  }
  laneDrop.frameId = frameId
  laneDrop.laneId = laneId
}
// 返回 true 表示本次 drop 已按「泳道排序」处理（不再走卡片落点逻辑）
function applyLaneDrop(frameId: string, laneId: string): boolean {
  const drag = laneDrag.value
  if (!drag) return false
  const targetLaneId = laneDrop.laneId || (laneId.startsWith('gap-') ? '' : laneId)
  const pos = laneDrop.pos
  onLaneDragEnd()
  if (drag.frameId !== frameId || !targetLaneId) return true
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return true
  if (drag.copy && drag.clip) {
    // Ctrl 拖拽泳道 = 复制：在目标泳道前/后插入克隆的泳道（含整栏卡片）
    const idx = f.lanes.findIndex((l) => l.id === targetLaneId)
    if (idx < 0) return true
    insertClipLanes(f, pos === 'before' ? idx : idx + 1, drag.clip)
    emitChange()
    scheduleRecompute()
    return true
  }
  const from = f.lanes.findIndex((l) => l.id === drag.laneId)
  if (from < 0) return true
  const moved = f.lanes[from]
  f.lanes.splice(from, 1)
  const to = f.lanes.findIndex((l) => l.id === targetLaneId)
  if (to < 0) {
    f.lanes.splice(from, 0, moved)
    return true
  }
  f.lanes.splice(pos === 'before' ? to : to + 1, 0, moved)
  emitChange()
  scheduleRecompute()
  return true
}
function removeNodeEdges(f: CaseFrame, nodeId: string, laneType: FrameLaneType) {
  if (laneType === 'main') {
    for (const k in f.edges) {
      const e = f.edges[k]
      if (e.from.startsWith('seq:') || e.to.startsWith('seq:')) delete f.edges[k]
    }
  } else {
    const prefix = 'node:' + nodeId
    for (const k in f.edges) {
      const e = f.edges[k]
      if (e.from === prefix || e.to === prefix) delete f.edges[k]
    }
  }
}
async function removeLane(frameId: string, laneId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const lane = f.lanes.find((l) => l.id === laneId)
  if (!lane) return
  // 统计将被一并删除的连线（与 removeNodeEdges 的匹配规则保持一致）
  const prefixes = lane.type === 'main' ? ['seq:'] : lane.nodeIds.map((nid) => 'node:' + nid)
  const edgeCount = Object.values(f.edges).filter(
    (e) => prefixes.some((p) => e.from.startsWith(p)) || prefixes.some((p) => e.to.startsWith(p)),
  ).length
  const seq = f.lanes.findIndex((l) => l.id === laneId) + 1
  try {
    await ElMessageBox.confirm(
      `确认删除工况「${f.name || '未命名'}」的第 ${seq} 条泳道？将同时删除该泳道内 ${lane.nodeIds.length} 张卡片及其相关 ${edgeCount} 条连线。删除后可按 Ctrl+Z 撤销。`,
      '删除泳道',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  // 弹窗期间画布可能已被其它操作改动，这里按 id 重新定位
  const f2 = frames.value.find((x) => x.id === frameId)
  const lane2 = f2 && f2.lanes.find((l) => l.id === laneId)
  if (!f2 || !lane2) return
  for (const nid of lane2.nodeIds) {
    removeNodeEdges(f2, nid, lane2.type)
    delete f2.nodes[nid]
  }
  f2.lanes = f2.lanes.filter((l) => l.id !== laneId)
  emitChange()
  ElMessage.success('已删除泳道，Ctrl+Z 可撤销')
  scheduleRecompute()
}

// ===== 拖拽（库卡片/函数 → 泳道 / 跨泳道移动节点） =====
function parseCard(e: DragEvent): Card | null {
  const dt = e.dataTransfer
  if (!dt) return null
  // 卡片库用 x-graph-card；函数库用 x-func-card（避免被步骤编辑器误判为卡片引用）
  const raw = dt.getData(FUNC_CARD_MIME) || dt.getData('application/x-graph-card')
  if (!raw) return null
  try {
    return JSON.parse(raw) as Card
  } catch {
    return null
  }
}
// 解析拖入的卡片（支持多选批量拖拽）
function parseCards(e: DragEvent): Card[] {
  const multi = e.dataTransfer?.getData('application/x-graph-cards')
  if (multi) {
    try {
      const arr = JSON.parse(multi)
      if (Array.isArray(arr) && arr.length) return arr as Card[]
    } catch {
      /* ignore */
    }
  }
  const one = parseCard(e)
  return one ? [one] : []
}
function onZoneOver(frameId: string, laneId: string, e?: DragEvent) {
  if (laneDrag.value) {
    if (e) updateLaneDropTarget(frameId, laneId, e)
    return
  }
  // 保险：若窗口 dragstart 监听因浏览器差异未捕获，这里依据拖拽载荷类型补置 dragging，
  // 确保泳道间停靠区（gap-zone）正常显示
  if (e?.dataTransfer) {
    const list = Array.from(e.dataTransfer.types || [])
    if (
      list.includes('application/x-graph-card') ||
      list.includes('application/x-graph-cards') ||
      list.includes(FUNC_CARD_MIME)
    ) {
      dragging.value = true
    }
  }
  if (dragPayload.value?.copy && e?.dataTransfer) {
    // 复制拖拽：显式声明 dropEffect=copy。源端 effectAllowed=copy 时若目标端 dropEffect 不是 copy，
    // 浏览器会判定该操作不被允许、直接不发 drop（表现为「Ctrl 拖拽放不下去」）。
    e.dataTransfer.dropEffect = 'copy'
  }
  dropHover.frameId = frameId
  dropHover.zone = laneId
  // 拖拽卡片落在泳道空白处（不在卡片上）时也要给出插入位置提示：
  // 落在最后一张卡片下面 → 提示线挂在最后一张之后；落在第一张上面 → 挂在第一张之前。
  if (e && dragPayload.value?.source === 'node' && !laneId.startsWith('gap-')) {
    const t = e.target as HTMLElement | null
    if (!t?.closest?.('.node')) syncNodeDropFromPointer(e, frameId, laneId)
  }
}
// 按鼠标 Y 在泳道内算出插入位置，并把停靠指示线挂到对应卡片上
function syncNodeDropFromPointer(e: DragEvent, frameId: string, laneId: string) {
  const laneEl = (e.currentTarget as Element | null) || null
  if (!laneEl) return
  const movingIds = dragNodeIdsOf(dragPayload.value)
  const skip = new Set(movingIds)
  const rest = Array.from(laneEl.querySelectorAll('.node')).filter((x) => !skip.has(x.getAttribute('data-nid') || ''))
  if (!rest.length) {
    clearNodeDrop()
    return
  }
  const idx = dropIndexInLane(laneEl, e.clientY, movingIds)
  const at = idx < 0 ? rest.length : Math.min(idx, rest.length)
  const isLast = at >= rest.length
  const targetEl = isLast ? rest[rest.length - 1] : rest[at]
  nodeDrop.frameId = frameId
  nodeDrop.laneId = laneId
  nodeDrop.nodeId = targetEl.getAttribute('data-nid') || ''
  nodeDrop.pos = isLast ? 'after' : 'before'
}
function onZoneLeave() {
  dropHover.frameId = ''
  dropHover.zone = ''
  clearNodeDrop()
}
function onNodeDragStart(e: DragEvent, frameId: string, laneId: string, nodeId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  const node = f && f.nodes[nodeId]
  if (!node) return
  // 按住 Ctrl 拖拽 = 复制：选中的多张一起复制，未选中则只复制当前这张
  const copy = e.ctrlKey || e.metaKey
  // 被拖的卡片在选中集合里（且多选）时，整批一起搬运/复制；否则只处理它自己
  const movingIds = isNodeSelected(nodeId) && selNodes.value.length > 1 ? [...selNodes.value] : [nodeId]
  let clip: CanvasClip | null = null
  if (copy && f) {
    const snap = isNodeSelected(nodeId) ? snapshotBySelection() : snapshotOneNode(f, nodeId)
    // 卡片拖拽只复制卡片，不连带把选中的泳道也复制一份
    clip = snap ? { cards: snap.cards, lanes: [], edges: snap.edges } : null
  }
  dragPayload.value = { source: 'node', frameId, laneId, nodeId, nodeIds: movingIds, copy, clip }
  dragging.value = true
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = copy ? 'copy' : 'move'
    e.dataTransfer.setData('text/plain', nodeId)
    // 拖拽源是左侧小手柄，默认拖拽影像只有手柄那么大；这里改成整张卡片，
    // 拖动时才有「卡片随手浮动」的反馈。
    const cardEl = (e.currentTarget as HTMLElement | null)?.closest?.('.node') as HTMLElement | null
    if (cardEl) {
      const r = cardEl.getBoundingClientRect()
      try {
        e.dataTransfer.setDragImage(cardEl, e.clientX - r.left, e.clientY - r.top)
      } catch {
        /* 非真实拖拽（脚本派发的 dragstart）下该 API 会抛错，忽略即可 */
      }
    }
  }
}
function onDragEnd() {
  dragPayload.value = null
  dragging.value = false
  dropHover.frameId = ''
  dropHover.zone = ''
  clearNodeDrop()
  stopAutoScroll()
}
// 解析「复制拖拽」的快照：只要按下 Ctrl 拖 或 松手时按着 Ctrl 就算复制；
// 快照缺失时按当前选中项（被拖卡片在其中就用整批，否则只用这张）兜底重建，
// 避免 copy 为真但 clip 为空时静默退化成「移动」。
function resolveCopyClip(e: DragEvent): CanvasClip | null {
  const p = dragPayload.value
  if (!p || p.source !== 'node') return null
  if (!(p.copy || e.ctrlKey || e.metaKey)) return null
  if (p.clip) return p.clip
  const f = p.frameId ? frames.value.find((x) => x.id === p.frameId) : null
  if (!f || !p.nodeId) return null
  const snap = isNodeSelected(p.nodeId) ? snapshotBySelection() : snapshotOneNode(f, p.nodeId)
  return snap ? { cards: snap.cards, lanes: [], edges: snap.edges } : null
}
function onZoneDrop(frameId: string, laneId: string, e: DragEvent) {
  if (applyLaneDrop(frameId, laneId)) return
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const lane = f.lanes.find((l) => l.id === laneId)
  if (!lane) return

  const payload = dragPayload.value
  if (payload?.source === 'node') {
    // Ctrl 拖拽 = 复制：原件保留，克隆落到停靠位置（泳道内的插入下标由鼠标 Y 决定）
    const copyClip = resolveCopyClip(e)
    if (copyClip) {
      applyClip(f, lane, copyClip, dropIndexInLane(e.currentTarget as Element | null, e.clientY, ''))
      emitChange()
      onDragEnd()
      scheduleRecompute()
      return
    }
    const ids = dragNodeIdsOf(payload)
    if (!ids.length) {
      onDragEnd()
      return
    }
    if (!ids.some((id) => {
      const n = findFrameNodeById(id)
      return !!n && laneAccepts(lane.type, n)
    })) {
      // 移动已有卡片到主序列泳道：主序列只放「序列」卡片，静默失败最费解
      ElMessage.warning('主序列泳道只放「序列」卡片；这些卡片请放到其它泳道（可在右侧新建泳道）')
      onDragEnd()
      return
    }
    const laneEl = laneElOf(e)
    moveNodesToLane(f, lane, ids, dropIndexInLane(laneEl, e.clientY, ids))
    emitChange()
    onDragEnd()
    scheduleRecompute()
    return
  }

  const incoming = parseCards(e)
  const cards = incoming.filter((c) => laneAccepts(lane.type, c))
  if (!cards.length) {
    // 静默失败最费解：主序列泳道只收「序列」卡片，其余卡片需落到其它泳道或泳道之间的新建区
    if (incoming.length) {
      ElMessage.warning('主序列泳道只放「序列」卡片；函数/注入/检查类卡片请拖到其它泳道，或拖到泳道之间新建泳道')
    }
    onZoneLeave()
    return
  }
  // 新卡片按鼠标位置插入（与拖拽时的停靠提示一致），位置由顺序决定
  const laneEl = laneElOf(e)
  const baseIdx = lane.type === 'main' ? -1 : dropIndexInLane(laneEl, e.clientY, '')
  let nth = 0
  for (const card of cards) {
    const n = cardToNode(card)
    f.nodes[n.id] = n
    if (lane.type === 'main') {
      for (const nid of lane.nodeIds) {
        removeNodeEdges(f, nid, 'main')
        delete f.nodes[nid]
      }
      lane.nodeIds = [n.id]
    } else {
      const at = baseIdx < 0 ? lane.nodeIds.length : Math.min(baseIdx + nth, lane.nodeIds.length)
      lane.nodeIds.splice(at, 0, n.id)
    }
    nth++
  }
  onZoneLeave()
  emitChange()
  scheduleRecompute()
}
// 拖拽经过某张卡片：根据鼠标位于卡片上/下半区，显示「插入到此卡前/后」的停靠指示线
function onNodeOver(e: DragEvent, frameId: string, laneId: string, nodeId: string) {
  if (laneDrag.value) return
  if (dragPayload.value?.copy && e.dataTransfer) {
    // 复制拖拽落到卡片上：同样要显式声明 dropEffect=copy，否则浏览器不发 drop
    e.dataTransfer.dropEffect = 'copy'
  }
  const el = e.currentTarget as HTMLElement | null
  if (el) {
    const r = el.getBoundingClientRect()
    nodeDrop.pos = e.clientY < r.top + r.height / 2 ? 'before' : 'after'
  } else {
    nodeDrop.pos = 'after'
  }
  nodeDrop.frameId = frameId
  nodeDrop.laneId = laneId
  nodeDrop.nodeId = nodeId
}
// 拖到某张卡片上：同泳道内排序 / 跨泳道跨工况移动
function onCardDrop(frameId: string, laneId: string, targetNodeId: string, e: DragEvent) {
  if (applyLaneDrop(frameId, laneId)) return
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const lane = f.lanes.find((l) => l.id === laneId)
  if (!lane || lane.type === 'main') {
    onDragEnd()
    return
  }
  // 依据拖拽过程中记录的落点方向决定插到目标卡片之前还是之后
  const dropAfter = isNodeDropAfter(frameId, laneId, targetNodeId)
  const insertAt = (nodeId: string) => {
    const idx = lane.nodeIds.indexOf(targetNodeId)
    if (idx < 0) {
      lane.nodeIds.push(nodeId)
      return
    }
    lane.nodeIds.splice(dropAfter ? idx + 1 : idx, 0, nodeId)
  }

  const payload = dragPayload.value
  if (payload?.source === 'node' && payload.nodeId) {
    // Ctrl 拖拽 = 复制：原件保留，克隆插到目标卡片前/后
    const copyClip = resolveCopyClip(e)
    if (copyClip) {
      const idx = lane.nodeIds.indexOf(targetNodeId)
      applyClip(f, lane, copyClip, idx < 0 ? -1 : dropAfter ? idx + 1 : idx)
      emitChange()
      onDragEnd()
      scheduleRecompute()
      return
    }
    const ids = dragNodeIdsOf(payload)
    if (!ids.length || ids.includes(targetNodeId)) {
      // 拖到自己身上：无操作（与单张拖拽一致）
      onDragEnd()
      return
    }
    if (!ids.some((id) => {
      const n = findFrameNodeById(id)
      return !!n && laneAccepts(lane.type, n)
    })) {
      onDragEnd()
      return
    }
    // 插入下标按「移除这一批之后」的顺序算，多选时下标才不会被前面的选中项挤偏
    const movedSet = new Set(ids)
    const rest = lane.nodeIds.filter((x) => !movedSet.has(x))
    const tIdx = rest.indexOf(targetNodeId)
    const at = tIdx < 0 ? rest.length : dropAfter ? tIdx + 1 : tIdx
    moveNodesToLane(f, lane, ids, at)
    // 位置由泳道顺序决定（不再按鼠标高度留白）
    emitChange()
    onDragEnd()
    scheduleRecompute()
    return
  }

  const cards = parseCards(e)
  if (!cards.length) return
  let nthNew = 0
  for (const card of cards) {
    const n = cardToNode(card)
    f.nodes[n.id] = n
    insertAt(n.id)
    nthNew++
  }
  onZoneLeave()
  emitChange()
  scheduleRecompute()
}
function onCanvasDrop(e: DragEvent) {
  // 泳道拖动排序：落到泳道之外视为取消
  if (laneDrag.value) {
    onLaneDragEnd()
    return
  }
  // 画布内卡片被拖出工况（未落在任何泳道/卡片上）→ 删除
  const payload = dragPayload.value
  if (payload?.source === 'node' && payload.nodeId) {
    // 复制拖拽落在空白处：什么都不做（绝不能把原件删掉）
    if (payload.copy || e.ctrlKey || e.metaKey) {
      onDragEnd()
      return
    }
    const insideFrame = (e.target as HTMLElement | null)?.closest?.('.frame')
    if (insideFrame) {
      onDragEnd()
      return
    }
    // 整批一起拖出工况框 → 整批一起删除（与多选移动保持一致，Ctrl+Z 可撤销）
    const ids = dragNodeIdsOf(payload)
    let removed = 0
    for (const id of ids) {
      for (const fr of frames.value) {
        const lane = fr.lanes.find((l) => l.nodeIds.includes(id))
        if (!lane || !fr.nodes[id]) continue
        lane.nodeIds = lane.nodeIds.filter((x) => x !== id)
        removeNodeEdges(fr, id, lane.type)
        delete fr.nodes[id]
        removed++
        break
      }
    }
    if (removed) {
      emitChange()
      scheduleRecompute()
    }
    onDragEnd()
    return
  }

  const cards = parseCards(e)
  if (!cards.length) return
  const f = newFrame(`工况${frames.value.length + 1}`)
  // 序列卡进主序列泳道，其余卡片统一放入同一个泳道
  const otherLane: FrameLane = { id: genId('lane'), type: 'other', nodeIds: [] }
  for (const card of cards) {
    const n = cardToNode(card)
    f.nodes[n.id] = n
    if (card.type === 'sequence' && !f.lanes[0].nodeIds.length) {
      f.lanes[0].nodeIds = [n.id]
    } else {
      otherLane.nodeIds.push(n.id)
    }
  }
  if (otherLane.nodeIds.length) f.lanes.push(otherLane)
  frames.value.push(f)
  emitChange()
  emit('update:active-frame-id', f.id)
  scheduleRecompute()
}

// ===== 节点操作 =====
function removeNode(frameId: string, laneId: string, nodeId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const lane = f.lanes.find((l) => l.id === laneId)
  if (!lane) return
  lane.nodeIds = lane.nodeIds.filter((x) => x !== nodeId)
  removeNodeEdges(f, nodeId, lane.type)
  delete f.nodes[nodeId]
  emitChange()
  scheduleRecompute()
}

// ===== 连线坐标与渲染 =====
function portPos(frameId: string, key: string, side: 'in' | 'out') {
  const el = portEls[`${frameId}:${key}:${side}`]
  const body = bodyEls[frameId]
  // 泳道重排等操作可能让缓存的端口元素短暂脱离文档，视为未就绪触发重算
  if (!el || !body || !el.isConnected || !body.isConnected) return null
  const r = el.getBoundingClientRect()
  const b = body.getBoundingClientRect()
  return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }
}
function bezier(x1: number, y1: number, x2: number, y2: number, bow = 0) {
  const dx = Math.max(30, Math.abs(x2 - x1) * 0.5)
  return `M ${x1},${y1} C ${x1 + dx},${y1 + bow} ${x2 - dx},${y2 + bow} ${x2},${y2}`
}
// 三次贝塞尔曲线上的点（与 bezier 的控制点一致）
function bezierPoint(x1: number, y1: number, x2: number, y2: number, t: number, bow = 0) {
  const dx = Math.max(30, Math.abs(x2 - x1) * 0.5)
  const c1x = x1 + dx
  const c2x = x2 - dx
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return { x: a * x1 + b * c1x + c * c2x + d * x2, y: a * y1 + b * (y1 + bow) + c * (y2 + bow) + d * y2 }
}
// 编号标签在曲线上的候选位置（按顺序尝试，避免互相遮挡）
const LABEL_TS = [0.5, 0.62, 0.38, 0.72, 0.28, 0.8, 0.2, 0.88, 0.12]
/** 编号避让的冲突阈值（也是分桶的格宽/格高）：两枚编号在 34×20 内即视为遮挡 */
const LABEL_W = 34
const LABEL_H = 20
// 同源/同目标的连线在「离开/进入接线口之后的那一段」会贴在一起（实测 11 条汇进口 5、
// 7 条从口 6 分出，中途最短间距只有 2~3px）。所以分两层错开：
//   1) 接线口落点错开 fan：把 N 条的落点沿口上下均匀分开；
//   2) 中段控制点偏移 bow：控制点同向平移 bow，曲线两端仍吸附在接线口上，
//      但中段被推到各自的通道里，只在接近接线口时才收拢。
const PORT_FAN_HALF = 10 // 落点扇形最大半宽(px)
const PORT_FAN_STEP = 4 // 落点相邻两条线的间距上限(px)
const EDGE_BOW_HALF = 60 // 中段控制点偏移的最大半宽(px)
const EDGE_BOW_STEP = 12 // 中段相邻两条线的偏移差上限(px)
interface FanEdge {
  id: string
  fromKey: string
  toKey: string
  ax: number
  ay: number
  bx: number
  by: number
}
function computeEdgeLayout(items: FanEdge[]): {
  outDy: Record<string, number>
  inDy: Record<string, number>
  bow: Record<string, number>
} {
  const outDy: Record<string, number> = {}
  const inDy: Record<string, number> = {}
  const bow: Record<string, number> = {}
  const spread = (
    keyOf: (it: FanEdge) => string,
    otherY: (it: FanEdge) => number,
    dyMap: Record<string, number>,
  ) => {
    const groups = new Map<string, FanEdge[]>()
    for (const it of items) {
      const k = keyOf(it)
      const list = groups.get(k)
      if (list) list.push(it)
      else groups.set(k, [it])
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue
      const n = list.length
      // 按「另一端」的高度排序：从上方来的线落在口的上面，展开时不会在口上交叉
      list.sort((p, q) => otherY(p) - otherY(q))
      const fanStep = Math.min(PORT_FAN_STEP, (PORT_FAN_HALF * 2) / (n - 1))
      const bowStep = Math.min(EDGE_BOW_STEP, (EDGE_BOW_HALF * 2) / (n - 1))
      list.forEach((it, i) => {
        const k = i - (n - 1) / 2
        dyMap[it.id] = k * fanStep
        bow[it.id] = (bow[it.id] || 0) + k * bowStep
      })
    }
  }
  spread((it) => it.toKey, (it) => it.ay, inDy)
  spread((it) => it.fromKey, (it) => it.by, outDy)
  return { outDy, inDy, bow }
}
function recompute() {
  const cache: Record<string, EdgePath[]> = {}
  const caseNumsCache: Record<string, number[]> = {}
  // 同一次重算里端口位置是固定的：大量边共用同一个接线口，复用后 getBoundingClientRect
  // 的调用次数从「约 4×边数」降到「约 4×端口数」
  const posCache = new Map<string, { x: number; y: number } | null>()
  const portPosCached = (frameId: string, key: string, side: 'in' | 'out') => {
    const k = `${frameId}:${key}:${side}`
    if (!posCache.has(k)) posCache.set(k, portPos(frameId, key, side))
    return posCache.get(k) ?? null
  }
  let missing = 0
  // 只量当前展示的工况：其它工况不在 DOM 里，量不到端口还会把重试次数耗光
  for (const f of visibleFrames.value) {
    const arr: EdgePath[] = []
    const geom: Array<{ p: EdgePath; x1: number; y1: number; x2: number; y2: number; bow: number }> = []
    const { edgeNums, caseNums } = resolveFrameNumbers(f)
    caseNumsCache[f.id] = caseNums
    // 同一源接线口的出线若携带相同编号，只保留一个徽标（否则分叉/交叉处同一编号会出现两次）
    const badgeKeys = new Set<string>()
    // 第一遍：取每条边两端接线口的位置
    const raws: FanEdge[] = []
    for (const e of Object.values(f.edges)) {
      const a = portPosCached(f.id, e.from, 'out')
      const b = portPosCached(f.id, e.to, 'in')
      if (!a || !b) {
        missing++
        continue
      }
      raws.push({ id: e.id, fromKey: e.from, toKey: e.to, ax: a.x, ay: a.y, bx: b.x, by: b.y })
    }
    // 第二遍：接线口落点错开 + 中段控制点偏移后再生成曲线
    const fan = computeEdgeLayout(raws)
    for (const r of raws) {
      const e = f.edges[r.id]
      if (!e) continue
      const ay = r.ay + (fan.outDy[r.id] || 0)
      const by = r.by + (fan.inDy[r.id] || 0)
      const bow = fan.bow[r.id] || 0
      const nums = edgeNums.get(frameEdgeKey(e)) ?? []
      // 覆盖全部用例（或没有编号）时收敛成 All，否则一长串编号会把徽标撑得很长
      const label = numsDisplayText(nums, caseNums)
      // 同一源接线口 + 同一编号 + 同一目标卡片的重叠连线（并行边）只保留一个徽标；
      // 编号相同但目标不同的分叉必须各留一个，否则分支线会「缺号」。
      const badgeKey = e.from + '|' + label + '|' + e.to
      const badgeOnSelect = badgeKeys.has(badgeKey)
      badgeKeys.add(badgeKey)
      const p: EdgePath = {
        key: e.from + '->' + e.to,
        d: bezier(r.ax, ay, r.bx, by, bow),
        explicit: true,
        edgeId: e.id,
        mid: { x: (r.ax + r.bx) / 2, y: (ay + by) / 2 + bow * 0.75 },
        label,
        editable: true,
        badgeOnSelect,
        nums,
        geo: { x1: r.ax, y1: ay, x2: r.bx, y2: by, bow },
      }
      arr.push(p)
      geom.push({ p, x1: r.ax, y1: ay, x2: r.bx, y2: by, bow })
    }
    // 编号自动避让：沿曲线移动标签位置，避免互相遮挡。
    // 已放置的编号按 LABEL_W×LABEL_H 分桶，只比对邻近格子：
    // 原来每条边都要跟「已放置的全部编号」比一遍（O(9×边数²)，200 条边约 36 万次比较），
    // 拖窗口 / 拖分栏时每帧都跑，是这类操作卡顿的主要来源。
    const grid = new Map<string, Array<{ x: number; y: number }>>()
    const bucketOf = (x: number, y: number) => `${Math.floor(x / LABEL_W)}:${Math.floor(y / LABEL_H)}`
    const put = (p: { x: number; y: number }) => {
      const k = bucketOf(p.x, p.y)
      const b = grid.get(k)
      if (b) b.push(p)
      else grid.set(k, [p])
    }
    /** 与已放置编号是否冲突：只查 ±1 格（冲突阈值就是格宽/格高，更远的格子不可能命中） */
    const clashes = (cand: { x: number; y: number }) => {
      const cx = Math.floor(cand.x / LABEL_W)
      const cy = Math.floor(cand.y / LABEL_H)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${cx + dx}:${cy + dy}`)
          if (!bucket) continue
          for (const q of bucket) {
            if (Math.abs(q.x - cand.x) < LABEL_W && Math.abs(q.y - cand.y) < LABEL_H) return true
          }
        }
      }
      return false
    }
    /** 到已放置编号的最近距离：只查 ±2 格；窗外一定比窗内远（附近没有则返回 1e9） */
    const nearestGap = (cand: { x: number; y: number }) => {
      const cx = Math.floor(cand.x / LABEL_W)
      const cy = Math.floor(cand.y / LABEL_H)
      let best = 1e9
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const bucket = grid.get(`${cx + dx}:${cy + dy}`)
          if (!bucket) continue
          for (const q of bucket) {
            const d = Math.hypot(q.x - cand.x, q.y - cand.y)
            if (d < best) best = d
          }
        }
      }
      return best
    }
    for (const g of geom) {
      let pos: { x: number; y: number } | null = null
      for (const t of LABEL_TS) {
        const cand = bezierPoint(g.x1, g.y1, g.x2, g.y2, t, g.bow)
        if (!clashes(cand)) {
          pos = cand
          break
        }
      }
      if (!pos) {
        // 所有候选位置都被占用：取「离已有编号最远」的那个，避免两个编号直接叠在一起
        let bestGap = -1
        for (const t of LABEL_TS) {
          const cand = bezierPoint(g.x1, g.y1, g.x2, g.y2, t, g.bow)
          const gap = nearestGap(cand)
          if (gap > bestGap) {
            bestGap = gap
            pos = cand
          }
        }
      }
      if (!pos) pos = bezierPoint(g.x1, g.y1, g.x2, g.y2, 0.5, g.bow)
      put(pos)
      g.p.mid = pos
    }
    cache[f.id] = arr
  }
  edgePathCache.value = cache
  frameCaseNums.value = caseNumsCache
  // 端口 DOM 尚未就绪时（渲染/布局未完成）下一帧重试，避免连线漏画
  if (missing > 0 && recomputeTries < 8) {
    recomputeTries++
    requestAnimationFrame(recompute)
  } else {
    recomputeTries = 0
  }
}
let recomputeTries = 0
let recomputeScheduled = false
function scheduleRecompute() {
  recomputeTries = 0
  syncObserveBodies()
  // 一次操作常同时触发「回写 + 尺寸监听」，用 rAF 把同一帧内的多次调用合并成一次重算。
  // 原来用 nextTick 合并 —— 那是按微任务合并的，同一帧里仍可能连跑好几次。
  // rAF 在 DOM 更新之后、绘制之前执行，读端口位置正是时候。
  if (recomputeScheduled) return
  recomputeScheduled = true
  requestAnimationFrame(() => {
    recomputeScheduled = false
    recompute()
  })
}
// 监听工况框尺寸变化（停靠区显隐、泳道宽度、内容增减等）自动重算连线
let bodyResizeObserver: ResizeObserver | null = null
const observedBodies = new WeakSet<Element>()
function syncObserveBodies() {
  if (!bodyResizeObserver) return
  for (const el of Object.values(bodyEls)) {
    if (el && !observedBodies.has(el)) {
      observedBodies.add(el)
      bodyResizeObserver.observe(el)
    }
  }
}
// 拖拽开始/结束时停靠区显隐会改变布局，需重算连线
watch(dragging, () => {
  nextTick(() => {
    syncObserveBodies()
    scheduleRecompute()
  })
})
function setPortEl(frameId: string, key: string, side: 'in' | 'out', el: any) {
  if (el) {
    portEls[`${frameId}:${key}:${side}`] = el as HTMLElement
    ;(el as any).__portKey = key
  } else {
    delete portEls[`${frameId}:${key}:${side}`]
  }
}
function setBodyEl(frameId: string, el: any) {
  if (el) bodyEls[frameId] = el as HTMLElement
  else delete bodyEls[frameId]
}
const frameEls: Record<string, HTMLElement | null> = {}
function setFrameEl(frameId: string, el: any) {
  if (el) frameEls[frameId] = el as HTMLElement
  else delete frameEls[frameId]
}

// ===== 宽工况的横向导航 =====
// 工况比画布宽时（如 ADS_Ang「Eps Off->No Active」6 条泳道约 1692px，画布可视区可能只有 745px），
// 右侧泳道完全滚出视野，鼠标够不到那里的卡片，表现就是「卡片按不起来 / 拖不动 / 没法 Ctrl 拖拽复制」。
// 横向滚动只用一个显式手势：**指针停在「宽度超出画布」的工况上 + Shift+滚轮**。
// 普通滚轮一律不接管（工况只做上下滚动），避免宽工况上想上下翻却被横滚带走。
/** 指针是否停在「宽度超出画布」的工况框上：这类工况必须横向滚动才够得到右侧泳道 */
function pointerOnWideFrame(e: WheelEvent): boolean {
  const el = canvasEl.value
  if (!el) return false
  const frame = (e.target as HTMLElement | null)?.closest?.('.frame') as HTMLElement | null
  return !!frame && frame.offsetWidth > el.clientWidth
}
function onCanvasWheel(e: WheelEvent) {
  const el = canvasEl.value
  if (!el) return
  // 普通滚轮：不接管，保持默认的上下滚动
  if (!e.shiftKey) return
  // Shift+滚轮：只有指针停在宽工况上才横滚（Chrome 原生 Shift+滚轮本就是横向，这里自己算滚动量）
  if (!pointerOnWideFrame(e)) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return
  // 触控板 Shift 横滑时 deltaY 可能为 0，取 deltaX 兜底
  const d = e.deltaY || e.deltaX
  if (!d) return
  e.preventDefault()
  // Shift+滚轮只做横向：已经滚到该方向尽头就不再动，不转成纵向
  if (d > 0 ? el.scrollLeft >= max - 1 : el.scrollLeft <= 1) return
  el.scrollLeft += d
}

// ===== 拖拽时边缘自动滚动 =====
// 泳道一多，工况框就比可视区宽很多（如 ADS_Ang「Eps Off->No Active」6 条泳道约 2561px，
// 而画布可视宽度可能只有 835px）。此时右侧泳道里的卡片能抓到，但可放置的泳道全在可视区外，
// HTML5 拖拽自带的边缘自动滚动在这种嵌套滚动容器里不可靠，表现为「拖不动 / 松手没反应」。
// 这里在 dragover 里按指针到画布边缘的距离自己滚动，保证跨泳道的卡片搬运可用。
const AUTO_SCROLL_EDGE = 70
const AUTO_SCROLL_MAX = 26
const autoScroll = { x: 0, y: 0, raf: 0, lastOver: 0 }
function stopAutoScroll() {
  autoScroll.x = 0
  autoScroll.y = 0
  autoScroll.lastOver = 0
  if (autoScroll.raf) {
    cancelAnimationFrame(autoScroll.raf)
    autoScroll.raf = 0
  }
}
function autoScrollStep() {
  autoScroll.raf = 0
  const el = canvasEl.value
  // 指针已离开画布（dragover 停止触发）或拖拽已结束：停止滚动。
  // 宽限 500ms：指针静止时浏览器约每 350ms 才补发一次 dragover，窗口太短会滚得一顿一顿。
  if (!el || !autoScroll.lastOver || performance.now() - autoScroll.lastOver > 500) {
    autoScroll.x = 0
    autoScroll.y = 0
    return
  }
  if (!autoScroll.x && !autoScroll.y) return
  el.scrollLeft += autoScroll.x
  el.scrollTop += autoScroll.y
  autoScroll.raf = requestAnimationFrame(autoScrollStep)
}
function onCanvasDragOverScroll(e: DragEvent) {
  const el = canvasEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  // 越靠近边缘滚得越快（0 ~ AUTO_SCROLL_MAX px/帧）
  const speed = (dist: number): number =>
    Math.max(0, Math.min(AUTO_SCROLL_MAX, Math.round(((AUTO_SCROLL_EDGE - dist) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX)))
  const left = e.clientX - r.left
  const right = r.right - e.clientX
  const top = e.clientY - r.top
  const bottom = r.bottom - e.clientY
  autoScroll.x = left < AUTO_SCROLL_EDGE ? -speed(left) : right < AUTO_SCROLL_EDGE ? speed(right) : 0
  autoScroll.y = top < AUTO_SCROLL_EDGE ? -speed(top) : bottom < AUTO_SCROLL_EDGE ? speed(bottom) : 0
  autoScroll.lastOver = performance.now()
  if ((autoScroll.x || autoScroll.y) && !autoScroll.raf) {
    autoScroll.raf = requestAnimationFrame(autoScrollStep)
  }
}
// 点击工况列表选中时，滚动画布到对应工况框
function scrollToFrame(id: string) {
  if (!id) return
  nextTick(() => {
    const el = frameEls[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
watch(
  () => props.selectedFrameId,
  (id) => scrollToFrame(id || ''),
  { immediate: true },
)
function edgePaths(frameId: string): EdgePath[] {
  return edgePathCache.value[frameId] || []
}

/** 选中连线按工况汇总的生效序号集合（「相同序号一起高亮」的比对依据） */
const selectedEdgeNums = computed<Record<string, number[]>>(() => {
  const map: Record<string, number[]> = {}
  if (!selectedEdgeIds.value.length) return map
  const want = new Set(selectedEdgeIds.value)
  for (const [fid, arr] of Object.entries(edgePathCache.value)) {
    for (const p of arr) {
      if (!want.has(p.edgeId)) continue
      const list = map[fid] ?? (map[fid] = [])
      for (const n of p.nums) if (!list.includes(n)) list.push(n)
    }
  }
  return map
})

/**
 * 连线是否处于高亮态：选中的那些，**以及（仅单击选中时）同一工况内**与它们共享序号的所有连线。
 *  「只高亮选中」还是「连同一编号一起高亮」由 `highlightSameNum` 决定：单击展开（便于读整条用例链路），
 *  Ctrl 追加多选 / 框选时不展开。序号只在单个工况内编号，跨工况同号没有关联意义，所以不跨工况高亮。
 *  汇合处继承多个编号的连线按「交集非空」判定，即只要有一条共同的序号就算同号；
 *  未编号的连线（`nums` 为空，徽标显示 `All`）不参与同号匹配，只高亮自身。
 */
function isEdgeHighlighted(p: EdgePath, frameId: string): boolean {
  if (!p.explicit) return false
  if (selectedEdgeIds.value.includes(p.edgeId)) return true
  if (!highlightSameNum.value) return false
  const nums = selectedEdgeNums.value[frameId]
  if (!nums || !nums.length) return false
  return p.nums.some((n) => nums.includes(n))
}

/**
 * 高亮连线对应的用例行号：把「连线编号」与下方「用例展开」列表对上号。
 * 用例行与编号同序 —— `resolveFrameNumbers` 的 caseNums 是由小到大排的编号集合，
 * 画布展开的用例行（`frameCaseRowsWithLookups`）也按同一顺序逐行生成，故行号 = 编号在 caseNums 里的下标。
 * 只要选了连线就高亮（单击同编号展开 / Ctrl 多选 / 框选都算），未选连线时为空。
 */
const highlightedCaseRows = computed<Record<string, number[]>>(() => {
  const map: Record<string, number[]> = {}
  for (const [fid, nums] of Object.entries(selectedEdgeNums.value)) {
    if (!nums.length) continue
    const rows: number[] = []
    ;(frameCaseNums.value[fid] || []).forEach((n, i) => {
      if (nums.includes(n)) rows.push(i)
    })
    if (rows.length) map[fid] = rows
  }
  return map
})
function isCaseRowHighlighted(f: CaseFrame, row: number): boolean {
  return (highlightedCaseRows.value[f.id] || []).includes(row)
}

// ===== 连线创建与序号 =====
function onPortOutDown(e: MouseEvent, frameId: string, key: string) {
  e.preventDefault()
  const pos = portPos(frameId, key, 'out')
  if (!pos) return
  linkDrag.value = { frameId, fromKey: key }
  tempLine.value = { frameId, d: bezier(pos.x, pos.y, pos.x, pos.y) }
  window.addEventListener('mousemove', onLinkMove)
  window.addEventListener('mouseup', onLinkUp)
}
function onPortInDown() {
  /* 仅落点，由 mouseup 命中检测 */
}
function onPortMousedown(e: MouseEvent, frameId: string, key: string, side: 'in' | 'out') {
  if (side === 'out') onPortOutDown(e, frameId, key)
  else onPortInDown()
}
// 连线方向是否合法：卡片→卡片（两端不同）、卡片→主序列、主序列→卡片
function edgeDirOk(fromKey: string, toKey: string): boolean {
  const fromNode = isNodeKey(fromKey)
  const toNode = isNodeKey(toKey)
  return (
    (fromNode && toNode && fromKey !== toKey) ||
    (fromNode && toKey.startsWith('seq:')) ||
    (fromKey.startsWith('seq:') && toNode)
  )
}
// 创建一条连线（拖拽释放或点击两个端口都会调用），方向校验在内部完成
function createEdge(frameId: string, fromKey: string, toKey: string): boolean {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return false
  if (!edgeDirOk(fromKey, toKey)) return false
  const eid = genId('edge')
  // 新连线默认不写编号：由起始卡片顺序排号 / 继承左侧连线编号
  const edge: FrameEdge = { id: eid, from: fromKey, to: toKey }
  f.edges[eid] = edge
  emitChange()
  scheduleRecompute()
  return true
}
/** 批量连线：已多选卡片（≥2）时，Ctrl 点接线口一次把选中的卡片都连到这个口上。
 *  点的是输入口 → 各选中卡片「输出 → 该输入口」；点的是输出口 → 「该输出口 → 各选中卡片输入」。
 *  方向逐条按 edgeDirOk 校验，全不合法时给一次提示；成功时只 emitChange 一次（避免 N 次整图回写）。 */
function batchConnect(frameId: string, key: string, side: 'in' | 'out'): boolean {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return false
  const nids = selNodes.value.filter((nid) => !!f.nodes[nid])
  if (nids.length < 2) return false
  let ok = 0
  for (const nid of nids) {
    const nodeKey = 'node:' + nid
    const fromKey = side === 'in' ? nodeKey : key
    const toKey = side === 'in' ? key : nodeKey
    if (fromKey === toKey || !edgeDirOk(fromKey, toKey)) continue
    const eid = genId('edge')
    f.edges[eid] = { id: eid, from: fromKey, to: toKey }
    ok++
  }
  if (!ok) {
    ElMessage.warning('连线方向不合法（仅支持：卡片→卡片、卡片→主序列、主序列→卡片）')
    return true
  }
  emitChange()
  scheduleRecompute()
  ElMessage.success(`已创建 ${ok} 条连线`)
  return true
}
/** 批量改接的目标集合 = **与「高亮」完全一致**的那批连线（直接复用 isEdgeHighlighted，
 *  高亮规则改了这里自动跟着改，不会出现「亮着的没被改 / 改了的没亮着」）。 */
function highlightedEdgeIds(frameId: string): string[] {
  const out: string[] = []
  for (const p of edgePathCache.value[frameId] ?? []) {
    if (isEdgeHighlighted(p, frameId)) out.push(p.edgeId)
  }
  return out
}
/** 批量改接：把「当前工况里选中的连线」的对应端改到点中的这个接线口。
 *  点输入口 → 改各连线的 to；点输出口 → 改各连线的 from（与 batchConnect 的约定同源）。
 *  目标集合与高亮一致（同序号的连线会跟着一起改），但**只改「同类接线口」的那一端**：
 *  点卡片上的口 → 只改同样接在卡片口上的那些线；点主序列（步骤）的口 → 只改接在序列口上的那些线。
 *  否则同一序号里混着的注入线（卡片→主序列）与结果线（主序列→卡片）会被一起改，
 *  注入线的 to 会被塞成一张卡片 —— 表现为「接到不相干的卡片上」。
 *  只按 edgeDirOk 判方向；最后只 emitChange / scheduleRecompute 各一次，
 *  所以一次 Ctrl+Z 能把整批改接撤销回去。 */
function repointSelectedEdges(frameId: string, key: string, side: 'in' | 'out'): boolean {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return false
  const ids = highlightedEdgeIds(frameId).filter((eid) => !!f.edges[eid])
  if (ids.length < 2) return false

  const end: 'from' | 'to' = side === 'in' ? 'to' : 'from'
  // 「单击展开同编号」时目标里混着三类线（注入线 / 结果线 / 链式线），要保守：只动与该口同类、
  // 且另一端接在主序列上的那些；而框选 / Ctrl 多选出来的线是用户**明确要改**的，一律照改
  // （仍然过 edgeDirOk，结构上不成立的方向照样挡掉）。
  const conservative = highlightSameNum.value
  const targetIsSeq = !!parseSeqPortKey(key)
  let ok = 0
  let badDir = 0
  let same = 0
  let kind = 0
  let offSeq = 0
  for (const eid of ids) {
    const e = f.edges[eid]
    const curEnd = end === 'from' ? e.from : e.to
    const otherEnd = end === 'from' ? e.to : e.from
    const fromKey = end === 'from' ? key : e.from
    const toKey = end === 'to' ? key : e.to
    if (fromKey === e.from && toKey === e.to) {
      same++
      continue
    }
    if (conservative) {
      // 要改的这一端与点中的口不是同类 → 跳过（别把注入线的 to 从序列口改成卡片口）
      if (!!parseSeqPortKey(curEnd) !== targetIsSeq) {
        kind++
        continue
      }
      // 另一端也不接主序列（纯卡片↔卡片的链）→ 不参与，省得被改到不相干的卡片上
      if (!parseSeqPortKey(otherEnd)) {
        offSeq++
        continue
      }
    }
    if (!edgeDirOk(fromKey, toKey)) {
      badDir++
      continue
    }
    e.from = fromKey
    e.to = toKey
    ok++
  }

  if (ok) {
    emitChange()
    scheduleRecompute()
  }
  const skip = badDir + same + kind + offSeq
  const reasons: string[] = []
  if (badDir) reasons.push(`方向不合法 ${badDir}`)
  if (same) reasons.push(`无需改动 ${same}`)
  if (kind) reasons.push(`接线口类型不同 ${kind}`)
  if (offSeq) reasons.push(`不接主序列 ${offSeq}`)
  const detail = reasons.join('、')
  if (ok && !skip) ElMessage.success(`已改接 ${ok} 条连线`)
  else if (ok) ElMessage.success(`已改接 ${ok} 条连线，跳过 ${skip} 条（${detail}）`)
  else ElMessage.warning(`未改接任何连线（${detail}）`)
  return true
}
// 连线拖拽：mousemove 合并到下一帧（每次都要读 body/端口 rect 并写 tempLine → 整树重渲染）
let linkRaf = 0
let linkPending: MouseEvent | null = null
function onLinkMove(e: MouseEvent) {
  linkPending = e
  if (linkRaf) return
  linkRaf = requestAnimationFrame(() => {
    linkRaf = 0
    const ev = linkPending
    if (!ev) return
    const drag = linkDrag.value
    if (!drag) return
    const body = bodyEls[drag.frameId]
    if (!body) return
    const b = body.getBoundingClientRect()
    const x = ev.clientX - b.left
    const y = ev.clientY - b.top
    const from = portPos(drag.frameId, drag.fromKey, 'out')
    if (from) tempLine.value = { frameId: drag.frameId, d: bezier(from.x, from.y, x, y) }
  })
}
function onLinkUp(e: MouseEvent) {
  if (linkRaf) {
    cancelAnimationFrame(linkRaf)
    linkRaf = 0
  }
  linkPending = null
  const drag = linkDrag.value
  linkDrag.value = null
  tempLine.value = { frameId: '', d: '' }
  window.removeEventListener('mousemove', onLinkMove)
  window.removeEventListener('mouseup', onLinkUp)
  if (!drag) return
  const target = document.elementFromPoint(e.clientX, e.clientY)
  const portEl = target && (target as HTMLElement).closest ? (target as HTMLElement).closest('.port-in') : null
  const toKey = portEl ? (portEl as any).__portKey : null
  if (toKey) createEdge(drag.frameId, drag.fromKey, toKey)
  scheduleRecompute()
}
// 点击连线：第一次点输出端口记录起点（再次点同一端口取消）
function onPortOutClick(frameId: string, key: string) {
  if (clickLinkFrom.value && clickLinkFrom.value.fromKey === key) {
    clickLinkFrom.value = null
    ElMessage.info('已取消连线起点')
    return
  }
  clickLinkFrom.value = { frameId, fromKey: key }
  ElMessage.info('已选择起点端口，请按住Ctrl点击目标输入端口完成连线')
}
// 判断某个输出端口是否为当前点击连线的起点（用于高亮）
function isPortSelected(frameId: string, key: string): boolean {
  return !!clickLinkFrom.value && clickLinkFrom.value.frameId === frameId && clickLinkFrom.value.fromKey === key
}
// 点击连线：点输入端口，若有起点则创建连线
function onPortInClick(frameId: string, key: string) {
  const from = clickLinkFrom.value
  if (!from) return
  clickLinkFrom.value = null
  if (from.frameId !== frameId) {
    ElMessage.warning('起点和目标不在同一工况')
    return
  }
  if (!createEdge(frameId, from.fromKey, key)) {
    ElMessage.warning('连线方向不合法（仅支持：卡片→卡片、卡片→主序列、主序列→卡片）')
    return
  }
  ElMessage.success('已创建连线')
}
function onPortClick(frameId: string, key: string, side: 'in' | 'out', e: MouseEvent) {
  // 裸点击：已多选连线（≥2）→ 把这些连线的对应端批量改接到这个口；否则维持现状（什么都不做）
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    repointSelectedEdges(frameId, key, side)
    return
  }
  // 已多选卡片（≥2）时：Ctrl 点接线口 = 批量连线，不再走「记住起点 → 再点终点」两步流程
  if (batchConnect(frameId, key, side)) return
  if (side === 'out') onPortOutClick(frameId, key)
  else onPortInClick(frameId, key)
}
// 按住 Ctrl 点击卡片：无起点时选中其输出口，有起点时连到其输入口
function onCardCtrlClick(frameId: string, nodeId: string) {
  const key = 'node:' + nodeId
  if (!clickLinkFrom.value) onPortOutClick(frameId, key)
  else onPortInClick(frameId, key)
}
// 连线：单击细线高亮/取消高亮（Ctrl/Shift+单击追加或取消），双击细线删除
function toggleEdgeSel(edgeId: string, additive = false) {
  const cur = selectedEdgeIds.value
  if (additive) {
    // Ctrl / Shift 追加多选：只高亮选中的这些，不展开同编号
    highlightSameNum.value = false
    selectedEdgeIds.value = cur.includes(edgeId) ? cur.filter((x) => x !== edgeId) : [...cur, edgeId]
    return
  }
  // 普通单击：它已经是唯一选中 → 取消；否则只选中它，并把同编号的连线一起高亮（便于读整条用例链路）
  const cancel = cur.length === 1 && cur[0] === edgeId
  highlightSameNum.value = !cancel
  selectedEdgeIds.value = cancel ? [] : [edgeId]
}
function removeEdge(frameId: string, edgeId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  if (!f || !f.edges[edgeId]) return
  const label = edgeNumsLabel(f.edges[edgeId]) || 'All'
  if (selectedEdgeIds.value.includes(edgeId)) {
    selectedEdgeIds.value = selectedEdgeIds.value.filter((x) => x !== edgeId)
  }
  delete f.edges[edgeId]
  emitChange()
  ElMessage.success(`已删除连线（序号 ${label}），Ctrl+Z 可撤销`)
  scheduleRecompute()
}

// ===== 框选（卡片 + 连线） =====
/** 框选矩形（视口坐标）；null = 没在框选 */
const marquee = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
/** 位移超过这么多像素才算框选，否则当普通点击（保证单击选泳道 / 卡片不受影响） */
const MARQUEE_MIN = 4
/** 框选起点（视口坐标）—— 起点锚在画布内容上：框选期间滚动画布时按滚动量反向平移 */
let marqueeStart: { x: number; y: number } | null = null
/** 起点补偿的参照：按下时画布的滚动位置 */
let marqueeScrollAtStart = { left: 0, top: 0 }
/** 最近一次指针位置：滚动发生时用它 + 补偿后的起点重算矩形 */
let marqueeLast: { x: number; y: number } | null = null
/** 框选结束后的那次 click 要吞掉，否则会顺手改掉泳道 / 画布 / 卡片的选中态 */
let suppressClick = false

/** 把框裁到画布可视区：选择框不画到画布外（否则会盖住页签 / 底部提示） */
function clampToCanvas(r: { x1: number; y1: number; x2: number; y2: number }) {
  const el = canvasEl.value
  if (!el) return r
  const b = el.getBoundingClientRect()
  return {
    x1: Math.max(r.x1, b.left),
    y1: Math.max(r.y1, b.top),
    x2: Math.min(r.x2, b.right),
    y2: Math.min(r.y2, b.bottom),
  }
}

const marqueeStyle = computed(() => {
  const m = marquee.value
  if (!m) return {}
  const c = clampToCanvas(m)
  return {
    left: `${c.x1}px`,
    top: `${c.y1}px`,
    width: `${Math.max(0, c.x2 - c.x1)}px`,
    height: `${Math.max(0, c.y2 - c.y1)}px`,
  }
})

/* 画布内任意位置按下时，先把焦点从「输入框」上摘掉。
   原因：`.label-badge` / `.lane-resizer` 的 mousedown 带 preventDefault（浏览器因此不会移走焦点），
   焦点若还留在面板输入框上，快捷键派发层会按「焦点在可编辑元素内」跳过 Delete，
   表现为「明明选中了连线/卡片，按 Delete 却没反应」。捕获阶段执行，保证早于子元素的 .stop/.prevent。 */
function onCanvasMouseDownCapture(e: MouseEvent) {
  const ae = document.activeElement as HTMLElement | null
  if (!ae || ae === document.body || ae === e.target) return
  const tag = ae.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae.isContentEditable) ae.blur()
}
function onCanvasMouseDown(e: MouseEvent) {
  // 上一次框选若没跟来 click（松手落在画布外），这里兜底清掉标志与残留的禁选状态
  suppressClick = false
  document.body.style.userSelect = ''
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return
  const t = e.target as HTMLElement | null
  if (!t?.closest?.('.cfc-canvas')) return
  // 卡片 / 端口 / 泳道头 / 泳道拖宽条 / 连线编号与编辑框 / 拖放停靠区 / 按钮与输入框：各自有手势，不接管
  if (t.closest('.node, .port, .lane-head, .lane-resizer, .edge-label, .edge-input, .gap-zone, button, input, textarea')) return
  /* 拖拽期间禁掉原生文本选择（拖过卡片时不该把卡面文字刷蓝）。
     这里**不能用 e.preventDefault()** —— 它同时会阻止浏览器把焦点从当前输入框移走，
     焦点留在输入框上时，快捷键派发层会按「焦点在可编辑元素内」跳过 Delete
     （见 useShortcuts.ts 的 isEditableEl 分支），表现为「框选完按 Delete 没反应」。 */
  document.body.style.userSelect = 'none'
  marqueeStart = { x: e.clientX, y: e.clientY }
  marqueeLast = { x: e.clientX, y: e.clientY }
  marqueeScrollAtStart = { left: canvasEl.value?.scrollLeft ?? 0, top: canvasEl.value?.scrollTop ?? 0 }
  window.addEventListener('mousemove', onMarqueeMove)
  window.addEventListener('mouseup', onMarqueeUp)
  canvasEl.value?.addEventListener('scroll', onMarqueeScroll)
}
/** 按「起点 + 当前指针（视口坐标）」重算矩形；位移不够阈值时当普通点击，不出框 */
function applyMarquee(s: { x: number; y: number }, cx: number, cy: number) {
  const dx = cx - s.x
  const dy = cy - s.y
  if (!marquee.value && Math.abs(dx) < MARQUEE_MIN && Math.abs(dy) < MARQUEE_MIN) return
  marquee.value = {
    x1: Math.min(s.x, cx),
    y1: Math.min(s.y, cy),
    x2: Math.max(s.x, cx),
    y2: Math.max(s.y, cy),
  }
}
/* 框选期间滚动画布：把起点按滚动量反向平移，让它始终钉在同一块画布内容上。
   矩形是 position: fixed 的视口坐标，不补偿就会「粘在视口上」、随内容一起滑走。 */
function onMarqueeScroll() {
  const el = canvasEl.value
  const s = marqueeStart
  if (!el || !s) return
  s.x -= el.scrollLeft - marqueeScrollAtStart.left
  s.y -= el.scrollTop - marqueeScrollAtStart.top
  marqueeScrollAtStart = { left: el.scrollLeft, top: el.scrollTop }
  // 已经拉出框才跟着重画；只滚不拖（还没过阈值）时凭空生成选择框不合适
  if (marquee.value && marqueeLast) applyMarquee(s, marqueeLast.x, marqueeLast.y)
}
function onMarqueeMove(e: MouseEvent) {
  const s = marqueeStart
  if (!s) return
  marqueeLast = { x: e.clientX, y: e.clientY }
  applyMarquee(s, e.clientX, e.clientY)
}
function onMarqueeUp() {
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeUp)
  canvasEl.value?.removeEventListener('scroll', onMarqueeScroll)
  document.body.style.userSelect = ''
  marqueeStart = null
  marqueeLast = null
  const r = marquee.value
  marquee.value = null
  if (!r) return
  suppressClick = true
  // 选中范围**不裁**到画布可视区：框内但已滚出可视区的对象同样要选中
  // （clampToCanvas 只用于画面上那个矩形的显示）
  selectInRect(r)
}
/** 吞掉框选结束后的那次 click（捕获阶段拦下，避免触发泳道 / 画布 / 卡片的点击逻辑）。
 *  用 stopImmediatePropagation：框起点与终点都落在画布留白上时，click 的目标就是 .cfc-canvas
 *  本身，而 @click.self="clearSelection()" 挂在同一个元素上 —— stopPropagation 拦不住同元素上的
 *  其它监听，会让刚框出来的选中态被立刻清空。 */
function onCanvasClickCapture(e: MouseEvent) {
  if (!suppressClick) return
  suppressClick = false
  e.stopImmediatePropagation()
  e.stopPropagation()
  e.preventDefault()
}

/** 线段是否与矩形相交（Liang–Barsky 裁剪） */
function segHitsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number,
): boolean {
  let t0 = 0
  let t1 = 1
  const dx = x2 - x1
  const dy = y2 - y1
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  return clip(-dx, x1 - rx1) && clip(dx, rx2 - x1) && clip(-dy, y1 - ry1) && clip(dy, ry2 - y1)
}

/** 曲线是否与框接触：按 16 段折线近似逐段判交（比外接矩形判定准，斜线不会误命中） */
function curveHitsRect(p: EdgePath, lx1: number, ly1: number, lx2: number, ly2: number): boolean {
  const N = 16
  let px = p.geo.x1
  let py = p.geo.y1
  for (let i = 1; i <= N; i++) {
    const q = bezierPoint(p.geo.x1, p.geo.y1, p.geo.x2, p.geo.y2, i / N, p.geo.bow)
    if (segHitsRect(px, py, q.x, q.y, lx1, ly1, lx2, ly2)) return true
    px = q.x
    py = q.y
  }
  return false
}

/** 框选：与框接触的连线 + 与框相交的卡片一起选中（不要求整条 / 整张落在框里） */
function selectInRect(r: { x1: number; y1: number; x2: number; y2: number }) {
  const edgeHit: string[] = []
  const nodeHit: string[] = []
  for (const f of frames.value) {
    const body = bodyEls[f.id]
    if (!body) continue
    const b = body.getBoundingClientRect()
    // 视口坐标 → 工况框内坐标（EdgePath 的几何是相对 frame-body 的）
    const lx1 = r.x1 - b.left
    const ly1 = r.y1 - b.top
    const lx2 = r.x2 - b.left
    const ly2 = r.y2 - b.top
    if (lx2 < 0 || ly2 < 0 || lx1 > b.width || ly1 > b.height) continue
    for (const p of edgePathCache.value[f.id] || []) {
      if (p.explicit && curveHitsRect(p, lx1, ly1, lx2, ly2)) edgeHit.push(p.edgeId)
    }
    // 卡片：先把框裁到工况可视区，再与卡片矩形求交 —— 否则会命中已横向滚出可视区的卡片
    const vx1 = Math.max(r.x1, b.left)
    const vy1 = Math.max(r.y1, b.top)
    const vx2 = Math.min(r.x2, b.right)
    const vy2 = Math.min(r.y2, b.bottom)
    if (vx2 < vx1 || vy2 < vy1) continue
    for (const el of body.querySelectorAll<HTMLElement>('.node[data-nid]')) {
      const t = el.getBoundingClientRect()
      if (t.right < vx1 || t.left > vx2 || t.bottom < vy1 || t.top > vy2) continue
      const nid = el.dataset.nid
      if (nid) nodeHit.push(nid)
    }
  }
  // 框选：只高亮选中的那些，不展开同编号（同编号高亮只留给「单击一条线 / 编号徽标」的手势）
  highlightSameNum.value = false
  selectedEdgeIds.value = edgeHit
  selNodes.value = nodeHit
  selLanes.value = []
  const parts: string[] = []
  if (nodeHit.length) parts.push(`${nodeHit.length} 张卡片`)
  if (edgeHit.length) parts.push(`${edgeHit.length} 条连线`)
  if (parts.length) ElMessage.success(`已选中 ${parts.join('、')}（Delete 删除；选中多条后点接线口可批量改接）`)
}

// ===== 连线序号就地编辑 =====
/** 单个片段展开后允许的最大项数：防止 `1-999999` 把数组撑爆 */
const EDGE_NUM_CAP = 500
/**
 * 解析编号串：支持 `,` / `，` / 空白分隔，片段可为
 *   单个正整数 `5`
 *   范围 `a-b`（a>b 自动翻转，如 `8-3` = 3..8）
 *   范围 + 步进 `a-b/s`（s 非法或 ≤0 时按 1 处理，如 `2-20/2` = 2,4,…,20）
 * 非法片段忽略；整体去重、升序；空串 = `[]`（= 全部）。
 */
function parseEdgeNums(raw: string): number[] {
  if (!raw) return []
  const out = new Set<number>()
  for (const part of raw.split(/[,，\s]+/)) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?(?:\s*\/\s*(\d+))?$/.exec(part)
    if (!m) continue
    const a = Number(m[1])
    if (!Number.isInteger(a) || a <= 0) continue
    if (m[2] === undefined) {
      out.add(a)
      continue
    }
    const b = Number(m[2])
    if (!Number.isInteger(b) || b <= 0) continue
    const step = m[3] === undefined ? 1 : Number(m[3])
    const s = Number.isInteger(step) && step > 0 ? step : 1
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    let n = 0
    for (let v = lo; v <= hi; v += s) {
      out.add(v)
      if (++n >= EDGE_NUM_CAP) break
    }
  }
  return Array.from(out).sort((a, b) => a - b)
}
function edgeNumsLabel(e: FrameEdge): string {
  if (e.pair && e.pair.length) return e.pair.join(',')
  return String(e.seq ?? '')
}
/** 连线当前「存储的显式编号」（不含继承 / 配对的结果），用于推导候选编号 */
function storedEdgeNums(e: FrameEdge): number[] {
  return edgeKind(e) === 'entry' ? parseEdgeNums(edgeNumsLabel(e)) : (e.pair ?? [])
}
/**
 * 生效编号的展示文案：覆盖了该工况的全部用例编号（或没有任何编号）时收敛成 `All`
 * —— 否则一条「全部」的线会把 1,2,3…30 全列出来，徽标与面板都被撑得很长。
 */
function numsDisplayText(nums: number[], caseNums: number[]): string {
  if (!nums.length) return 'All'
  if (caseNums.length && nums.length >= caseNums.length) {
    const set = new Set(nums)
    if (caseNums.every((n) => set.has(n))) return 'All'
  }
  return nums.join(',')
}

// ===== 编号选择器（候选编号点选 / 多选 / 框选） =====
/** 候选编号 = 本工况在用的编号（caseNums）∪ 该线已填的号，升序去重 */
function numCandidates(frameId: string, edgeId: string): number[] {
  const f = frames.value.find((x) => x.id === frameId)
  const e = f && f.edges[edgeId]
  if (!e) return []
  const set = new Set<number>(frameCaseNums.value[frameId] || [])
  for (const n of storedEdgeNums(e)) set.add(n)
  return Array.from(set).sort((a, b) => a - b)
}
/** chips 的选中态没有独立状态：单一真源就是 editingEdgeValue 这个字符串 */
const draftNums = computed(() => parseEdgeNums(editingEdgeValue.value))
const selectedNumSet = computed(() => new Set(draftNums.value))
/** 打开面板时回填的编号：用来判断「没改动就直接关闭」，避免把自动排号/继承的编号写死成显式编号 */
let edgeSeedNums: number[] = []
/** Shift 区间连选的锚点（chips 下标）；打开面板 / 提交 / 取消时复位 */
let numAnchorIdx: number | null = null
function edgeKindText(frameId: string, edgeId: string): string {
  const f = frames.value.find((x) => x.id === frameId)
  const e = f && f.edges[edgeId]
  if (!e) return ''
  const k = edgeKind(e)
  return k === 'entry' ? '注入线' : k === 'exit' ? '结果线' : '链式线'
}
function writeNumSelection(set: Set<number>) {
  editingEdgeValue.value = Array.from(set)
    .sort((a, b) => a - b)
    .join(',')
}
/** 点 chip：普通单击 = 单选；Ctrl/Cmd = 切换；Shift = 从锚点到本 chip 整段选中（不取消） */
function onChipClick(n: number, e: MouseEvent) {
  const cands = numCandidates(editingEdgeFrameId.value, editingEdgeId.value)
  const idx = cands.indexOf(n)
  const cur = new Set(parseEdgeNums(editingEdgeValue.value))
  if (e.shiftKey && numAnchorIdx !== null && numAnchorIdx >= 0 && numAnchorIdx < cands.length) {
    const a = Math.min(numAnchorIdx, idx)
    const b = Math.max(numAnchorIdx, idx)
    for (let i = a; i <= b; i++) cur.add(cands[i])
  } else if (e.ctrlKey || e.metaKey) {
    if (cur.has(n)) cur.delete(n)
    else cur.add(n)
    numAnchorIdx = idx
  } else {
    // 已唯一选中它 → 取消；否则只选它
    if (cur.size === 1 && cur.has(n)) cur.clear()
    else {
      cur.clear()
      cur.add(n)
    }
    numAnchorIdx = idx
  }
  writeNumSelection(cur)
}
/** 「清空」= 全部：选中该工况现有的全部编号（提交时按显式编号写入，
 *  否则结果线/链式线会被自动配对或继承规则再算回单个编号，看不到「全部」） */
function clearEdgeNums() {
  writeNumSelection(new Set(frameCaseNums.value[editingEdgeFrameId.value] || []))
  numAnchorIdx = null
}

// —— 候选区拖拽框选：鼠标模式与画布框选一致（阈值 / window 监听 / 吞掉尾随 click） ——
const numMarquee = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
let numMarqueeStart: { x: number; y: number } | null = null
let numMarqueeLast: { x: number; y: number } | null = null
let numMarqueeGrid: HTMLElement | null = null
let numMarqueeGridAt: { left: number; top: number } | null = null
let numMarqueeScrollAt = { left: 0, top: 0 }
let numMarqueeAdditive = false
let numMarqueeSuppressClick = false
/** 框的显示坐标换算到 .num-grid 容器内（命中判定统一用视口坐标） */
const numMarqueeStyle = computed(() => {
  const m = numMarquee.value
  const g = numMarqueeGrid
  const at = numMarqueeGridAt
  if (!m || !g || !at) return {}
  return {
    left: `${m.x1 - at.left + g.scrollLeft}px`,
    top: `${m.y1 - at.top + g.scrollTop}px`,
    width: `${Math.max(0, m.x2 - m.x1)}px`,
    height: `${Math.max(0, m.y2 - m.y1)}px`,
  }
})
function applyNumMarquee(s: { x: number; y: number }, cx: number, cy: number) {
  const dx = cx - s.x
  const dy = cy - s.y
  if (!numMarquee.value && Math.abs(dx) < MARQUEE_MIN && Math.abs(dy) < MARQUEE_MIN) return
  numMarquee.value = {
    x1: Math.min(s.x, cx),
    y1: Math.min(s.y, cy),
    x2: Math.max(s.x, cx),
    y2: Math.max(s.y, cy),
  }
}
/** 收尾：摘掉监听并复位框选状态（提交 / 取消 / 面板关闭时兜底复用） */
function detachNumMarquee() {
  window.removeEventListener('mousemove', onNumMarqueeMove)
  window.removeEventListener('mouseup', onNumMarqueeUp)
  numMarqueeGrid?.removeEventListener('scroll', onNumMarqueeScroll)
  numMarquee.value = null
  numMarqueeStart = null
  numMarqueeLast = null
  numMarqueeGrid = null
  numMarqueeGridAt = null
}
function onNumGridMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  numMarqueeSuppressClick = false
  const g = e.currentTarget as HTMLElement
  const b = g.getBoundingClientRect()
  numMarqueeStart = { x: e.clientX, y: e.clientY }
  numMarqueeLast = { x: e.clientX, y: e.clientY }
  numMarqueeGrid = g
  numMarqueeGridAt = { left: b.left, top: b.top }
  numMarqueeScrollAt = { left: g.scrollLeft, top: g.scrollTop }
  numMarqueeAdditive = e.ctrlKey || e.metaKey
  window.addEventListener('mousemove', onNumMarqueeMove)
  window.addEventListener('mouseup', onNumMarqueeUp)
  g.addEventListener('scroll', onNumMarqueeScroll)
}
function onNumMarqueeMove(e: MouseEvent) {
  const s = numMarqueeStart
  if (!s) return
  numMarqueeLast = { x: e.clientX, y: e.clientY }
  applyNumMarquee(s, e.clientX, e.clientY)
}
/** 候选区滚动时把起点按滚动量反向平移，让它钉在同一批 chip 上 */
function onNumMarqueeScroll() {
  const g = numMarqueeGrid
  const s = numMarqueeStart
  if (!g || !s) return
  s.x -= g.scrollLeft - numMarqueeScrollAt.left
  s.y -= g.scrollTop - numMarqueeScrollAt.top
  numMarqueeScrollAt = { left: g.scrollLeft, top: g.scrollTop }
  if (numMarquee.value && numMarqueeLast) applyNumMarquee(s, numMarqueeLast.x, numMarqueeLast.y)
}
function onNumMarqueeUp() {
  const g = numMarqueeGrid
  const r = numMarquee.value
  const additive = numMarqueeAdditive
  detachNumMarquee()
  if (!r || !g) return
  // 框选结束后的那次 click 要吞掉，否则会再按「普通单击」把选中改回一个
  numMarqueeSuppressClick = true
  const picked: number[] = []
  g.querySelectorAll<HTMLElement>('.num-chip').forEach((el) => {
    const t = el.getBoundingClientRect()
    if (t.right < r.x1 || t.left > r.x2 || t.bottom < r.y1 || t.top > r.y2) return
    const n = Number(el.dataset.n)
    if (Number.isInteger(n) && n > 0) picked.push(n)
  })
  const set = additive ? new Set(parseEdgeNums(editingEdgeValue.value)) : new Set<number>()
  for (const n of picked) set.add(n)
  writeNumSelection(set)
  numAnchorIdx = null
}
/** 在候选区捕获阶段吞掉框选尾随的那次 click（避免触发 chip 的单击逻辑） */
function onNumGridClickCapture(e: MouseEvent) {
  if (!numMarqueeSuppressClick) return
  numMarqueeSuppressClick = false
  e.stopPropagation()
  e.preventDefault()
}

function editEdge(frameId: string, edgeId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  const e = f && f.edges[edgeId]
  if (!e) return
  // 点击序号徽标即高亮这条连线（与点击连线本体一致）：编号相同的分叉线很多，编辑时能看清改的是哪条
  selectedEdgeIds.value = [edgeId]
  editingEdgeId.value = edgeId
  editingEdgeFrameId.value = frameId
  // 回填「当前生效编号」而不是只回填显式编号：徽标显示 2 的线（自动排号 / 继承得到）双击进来
  // 也必须已经选中 2，否则一个 chip 都不亮，看不出它现在就是 2
  const eff = (edgePathCache.value[frameId] || []).find((p) => p.edgeId === edgeId)?.nums ?? storedEdgeNums(e)
  edgeSeedNums = [...eff]
  editingEdgeValue.value = eff.join(',')
  numAnchorIdx = null
}
function saveEdgeInline() {
  const f = frames.value.find((x) => x.id === editingEdgeFrameId.value)
  const e = f && f.edges[editingEdgeId.value]
  const nums = parseEdgeNums(editingEdgeValue.value.trim())
  // 打开后没改动就直接关闭：不要把自动排号 / 继承算出来的编号写死成显式编号
  if (f && e && nums.join(',') !== edgeSeedNums.join(',')) {
    if (edgeKind(e) === 'entry') {
      // 入口编号：支持多个；pair 存多个，seq 保留首个以兼容旧数据
      e.seq = nums.length ? nums[0] : 0
      e.pair = nums.length > 1 ? nums : []
    } else {
      // 出口编号：支持多个（逗号/空格分隔），留空 = 全部
      e.pair = nums
    }
    emitChange()
  }
  cancelEdgeEdit()
  scheduleRecompute()
}
function cancelEdgeEdit() {
  editingEdgeId.value = ''
  editingEdgeFrameId.value = ''
  editingEdgeValue.value = ''
  edgeSeedNums = []
  numAnchorIdx = null
  detachNumMarquee()
  numMarqueeSuppressClick = false
}
// 点击面板以外的地方自动保存编号（输入框已不用 blur 提交：面板内的多选 / 框选手势会让它失焦）
function onWindowMouseDown(e: MouseEvent) {
  if (!editingEdgeId.value) return
  const t = e.target as HTMLElement | null
  if (t && t.closest && (t.closest('.edge-input') || t.closest('.cfc-num-pop'))) return
  saveEdgeInline()
}

// ===== 节点就地编辑 =====
function openEditor(frameId: string, nodeId: string) {
  const f = frames.value.find((x) => x.id === frameId)
  const n = f && f.nodes[nodeId]
  if (!n) return
  editorFrameId.value = frameId
  editorNodeId.value = nodeId
  editingCard.value = JSON.parse(JSON.stringify(n))
  editorVisible.value = true
}
function saveEditor(card: Card) {
  const f = frames.value.find((x) => x.id === editorFrameId.value)
  if (f) {
    const isSeq = frameSequenceId(f) === editorNodeId.value
    // 主序列步骤变化前先记下旧步骤：被删步骤上的连线要就近改锚到相邻存活步骤
    const oldSteps = isSeq ? [...(f.nodes[editorNodeId.value]?.steps ?? [])] : []
    f.nodes[editorNodeId.value] = card
    if (isSeq) {
      const fixed = reanchorFrameSeqPorts(f, oldSteps)
      if (fixed) ElMessage.warning(`主序列步骤已变化，已自动调整 ${fixed} 条连线的接线口`)
    }
    emitChange()
  }
  editorVisible.value = false
  scheduleRecompute()
}

// ===== 连线校验（悬空连线 / 孤立卡片）=====
// 悬空与孤立的连线在画布上「画不出来」（端口定位失败直接跳过绘制），
// 也不参与用例展开，属于静默失效，必须显式提示，否则只能靠数用例数猜。
const EMPTY_DIAG: FrameDiagnostics = {
  issues: [],
  danglingEdgeIds: new Set<string>(),
  invalidNodeIds: new Set<string>(),
  ok: true,
}
const frameDiags = computed<Record<string, FrameDiagnostics>>(() => {
  const map: Record<string, FrameDiagnostics> = {}
  // 带上卡片库：标签里的 {{参数}} 要按「节点 params / 它引用的库卡片 params」解析
  const lookup = cardLookup.value
  // 只校验当前展示的工况（画布一次只挂载一个；全量校验是每次改动都要跑一遍的开销）
  for (const f of visibleFrames.value) map[f.id] = frameDiagnostics(f, lookup)
  return map
})
function diagOf(f: CaseFrame): FrameDiagnostics {
  return frameDiags.value[f.id] || EMPTY_DIAG
}
function danglingOf(f: CaseFrame): FrameIssue[] {
  return diagOf(f).issues.filter((it) => it.kind === 'dangling-edge')
}
function diagReasonOf(f: CaseFrame, nodeId: string): string {
  return diagOf(f)
    .issues.filter((it) => it.nodeId === nodeId)
    .map((it) => it.reason)
    .join('；')
}

// ===== 展开预览（含值资源 @list/@range 拆分）=====
/**
 * 工况 id → 展开后的用例行（画布自算的兜底版本）。
 * 渲染期一个工况会被引用 3 次（展开徽标 / 标题 / 行列表），而每次展开都要重建卡片库与值资源库的
 * 查找表、再做笛卡尔积拆分；直接写在渲染函数里会随渲染次数反复重算，大工况下每次交互上百毫秒。
 * 这里按依赖缓存：只在工况结构 / 卡片库 / 值资源库真正变化时重算，改工况名之类不会触发。
 * 外层编辑器（顶部「N 条用例」）算的是同一份结果，正常都会经 caseRowsMap 传进来，这里不会求值。
 */
const localCaseRowsMap = computed<Record<string, FrameCaseRow[]>>(() => {
  const map: Record<string, FrameCaseRow[]> = {}
  // 查找表只建一次（原来每个工况都重建一遍卡片库/值资源库索引）
  const libLookup = buildCardLookup(props.cardLibrary)
  const valLookup = buildValueLookup(props.valueLibrary)
  for (const f of frames.value) {
    map[f.id] = frameCaseRowsWithLookups(f, libLookup, valLookup)
  }
  return map
})
const EMPTY_CASE_ROWS: FrameCaseRow[] = []
function caseRows(f: CaseFrame): FrameCaseRow[] {
  const map = props.caseRowsMap || localCaseRowsMap.value
  return map[f.id] || EMPTY_CASE_ROWS
}

// ===== 用例名（双击可编辑）=====
/**
 * 用例名优先级：后端按当前图展开出的 case_id（即「这条用例生成出来叫什么」）>
 * 用户改过的名字 > 「用例N」。
 * 后端可用时以它为准，改名的去重结果（重名会被后端追加 _2）也能如实显示出来。
 */
function caseNameOf(f: CaseFrame, row: number): string {
  const auto = props.frameCaseIds?.[f.id]?.[row]
  if (auto) return auto
  const custom = f.caseNames?.[row]
  if (custom && custom.trim()) return custom.trim()
  return `用例${row + 1}`
}

const editingCaseName = ref({ frameId: '', row: -1, value: '' })
/** 输入框宽度按内容自适应（初始 4 个字符；14px = 左右内边距 6+6 + 左右边框 1+1） */
const caseNameInputWidth = computed(
  () => `calc(${Math.max(4, editingCaseName.value.value.length)}ch + 14px)`,
)

function startCaseNameEdit(f: CaseFrame, row: number) {
  editingCaseName.value = { frameId: f.id, row, value: caseNameOf(f, row) }
}

function cancelCaseNameEdit() {
  editingCaseName.value = { frameId: '', row: -1, value: '' }
}

/** 提交用例名：与默认名一致就清掉覆盖（不存冗余），非法标识符直接拒绝 */
function saveCaseName() {
  const { frameId, row, value } = editingCaseName.value
  if (row < 0) return
  cancelCaseNameEdit()
  const f = frames.value.find((x) => x.id === frameId)
  if (!f) return
  const name = value.trim()
  if (name && !/^[A-Za-z_]\w*$/.test(name)) {
    ElMessage.warning('用例名只能用字母 / 数字 / 下划线，且不能以数字开头（会作为生成的函数名）')
    return
  }
  const auto = props.frameCaseIds?.[f.id]?.[row] || ''
  const list = Array.isArray(f.caseNames) ? [...f.caseNames] : []
  while (list.length <= row) list.push('')
  list[row] = name && name !== auto ? name : ''
  f.caseNames = list
  emitChange()
}

// ===== 用例代码预览（右击用例 ID / 高亮态下右击编号徽标）=====
const casePreview = ref({
  visible: false,
  /** 本次可预览的用例（编号可能对应多条：徽标写了 1,2 或 All） */
  caseIds: [] as string[],
  active: '',
  code: '',
  loading: false,
  error: '',
})

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
const highlightedPreviewCode = computed(() => {
  if (!casePreview.value.code) return ''
  try {
    return hljs.highlight(casePreview.value.code, { language: 'c' }).value
  } catch {
    return escapeHtml(casePreview.value.code)
  }
})

/** 右击「用例展开」里的用例 ID：预览该行用例的代码 */
function openCasePreview(f: CaseFrame, row: number) {
  openCasePreviewRows(f, [row])
}

/**
 * 右击编号徽标：仅在高亮态（该连线属于这次高亮）下响应 —— 此时「这个编号是哪条用例」才有确定含义。
 * 徽标上的编号可能不止一个（如 `1,2`）；`All` 徽标的 nums 为空，按本工况全部用例处理。
 */
function onBadgeContextMenu(f: CaseFrame, p: EdgePath) {
  if (!isEdgeHighlighted(p, f.id)) return
  const caseNums = frameCaseNums.value[f.id] || []
  const nums = p.nums.length ? p.nums : caseNums
  const rows: number[] = []
  caseNums.forEach((n, i) => {
    if (nums.includes(n)) rows.push(i)
  })
  if (!rows.length) return
  openCasePreviewRows(f, rows)
}

async function openCasePreviewRows(f: CaseFrame, rows: number[]) {
  const ids = rows.map((ri) => caseNameOf(f, ri)).filter(Boolean)
  if (!ids.length) return
  casePreview.value = { visible: true, caseIds: ids, active: ids[0], code: '', loading: true, error: '' }
  await loadPreviewCode(ids[0])
}

/** 取某条用例的代码（由外层编辑器按需展开 TestCase.can 后抽取） */
async function loadPreviewCode(caseId: string) {
  casePreview.value.active = caseId
  casePreview.value.code = ''
  casePreview.value.loading = true
  casePreview.value.error = ''
  try {
    const code = (await props.loadCaseCode?.(caseId)) || ''
    if (code) casePreview.value.code = code
    else casePreview.value.error = `未找到用例 ${caseId} 的代码（该用例名可能还没在后端展开中生效）`
  } catch (e: any) {
    casePreview.value.error = `获取用例代码失败：${e?.message || e}`
  } finally {
    casePreview.value.loading = false
  }
}

function copyCaseCode() {
  if (!casePreview.value.code) return
  navigator.clipboard
    .writeText(casePreview.value.code)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'))
}

onMounted(() => {
  scheduleRecompute()
  if (typeof ResizeObserver !== 'undefined') {
    bodyResizeObserver = new ResizeObserver(() => scheduleRecompute())
  }
  window.addEventListener('resize', scheduleRecompute)
  window.addEventListener('dragstart', onWindowDragStart)
  window.addEventListener('dragend', onWindowDragEnd)
  window.addEventListener('drop', onWindowDragEnd)
  window.addEventListener('mousedown', onWindowMouseDown, true)
  nextTick(syncObserveBodies)
  scrollToFrame(props.selectedFrameId || '')
})
onUnmounted(() => {
  if (frameNameTimer) clearTimeout(frameNameTimer)
  frameNameTimer = null
  window.removeEventListener('resize', scheduleRecompute)
  window.removeEventListener('dragstart', onWindowDragStart)
  window.removeEventListener('dragend', onWindowDragEnd)
  window.removeEventListener('drop', onWindowDragEnd)
  window.removeEventListener('mousedown', onWindowMouseDown, true)
  window.removeEventListener('mousemove', onLinkMove)
  window.removeEventListener('mouseup', onLinkUp)
  bodyResizeObserver?.disconnect()
  bodyResizeObserver = null
})
</script>

<style scoped>
.cfc {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: #f0f2f5;
}
.cfc-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
/* ===== 工况标签：画布一次只挂载一个工况 ===== */
.cfc-frame-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
  min-height: 0;
}
.cfc-frame-tab-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.cfc-frame-tab {
  flex: 0 0 auto;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 10px;
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 5px;
  cursor: pointer;
}
.cfc-frame-tab:hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: var(--el-color-primary);
}
.cfc-frame-tab.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.cfc-frame-nav {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  line-height: 1;
  padding: 0;
  font-size: 11px;
  color: #606266;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 5px;
  cursor: pointer;
}
.cfc-frame-nav:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}
.cfc-frame-nav:not(:disabled):hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: var(--el-color-primary);
}
.cfc-frame-pos {
  flex: 0 0 auto;
  font-size: 12px;
  color: #909399;
}
.cfc-help {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  background: #fff;
  color: #909399;
  cursor: pointer;
}
.cfc-help:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
/* 画布操作说明（popover 内容）：原来铺在工具栏上的一长串提示，收进 ? 里 */
.cfc-hint {
  font-size: 12px;
  line-height: 1.7;
  color: #606266;
}
.cfc-hint .hint-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.cfc-hint .hint-row + .hint-row {
  margin-top: 6px;
}
.cfc-hint b {
  flex-shrink: 0;
  width: 30px;
  font-weight: 600;
  color: #303133;
}
.cfc-spacer {
  flex: 1;
}
.cfc-canvas {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 12px;
  min-height: 0;
}
.cfc-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #909399;
}

.frame {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
  min-width: 640px;
  /* 泳道增多时工况框随内容变宽（而不是让泳道溢出框外），由 .cfc-canvas 横向滚动查看 */
  width: max-content;
  max-width: none;
}
.frame-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #e4e7ed;
}
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #ecf5ff;
  color: var(--el-color-primary);
  font-weight: 600;
  white-space: nowrap;
}
.badge.green {
  background: #f0f9eb;
  color: #67c23a;
}
.badge.warn {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #f5dab1;
  cursor: help;
}
.diag-tip {
  max-width: 460px;
  line-height: 1.7;
}
.diag-tip-title {
  font-weight: 700;
  margin-bottom: 4px;
}
.diag-tip-row {
  font-size: 12px;
  opacity: 0.92;
}
.frame-name {
  flex: 1;
  /* 工况框随泳道变宽后，名称输入框不再无限拉伸 */
  max-width: 480px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  padding: 4px 6px;
  border-radius: 6px;
  min-width: 120px;
}
.frame-name:hover,
.frame-name:focus {
  border-color: #e4e7ed;
  background: #fafafa;
  outline: none;
}
.frame-actions {
  display: flex;
  gap: 6px;
}
.icon-btn {
  border: none;
  background: transparent;
  color: #909399;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 6px;
}
.icon-btn:hover {
  background: #f0f2f5;
  color: #303133;
}
.icon-btn.danger:hover {
  color: #f56c6c;
}

.frame-body {
  display: flex;
  align-items: stretch;
  position: relative;
  min-height: 220px;
  gap: 80px;
  padding: 12px 0;
  overflow: visible;
}
/* 只有一个泳道时居中显示 */
.frame-body.single-lane {
  justify-content: center;
}
.edge-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.edge-svg path {
  fill: none;
}
/* 命中层：在卡片下面，只负责点击/双击，不画可见线（可见线由 .edge-top 画在卡片上面）。
   描边设成透明仍然可以被 pointer-events: stroke 命中。 */
.edge-hit {
  z-index: 5;
}
.edge-hit path.hit {
  stroke: transparent;
  stroke-width: 3;
  pointer-events: stroke;
  cursor: pointer;
}
/* 拖拽中：连线不能吃掉拖放事件。连线是 SVG 描边（pointer-events: stroke），
   而 .edge-hit 的 z-index(5) 高于泳道，落点正好压在连线描边上时 dragover 会落到 SVG 上，
   上层 .frame-body 没有监听、不会被 preventDefault，浏览器就不发 drop —— 表现为「松手没反应」。 */
.edge-svg.svg-dragging path.hit {
  pointer-events: none;
}
/* 可见层：压在卡片上面（.node 是 6、序号徽标是 9），连线跨过卡片时不会被卡片挡住 */
.edge-top {
  z-index: 7;
}
.edge-top path.line {
  stroke: var(--el-color-primary);
  stroke-width: 3;
}
/* 单击连线后的高亮态：加粗 + 换色 + 发光，双击即删除 */
.edge-top path.line.edge-selected {
  stroke: #e6a23c;
  stroke-width: 5;
  filter: drop-shadow(0 0 4px rgba(230, 162, 60, 0.9));
}
.edge-svg path.temp {
  stroke: var(--el-color-primary);
  stroke-width: 2;
  stroke-dasharray: 5, 3;
}
/* 框选矩形：视口坐标固定定位（不随画布滚动偏移），不接收鼠标事件 */
.cfc-marquee {
  position: fixed;
  z-index: 3000;
  pointer-events: none;
  border: 1px dashed var(--el-color-primary);
  background: rgba(64, 158, 255, 0.12);
  border-radius: 3px;
}
.edge-label {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 9;
}
.label-badge {
  display: inline-block;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 12px;
  cursor: pointer;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}
.label-badge:hover {
  background: #337ecc;
}
/* 连线高亮时，所属序号徽标同步高亮（含同工况内相同序号的所有连线） */
.label-badge.badge-selected,
.label-badge.badge-selected:hover {
  background: #e6a23c;
  transform: scale(1.18);
  box-shadow: 0 0 0 2px rgba(230, 162, 60, 0.35);
}
/* 正在编辑编号的那条线：徽标描边高亮，与面板里 .edge-input 的描边同色 */
.label-badge.badge-editing,
.label-badge.badge-editing:hover {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(230, 162, 60, 0.55);
}
/* ===== 编号选择器面板（teleport 到 body，根节点样式见文件末尾的非 scoped 块） ===== */
.num-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.num-pop-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.num-pop-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.num-pop-kind {
  font-size: 12px;
  color: var(--el-color-primary);
}
.num-pop-cur {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
/* 候选编号区：position: relative 供框选矩形挂靠；chips 多时可滚动 */
.num-grid {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 180px;
  overflow: auto;
  padding: 2px;
}
.num-chip {
  min-width: 24px;
  padding: 2px 6px;
  font-size: 12px;
  line-height: 1.4;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.num-chip:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.num-chip.active,
.num-chip.active:hover {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.num-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
/* 候选区内的框选矩形：与画布框选（.cfc-marquee）同一套选择框语言 */
.num-marquee {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  border: 1px dashed var(--el-color-primary);
  background: rgba(64, 158, 255, 0.12);
  border-radius: 3px;
}
.num-pop-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-height: 16px;
}
.num-pop-foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.num-pop-foot .el-button + .el-button {
  margin-left: 0;
}
.edge-input {
  /* 宽度由内联样式 edgeInputWidth 按内容长度自适应（最小 9 个字符），这里不再固定宽度；
     编号多（如「全部」= 一长串）时用 max-width 夹住，不要让输入框把面板撑破 */
  max-width: 100%;
  box-sizing: border-box;
  padding: 2px 6px;
  font-size: 12px;
  /* 与连线高亮态（.edge-top path.line.edge-selected / .label-badge.badge-selected）同色，
     让「正在编辑哪条连线」一眼对上 */
  border: 1px solid #e6a23c;
  border-radius: 6px;
  text-align: center;
  outline: none;
  box-shadow: 0 0 0 2px rgba(230, 162, 60, 0.35);
}

.lane {
  flex: 1;
  /* 仅首帧兜底：实际宽度由 laneStyle() 内联样式决定
     （minWidth=LANE_MIN_W，自适应上限=LANE_AUTO_MAX_W，手动宽度不设上限） */
  min-width: 160px;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  overflow: visible;
  position: relative;
}
.lane-resizer {
  position: absolute;
  top: 0;
  right: -5px;
  width: 10px;
  height: 100%;
  cursor: col-resize;
  z-index: 4;
  border-radius: 4px;
}
.lane-resizer:hover {
  background: rgba(64, 158, 255, 0.35);
}
.lane.drop-hover {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -4px;
  background: rgba(64, 158, 255, 0.08);
}
/* 拖动时泳道内的空态占位提示更醒目，明确「可放入这里」 */
.lane-body .empty-drop-hint {
  text-align: center;
  padding: 20px 0;
  color: #c0c4cc;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  transition: all 0.15s;
}
.lane.drop-hover .empty-drop-hint {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.08);
}
.lane-main {
  flex: 1.6;
  background: #f6f9ff;
  border-top: 2px solid var(--el-color-primary);
}
.lane-other {
  background: #fafbfc;
  border-top: 2px solid #909399;
}
.lane-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
  border-radius: 8px 8px 0 0;
  cursor: grab;
}
.lane-head:active {
  cursor: grabbing;
}
.lane-grip {
  font-size: 12px;
  line-height: 1;
  color: #c0c4cc;
  flex-shrink: 0;
  user-select: none;
}
.lane-grip:hover {
  color: #909399;
}
.lane-drop-before {
  box-shadow: inset 3px 0 0 0 var(--el-color-primary);
}
.lane-drop-after {
  box-shadow: inset -3px 0 0 0 var(--el-color-primary);
}
.lt {
  font-size: 12px;
  font-weight: 700;
  color: #909399;
  letter-spacing: 1px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lr {
  font-size: 11px;
  color: #909399;
}
.lane-body {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
/* 拖拽时「新建泳道」停靠区：外面套一个零宽锚点，用绝对定位盖在泳道之间的空隙上。
   关键：它必须**完全不影响布局**——否则拖拽一开始整排泳道就被挤着位移，被拖的卡片会从鼠标下
   跑掉、落点算到泳道之间的空隙上（落在 .frame-body 上没有任何处理，表现为「松手没反应」）。
   锚点是 flex 项，插入后自己会多占一个 .frame-body 的 gap，所以左右负边距必须把这个 gap
   全额抵消：负边距 40px × 2 = 80px = .frame-body 的 gap。改 gap 时要同步改这里。 */
.gap-anchor {
  position: relative;
  width: 0;
  flex: 0 0 0;
  margin: 0 -40px;
}
.gap-zone {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -13px;
  width: 26px;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: copy;
  border-radius: 6px;
  transition: background 0.15s;
}
.gz-tip {
  writing-mode: vertical-lr;
  font-size: 13px;
  color: #c0c4cc;
  font-weight: 700;
}
.gap-zone:hover {
  background: rgba(64, 158, 255, 0.08);
}
.gap-zone.drop-hover {
  background: rgba(64, 158, 255, 0.15);
}
.gap-zone.drop-hover .gz-tip {
  color: var(--el-color-primary);
}

.node {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-left: 4px solid #ccc;
  border-radius: 6px;
  padding: 7px 22px 7px 20px;
  margin-bottom: 6px;
  cursor: default;
  user-select: none;
  position: relative;
  /* 要高于连线的「命中层」.edge-hit(z-index:5)：它的描边是可点区域（pointer-events: stroke），
     卡片不抬高层级时，落点/按点只要压在连线描边上就会被 SVG 吃掉，表现为「按在卡片上也拖不动」
     「松手没反应」。抬到 6 之后卡片优先命中，空隙处的连线仍可点删。
     连线另有「可见层」.edge-top(z-index:7) 画在卡片上面，所以跨过卡片的连线依然看得见。 */
  z-index: 6;
}
.node:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
/* 选中态：用于 Ctrl+C / Ctrl+V / Ctrl+拖拽批量复制 */
.node.node-selected {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}
.lane.lane-selected {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -3px;
}
.node.n-inject {
  border-left-color: #e6a23c;
  background: rgba(230, 162, 60, 0.06);
}
.node.n-recover {
  border-left-color: #f56c6c;
  background: rgba(245, 108, 108, 0.06);
}
.node.n-result {
  border-left-color: #67c23a;
  background: rgba(103, 194, 58, 0.06);
}
.node.n-sequence {
  border-left-color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.06);
}
.node.n-other {
  border-left-color: #909399;
}
/* 校验异常卡片：孤立（无连线）或未接入主序列，不会出现在任何用例中 */
.node.node-invalid {
  border-color: #e6a23c;
  border-left-color: #e6a23c;
  background: repeating-linear-gradient(
    45deg,
    rgba(230, 162, 60, 0.12),
    rgba(230, 162, 60, 0.12) 6px,
    rgba(230, 162, 60, 0.02) 6px,
    rgba(230, 162, 60, 0.02) 12px
  );
}
.warn-mark {
  color: #e6a23c;
  font-weight: 700;
  margin-right: 3px;
  cursor: help;
}
/* 拖拽排序停靠占位框：在落点处画一个与卡片等宽的虚线占位框（替代原来的一条指示线），
   直观提示卡片松手后会插到这个位置；框整个落在卡片上/下方的间隙里，不遮住卡片本身 */
.node.node-drop-before::before,
.node.node-drop-after::after {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  height: 40px;
  border-radius: 6px;
  border: 2px dashed var(--el-color-primary);
  background: rgba(64, 158, 255, 0.1);
  box-shadow: 0 0 10px rgba(64, 158, 255, 0.35);
  z-index: 8;
  pointer-events: none;
}
.node.node-drop-before::before {
  bottom: calc(100% + 3px);
}
.node.node-drop-after::after {
  top: calc(100% + 3px);
}
.node.node-drop-before,
.node.node-drop-after {
  border-color: var(--el-color-primary);
}
/* 正在被拖拽的卡片轻量化，突出可停靠的目标 */
.node.node-dragging {
  opacity: 0.4;
  box-shadow: none;
}
.node-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ref-mark {
  color: var(--el-color-primary);
  margin-right: 2px;
  font-size: 12px;
}
.aux-mark {
  color: #909399;
  margin-right: 2px;
  font-size: 12px;
}
.node-sub {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 拖拽手柄：唯一可拖拽的地方，避免在卡片文字/接线口上按下时拖不动 */
.node-grip {
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 13px;
  text-align: center;
  font-size: 12px;
  line-height: 1;
  color: #c0c4cc;
  border-radius: 3px;
  cursor: grab;
  z-index: 8;
}
.node-grip:hover {
  color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.12);
}
.node-grip:active {
  cursor: grabbing;
}
.node-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  font-size: 11px;
  color: #909399;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.45;
  z-index: 7;
}
.node-del:hover {
  opacity: 1;
  color: #fff;
  background: #f56c6c;
}
.mini {
  font-size: 11px;
  color: #909399;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 4px;
}
.mini:hover {
  background: #f0f2f5;
  color: #303133;
}

.seq-card {
  background: #fff;
  border: 1px solid var(--el-color-primary);
  border-radius: 8px;
  overflow: visible;
  position: relative;
}
.seq-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #e4e7ed;
  background: #ecf5ff;
}
.sn {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sc {
  font-size: 11px;
  color: #909399;
}
.seq-card-body {
  padding: 6px 0;
  display: flex;
  flex-direction: column;
}
.seq-step {
  position: relative;
  padding: 7px 22px;
  margin: 0 6px;
  border-radius: 6px;
  cursor: default;
}
.seq-step:hover {
  background: #f0f7ff;
}
.seq-slot {
  position: relative;
  height: 14px;
  margin: 0 6px;
}
.step-name {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-sub {
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.port {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #c0c4cc;
  z-index: 6;
  cursor: crosshair;
}
.port:hover {
  transform: translateY(-50%) scale(1.3);
}
.port-in {
  left: -9px;
  border-color: #67c23a;
}
.port-out {
  right: -9px;
  border-color: var(--el-color-primary);
}
.port-in:hover {
  background: #67c23a;
  border-color: #67c23a;
}
.port-out:hover {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.port-selected {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.35);
  transform: translateY(-50%) scale(1.25);
}

.frame-foot {
  padding: 10px 14px;
  border-top: 1px solid #e4e7ed;
  background: #fafbfc;
  border-radius: 0 0 10px 10px;
}
.f-title {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 6px;
}
.foot-warn {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid #f5dab1;
  border-radius: 6px;
  background: #fdf6ec;
}
.foot-warn-title {
  font-size: 12px;
  font-weight: 600;
  color: #b88230;
  margin-bottom: 4px;
}
.foot-warn-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
  padding: 2px 0;
}
.foot-warn-item .fw-label {
  color: #b88230;
  font-weight: 600;
}
.foot-warn-item .fw-reason {
  color: #909399;
}
.case-row {
  font-size: 12px;
  padding: 3px 0;
  color: #303133;
  display: flex;
  align-items: baseline;
  min-width: 0;
}
.case-row .seq {
  color: var(--el-color-primary);
  font-weight: 600;
  flex-shrink: 0;
  cursor: text;
  /* 用例名可能比「用例N」长很多（后端 case_id / 自定义名），别把右侧链路挤没 */
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 用户改过名字的行：与默认名区分开 */
.case-row .seq.seq-custom {
  color: #b88230;
}
.case-row .case-name-input {
  flex-shrink: 0;
  height: 20px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #e6a23c;
  border: 1px solid #e6a23c;
  border-radius: 3px;
  outline: none;
  box-shadow: 0 0 0 2px rgba(230, 162, 60, 0.35);
  background: #fff;
}
.case-row .chain {
  color: #909399;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.case-row .variant {
  color: #e6a23c;
  font-weight: 600;
}
/* 高亮连线所属的用例行：与连线高亮同色（#e6a23c），让「编号 ↔ 用例」一眼对上 */
.case-row.case-row-hl {
  background: rgba(230, 162, 60, 0.12);
  border-radius: 3px;
  box-shadow: inset 2px 0 0 #e6a23c;
}
.case-row.case-row-hl .seq {
  color: #e6a23c;
}

/* ---------- 用例代码预览 ---------- */
.cp-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.cp-label {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  line-height: 24px;
}
.cp-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.cp-tab {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  background: #fff;
  color: #606266;
  cursor: pointer;
}
.cp-tab:hover {
  border-color: #e6a23c;
  color: #e6a23c;
}
.cp-tab.active {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.12);
  color: #e6a23c;
}
.cp-hint {
  font-size: 13px;
  color: #909399;
  padding: 24px 0;
  text-align: center;
}
.cp-hint.cp-error {
  color: #f56c6c;
}
.cp-code {
  max-height: 56vh;
  overflow: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.cp-pre {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  background: #282c34;
  color: #abb2bf;
}
.cp-pre code {
  background: transparent;
}
</style>

<!-- 编号选择器的浮层根节点由 el-popover teleport 到 body，拿不到 scoped 属性，
     所以这里只放「根节点」相关规则；面板内部元素仍在上面 scoped 块里 -->
<style>
.cfc-num-pop {
  padding: 8px;
}
</style>
