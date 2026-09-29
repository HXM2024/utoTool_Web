<template>
  <div class="file-uploader">
    <el-upload
      ref="uploadRef"
      class="upload-dragger"
      drag
      :accept="accept"
      :auto-upload="false"
      :show-file-list="false"
      :on-change="onFileChange"
    >
      <el-icon class="upload-icon"><UploadFilled /></el-icon>
      <div class="upload-text">
        将文件拖拽到此处，或<em>点击上传</em>
      </div>
      <template #tip>
        <div class="upload-tip">支持 {{ accept }} 格式文件</div>
      </template>
    </el-upload>

    <!-- 上传进度 -->
    <div v-if="uploading" class="upload-progress">
      <div class="progress-info">
        <span class="progress-name">{{ fileName }}</span>
        <span class="progress-status">{{ progressText }}</span>
      </div>
      <el-progress :percentage="percentage" :status="progressStatus" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import client from '@/api/client'

const props = withDefaults(defineProps<{
  accept?: string
  moduleName: string
}>(), {
  accept: '.xlsx,.xls',
  moduleName: '',
})

const emit = defineEmits<{
  (e: 'upload-success', data: any): void
  (e: 'upload-error', error: any): void
}>()

const uploadRef = ref()
const uploading = ref(false)
const percentage = ref(0)
const fileName = ref('')
const progressStatus = ref<'success' | 'warning' | 'exception' | undefined>(undefined)

const progressText = ref('上传中...')

function onFileChange(file: UploadFile) {
  if (!file.raw) return
  uploadFile(file.raw)
}

async function uploadFile(file: File) {
  uploading.value = true
  percentage.value = 0
  fileName.value = file.name
  progressStatus.value = undefined
  progressText.value = '上传中...'

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res: any = await client.post(`/${props.moduleName}/parse`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total) {
          percentage.value = Math.round((e.loaded / e.total) * 100)
        }
      },
    })

    percentage.value = 100
    progressStatus.value = 'success'
    progressText.value = '上传成功'
    ElMessage.success('文件解析成功')
    emit('upload-success', res)
  } catch (err) {
    progressStatus.value = 'exception'
    progressText.value = '上传失败'
    emit('upload-error', err)
  } finally {
    setTimeout(() => {
      uploading.value = false
    }, 1500)
    uploadRef.value?.clearFiles()
  }
}
</script>

<style scoped lang="scss">
.file-uploader {
  width: 100%;
}

.upload-dragger {
  width: 100%;

  :deep(.el-upload-dragger) {
    width: 100%;
    padding: 40px 20px;
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-base);
    background: var(--bg-card);
    transition: var(--transition-base);

    &:hover {
      border-color: var(--color-primary);
    }
  }
}

.upload-icon {
  font-size: 48px;
  color: var(--color-primary);
  margin-bottom: 12px;
}

.upload-text {
  color: var(--text-regular);
  font-size: 14px;

  em {
    color: var(--color-primary);
    font-style: normal;
    font-weight: 600;
  }
}

.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.upload-progress {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-card);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;

  .progress-name {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .progress-status {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
</style>
