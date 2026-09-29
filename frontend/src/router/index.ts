import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/boot',
  },
  {
    path: '/boot',
    name: 'Boot',
    component: () => import('@/views/BootView.vue'),
    meta: { title: 'Boot', label: 'Boot' },
  },
  {
    path: '/uds',
    name: 'UDS',
    component: () => import('@/views/UDSView.vue'),
    meta: { title: 'UDS', label: 'UDS' },
  },
  {
    path: '/function',
    name: 'Function',
    component: () => import('@/views/FunctionView.vue'),
    meta: { title: 'Function', label: 'Function' },
  },
  {
    path: '/can',
    name: 'CAN',
    component: () => import('@/views/CANView.vue'),
    meta: { title: 'CAN', label: 'CAN' },
  },
  {
    path: '/create-canoe',
    name: 'CreateCANoe',
    component: () => import('@/views/CreateCanoeView.vue'),
    meta: { title: 'Creat CANoe', label: 'Creat CANoe' },
  },
  {
    path: '/sanbao',
    name: 'Sanbao',
    component: () => import('@/views/SanbaoView.vue'),
    meta: { title: '三包', label: '三包' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
